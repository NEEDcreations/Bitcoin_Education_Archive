# Bitcoin Quest — Google Play closed-test prep (around Dec 3, 2026)

Written: Thursday, Nov 26, 2026, America/New_York (Eastern).
Repo: `NEEDcreations/Bitcoin_Education_Archive`. Site / TWA origin: `https://bitcoineducation.quest`.
Website branch for this prep: `prep/play-closed-test-1126` (off `origin/gh-pages` at `7f3c8c15c`). No PR opened. Nothing deployed.

This is an implementation and Play Console checklist, not a legal opinion, and not approval to publish or upload.

## Final decisions (never re-ask)

These are already decided. Do not go back to Phil with a new choice on them.

| Decision | Source |
| --- | --- |
| Android / Play package name: `quest.bitcoineducation.app` | Phil, first set Nov 21, 2026; entered in Play Console Create app around Nov 23; confirmed again Nov 25 ~9:54 PM ET (card A). It cannot change after the first AAB is uploaded. |
| Play target audience: 18 and older only | Phil, Nov 25, 2026, 5:33 PM ET, decision card. |
| Kids / Classroom stay web-only (not in the Android app) | Phil, Nov 25, 2026, 10:20 PM ET (ads / age workstream) and the 18+ Play decision. |
| Sats features: declare tokenized rewards only; do not declare a cryptocurrency exchange | Phil, Nov 25, 2026, 5:33 PM ET. |
| Premium checkout stays out of the Android app for now (no website checkout, no Play Billing, no ads-free paid plan in the wrapper) | Phil, Nov 25, 2026, 5:33 PM ET. |
| Onboarding fixes (new-user bugs, first-time onboarding, guided tour) must be live before the closed test starts | Phil, Nov 24, 2026, 11:05 AM ET. |
| Public developer name: 603BTC. Account type: personal (not organization), started Nov 21, 2026 | Phil, Nov 21, 2026. Because this personal account is after Nov 13, 2023, the 12-tester / 14-day rule applies. |
| Testers: at least 12 real Android testers opted in continuously for 14 days who actually open the app; aim for 15–20 people who agreed. Phil may add himself once on his own Android phone. Do not use multiple of his own emails. Google does not email listed testers, so Phil must send the opt-in link himself (BCC). Prefer agreed people plus Testers Community over bulk-adding all Bitcoin Quest Gmail addresses. | Phil, Nov 21, 2026. |

---

## 1. Closed-test checklist

### Verified tester rule (Nov 26, 2026)

Checked against Google Play Console Help, "App testing requirements for new personal developer accounts" (https://support.google.com/googleplay/android-developer/answer/14151465?hl=en), fetched Nov 26, 2026.

For a **personal** developer account created **after November 13, 2023** (this is Phil's case):

- You must run a **closed test** before you can apply for production access.
- At least **12 testers** must be **opted in continuously for the preceding 14 days** when you apply.
- The 14 days are consecutive. If a tester opts out and later opts back in, their 14-day clock restarts.
- Testers who are only listed, or who opt in for a few days and leave, do not count. They need to stay opted in, and they should actually open the app.
- Internal testing is optional and does not satisfy this rule. Open testing is only available after production access.
- Production and pre-registration stay disabled until the closed-test bar is met and Google approves the production-access application (review is often seven days or less, sometimes longer).

Practical plan: recruit 15–20 agreed testers so a few drop-offs still leave 12 continuous opt-ins. Tell testers up front that they must stay opted in for at least 14 days. If the closed test starts around Dec 3, the earliest date 12 people can have been opted in for 14 days is around Dec 17, and production access would come after Google's review.

A private working list of 8 agreed people already exists from Nov 21 (not stored in this public repo). A larger export of Bitcoin Quest Gmail addresses also exists and **must not** be bulk-added.

### A. Build and signing

| Item | Status | Notes |
| --- | --- | --- |
| TWA / Bubblewrap project | Not started | Keep it in a **new private repo**, suggested `NEEDcreations/bitcoin-quest-android`. Do not put the Android project, a keystore, or `local.properties` in this public website repo. Tooling: `@bubblewrap/cli`. Template: `docs/play-1126/twa-manifest.json`. Start URL: `/?client=android-twa`. Host: `bitcoineducation.quest` only (not www, not pages.dev). |
| Existing AAB | None | No AAB or APK is in this repo or on the shared computer. The first upload-signed AAB should be built on a maintainer machine after Phil creates the upload keystore. The shared bot box is the wrong place for a real keystore. |
| Play App Signing | Phil must enroll | After the first upload, copy the **App signing key certificate SHA-256** (and the upload-key SHA-256 if a locally signed build should also verify) into `.well-known/assetlinks.json`. Format: 32 colon-separated uppercase hex bytes, as Play Console shows it. Do not invent a fingerprint. Do not put a debug cert on the production origin. |
| Upload keystore | Phil must create and store privately | Alias in the template is `upload`. Keep the password in Phil's password manager. Never commit `*.jks` / `*.keystore`. |

### B. Digital Asset Links (`assetlinks.json`)

Canonical URL (the only one DAL will accept for this TWA):

`https://bitcoineducation.quest/.well-known/assetlinks.json`

Requirements: HTTPS, HTTP 200, **no redirect**, `Content-Type: application/json`, body a JSON array of statements.

Live check, Nov 26, 2026, 8:51 AM ET: the HTTPS URL still returns **HTTP 404** with `content-type: text/html` (the site HTML 404 shell) on both the apex and `bitcoin-quest.pages.dev`. `www`, `btcedu.app`, and `btcedu.quest` 301 to the apex path, which is fine if the TWA host is the apex only.

This branch adds a **placeholder** file and the hosting plumbing so the path can be served as JSON once real fingerprints are in place. **Do not merge or deploy the placeholder fingerprints.** A live file with `REPLACE_WITH_…` strings will not verify, and it should not be published as if it were complete.

Plain `http://bitcoineducation.quest/.well-known/assetlinks.json` still returns **HTTP 500** from Pingora (rechecked Nov 26, 8:53 AM ET). Official DAL checks use HTTPS, so this is not the main closed-test blocker. The worker already has an HTTPS 301 helper; the 500 appears to happen in front of the worker. Follow-up, not a ship blocker.

After a real file is published, verify with:

- `curl -sI https://bitcoineducation.quest/.well-known/assetlinks.json` → 200, `application/json`, no redirect
- Google's statement list tester: `https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://bitcoineducation.quest&relation=delegate_permission/common.handle_all_urls`

A TWA that shows a URL bar is a failed DAL or a host mismatch. Do not start the closed test on a wrapper that looks like a browser tab.

### C. Store listing, rating, and policy forms

Paste-ready drafts are in `docs/play-1126/`:

- `store-listing.md` — name, short description (78 characters), full description, category, contact links, graphics
- `data-safety.md` — overview, sharing, and per-type rows
- `content-rating-and-declarations.md` — IARC, 18+ target audience, ads, crypto, other App content boxes

| Item | Draft / URL | Still needed |
| --- | --- | --- |
| Privacy policy | https://bitcoineducation.quest/privacy.html (HTTP 200) | Update before submit if we declare optional phone MFA, and before any "Contains ads: Yes" (policy today still says the app does not use ad networks). Consider renaming page titles from "Bitcoin Education Archive" to "Bitcoin Quest". |
| Terms | https://bitcoineducation.quest/terms.html | Website terms still allow 13–17 with a guardian. The Play listing and Android app are 18+. That is OK if the Android first-run age confirm is live. |
| Account deletion URL | https://bitcoineducation.quest/deletion.html (HTTP 200) | Page title still says Bitcoin Education Archive. Align the name with the Play listing before review. |
| Content rating (IARC), 18+ | Draft in `content-rating-and-declarations.md` | Phil completes the questionnaire in Console and confirms the chance-reward checkbox wording. |
| Data safety | Draft in `data-safety.md` | Phil reviews sharing rows (Telegram, Substack, YouTube / Wavlake) and the approximate-location (IP) row. |
| Ads declaration | Depends on whether the first AAB actually shows ads | If no ad SDK yet: Contains ads **No**, then change when ads land. If the banner is already in that AAB: **Yes**, but only after privacy.html, CSP, and any required consent are updated. |
| Financial / crypto | Tokenized rewards only; no exchange | Software-wallet box still open (WebLN / NWC UI). Phil or counsel decides. This draft does not tick it from the rewards decision alone. |
| Graphics | Icon draft and a 1024×500 feature-graphic draft in `docs/play-1126/graphics/` | Phil approves or replaces the feature graphic. Someone captures at least 2 (ideally 4–8) 18+ phone screenshots. |
| Reviewer test account | Instructions drafted in the earlier Play Console notes; no password in git | Phil creates a non-admin Google or email account, 2FA off or with a usable method, and puts credentials only in Play Console > App access. |

### D. Onboarding and the live origin the TWA will load

The TWA is a thin wrapper around whatever is live on `https://bitcoineducation.quest`. The closed test should not start until these are on that origin:

- Week 1 onboarding fixes (`fix/onboarding-w1-1125`, head `1d13e15ed`)
- 18+ age confirm (`feat/age-confirm-18`, and the App Check wait fix on `fix/age-confirm-appcheck-1126`)
- Premium purchase paths hidden in the Android client (not implemented yet; plan below)
- Kids / Classroom not offered in the Android client

See section 3 for the onboarding plan and remaining gaps.

### E. Testers and Play Console account

- Confirm identity verification is complete and the app `quest.bitcoineducation.app` already exists in the 603BTC Play Console (Phil entered the package name around Nov 23).
- Complete App setup (the forms above). Closed testing is only available after App setup is complete.
- Create a closed-test track, upload the AAB, add 15–20 agreed testers, and copy the opt-in link.
- Phil sends the opt-in link (BCC). Google will not email them.
- Start around Dec 3 only if the live origin and the signed, DAL-verified AAB are ready. If they are not, slip the start date rather than burn the 14-day clock on a broken build.

---

## 2. What this branch contains (prep only)

Website branch `prep/play-closed-test-1126`. Safe prep. No PR. Do not deploy, and do not merge until fingerprints are real and Phil has said yes to the publish.

| Path | What changed |
| --- | --- |
| `.well-known/assetlinks.json` | Package `quest.bitcoineducation.app`, placeholder SHA-256 strings only. |
| `_headers` | New Cloudflare Pages rule: that path is `application/json`, cached 5 minutes. |
| `firebase.json` | Un-ignore `.well-known` for prod and dev; same content-type and short cache, placed after the general `*.json` 1-day cache so it can override. |
| `scripts/build-staging.sh` | Re-copies `.well-known` after the hidden-file exclude, so staging can serve the file if we ever need a staging TWA. The Dec 3 test should wrap production, not staging. |
| `workers/seo-router/worker.js` | If the path misses, return a JSON 404 instead of the HTML 404 shell. If it hits, force `application/json`. Also preserve `client=android-twa` across clean-URL alias redirects (`/forum`, `/tv`, and the others), which previously kept only `ref`, `src`, and `card`. |
| `manifest.json` | `name` and `short_name` are now "Bitcoin Quest" (they were "Bitcoin Education Archive" / "BTC Archive"). Description updated to the product line. `start_url` stays `./` so the installed web PWA is unchanged. The TWA start URL lives only in `twa-manifest.json`. |
| `docs/play-1126/` | TWA Bubblewrap template, store listing, Data safety, content-rating drafts, this plan, and draft graphics. |

Not in this branch (on purpose):

- A real SHA-256, keystore, or AAB
- A private Android repo (needs a new private GitHub repo; not created)
- Premium hide / block in the web client (planned, needs a small follow-up branch and tests)
- Onboarding product fixes (already on `fix/onboarding-w1-1125`)
- Age confirm (already on `feat/age-confirm-18` and `fix/age-confirm-appcheck-1126`)
- Deploy or worker publish
- Privacy.html / deletion.html title rename (small follow-up; not done here)

### Premium hide (follow-up, not in this branch)

When a later branch implements it:

1. Detect TWA from `/?client=android-twa`, persist in `sessionStorage` (and optionally `localStorage`), with fallback `document.referrer` starting with `android-app://quest.bitcoineducation.app`.
2. Do not use `display-mode: standalone` alone (that is also the installed web PWA). Do not reuse the `src` query (that is share attribution).
3. Hide and block every Premium / Bitcoin Maxi upgrade, checkout, pricing, and ads-free paid-plan CTA. If a leftover hash or link still opens checkout, show "Premium is not available in the Android app" and do not take payment.
4. Leave `isPremium()` alone so an existing website entitlement is not stripped for the closed test.
5. Do not add Play Billing.

---

## 3. Onboarding plan — first-run gaps and small fixes

First-run, in order, once the age confirm and onboarding branches are on the live origin:

1. **Age confirm (18+).** One-tap prompt ("Quick age check", "I'm 18 or older" / "I'm under 18"). A saved under-18 answer is changeable only via support. Dismiss means no ads this session (ads workstream). Play and the Android app are 18+. Kids / Classroom stay web-only. Branch: `feat/age-confirm-18` at `34871df31`. Follow-up already pushed: `fix/age-confirm-appcheck-1126` at `1bed76650` waits for App Check before the 18+ save so an early tap does not show "Error saving." These must be in the Friday ship (or a follow-up that is live before Dec 3). Do not build a second age gate inside the TWA.
2. **Sign-up.** Guest or account. Social sign-up (Google, GitHub, X, Facebook) must go to the username step, not Settings. Already fixed on `fix/onboarding-w1-1125` (#5, `cfda413a3`). The Update banner must not sign a new user out or reload while signup / onboarding chrome is open (#1, already in `#387` / `b395fc6df`).
3. **Questions-first onboarding, then mode picker, then first quest overlay.** Already live in product shape (shipped Nov 19; guest path checked Nov 20 / Nov 25). `introSeen` must be saved so the intro does not repeat (#2, already fixed). On a 375 px phone the account sheet must not cover the questions (#3, already fixed).
4. **Guided tour after onboarding** (how to earn XP and convert it to bitcoin, ways to earn, Learn tab, mini apps, Skip anytime, a Need help? step, end-of-tour "Ready to start learning?" / "Want to earn some quick XP?", and blur daily tasks behind "Reveal your daily tasks"). Script still waits on Phil. Do not ship a tour until he has approved the script. This is the remaining closed-test onboarding blocker that is not already coded.

### Status of the Week 1 list (from Mini Rufus, not re-asked)

Branch `fix/onboarding-w1-1125`, head `1d13e15ed`, SW still `v2691` (final pin is set at merge). Pushed, no PR.

| Item | Status |
| --- | --- |
| #1 Update banner must not sign new users out | Fixed earlier (`b395fc6df`, PR #387). Staging plan written at `/workspace/private/onboarding-w1-1125-staging-plan.md`. **Not yet run** on a real staging account. |
| #2 `introSeen` saved | Already fixed on that earlier commit. |
| #3 Account sheet covering onboarding at 375 px | Already fixed. |
| #4 First-time onboarding / tutorial vs the Nov 20 guest path | Checked locally; no new defect besides #5. |
| #5 Social sign-up goes to username, not Settings | Fixed (`cfda413a3`); registry helper follow-up in `1d13e15ed`. |
| #6 / #7 Invite and Quest pills covering Guide / XP | Fixed (`40db6580d`). |
| #8 Withdraw / Settings top cut off under the status bar | Fixed (`86c9d7d49`). |
| #9 Language switch has no effect | Root cause: live CSP (seo-router) blocks Google Translate hosts. Needs Security sign-off and a worker deploy. Left as-is on the onboarding branch. |
| #10 "Member since" Invalid Date | Already fixed (`bqFormatJoinDate`). |
| #11 Missing profile join dates, plus a live backfill | Write-path fix may be in the branch; **live backfill needs Phil's OK** and a pre-backfill export. Not a reason to delay the closed test if new accounts write a join date going forward. |
| #12 Saved confirmation on profile settings (e.g. country) | Not started. Small follow-up: show an immediate "Saved" confirmation on a successful profile-field write (country and the other settings on that sheet). |
| #13 Make orange toasts instant; profile-picture toast was ~10 seconds late | Not started. Small follow-up: audit `showToast` / delayed toast calls on profile saves and fire the success toast when the write resolves, not after an extra timer. |
| #14–#17 Guided tour | Waits on Phil's script review. Must still be live before the closed test if we keep that earlier commitment. |

Unit tests already green on that branch: Week 1 7/0, guest onboarding 13/0, busters 13/0. The #1 staging plan still needs a staging preview and a throwaway account (Google, email-link, and guest). That is a QA / Rufus run, not a new code branch.

#12 and #13 are small enough for a later branch (`fix/profile-save-toasts-1126` or similar). They were not mixed into this Play hosting branch. They are not closed-test blockers in the same way as age confirm, social username, and the tour.

---

## 4. Exact steps only Phil can do in Play Console (and related)

Rufus cannot complete these in Phil's Play account from here. Do them in this order when the AAB and live origin are ready.

1. **Confirm the developer account.** Open Play Console as 603BTC. Confirm identity verification is approved, the $25 registration is paid, and the account is in good standing. Confirm the app with application id `quest.bitcoineducation.app` is the one already created.
2. **Create the upload key and turn on Play App Signing.** Generate an upload keystore on a machine you control (not the shared bot computer). Store the keystore and passwords in your password manager. When Play shows the **App signing key certificate** SHA-256 (and the upload-key SHA-256), paste them to Rufus or into the assetlinks file yourself. Do not send the keystore file in chat.
3. **Approve publishing `assetlinks.json` and the worker / hosting changes**, in your own words, after the real SHA-256 values are in the file. Until then, the website branch must not be merged to `gh-pages` or deployed.
4. **Complete App setup in Play Console** (closed testing is locked until this is done), using the drafts in `docs/play-1126/`:
   - Store listing (name, short and full description, icon, feature graphic, phone screenshots)
   - Privacy policy URL: https://bitcoineducation.quest/privacy.html
   - Account deletion URL: https://bitcoineducation.quest/deletion.html
   - Data safety form
   - Content rating (IARC), category Education, 18+
   - Target audience: 18+ only; not designed for children; not Families
   - Ads: No unless the uploaded AAB actually shows ads and the privacy policy already matches
   - Financial features: tokenized rewards only; no exchange; software-wallet box only if you or counsel decide to tick it
   - Government: No. News: No. Health: not a medical app; declare optional Proof of Walk / Strava activity
   - Independent security review: No, unless you have a formal third-party review to cite
5. **Create a Play reviewer account** (not an admin). Put the username or email, password, and 2FA notes only in App content > App access, never in the public listing or in git. Guest browsing works without an account. Ask reviewers not to change the Lightning address, request a withdrawal, or delete the reviewer account.
6. **Upload the signed AAB** to a closed-test track (internal testing first is optional and useful for a smoke install). Confirm the package name is `quest.bitcoineducation.app`.
7. **Add 15–20 agreed testers** (you may include yourself once, on your own Android phone). Do not bulk-add the full Bitcoin Quest Gmail export. Copy the opt-in link and **email it yourself (BCC)**. Tell people they must stay opted in continuously for at least 14 days and actually open the app.
8. **Start the closed test** around Dec 3 only if: the live site has onboarding + age confirm, `assetlinks.json` verifies, the AAB installs without a URL bar, and Premium / Kids / Classroom are not offered in the app.
9. **Any Play spend** (beyond the already-paid registration, if something else is charged) stays yours to approve.
10. **Production access** is a later step, after 12 testers have been opted in continuously for 14 days. You apply from the Dashboard and answer questions about the closed test, the app, and production readiness. Do not apply early.

Still for you to confirm when you fill the forms (recommended answers are already in the drafts; these are not new product decisions):

- Approximate location (IP) declared as collected for fraud prevention
- Telegram / Substack / YouTube-or-Wavlake sharing rows
- IARC chance-reward checkbox wording
- Software-wallet box (open)
- Legal name and IARC contact email match the account (recommended: 603BTC LLC and info.603btc@gmail.com)
- Distribution countries
- Whether the first closed-test AAB will already show ads
- Approval of the tour script, and OK for the live join-date backfill (#11) when we are ready
- How you want the private Android repo created (recommended name `NEEDcreations/bitcoin-quest-android`)

---

## 5. Suggested sequence toward Dec 3

1. Friday ship (separate track): combined web build, including onboarding `fix/onboarding-w1-1125` and age confirm, after the usual QA / Security / User Data / Phil OK and a verified full export. Not part of this branch.
2. Phil creates the upload key, enrolls Play App Signing, and returns the SHA-256 values.
3. Rufus fills `.well-known/assetlinks.json`, you approve the publish in your own words, and we verify DAL on the apex HTTPS URL.
4. Rufus (or you) creates the private Android repo, runs Bubblewrap from `docs/play-1126/twa-manifest.json`, and builds the upload-signed AAB on a maintainer machine.
5. A follow-up website branch hides Premium (and Kids / Classroom) in the TWA client. Merge it with the usual review before testers start.
6. You complete the Play forms, upload the AAB, add testers, and send the opt-in link.
7. Install the Play-signed build on a real phone and confirm: no URL bar, age confirm, sign-up, first quest, no Premium checkout, no Kids / Classroom.
8. Keep 12 testers opted in for 14 continuous days. Apply for production later (target live on Play before January 3, 2027, for Citadel Quest — Apple is not required for that date).

If signing, DAL, or the Friday ship slips, move the closed-test start, not the 14-day definition.

---

## 6. Sources

- Workstream memory: `/bot/workstream/bitcoin-quest-google-play`
- Mini Rufus local drafts (Nov 25): `/workspace/private/twa-assetlinks-plan-1125.md`, `play-console-answers-1125.md`, `assetlinks-1125.json`, `twa-manifest-1125.json`, `onboarding-w1-1125.md`, `onboarding-w1-1125-test-results.md`, `onboarding-w1-1125-staging-plan.md`
- Google Play Console Help, testing requirements for new personal accounts, fetched Nov 26, 2026: https://support.google.com/googleplay/android-developer/answer/14151465?hl=en
- Live probes, Nov 26, 2026, ~8:51–8:53 AM ET: privacy.html HTTP 200; assetlinks.json HTTPS 404 HTML; same path over HTTP 500 from Pingora
