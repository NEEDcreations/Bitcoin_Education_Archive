# Play closed-test prep (docs/play-1126)

Branch: `prep/play-closed-test-1126`. Prep only. Do not merge or deploy until:

1. Phil pastes the real Play App Signing SHA-256 (and the upload-key SHA-256 if we should include it) into `.well-known/assetlinks.json`. Placeholder strings must never go live.
2. Phil says the usual yes, in his own words, to publish `assetlinks.json`, the worker route, and any related hosting change.
3. Rufus opens a PR only after telling Phil first.

The Android / Bubblewrap project does **not** belong in this public website repo. Suggested private repo: `NEEDcreations/bitcoin-quest-android`. Never commit a keystore, `*.jks`, passwords, or `local.properties` here.

See `PLAN.md` in this folder (and `/workspace/play-1126/PLAN.md` on the shared computer) for the full checklist, onboarding plan, and the steps only Phil can do in Play Console.
