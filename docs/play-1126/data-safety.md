# Google Play Data safety draft — Bitcoin Quest

Play Console path: Policy and programs > App content > Data safety.
Package: `quest.bitcoineducation.app`. Audience: 18+ only. Families Policy: not committed.
Drafted from the live privacy policy and the Nov 25, 2026 form draft, updated Nov 26.
This is a form-fill draft, not legal advice. Phil (or counsel) should review before submit.

Privacy policy URL: https://bitcoineducation.quest/privacy.html
Account deletion URL: https://bitcoineducation.quest/deletion.html

## Overview answers

| Question | Draft answer |
| --- | --- |
| Does the app collect or share user data? | Yes, the app collects user data. Some of it is also shared (see sharing). |
| Is all collected user data encrypted in transit? | Yes (HTTPS). |
| Do users have a way to request that their data be deleted? | Yes. In-app: Settings → Account → Delete account. Web: https://bitcoineducation.quest/deletion.html and email info.603btc@gmail.com with subject "Delete My Data". |
| Account creation? | Yes (Firebase Auth). |
| In-app account deletion? | Yes, and it also deletes associated account data, with the stated exceptions below. |
| Independent security review? | No, unless Phil has a formal third-party assessment to cite. Internal notes in the repo are not that. |
| Committed to Play Families Policy? | No. Target audience is 18 and older only. |

Deletion exceptions that must stay consistent with the privacy policy: faucet abuse logs, payout / invoice records, charity donation records, and a hashed tombstone of sign-in identities used to stop a new account from resetting a ban, a sats block, a faucet cap, or a referral. A clean tombstone expires after about a year. The same person can delete a limited number of times (policy text: at most 3).

## Collection vs sharing (Play definitions)

Collect = data leaves the device (Firebase, Cloud Functions, or Cloudflare).

Sharing = transfer to a third party that is not a service provider acting on 603BTC LLC's instructions. Recommended sharing:

- Telegram: Global Chat and GGs messages (username and text) are mirrored to a public Telegram group. Sharing of Name, User IDs, and Other in-app messages. Purpose: App functionality. Optional UGC (only when the user posts in those rooms).
- Substack: waitlist email at /waitlist. Sharing of Email. Purpose: Developer communications. Optional.
- YouTube / Wavlake embeds: the app does not send the Bitcoin Quest account id, but the embedded players can collect device and watch or listen data under their own policies. Recommended: declare sharing of App interactions and Device or other IDs to YouTube when Timechain TV is used, and similarly for Wavlake when that player is used. Optional features.
- Upcoming A-ADS and AdSense: not in the closed-test declaration until those scripts and the privacy policy / CSP actually ship. When they ship, retake this form (likely Device or other IDs, App interactions, possibly Approximate location, purpose Advertising or marketing).

Not sharing (service providers): Firebase Auth, Firestore, Cloud Functions, Cloud Messaging, Cloud Storage; Cloudflare (Workers AI for Nacho, Turnstile, hosting / bot checks, waitlist D1); Alby Hub NWC used by the company to pay invoices; Strava API (user-connected, data stored for the user, not sold). OAuth sign-in is user-initiated collection from Google, X, GitHub, or Facebook.

## Data types to declare

For each: Collected / Shared / Required or optional / Encrypted in transit / Purposes.

**Location**

- Approximate location: Yes, recommended. Not shared with advertisers today. Optional. Encrypted in transit. Purpose: Fraud prevention, security, and compliance. Only on certain actions (sats-claim IP; hashed referral network fingerprint). Not used for normal browsing. Precise location: No. Geolocation permission is disabled.

**Personal info**

- Name: Yes if the user sets a username or display name (and optional profile text). Shared when posted in public rooms or Telegram mirrors. Optional display name; a username is required for a signed-in account. Purpose: App functionality, Account management.
- Email: Yes if the user signs in with email or Google, or joins the waitlist. Waitlist email is shared with Substack. Optional. Purposes: Account management; Developer communications (waitlist).
- User IDs: Yes (Firebase uid; optional Nostr pubkey; optional Lightning linking key). Public profile and Telegram mirrors may include username and account id. Required for a signed-in account. Purposes: App functionality, Account management, Fraud prevention, security, and compliance.
- Phone number: Yes, optional, only if the user enrolls SMS / phone MFA. Not shared (Firebase Auth as service provider). Purposes: Account management; Fraud prevention, security, and compliance. Update privacy.html to mention optional phone MFA before submitting this row.
- Address: No as a home address. User-typed IRL event location is UGC, not a collected home address.
- Other special categories (race, ethnicity, government ID, date of birth, etc.): not collected as account fields.

**Financial info**

- User payment info: No, for the Android app, while Premium checkout is kept out of the app. Website Premium is out of scope for this APK.
- Purchase history: No, for this Android app, for the same reason.
- Credit score, etc.: No.
- Other financial: in-app sats balances are promotional reward entitlements, not stored Bitcoin. Declare only if Play's form has a fitting "other financial" row; describe them as promotional reward balances, not a custodial wallet balance.

**Health and fitness**

- Not a health or medical app. Optional fitness activity (Proof of Walk / Strava): activity type, distance, duration, steps. No GPS routes, no heart rate, no Health Connect. Optional. Purpose: App functionality.

**Messages**

- Emails: only if counting support mail the user sends to info.603btc@gmail.com, which is optional and not in-app collection.
- SMS or MMS: No as a product feature (SMS MFA is handled by Firebase).
- Other in-app messages: Yes (chat, DMs, forum, comments). Shared to Telegram when posted in mirrored public rooms. Optional. Purpose: App functionality.

**Photos, video, and audio**

- Photos / videos: Yes if the user uploads a profile or other image, or posts media. Public UGC is visible to other users. Optional. Purpose: App functionality.
- Voice recordings: No (microphone permission disabled).
- Music files: Yes if the user uploads to Bitcoin Beats (public). Optional. Purpose: App functionality. Wavlake embed may collect its own data.

**Files and docs, calendar, contacts**

- Files: user-uploaded images and audio are covered above. Shareable certificates are stored in Firebase. No general device-file access beyond user-initiated uploads.
- Calendar: No.
- Contacts: No. The OS share sheet is user-initiated and does not upload the address book.

**App activity**

- App interactions: Yes (topics opened, quest and onboarding progress, XP and badge state, Timechain TV presence and watch time, spins, PVP, predictions, Nacho feedback and first-party counters). YouTube embed may receive watch interactions. Some progress is required for a signed-in learning account; watching and Nacho are optional. Purposes: App functionality; Analytics (first-party only, today). No Google Analytics, Firebase Analytics, or Crashlytics in the scanned sources as of the Nov 25 draft.
- In-app search history: Yes if search queries are stored. Optional. App functionality.
- Installed apps: No.
- Other user-generated content: Yes (posts, listings, event text, music metadata). Optional. App functionality.

**Device or other IDs**

- Yes as needed for Auth, abuse prevention, App Check, and push (FCM). Not used for advertising today. Required for a signed-in session and for abuse checks on some actions. Purposes: App functionality; Fraud prevention, security, and compliance. Retake when ads ship.

**Web browsing, crash logs, performance diagnostics**

- Crash logs / diagnostics: no Firebase Crashlytics or similar in the scanned sources. Declare No unless a later SDK is added.

## Ads checkbox vs this form

If the first closed-test AAB does not include A-ADS or AdSense, keep Data safety free of advertising-purpose rows and declare Contains ads: No for that upload, then change both when ads land (after the privacy policy and CSP are updated).

If that first AAB already includes the homepage ad banner, declare Contains ads: Yes only after privacy.html, CSP, and any required EU/UK consent are updated, and add the advertising data rows above.
