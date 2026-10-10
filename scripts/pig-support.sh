#!/bin/sh
# Installs, removes, or reports on the PiG extension that makes PiG report its
# state to Herdr. Works on its own, as the plugin's build step, and as the
# command behind the plugin actions.
#
# usage: pig-support.sh <install|uninstall|status|refresh>
set -eu

# CDPATH= stops a user CDPATH from changing where cd goes.
# shellcheck disable=SC1007
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
SOURCE_FILE="$ROOT/extensions/herdr-agent-state.ts"
INSTALL_NAME="herdr-pig-agent-state.ts"
MARKER="HERDR_PIG_EXTENSION_VERSION="

# Mirrors PiG's own lookup: PIG_CODING_AGENT_DIR, then PIG_HOME/agent, then ~/.pig/agent.
agent_dir() {
    if [ -n "${PIG_CODING_AGENT_DIR:-}" ]; then
        printf '%s\n' "$PIG_CODING_AGENT_DIR"
    elif [ -n "${PIG_HOME:-}" ]; then
        printf '%s\n' "$PIG_HOME/agent"
    else
        printf '%s\n' "$HOME/.pig/agent"
    fi
}

# Show the result in Herdr when run as a plugin action; stay quiet otherwise.
notify() {
    if [ "${HERDR_ENV:-}" = "1" ] && [ -n "${HERDR_BIN_PATH:-}" ]; then
        "$HERDR_BIN_PATH" notification show "$1" --body "$2" >/dev/null 2>&1 || true
    fi
}

fail() {
    echo "herdr-pig: $1" >&2
    notify "PiG support" "$1"
    exit 1
}

managed() {
    [ -f "$1" ] && grep -q "$MARKER" "$1"
}

# With PIG_USE_PI_DIRS=1, PiG loads Pi's extension directory, so Pi would load
# this file too and report itself to Herdr as PiG.
check_not_shared_with_pi() {
    if [ "${PIG_USE_PI_DIRS:-}" = "1" ]; then
        fail "PIG_USE_PI_DIRS=1 shares Pi's extension directory; unset it before installing"
    fi
}

command=${1:-}
target_dir="$(agent_dir)/extensions"
target="$target_dir/$INSTALL_NAME"

case "$command" in
install)
    check_not_shared_with_pi
    [ -f "$SOURCE_FILE" ] || fail "extension source missing at $SOURCE_FILE"
    [ -d "$(agent_dir)" ] || fail "PiG agent directory not found at $(agent_dir); run pig once first"
    if [ -e "$target" ] && ! managed "$target"; then
        fail "$target exists and is not managed by herdr-pig; move it away first"
    fi
    mkdir -p "$target_dir"
    cp "$SOURCE_FILE" "$target"
    echo "installed PiG support to $target"
    echo "restart pig, or run /reload in a running session"
    notify "PiG support installed" "Restart pig or run /reload in a running session."
    ;;
uninstall)
    if managed "$target"; then
        rm "$target"
        echo "removed PiG support from $target"
        notify "PiG support removed" "Restart pig or run /reload in a running session."
    elif [ -e "$target" ]; then
        fail "$target is not managed by herdr-pig; not removing it"
    else
        echo "PiG support is not installed at $target"
        notify "PiG support" "Not installed."
    fi
    ;;
status)
    if ! managed "$target"; then
        echo "not installed ($target)"
        notify "PiG support" "Not installed."
    elif cmp -s "$SOURCE_FILE" "$target"; then
        echo "installed and current ($target)"
        notify "PiG support" "Installed and current."
    else
        echo "installed but outdated ($target)"
        notify "PiG support" "Installed but outdated. Run Install to update it."
    fi
    ;;
refresh)
    # Startup hook: keep an existing install in step with this plugin's copy.
    # It never installs on its own, so nothing is added without the user asking.
    if managed "$target" && [ -f "$SOURCE_FILE" ] && ! cmp -s "$SOURCE_FILE" "$target"; then
        cp "$SOURCE_FILE" "$target"
        echo "refreshed PiG support at $target"
    fi
    ;;
*)
    echo "usage: $0 <install|uninstall|status|refresh>" >&2
    exit 2
    ;;
esac
