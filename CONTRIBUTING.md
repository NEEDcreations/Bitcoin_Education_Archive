# Contributing

Thanks for looking at Bitcoin Education Archive. The repository is public for inspection. The [LICENSE](LICENSE) is proprietary, so a pull request is not a license to reuse the code, the design, or the Nacho branding elsewhere.

Read [SECURITY.md](SECURITY.md) before you test anything that touches accounts, payments, or production data.

## Branch and pull request conventions

The default branch is `gh-pages`. That branch is production: a push publishes the live site and the staging copy. The `dev` branch publishes the Firebase Hosting dev site. Do not push to either branch unless you are releasing.

1. Branch from an up-to-date `gh-pages`.
2. Use a short name such as `fix/leaderboard-sort`, `feat/quest-copy`, or `chore/rules-test`.
3. Open a pull request into `gh-pages`. Fill in the pull request template.
4. Keep the change focused. A bug fix and a drive-by cleanup belong in separate requests.
5. `.github/CODEOWNERS` requests review from @NEEDcreations.

Do not run `deploy.sh` or `deploy-dev.sh`. Those scripts are for a maintainer machine. `deploy.sh` commits, pushes `gh-pages`, and can push mirrors.

Do not commit secrets, `.env` files, or anything under `functions/private-bank/` other than the README that is already there. Question banks and API tokens stay off the pull request.

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

A small `.betterleaksignore` allowlists only public client config (the live and staging Firebase web API keys, the public reCAPTCHA v3 site key, and the public Web Push VAPID key), documented false positives, and emulator-only test fixture passwords. Never add a real server secret to that file.

## Code style

There is no checked-in ESLint or Prettier config. Match the file you are editing, and leave unrelated lines alone.

- **Browser code** is plain script, often an IIFE. Older client files use `var` and `function`. Follow the file you are in.
- **Cloud Functions** are CommonJS on Node.js 22. Modules live in `functions/src/`, start with `'use strict'`, and are required from `functions/index.js`.
- **Bundled sources.** If you change a file that `build.sh` concatenates, run `bash build.sh` and commit the regenerated `bundle.js` and `bundle.min.js`. The script needs `terser` on your PATH. The file list is in the README.
- **Lazy-loaded files** (for example `quests.js`, `scholar.js`, `beats.js`, `pvp.js`) are not part of the bundle. If `index.html` loads the file with a `?v=` query, update that value in the same pull request so browsers fetch the new file.
- **Rules.** Behavior that must hold in production belongs in `firestore.rules` or in a Cloud Function, with a test that tries the illegal write.

## Testing

Install dependencies once:

```bash
npm ci --prefix functions
npm ci --prefix tests/rules
```

Function suites load `functions/index.js` from `functions/node_modules`. Rules suites load `@firebase/rules-unit-testing` from `tests/rules/node_modules`. `node tests/run-all.js` runs `npm ci` in `tests/rules` for you. It does not install `functions/`.

| Goal | Command |
| --- | --- |
| Parse check of the main client files | `node tests/test-syntax.js` |
| One suite | `node tests/test-<name>.js` or `node tests/rules/<name>.js` |
| Everything registered | `node tests/run-all.js` |

A new suite needs to be added to the `TESTS` array in `tests/run-all.js` or the full run will skip it. Tests are plain Node scripts and use `assert`. They should pass with no network access to the live Firebase project.

Run the suites that cover your change before you open the pull request. Say in the request which commands you ran.

## Emulator tests

Rules tests and several function tests start the Firebase emulator when the emulator host variables are missing. You need:

- Node.js 22
- A JDK on `PATH` (the emulator will not boot without Java)
- `firebase-tools`, which the suites invoke with `npx --yes firebase-tools`
- `npm ci` in `functions/` for suites that load Cloud Functions
- `npm ci` in `tests/rules/` for rules suites

Examples:

```bash
node tests/rules/profile-allowlist.js
node tests/test-pvp-rules.js
node tests/test-totp-emulator.js
node tests/test-raid-boss-emulator.js
node tests/test-scholar-exam-emulator.js
```

Each of those re-runs itself under `firebase emulators:exec` when `FIRESTORE_EMULATOR_HOST` is unset. The TOTP suite also requires the Auth emulator. The child process sets `CI=true` so the emulator does not prompt.

Project ids in these commands start with `demo-` (`demo-btc`, `demo-profile-allow`, `demo-pvp-rules`, and others). Firebase keeps those on the emulator. They are not the live project.

`firebase.json` sets Auth to port 9099 and Firestore to `127.0.0.1:8085`. Some suites pass a different Firestore port when they start the emulator, so two suites can run one after another without a leftover process. If a port is already taken, stop the old emulator and run the suite again.

The emulator is the right place to try rules, XP, payouts, and account changes. Do not point a test at a real player account or at production Firestore.
