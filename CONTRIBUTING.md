# Contributing

Open a pull request against `gh-pages`. Do not run `deploy.sh` from a contributor clone; that script commits and pushes.

## Secret scanning (required)

This repo uses [Betterleaks](https://github.com/betterleaks/betterleaks) v2 so tokens and other secrets are not committed.

1. Install Betterleaks v2 from the [official GitHub releases](https://github.com/betterleaks/betterleaks/releases). Verify the release checksum, and the Sigstore signature when one is published. Put the `betterleaks` binary on your `PATH` (`~/.local/bin` or `/usr/local/bin`).
2. In this clone, point Git at the tracked hooks (once per clone; this setting is local, not committed):

   ```bash
   git config core.hooksPath githooks
   ```

   That value applies to every worktree of the same clone.

3. The hook `githooks/pre-commit` scans the staged diff with:

   ```bash
   git diff --cached --no-ext-diff --no-textconv --no-color --src-prefix=a/ --dst-prefix=b/ | betterleaks stdin --git-diff --redact
   ```

   Findings fail the commit and are printed redacted. If `betterleaks` is missing, the hook fails with an install message.

Do not use `git commit --no-verify` or otherwise skip this hook.

People who already use the [pre-commit](https://pre-commit.com) framework can also install `.pre-commit-config.yaml`, which runs the same official Betterleaks hook. The tracked `githooks/pre-commit` path is still required so commits are scanned without that framework.

CI runs `.github/workflows/secret-scan.yml` on pull requests, pushes to every branch (including `gh-pages`), and `workflow_dispatch`. It installs a pinned, checksum-verified Betterleaks and scans new commits in detection-only mode (`--redact`, no `--validate`).
