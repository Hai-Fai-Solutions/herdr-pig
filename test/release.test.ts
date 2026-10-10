import { afterEach, beforeEach, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const ROOT = resolve(import.meta.dir, "..");
const SCRIPT = join(ROOT, "scripts", "release.sh");

let repo: string;

beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "herdr-pig-release-"));
  mkdirSync(join(repo, "scripts"));
  copyFileSync(SCRIPT, join(repo, "scripts", "release.sh"));
  writeFileSync(join(repo, "package.json"), '{\n  "name": "herdr-pig",\n  "version": "0.1.0"\n}\n');
  writeFileSync(join(repo, "herdr-plugin.toml"), 'id = "herdr-pig"\nversion = "0.1.0"\nmin_herdr_version = "0.9.0"\n');
  git("init", "-q");
  commit("chore: initial");
  git("tag", "-a", "v0.1.0", "-m", "v0.1.0");
});

afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

// A clean environment keeps the user's real git identity and config out of the tests.
function env() {
  return {
    PATH: process.env.PATH ?? "",
    HOME: repo,
    GIT_AUTHOR_NAME: "test",
    GIT_AUTHOR_EMAIL: "test@example.com",
    GIT_COMMITTER_NAME: "test",
    GIT_COMMITTER_EMAIL: "test@example.com",
  };
}

function git(...args: string[]) {
  const result = spawnSync("git", args, { cwd: repo, encoding: "utf8", env: env() });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout;
}

function commit(message: string) {
  writeFileSync(join(repo, `file-${Math.random()}.txt`), message);
  git("add", ".");
  git("commit", "-q", "-m", message);
}

function release(command: "next" | "apply") {
  const result = spawnSync("sh", [join(repo, "scripts", "release.sh"), command], {
    cwd: repo,
    encoding: "utf8",
    env: env(),
  });
  if (result.status !== 0) throw new Error(result.stderr);
  return result.stdout.trim();
}

test("no release is due when only non-release commits follow the tag", () => {
  commit("docs: explain setup");
  commit("chore: bump dependencies");
  commit("ci: add workflow");
  expect(release("next")).toBe("");
});

test("a fix makes a patch release", () => {
  commit("fix: restore resume command");
  expect(release("next")).toBe("0.1.1");
});

test("a feat makes a minor release, even alongside fixes", () => {
  commit("fix: small thing");
  commit("feat(pi): report blocked state");
  expect(release("next")).toBe("0.2.0");
});

test("a breaking change makes a major release", () => {
  commit("feat!: drop herdr 0.8 support");
  expect(release("next")).toBe("1.0.0");
});

test("a BREAKING CHANGE footer makes a major release", () => {
  commit("refactor: rename state\n\nBREAKING CHANGE: state field renamed");
  expect(release("next")).toBe("1.0.0");
});

test("apply bumps both version files, commits and tags", () => {
  commit("feat: add lint");
  expect(release("apply")).toBe("0.2.0");

  expect(readFileSync(join(repo, "package.json"), "utf8")).toContain('"version": "0.2.0"');
  expect(readFileSync(join(repo, "herdr-plugin.toml"), "utf8")).toContain('version = "0.2.0"');
  expect(readFileSync(join(repo, "herdr-plugin.toml"), "utf8")).toContain('min_herdr_version = "0.9.0"');
  expect(git("log", "-1", "--format=%s").trim()).toBe("chore(release): v0.2.0");
  expect(git("describe", "--tags", "--abbrev=0").trim()).toBe("v0.2.0");
  expect(release("next")).toBe("");
});

test("apply does nothing when no release is due", () => {
  commit("docs: nothing to release");
  expect(release("apply")).toBe("");
  expect(git("describe", "--tags", "--abbrev=0").trim()).toBe("v0.1.0");
});
