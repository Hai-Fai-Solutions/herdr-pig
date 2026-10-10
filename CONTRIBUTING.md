# Contributing

Thanks for helping with herdr-pig. This guide covers how to set up, what a
change has to pass, and how releases happen. For how the code fits together,
read [ARCHITECTURE.md](ARCHITECTURE.md) first.

## Setup

You need [Bun](https://bun.sh) 1.4 or later, and Git. To try a change for real
you also need [Herdr](https://herdr.dev) 0.9.0 or later and
[PiG](https://github.com/MichaelKinsy/PiG).

```bash
git clone https://github.com/Hai-Fai-Solutions/herdr-pig
cd herdr-pig
bun install
```

## Checks

Run these before you open a pull request. CI runs the same ones.

```bash
bun test             # extension and installer tests
bun run lint         # Biome
bun run typecheck    # tsc
```

CI also runs `shellcheck` on `scripts/pig-support.sh` and PSScriptAnalyzer on
`scripts/pig-support.ps1`.

The tests run on Linux, macOS and Windows in CI. The PowerShell cases are
skipped locally when `pwsh` is not installed, so a change to
`pig-support.ps1` is only fully checked once CI has run.

## Trying a change

Link your checkout into Herdr and install the extension from it:

```bash
herdr plugin link /path/to/herdr-pig
herdr plugin action invoke herdr-pig.install     # install-windows on Windows
```

Linking does not run the manifest's build step, so the install action is
needed. After that, start `pig` in a Herdr pane, or run `/reload` in a running
session, and check the pane:

```bash
herdr agent list     # the pane shows "agent": "pig" and its state
```

To load the extension for one run without installing it:

```bash
pig -e /path/to/herdr-pig
```

## Rules for changes

- **Keep the extension to one file with no dependencies.** The installer
  copies that single file into PiG, and nothing else comes with it.
- **Change both installer scripts together.** `pig-support.sh` and
  `pig-support.ps1` must keep the same commands, messages and exit codes. The
  tests run the same cases against both.
- **Give every manifest entry a form for each platform.** A new action needs a
  shell entry and a `-windows` entry. A test fails if one is missing.
- **Keep `pig-support.ps1` working under Windows PowerShell 5.1.**
- **Add a test for a behaviour change.**

## Commits and pull requests

Use [Conventional Commits](https://www.conventionalcommits.org): a type, an
optional scope, and a short description.

```text
feat: report blocked state for permission prompts
fix(installer): honour PIG_HOME on Windows
docs: explain the resume command
```

Pull requests are squash-merged, so **the pull request title becomes the
commit on `main`**. CI checks that the title is a conventional commit. Commits
inside the pull request are not checked.

A pull request can merge once:

- every check passes: tests on three platforms, lint, type check, shell lint,
  dependency review, the title check and CodeQL;
- it has one approving review from someone other than its author.

`main` is protected. Changes reach it only through a pull request.

## Releases

Releases are automatic. Every merge to `main` runs
[semantic-release](https://github.com/semantic-release/semantic-release), which
decides the version from the commit type:

| Commit | Release |
| --- | --- |
| `feat` | Minor |
| `fix`, `perf` | Patch |
| A `!` after the type, or a `BREAKING CHANGE:` footer | Major |
| `docs`, `ci`, `chore`, `test`, `refactor`, `build`, `style` | None |

It then bumps the version in `package.json` and `herdr-plugin.toml`, updates
`CHANGELOG.md`, commits `chore(release): X.Y.Z [skip ci]`, tags `vX.Y.Z` and
creates the GitHub release. Do not edit the version or the changelog by hand.

Pick the type for what users get, not for the size of the diff. A one-line
change that fixes a bug is a `fix`. A large change to CI is still `ci`.

## Dependencies and security

- Dependabot opens weekly pull requests for Bun packages and GitHub Actions.
- A weekly job runs `bun audit`. An advisory that has no fix can be ignored in
  `.github/workflows/audit.yml`, with a comment saying why and when to remove
  the ignore.
- Actions are pinned to commit SHAs. Leave the version comment next to the
  SHA, because Dependabot updates both.

Please report a security problem privately through GitHub's
[security advisories](https://github.com/Hai-Fai-Solutions/herdr-pig/security/advisories/new)
and not in a public issue.
