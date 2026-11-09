## What changed

<!-- One short paragraph. Name the files that matter. -->

## Why

<!-- The player-facing or maintainer-facing problem this solves. -->

## How to test

<!-- Commands you ran, and what a reviewer should click or run. Write "not run" if you could not run them. -->

- [ ] `node tests/test-syntax.js`
- [ ] Suites that cover this change:
- [ ] Emulator suite, if rules or Cloud Functions behavior changed:

## Checklist

- [ ] This pull request targets `gh-pages` and does not push that branch directly.
- [ ] No secrets, `.env` values, private question banks, or live credentials.
- [ ] Bundled client sources were rebuilt with `build.sh` if any of them changed.
- [ ] Cache-buster query strings in `index.html` were updated if a lazy-loaded file changed.
- [ ] This is not a vulnerability report. Security issues go to info.603btc@gmail.com or GitHub private vulnerability reporting. See SECURITY.md.
