# Bitcoin Education Archive

Bitcoin Education Archive (Bitcoin Quest) is a gamified Bitcoin education app at [bitcoineducation.quest](https://bitcoineducation.quest). People work through curated lessons, earn in-app XP, and can turn XP into small bitcoin payouts. Lightning tips use wallets the player controls.

The source is public so it can be inspected. Use of the code, the design, and the Nacho branding is governed by the proprietary [LICENSE](LICENSE) held by 603BTC LLC. Questions about the license go to info.603btc@gmail.com.

Security reports go through [SECURITY.md](SECURITY.md). Contribution steps are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Architecture

The browser loads a static site. Firebase is the backend. Cloudflare Workers sit on the public hostnames for routing, headers, and a few edge tasks.

```text
Browser
  ├─ static site (HTML, CSS, JS in this repo)
  │    GitHub Pages publishes production from gh-pages
  │    Cloudflare Pages publishes the staging copy
  ├─ Firebase Auth, Firestore, Storage
  ├─ Cloud Functions (functions/, Node.js 22)
  └─ Cloudflare Workers (workers/)
```

- **Static site.** `index.html` and the JavaScript next to it are the app. `build.sh` concatenates the core client files into `bundle.js`. Larger features (quests, scholar, beats, PvP, and others) stay as separate files and load on demand.
- **Firebase.** Auth, Cloud Firestore, Storage, and Cloud Functions. Rules live in `firestore.rules` and `storage.rules`. Function code is CommonJS under `functions/`, with modules in `functions/src/` and the entry in `functions/index.js`. Hosting targets in `firebase.json` are `prod` and `dev`.
- **Cloudflare Workers.** Each directory under `workers/` is its own Worker, deployed with Wrangler (not by the GitHub workflows below):
  - `seo-router` — bot-friendly routes and response headers
  - `nacho-search` — search answers
  - `chat-bridge` — global chat bridge
  - `rss-feed` — RSS feed
  - `embed-proxy` and `noderunners-proxy` — embed proxies
  - `pleb-underground` — Timechain TV sync

The client config in the repo points a local static server at the live Firebase project. Treat a local preview as production. Use the emulators and the demo project ids in `tests/` for anything that writes data. Do not test against real player accounts.

## Local setup

Install Node.js 22 (the Functions runtime and the dev workflow both use 22) and a JDK. The Auth and Firestore emulators do not start without Java. There is no root `package.json`.

```bash
git clone https://github.com/NEEDcreations/Bitcoin_Education_Archive.git
cd Bitcoin_Education_Archive
git config core.hooksPath githooks
npm ci --prefix functions
npm ci --prefix tests/rules
node tests/test-syntax.js
```

The `core.hooksPath` line is required so the tracked pre-commit hook can block secrets before they are committed. Install Betterleaks v2 and the rest of the hook setup as described in [CONTRIBUTING.md](CONTRIBUTING.md). Do not use `git commit --no-verify`.

`node tests/run-all.js` installs the rules-test dependencies again, then runs every suite in `tests/run-all.js`. Suites that need Firebase start the emulators themselves when `FIRESTORE_EMULATOR_HOST` (and, for auth, `FIREBASE_AUTH_EMULATOR_HOST`) is unset. They use project ids that start with `demo-`, which stay on the emulator.

`firebase.json` pins the Auth emulator to port 9099 and Firestore to `127.0.0.1:8085`. A few suites pick another Firestore port when they launch the emulator.

To click through the UI, serve the repo root with any static file server. That preview still uses the live Firebase project, so do not sign in with a real account while experimenting.

`bash build.sh` rebuilds `bundle.js` after you edit a bundled source. It expects `terser` on your PATH. If minification fails, the script keeps an unminified bundle. Files `build.sh` concatenates:

`channel_index.js`, `utils.js`, `raid-hp.js`, `badges.catalog.js`, `badge-search.js`, `badges.js`, `tickets.js`, `engagement.js`, `nacho-live.js`, `nacho.js`, `nacho-engage.js`, `nacho-closet.js`, `forum.js`, `marketplace.js`, `messaging.js`, `features.js`, `mobile-ux.js`, `bitcoin-dashboard.js`, `usermap.js`, `app.js`, `topic-discussions.js`, `ux-patches.js`, `quest-defer.js`.

## Project layout

| Path | What it is |
| --- | --- |
| `index.html`, `app.js`, `bundle.js` | Static client. `bundle.js` is generated. |
| `data/` | Education content and other client JSON. |
| `styles/` | Shared CSS tokens. |
| `functions/` | Cloud Functions (Node.js 22). Entry is `functions/index.js`. |
| `functions/src/` | Function modules loaded by the entry file. |
| `functions/private-bank/` | Placeholder note only. Question banks are not in git. |
| `firestore.rules`, `storage.rules`, `firestore.indexes.json` | Database and storage rules, and indexes. |
| `firebase.json`, `.firebaserc` | Firebase config and hosting targets. |
| `workers/` | Cloudflare Workers, one directory each. |
| `tests/` | Node test scripts. `tests/run-all.js` is the full run. |
| `tests/rules/` | Firestore rules tests against the emulator. |
| `scripts/` | Maintainer scripts. Most of this directory is gitignored. |
| `docs/` | Design notes. |
| `githooks/` | Tracked Git hooks. Enable with `git config core.hooksPath githooks`. |
| `.betterleaksignore` | Allowlist of public client config, documented false positives, and emulator-only test fixtures |
| `.github/workflows/` | Pages, staging, dev hosting, the nightly backup, and the Betterleaks secret scan. |

## How deploys work

The default branch is `gh-pages`. Pushes to it and to `dev` publish sites. Cloud Functions, security rules, and Workers are deployed by a maintainer with the Firebase CLI and Wrangler. Those deploys are not steps in the workflows below.

| Workflow | When it runs | What it publishes |
| --- | --- | --- |
| `deploy.yml` | Push to `gh-pages` | Static site to GitHub Pages, which serves [bitcoineducation.quest](https://bitcoineducation.quest). The job copies the tree into `_site` and leaves out functions, workers, tests, scripts, rules, and docs. |
| `deploy-staging-dev.yml` | Push to `gh-pages`, or a manual run | Staging copy to Cloudflare Pages. `scripts/build-staging.sh` rewrites the client onto the staging Firebase project, marks the pages `noindex`, and fails if a live client key remains. |
| `deploy-dev.yml` | Push to `dev` | Firebase Hosting target `dev` only (the `bitcoin-education-dev` site). No functions deploy. |
| `r2-nightly-backup.yml` | Nightly, or a manual run | Copies that day's Firestore export into private Cloudflare R2 storage as an encrypted archive. It does not deploy the app. |
| `secret-scan.yml` | Pull requests, pushes to every branch, or a manual run | Installs a pinned, checksum-verified Betterleaks and scans new commits for secrets (detection only, redacted). |

`deploy.sh` and `deploy-dev.sh` are maintainer scripts. They assume a configured machine, and `deploy.sh` commits and pushes. Contributors should open a pull request instead of running them.

## Reporting bugs

Use the bug and feature templates under `.github/ISSUE_TEMPLATE`. Vulnerability reports stay private. See [SECURITY.md](SECURITY.md).
