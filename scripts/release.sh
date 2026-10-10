#!/bin/sh
# Works out the next version from the conventional commits since the last v* tag,
# and with `apply` bumps the version files, commits the bump and tags it.
#
# usage: release.sh <next|apply>
#   next   prints the next version without a leading v, or nothing when no release is due
#   apply  does the same bump, commits it as chore(release) and tags vX.Y.Z; prints the version
#
# Bumps follow the conventional commits since the last tag:
#   a `!` after the type or a BREAKING CHANGE footer  -> major
#   feat                                              -> minor
#   fix or perf                                       -> patch
set -eu

# CDPATH= stops a user CDPATH from changing where cd goes.
# shellcheck disable=SC1007
ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)

last_tag() {
    git -C "$ROOT" describe --tags --abbrev=0 --match 'v[0-9]*' 2>/dev/null || true
}

# Prints major, minor or patch for the commits in $1, or nothing when none of them call for a release.
bump_level() {
    range=$1
    if git -C "$ROOT" log --format='%s%n%b' "$range" | grep -Eq '^(BREAKING CHANGE:|[a-z]+(\([^)]*\))?!:)'; then
        echo major
    elif git -C "$ROOT" log --format='%s' "$range" | grep -Eq '^feat(\([^)]*\))?:'; then
        echo minor
    elif git -C "$ROOT" log --format='%s' "$range" | grep -Eq '^(fix|perf)(\([^)]*\))?:'; then
        echo patch
    fi
}

next_version() {
    last=$(last_tag)
    level=$(bump_level "${last:+$last..}HEAD")
    [ -n "$level" ] || return 0

    current=${last#v}
    if [ -z "$current" ]; then
        current=$(sed -n 's/^  "version": "\([^"]*\)".*/\1/p' "$ROOT/package.json")
    fi

    major=${current%%.*}
    rest=${current#*.}
    minor=${rest%%.*}
    patch=${rest#*.}

    case $level in
        major) major=$((major + 1)); minor=0; patch=0 ;;
        minor) minor=$((minor + 1)); patch=0 ;;
        patch) patch=$((patch + 1)) ;;
    esac

    printf '%s.%s.%s\n' "$major" "$minor" "$patch"
}

apply() {
    version=$(next_version)
    [ -n "$version" ] || return 0

    sed -i.bak "s/^  \"version\": \"[^\"]*\"/  \"version\": \"$version\"/" "$ROOT/package.json"
    sed -i.bak "s/^version = \"[^\"]*\"/version = \"$version\"/" "$ROOT/herdr-plugin.toml"
    rm -f "$ROOT/package.json.bak" "$ROOT/herdr-plugin.toml.bak"

    git -C "$ROOT" add package.json herdr-plugin.toml
    git -C "$ROOT" commit -q -m "chore(release): v$version"
    git -C "$ROOT" tag -a "v$version" -m "v$version"

    printf '%s\n' "$version"
}

case ${1:-} in
    next) next_version ;;
    apply) apply ;;
    *)
        echo "usage: release.sh <next|apply>" >&2
        exit 2
        ;;
esac
