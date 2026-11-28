# Deploy list

Items below need Phil's own words before they go live. Nothing here is
deployed from this branch.

## Ads privacy (`feat/ads-privacy-choices-1126`)

- [ ] **`setPrivacyShareOptOut` Cloud Function** — needs Phil's OK to
  deploy. Persists Your Privacy Choices on the signed-in account
  (`privacyShareOptOut`, `privacyShareOptOutAt`). App Check is required,
  writes go through a transaction/`update()` so a missing `users/{uid}`
  doc is never created as a partial profile, and a per-uid rate limit
  of about 10 calls per minute is in place. `firestore.rules` are
  unchanged. The on-device toggle and Global Privacy Control still work
  if this function is not deployed yet.

- [ ] **seo-router worker publish** — needs Phil's OK. Adds
  `https://fundingchoicesmessages.google.com` to `script-src`,
  `connect-src`, and `frame-src` so AdSense Privacy & messaging
  (Funding Choices) can load after `ADS_EEA_ENABLED` is flipped. Do
  not publish until Phil turns the consent message on and approves
  this publish.

- [ ] **`firebase.json` hosting CSP publish** — needs Phil's OK. Same
  Funding Choices host as the worker, so staging / Firebase Hosting CSP
  matches. Publish together with the worker, not ahead of it.

## Sats require 18+ (`feat/sats-require-18plus`)

- [ ] **Functions `claimSats`, `claimFavorBlock`, `claimCipherWin`, `claimCipherSats`** — needs Phil's go-live OK. Existing functions, so this is a redeploy of those four by name. Refuses sats unless the player has confirmed 18+ (`age_18_required`). At the time this branch was cut only 1 of 1,977 live accounts had confirmed 18+, so almost every player is blocked from sats until they answer the age prompt. Deploy the site (SW v2746) together with the functions so the prompt appears.

