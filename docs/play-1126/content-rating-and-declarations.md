# Google Play content rating, target audience, and related declarations — Bitcoin Quest

Play Console paths: App content > Content rating; Target audience and content; Ads; Financial features.
Audience: **18 and older only** (FINAL, Phil, Nov 25, 2026, 5:33 PM ET). Kids / Classroom stay web-only.
This is a form-fill draft, not legal advice.

## Target audience

| Question | Draft answer |
| --- | --- |
| Target age groups | 18 and older only. Do not select any under-18 group. |
| Designed for children? | No. |
| Appeals to children? | No. |
| Families Policy | Does not apply. Do not commit to it. |

Store listing, screenshots, and copy must not look child-directed. The public website terms still allow ages 13–17 with a parent or guardian, but the Play listing and the Android app are 18+. The Android first-run must include the 18+ age confirm (`feat/age-confirm-18`) before testers start.

## Content rating (IARC)

Primary category: Education (game-like features are secondary). Not Casino. Not a social-only app.
IARC contact email: use the Play developer contact (recommended: info.603btc@gmail.com, if that matches the account).

| Topic | Draft answer |
| --- | --- |
| Violence, blood, gore, weapons used in play | No as app-published game combat. Educational or user posts could mention historical or news violence. PVP is a quiz, not an action game. |
| Sexual content or nudity from the developer | No. Marketplace and Beats rules prohibit adult or sexual content. UGC is moderated. |
| Language | Users may encounter strong language in UGC and in Bitcoin Beats titles or credits (optional uncensored-titles setting). Public chat is filtered but not guaranteed clean. |
| Drugs, alcohol, tobacco promoted by the app | No as a feature. Educational or UGC text might mention them. |
| User interaction | Yes (chat, DMs, forum, marketplace, IRL RSVP, PVP lobby, and similar). |
| Users can interact or exchange personal info | Yes. DMs and public posts. |
| User-generated content | Yes, some of it public. Moderation exists (filters, reports, human review). |
| Users can share their location | Not GPS. Users can type a meetup location into a public IRL event. Answer as location text in UGC, not device location sharing. |
| Digital purchases | No digital goods sold by the developer in the Android app for now (Premium is kept out of the Android app). Orange Tickets and Nook items are earned, not bought with money. LightningMart is user-to-user. Tips are voluntary Lightning payments. Retake this if Premium is later sold in the Android app. |
| Real-money gambling | No. Users do not stake money for a chance to win money. Paying never improves odds. |
| Simulated gambling / chance rewards | Chance mechanics exist without a money stake: daily prize wheel, gift drop, monthly raffle (entries from earned tickets only), locked-cipher sats prizes, Satoshi's Favor. Odds are published. Classroom and under-18 accounts cannot win sats on the website; the Play app is 18+ only. Phil should tick the exact IARC checkbox that matches "promotional chance rewards with no money stake," and not a casino or real-money gambling box. |
| In-game purchases linked to chance | No, if the question means real-money purchases. Premium and paid value cannot be used for chance items. |

Retake the questionnaire when ads ship, if Premium is later added to the Android app, or if the age confirm changes a rating answer.

## Ads

If the first closed-test AAB has no ad SDK or A-ADS banner: **Contains ads: No**, then change to Yes when ads land (after the privacy policy and CSP update).

If that AAB already shows ads: **Contains ads: Yes**, but only after privacy.html, CSP, and any required consent are updated so the policy and the form agree.

The only commercial "advertise" UI on the site today is a sponsor-inquiry panel that mails info.603btc@gmail.com. That is not an ad SDK. Timechain TV has no ads from Bitcoin Quest; YouTube's own ads may still appear. Public wording should stay "No ads from us," not "ad-free."

## Financial features / crypto

FINAL (Phil, Nov 25, 2026, 5:33 PM ET):

- Declare **tokenized digital assets / promotional rewards** for sats. Do **not** declare a cryptocurrency exchange.
- Keep Premium out of the Android app (no website checkout, no Play Billing).

The software-wallet box is still open. The app has a non-custodial WebLN / NWC send/receive UI in addition to Lightning-address reward payouts. A conservative reviewer may treat that UI as wallet functionality. Checking "cryptocurrency software wallet" can open country-specific licensing forms (including US FinCEN MSB). This draft does **not** tick that box from the tokenized-rewards decision alone. Phil or counsel should decide before submit.

In-app sats balances are reward entitlements, not stored Bitcoin. 603BTC LLC does not custody user funds for those balances.

## Other App content boxes

| Declaration | Draft answer |
| --- | --- |
| Privacy policy URL | https://bitcoineducation.quest/privacy.html |
| Account deletion URL | https://bitcoineducation.quest/deletion.html |
| Government apps | No |
| News apps | No (educational library, not a news publisher) |
| Health apps | Not a health or medical app; do declare optional fitness tracking for Proof of Walk / Strava (steps, distance, duration; no GPS routes) |
