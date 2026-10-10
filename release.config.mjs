// Releases run on every merge to main. semantic-release reads the conventional
// commits since the last tag, bumps the version in both files, writes the
// changelog, commits the bump, tags vX.Y.Z and creates the GitHub release.
//
// Bumps: `!` or a BREAKING CHANGE footer -> major, feat -> minor,
// fix and perf -> patch. Other types do not release.
export default {
  branches: ["main"],
  plugins: [
    "@semantic-release/commit-analyzer",
    "@semantic-release/release-notes-generator",
    "@semantic-release/changelog",
    // private: true in package.json, so this only bumps the version and never publishes.
    ["@semantic-release/npm", { npmPublish: false }],
    [
      "@semantic-release/exec",
      {
        prepareCmd: "sed -i.bak -e 's/^version = \"[^\"]*\"/version = \"${nextRelease.version}\"/' herdr-plugin.toml && rm herdr-plugin.toml.bak",
      },
    ],
    [
      "@semantic-release/git",
      {
        assets: ["package.json", "herdr-plugin.toml", "CHANGELOG.md"],
        message: "chore(release): ${nextRelease.version} [skip ci]\n\n${nextRelease.notes}",
      },
    ],
    "@semantic-release/github",
  ],
};
