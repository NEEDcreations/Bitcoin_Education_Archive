# Badge verification

The client is hostile. `awardPoints` grants a badge only when `badgeRules.meets()` is true for server-owned data. Every grant goes through `awardBadge`. `grantBadgeIfEarned` delegates to it. One transaction verifies the badge, writes `badge_awards`, and, only if `satoshiFavor/current/contributors/{uid}_badge_{badgeId}` is missing, adds one Satoshi's Favor point. The tier is part of the badge id. A second award of the same id does not add a second point. `rewardBlocked` skips `ban_reason`, `banned`, `satsDisabled`, and `faucet_ledger/{uid}.banned`. If the 1,000 daily XP cap leaves 0 XP, the badge and the Favor point are still written. Unverified cosmetic badges return `{ success: true, cosmetic: true, awarded: 0 }` and do not write `badge_awards` or Favor. `contributeFavor` rejects `badge_earned`. `creditDailyAllThree` uses the same ban check.

## Pays from a server counter or server profile

These counters are incremented only by Cloud Functions that already checked the action. Firestore rules do not allow the client to write them.

- `channelsVisited` / `visitedChannelsList` — channel opens whose id is in the server catalog
- `bestStreak` — daily visit function
- `satsWithdrawn` — faucet payment after the invoice is paid
- `pointsDonated` — `donatePoints`, XP through the 1,000 daily cap
- `marketListings` — listing trigger, at most 3 counted listings per seller per server day
- `marketMessages` — buyer message trigger, once per buyer per listing
- `marketSold` — sale trigger, only after a counted buyer message
- `peerCount` — accepted peer request
- `referralCount` — referral verification
- `trifectaDays` / `sfContributions` — trifecta credit. Proof is a trivia doc, a quest doc with count ≥ 1, and `polls/{day}/votes/{uid}`
- `dailyFiveDays` / `dailyFiveStreak` — all five dailies. The TV step is `users/{uid}/award_claims/{day}_tctv_watch_ticket`, the claim `tctvWatchHeartbeat` writes. The reward is skipped when `ban_reason` is set, `banned` or `satsDisabled` is true, or `faucet_ledger/{uid}.banned` is true
- `sayHiDays` — `claimSayHi` (App Check stays on)
- `pollDays` — `dailyPollVote` only
- `chatCount`, `dmCount`, `forumPosts`, `forumReplies`, `beatsUploads`, `articlesPublished` — create triggers, skipping Nacho, system, and Telegram
- `pvpWins` / `pvpPlayed` — match status becomes `finished`
- `ciphersSolved` — cipher open transaction
- `sfHashes` — one per successful Satoshi's Favor hash. `sfBlockSolver` is set when that hash wins
- `predTotal`, `predCorrect`, `predBestStreak`, `predAccuracy` — prediction resolution
- Profile text (`username`, `bio`, `country`, `lightningAddress`) — checked on the profile itself, once, via `badge_awards`
- `referredBy` — non-empty string written by the referral function
- Milestone and set badges — count of non-cosmetic `badge_awards`

`replyBonusCount` is incremented inside `claimReplyBonus` after that function's own checks (PR #46 is on this base).

## Cosmetic (0 XP, no Favor unless a server path verifies them)

Flex badges, Learning Quest badges, quest and trivia completion badges, secret and hidden badges that depend on localStorage, duplicate legacy ids (`first_peer`, `peer_network_*`, `market_seller`, `market_buyer`, `first_post`, hidden copies of explorer and night owl), and the set bonuses whose members are not server-verified. `awardPoints` does not grant these, so they add no Favor point. `country_set` is not a catalog id; the server treats it as `global_citizen`.

`weekly_hero` and the combo tiers (`combo_trio`, `combo_mega`, `combo_legend`) are cosmetic in the catalog. The weekly cron and the allowlisted `combo_bonus` action pass `verified: true`, so those grants pay the catalog display XP through the daily cap and add one Favor point. Combo Favor is that one grant. The client's follow-up call with the cosmetic id does not add a second point. Peer grants write `peer_1`, `peer_3`, `peer_10`, and `peer_25`. Old `badges` array entries are left in place and are not copied.

Learning Quest rows still show their catalog XP in search. The grant is cosmetic until quest grading is server-side (PR #40). That is display only. Hidden-badge XP is no longer paid by the client, and Firestore rules deny client writes to `hiddenBadges` and the other badge fields.

## Waiting on another change

Nothing in this deploy writes these, so claims fail closed:

- `questDays` — quest day badges, until server grading
- `plebTalkSessions`, `onboardingComplete`, `pushToken`
- `tctvWatchDays` — Timechain TV watch-day badges. The all-five check uses the daily ticket claim, not this counter
- `giftsSent`

## Not revoked

Existing `badge_awards` and `visibleBadges` entries are left in place. `functions/dry-run-badge-criteria.js` lists, in aggregate, how many held paying badges would fail the new rules. It does not write.

`scripts/backfill-badge-favor.js` writes missing contributor docs only. It does not add pool points or move faction totals. It skips banned users and any badge that already has either `{uid}_badge_{badgeId}` or the legacy name-keyed doc. Dry-run is the default and prints counts. `--apply` writes. It has not been run.

## Account deletion

`deleteAccount` removes `market_listing_counts`, `market_listing_daily`, `market_message_counts`, and `market_sale_counts` for that user after the sign-in is deleted.

## Deploy order

1. `firestore.rules` — profile denylist of server-only fields (live client saves stay writable, including `notificationPrefs` and `beatsShowUncensored`; `lastTriviaDate`, `lastPollDate`, `lastQuestDate`, `hiddenBadges`, and badge counters are server-only), `poll_votes` client writes off, server-only `market_listing_daily`, `market_message_counts`, `market_sale_counts`, and `polls/{day}/votes`.
2. Functions — `awardBadge` on every grant path (badges, donations, weekly hero, peers, combos, counters), `contributeFavor` without `badge_earned`, `dailyPollVote`, listing cap, message and sale triggers, activity counters, `claimSayHi` / `armSayHi`, trifecta credit with `rewardBlocked`, nightly reconcile, distribution refresh, anon-badge recompute, donation cap, peer grants.
3. Hosting. The service worker placeholder is `btc-archive-v2324` and is renumbered at merge. `index.html` and `404.html` stay identical.

`claimSayHi` and `armSayHi` must be deployed. Production had no Say hi claims; the callable is the only writer, App Check stays enforced, and a failed claim now toasts and retries once. A message timestamped before the arm is still rejected.

## Nightly job

`reconcileDailyProofs` at 05:15 UTC grants a missed trifecta point and the all-five badge for the previous server day (5:00 UTC). It is idempotent per uid and day. It skips anonymous users. Trifecta credit and the all-five payout both use `rewardBlocked` (`ban_reason`, `banned`, `satsDisabled`, and `faucet_ledger/{uid}.banned`).
