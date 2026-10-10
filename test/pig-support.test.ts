import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SCRIPT = join(ROOT, "scripts", "pig-support.sh");
const SOURCE = join(ROOT, "extensions", "herdr-agent-state.ts");
const INSTALL_NAME = "herdr-pig-agent-state.ts";

let home: string;

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "herdr-pig-home-"));
});

afterEach(() => {
  rmSync(home, { recursive: true, force: true });
});

// A clean environment keeps the user's real PiG and Herdr settings out of the tests.
function run(command: string, env: Record<string, string> = {}) {
  const result = spawnSync("/bin/sh", [SCRIPT, command], {
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", HOME: home, ...env },
  });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

function installedPath(agentDir = join(home, ".pig", "agent")) {
  return join(agentDir, "extensions", INSTALL_NAME);
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

// Herdr runs the manifest's build commands from the plugin checkout during
// `herdr plugin install`, without any of the runtime plugin environment.
test("the plugin's build step installs the extension", () => {
  mkdirSync(join(home, ".pig", "agent"), { recursive: true });
  const manifest = Bun.TOML.parse(readFileSync(join(ROOT, "herdr-plugin.toml"), "utf8")) as {
    build: { command: string[] }[];
  };
  expect(manifest.build).toHaveLength(1);

  const [program, ...args] = manifest.build[0].command;
  const result = spawnSync(program, args, {
    cwd: ROOT,
    encoding: "utf8",
    env: { PATH: process.env.PATH ?? "", HOME: home },
  });

  expect(result.status).toBe(0);
  expect(readFileSync(installedPath(), "utf8")).toBe(readFileSync(SOURCE, "utf8"));
});
