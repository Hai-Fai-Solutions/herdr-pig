# herdr-pig

Makes [PiG](https://github.com/MichaelKinsy/PiG) a first-class agent in
[Herdr](https://herdr.dev) without changing Herdr.

With it installed, a `pig` session running in a Herdr pane shows up as `pig`
with its `idle`, `working` or `blocked` state in the sidebar and in
`herdr agent list`. Herdr can notify you when it finishes, and it reopens the
same PiG session after a Herdr server restart.

## How it works

It has two parts:

- **A PiG extension** (`extensions/herdr-agent-state.ts`). It listens to PiG's
  lifecycle events and reports to Herdr over the socket Herdr exposes to every
  pane. This follows Herdr's
  [Add Herdr support to your agent](https://herdr.dev/docs/add-herdr-support/)
  contract: it reports state with `pane.report_agent`, attaches the command
  `pig --session <session>` so Herdr can restore the session, and releases the
  pane when PiG quits.
- **A Herdr plugin** (`herdr-plugin.toml`). It adds actions that install,
  remove and check the extension, and a startup hook that keeps an installed
  copy up to date.

The extension does nothing when PiG runs outside Herdr, and nothing in PiG's
print, JSON or RPC modes.

## Requirements

- Herdr 0.9.0 or later. Restoring sessions after a restart needs 0.9.2 or
  later; older versions show state only.
- PiG, with Node.js available for its TypeScript extension host.
- Linux, macOS or Windows. Windows is a preview, as it is in PiG itself: the
  installer is tested there, but the extension has not been run against Herdr
  on a Windows machine.

## Install

Install the plugin from GitHub:

```bash
herdr plugin install Hai-Fai-Solutions/herdr-pig
```

Restart `pig`, or run `/reload` in a running session.

Installing the plugin also installs the extension into PiG. Run `pig` once
before installing, so its agent directory exists; otherwise the install stops
and says so.

To install a specific release, name its tag:

```bash
herdr plugin install Hai-Fai-Solutions/herdr-pig --ref v0.2.0
```

To work on the plugin itself, link a local checkout instead of installing it.
Linking does not install the extension, so run the install action afterwards:

```bash
herdr plugin link /path/to/herdr-pig
herdr plugin action invoke herdr-pig.install
```

On Windows the actions are `herdr-pig.install-windows`,
`herdr-pig.uninstall-windows` and `herdr-pig.status-windows`.

The install copies the extension to
`~/.pig/agent/extensions/herdr-pig-agent-state.ts`. It honours
`PIG_CODING_AGENT_DIR` and `PIG_HOME`.

You can also install without the plugin:

```bash
sh scripts/pig-support.sh install      # or: uninstall, status
```

```powershell
powershell -ExecutionPolicy Bypass -File scripts/pig-support.ps1 install
```

Or load it for one run, without installing anything:

```bash
pig -e /path/to/herdr-pig
```

## Check that it works

Start `pig` in a Herdr pane and send it a prompt:

```bash
herdr agent list          # the pane shows "agent": "pig" and its state
```

## Update

Herdr has no update command. Install the plugin again to get the latest
version:

```bash
herdr plugin install Hai-Fai-Solutions/herdr-pig
```

That replaces the plugin and installs the new extension into PiG. Restart
`pig`, or run `/reload`, to load it.

## Uninstall

```bash
herdr plugin action invoke herdr-pig.uninstall
herdr plugin uninstall herdr-pig      # or: herdr plugin unlink herdr-pig
```

Run the uninstall action first. Herdr has no uninstall hook, so removing the
plugin alone leaves the extension in PiG's agent directory.

## License

MIT. See [LICENSE](LICENSE).

## Limits

- PiG does not appear in Herdr's settings/integrations pane. That pane lists
  integrations Herdr installs itself; PiG reports for itself instead.
- `blocked` is reported only when another PiG extension emits `herdr:blocked`
  on the `pi.events` bus with `{ active, label }`. PiG's own permission prompts
  are not detected yet.
- Installing is refused when `PIG_USE_PI_DIRS=1`, because Pi would then load
  the extension too and report itself as PiG.

## Development

[mise](https://mise.jdx.dev) installs the tools and runs the tasks:

```bash
mise install                               # Bun, Node and the other pinned tools
mise run hooks:install                     # git hooks; run once per checkout
mise run check                             # lint, type check and test
mise tasks                                 # list every task
pig install . --validate-only --json       # check that PiG loads the extension
```

See [CONTRIBUTING.md](CONTRIBUTING.md) for the checks, commit rules and release
process, and [ARCHITECTURE.md](ARCHITECTURE.md) for how the parts fit together.
