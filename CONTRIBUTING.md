# Contributing

Thanks for helping with herdr-pig. This guide covers how to set up, what a
change has to pass, and how releases happen. For how the code fits together,
read [ARCHITECTURE.md](ARCHITECTURE.md) first.

## Setup

You need [mise](https://mise.jdx.dev) and Git. mise installs everything else at
the versions in `mise.toml`: Bun, Node, pre-commit and shellcheck. To try a
change for real you also need [Herdr](https://herdr.dev) 0.9.0 or later and
[PiG](https://github.com/MichaelKinsy/PiG).

```bash
git clone https://github.com/Hai-Fai-Solutions/herdr-pig
cd herdr-pig
mise install
mise run hooks:install
```

## Tasks

mise is the task runner, locally and in CI. Every CI job runs one of these
tasks, so a task that passes locally passes in CI.

| Task | Does |
| --- | --- |
| `mise run check` | Lint, type check, test and check licences |
| `mise run lint` | Biome |
| `mise run lint:shell` | Syntax check and shellcheck for `pig-support.sh` |
| `mise run lint:powershell` | PSScriptAnalyzer for `pig-support.ps1`; needs `pwsh` |
| `mise run typecheck` | tsc |
| `mise run test` | Extension and installer tests |
| `mise run hooks` | Every git hook, on every file |
| `mise run audit` | Known vulnerabilities in dependencies |
| `mise run licenses` | Dependency licences against the allow-list |

Tasks install the dependencies first, so there is no separate install step.
Add a new check as a task in `mise.toml` and call that task from the workflow.

The tests run on Linux, macOS and Windows in CI. The PowerShell cases are
skipped locally when `pwsh` is not installed, so a change to
`pig-support.ps1` is only fully checked once CI has run.

## Git hooks

`mise run hooks:install` sets up [pre-commit](https://pre-commit.com) hooks.
They download their own tools.

| When | What runs |
| --- | --- |
| Before a commit | gitleaks for secrets, codespell and Vale for spelling and prose, Biome, the type check, shellcheck, actionlint for the workflows, and file hygiene checks |
| On the commit message | A conventional-commit check |
| Before a push | The tests |

A hook also refuses a commit made directly on `main`.

Vale reads `.vale.ini`. Add a project word it does not know to
`.vale/styles/config/vocabularies/herdr-pig/accept.txt`.

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
  the pre-commit hooks, dependency review, the title check and CodeQL;
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
- A weekly job runs `mise run audit`. An advisory that has no fix can be
  ignored in that task in `mise.toml`, with a comment saying why and when to
  remove the ignore.
- Actions are pinned to commit SHAs. Leave the version comment next to the
  SHA, because Dependabot updates both.

## Licence

The project is Apache-2.0. The extension is based on Herdr's Pi integration,
so keep the attribution header in `extensions/herdr-agent-state.ts` and the
`NOTICE` file.

Dependencies must use a licence on the allow-list, which holds permissive
licences only. `mise run licenses` checks the whole tree, and CI checks every
dependency a pull request adds. The list is in the `licenses` task in
`mise.toml` and in `.github/workflows/ci.yml`; change both together.

These checks read what packages declare. They cannot tell where copied source
came from, so say in the pull request if you bring in code from another
project.

Please report a security problem privately through GitHub's
[security advisories](https://github.com/Hai-Fai-Solutions/herdr-pig/security/advisories/new)
and not in a public issue.
