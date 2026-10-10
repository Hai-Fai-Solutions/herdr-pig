# Agent guide

herdr-pig makes [PiG](https://github.com/MichaelKinsy/PiG) report its state to
[Herdr](https://herdr.dev). It has two parts: an extension that PiG loads, and
installer scripts that Herdr runs. Read [ARCHITECTURE.md](ARCHITECTURE.md)
before changing either, and [CONTRIBUTING.md](CONTRIBUTING.md) for the full
contributor rules. This file is the short version for coding agents.

## Setup

[mise](https://mise.jdx.dev) installs the tools and runs every task. Do both of
these once in a fresh checkout:

```bash
mise install              # Bun, Node, pre-commit, shellcheck
mise run hooks:install    # git hooks; they are not active until this runs
```

Install the hooks before the first commit. Without them, a commit skips the
secret scan, the prose checks and the commit message check, and CI then fails
on the pull request.

## Commands

Use mise tasks, not the underlying tools. CI runs the same tasks.

| Task | Does |
| --- | --- |
| `mise run check` | Lint, type check, test and check licences |
| `mise run hooks` | Every git hook, on every file |
| `mise run test` | Tests only |
| `mise run lint` | Biome |
| `mise run lint:shell` | shellcheck for `pig-support.sh` |
| `mise run typecheck` | tsc |

`mise tasks` lists the rest. Add a new check as a task in `mise.toml`, then
call that task from the workflow and the hook.

## Before you say a change is done

1. Run `mise run check` and `mise run hooks`. Both must pass.
2. Say which checks you could not run. The PowerShell tests only run where
   `pwsh` is installed, so a change to `scripts/pig-support.ps1` is not checked
   until CI has run on Windows.

## Rules for code

- **The extension stays one file with no dependencies.** The installer copies
  `extensions/herdr-agent-state.ts` alone into PiG. Do not add imports beyond
  Node's built-in modules.
- **Keep the marker line** `HERDR_PIG_EXTENSION_VERSION=` in the extension. The
  installer only overwrites or removes a file that has it.
- **Change both installer scripts together.** `pig-support.sh` and
  `pig-support.ps1` keep the same commands, messages and exit codes.
- **Keep `pig-support.ps1` compatible with Windows PowerShell 5.1.** Do not use
  `Get-FileHash` or syntax from PowerShell 7.
- **Every manifest entry needs a form for each platform**: a shell entry, and a
  PowerShell entry with a `-windows` id.
- **Keep the attribution header** in the extension, and the `NOTICE` file. The
  extension is based on Herdr's Pi integration, and Apache-2.0 requires both.
- **Say where copied code comes from.** Do not paste source from another
  project without naming it and its licence in the pull request.
- **Add a test for a behaviour change.**

## Rules for git

- **Never commit on `main`.** Work on a branch and open a pull request. `main`
  is protected, and a hook refuses the commit.
- **Use Conventional Commits** for commit messages and for the pull request
  title. Pull requests are squash-merged, so the title becomes the commit on
  `main` and decides the release: `feat` is a minor release, `fix` and `perf`
  are patches, and `docs`, `ci`, `chore`, `test`, `build` and `refactor`
  release nothing.
- **Do not skip hooks** with `--no-verify`. Fix what the hook reports.
- **Do not merge pull requests, and do not push to `main`.** A person approves
  and merges.

## Do not edit by hand

- The `version` in `package.json` and `herdr-plugin.toml`, and `CHANGELOG.md`.
  The release workflow writes them.
- `bun.lock`, except through `bun add`, `bun remove` or `bun update`.
- The tool versions in the workflows. They come from `mise.toml`.

## Keep out of the user's environment

- Do not run the installer scripts against the real home directory. They write
  into `~/.pig`. The tests use a temporary home; do the same.
- Do not run `herdr plugin install`, `link` or `uninstall`. They change the
  user's Herdr setup.

## Other conventions

- **Docs:** Vale and codespell check Markdown. Add a project word Vale does not
  know to `.vale/styles/config/vocabularies/herdr-pig/accept.txt`.
- **Workflows:** pin every action to a commit SHA, with the version in a
  comment after it. Dependabot updates both.
- **Dependencies:** `mise run audit` lists known vulnerabilities. An advisory
  with no fix can be ignored in that task, with a comment saying why.
