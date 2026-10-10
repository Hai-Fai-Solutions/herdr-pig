import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SOURCE = join(ROOT, "extensions", "herdr-agent-state.ts");
const INSTALL_NAME = "herdr-pig-agent-state.ts";
const WINDOWS = process.platform === "win32";
const PLATFORM = WINDOWS ? "windows" : process.platform === "darwin" ? "macos" : "linux";

// Windows always has powershell. Elsewhere the PowerShell script is tested under
// pwsh when that is installed, which it is on the CI runners.
const POWERSHELL = WINDOWS ? "powershell" : Bun.which("pwsh");
const POWERSHELL_ARGS = ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File"];

const scripts: { name: string; argv: string[] }[] = [];
if (!WINDOWS) {
  scripts.push({ name: "pig-support.sh", argv: ["/bin/sh", join(ROOT, "scripts", "pig-support.sh")] });
}
if (POWERSHELL) {
  scripts.push({
    name: "pig-support.ps1",
    argv: [POWERSHELL, ...POWERSHELL_ARGS, join(ROOT, "scripts", "pig-support.ps1")],
  });
}

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "herdr-pig-home-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

// A clean environment keeps the user's real PiG and Herdr settings out of the tests.
// Windows needs a few system variables before PowerShell will start at all.
function cleanEnv(extra: Record<string, string> = {}) {
  const env: Record<string, string> = { PATH: process.env.PATH ?? "", HOME: home, USERPROFILE: home };
  for (const key of ["SystemRoot", "windir", "PATHEXT", "ComSpec", "TEMP", "TMP"]) {
    const value = process.env[key];
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...extra };
}

function installedPath(agentDir = join(home, ".pig", "agent")) {
  return join(agentDir, "extensions", INSTALL_NAME);
}

describe.each(scripts)("$name", ({ argv }) => {
  function run(command: string, env: Record<string, string> = {}) {
    const result = spawnSync(argv[0], [...argv.slice(1), command], { encoding: "utf8", env: cleanEnv(env) });
    return { status: result.status, stdout: result.stdout, stderr: result.stderr };
  }

  test("install copies the extension into PiG's agent directory", () => {
    mkdirSync(join(home, ".pig", "agent"), { recursive: true });

    const result = run("install");

    expect(result.status).toBe(0);
    expect(readFileSync(installedPath(), "utf8")).toBe(readFileSync(SOURCE, "utf8"));
    expect(run("status").stdout).toContain("installed and current");
  });

  test("install refuses when PiG has never been set up", () => {
    const result = run("install");

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PiG agent directory not found");
    expect(existsSync(installedPath())).toBe(false);
  });

  test("install follows PIG_CODING_AGENT_DIR and PIG_HOME", () => {
    const custom = join(home, "custom-agent");
    const pigHome = join(home, "pig-home");
    mkdirSync(custom, { recursive: true });
    mkdirSync(join(pigHome, "agent"), { recursive: true });

    expect(run("install", { PIG_HOME: pigHome }).status).toBe(0);
    expect(existsSync(installedPath(join(pigHome, "agent")))).toBe(true);

    expect(run("install", { PIG_HOME: pigHome, PIG_CODING_AGENT_DIR: custom }).status).toBe(0);
    expect(existsSync(installedPath(custom))).toBe(true);
  });

  test("install refuses a directory shared with Pi", () => {
    mkdirSync(join(home, ".pig", "agent"), { recursive: true });

    const result = run("install", { PIG_USE_PI_DIRS: "1" });

    expect(result.status).toBe(1);
    expect(result.stderr).toContain("PIG_USE_PI_DIRS=1");
    expect(existsSync(installedPath())).toBe(false);
  });

  test("install and uninstall leave a file they do not manage alone", () => {
    const target = installedPath();
    mkdirSync(join(home, ".pig", "agent", "extensions"), { recursive: true });
    writeFileSync(target, "// someone else's extension\n");

    expect(run("install").status).toBe(1);
    expect(run("uninstall").status).toBe(1);
    expect(readFileSync(target, "utf8")).toBe("// someone else's extension\n");
  });

  test("uninstall removes a managed install and reports when nothing is installed", () => {
    mkdirSync(join(home, ".pig", "agent"), { recursive: true });
    run("install");

    expect(run("uninstall").status).toBe(0);
    expect(existsSync(installedPath())).toBe(false);

    const again = run("uninstall");
    expect(again.status).toBe(0);
    expect(again.stdout).toContain("not installed");
  });

  test("refresh updates an outdated install but never installs on its own", () => {
    mkdirSync(join(home, ".pig", "agent"), { recursive: true });

    expect(run("refresh").status).toBe(0);
    expect(existsSync(installedPath())).toBe(false);

    run("install");
    writeFileSync(installedPath(), "// HERDR_PIG_EXTENSION_VERSION=0\n// old copy\n");
    expect(run("status").stdout).toContain("outdated");

    expect(run("refresh").status).toBe(0);
    expect(readFileSync(installedPath(), "utf8")).toBe(readFileSync(SOURCE, "utf8"));
  });
});

// Herdr runs the manifest's build commands from the plugin checkout during
// `herdr plugin install`, without any of the runtime plugin environment.
test("the plugin's build step for this platform installs the extension", () => {
  mkdirSync(join(home, ".pig", "agent"), { recursive: true });
  const manifest = Bun.TOML.parse(readFileSync(join(ROOT, "herdr-plugin.toml"), "utf8")) as {
    build: { command: string[]; platforms: string[] }[];
  };
  const steps = manifest.build.filter((step) => step.platforms.includes(PLATFORM));
  expect(steps).toHaveLength(1);

  const [program, ...args] = steps[0].command;
  const result = spawnSync(program, args, { cwd: ROOT, encoding: "utf8", env: cleanEnv() });

  expect(result.status).toBe(0);
  expect(readFileSync(installedPath(), "utf8")).toBe(readFileSync(SOURCE, "utf8"));
});

// Every entry needs a form for each platform the manifest claims to support.
test("every manifest entry covers all supported platforms", () => {
  const manifest = Bun.TOML.parse(readFileSync(join(ROOT, "herdr-plugin.toml"), "utf8")) as {
    platforms: string[];
    build: { platforms: string[] }[];
    startup: { platforms: string[] }[];
    actions: { id: string; platforms: string[] }[];
  };
  const covered = (entries: { platforms: string[] }[]) => entries.flatMap((entry) => entry.platforms).sort();
  const supported = [...manifest.platforms].sort();

  expect(covered(manifest.build)).toEqual(supported);
  expect(covered(manifest.startup)).toEqual(supported);
  for (const action of ["install", "uninstall", "status"]) {
    const forms = manifest.actions.filter((entry) => entry.id === action || entry.id === `${action}-windows`);
    expect(covered(forms)).toEqual(supported);
  }
});
