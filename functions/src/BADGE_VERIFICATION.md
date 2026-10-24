# Badge verification

The client is hostile. `awardPoints` grants a badge only when `badgeRules.meets()` is true for server-owned data. Every grant goes through `awardBadge`. `grantBadgeIfEarned` delegates to it. One transaction verifies the badge, writes `badge_awards`, and, only if `satoshiFavor/current/contributors/{uid}_badge_{badgeId}` is missing, adds one Satoshi's Favor point and increments `satoshiFavor/userSfPoints/users/{uid}` the same way `contributeFavor` does. The tier is part of the badge id. A second award of the same id does not add a second point. `rewardBlocked` skips `ban_reason`, `banned`, `satsDisabled`, and `faucet_ledger/{uid}.banned`. Badge XP amounts come from `badge-xp.json`. The grant calls `applyDailyXp` (full XP until 500, half until 900, quarter until 1,000, then 0; floor per tier). The remainder is dropped. Badge grants do not write `pendingOverflow`. If that cap leaves 0 XP for today, the badge and the Favor point are still written. Flex badges count `daily_action_counts` claim docs, not `flexTotals`. `functions/scripts/backfill_badge_xp.js` tops up the difference for badges that pass today, bypasses the daily cap, and was not run. Unverified cosmetic badges return `{ success: true, cosmetic: true, awarded: 0 }` and do not write `badge_awards` or Favor. `contributeFavor` rejects `badge_earned`. `creditDailyAllThree` uses the same ban check.

## Pays from a server counter or server profile

These counters are incremented only by Cloud Functions that already checked the action. Firestore rules do not allow the client to write them.

- `channelsVisited` / `visitedChannelsList` — channel opens whose id is in the server catalog
- `bestStreak` — daily visit function
- `satsWithdrawn` — faucet payment after the invoice is paid
- `pointsDonated` — `donatePoints`, XP through the 1,000 daily cap
- `marketListings` — listing trigger, at most 3 counted listings per seller per server day
- `marketMessages` — buyer message trigger, once per buyer per listing
- `marketSold` — sale trigger, only after a counted buyer message
- `peerCount` — accepted peer request. `meets()` uses the larger of `peerCount` and `peers.length`, so a legacy `first_peer` or `peer_network_*` holder still qualifies when the counter and the peer list have drifted. The grant writes `peer_1`, `peer_3`, `peer_10`, `peer_25`, `first_peer`, and `peer_network_10/50/100/250`
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
- `flexTotals.{actionId}` — incremented inside `awardPoints` when the flex `award_claims` doc is created, including a 0 XP cap hit. `flexAllDays` increments once when that day's claim exists for every flex id. The client `flexTotals` write is denied
- `questsPassed` — `gradeQuest` when the score is at least 3. The quest doc `graded` flag makes it once per quest. `completedQuests` stays a client field and is not the proof
- `triviaCorrect` / `triviaStreak` / `triviaStreakDay` — the once-per-day `trivia_correct` claim `awardPoints` already writes. The chosen answer is still compared in the browser before that call; the badge counts accepted claims, one per server day, and the streak continues only when `triviaStreakDay` is the previous UTC day
- `lqPassed` — the one-time `lq_lesson` claim, mapped from the sanitized lesson title to the eight topic ids. The quiz score itself is still checked in the browser; the badge follows the same callable record the lesson XP uses. `lq_graduate` needs all eight ids
- `spinDays` / `spinStreak` — the non-bonus `dailySpin` only. The older client field `spinCount` stays writable and is not the proof. `spinHitRare` is set when the server roll is rare. `spinClosetAwards` counts closet rolls, not unique items
- `raidDamageAllTime` — `contributeRaid` after a counted contribution. On defeat, `users/{uid}/raid_credits/{bossId}` is written once per participant and increments `raidBossesDefeated`; winners also increment `raidWins`
- `tipsVerified` / `tipsSentSats` / `tipsReceived` — only a tip paid through `requestTipInvoice`. The server checks the custodial allowlist before any fetch (`lnbits.com` is an exact host; other custodians still match their subdomains), follows at most 3 https redirects with `redirect: 'manual'` and `assertPublicHost` on every hop, and rate-limits invoice requests per user. It stores the payment hash and the decoded amount. `confirmTipSent` counts it when the verify host is on that allowlist, sender and recipient are different and unbanned, they do not share a fingerprint or IP cluster when that data exists, and the pair has not already been credited that UTC day. The tip overlay calls `requestTipInvoice` when it has a recipient uid, then `confirmTipSent` after payment. A pre-made invoice or a client LNURL fetch stays a social confirmation: challenge XP can still record, and the badge counters do not move. The amount is the stored invoice, never the client's sats
- `orangeTickets` — ticket grants inside `awardPoints` and `dailySpin`. `ticket_bronze`, `ticket_silver`, and `ticket_gold` read it
- `streakFreezesUsed` — `recordDailyVisit` when a freeze covers a missed day
- `ghost_reader` — server `streak >= 7` and `points === 0`
- `genesis` — `visitedChannelsList` contains `whitepaper`. `first_post`, `first_reply`, `market_seller`, `market_buyer`, and `hash_obsessed` (`sfHashes >= 25000`) read the same counters as their public twins. `scholar` is a `scholar_exam_keys` doc for that account with `type: properties` and `passed: true`. Profile flags such as `certPassed_prop` and `scholar_exam_passed` are not the proof
- Milestone and set badges — count of non-cosmetic `badge_awards`. A set now requires any member that has a server source, including tip, trivia, and quest members

`replyBonusCount` is incremented inside `claimReplyBonus` after that function's own checks (PR #46 is on this base).

## Cosmetic (0 XP, no Favor)

These have no server proof. `awardBadge` returns `{ success: true, cosmetic: true, awarded: 0 }` and does not write `badge_awards` or Favor. `country_set` is not a catalog id; the server treats it as `global_citizen`.

`weekly_hero` stays cosmetic in the catalog. The weekly cron passes `verified: true`, so that grant pays the catalog display XP through the daily cap and adds one Favor point. Combo tiers (`combo_trio`, `combo_mega`, `combo_legend`) stay cosmetic in the catalog and are granted only from server-recorded zones for the offset day (PvP, spin, Timechain TV, forum, prediction, chat, Satoshi's Favor, Beats). Crossing 3, 5, and 8 zones pays the display XP and one Favor point each. A client `combo_bonus` call does not pay XP or grant the badge.

Trivia correct is graded from `functions/src/trivia-bank.js`, a copy of `data/trivia-bank.js`, with the same day index as the client. The functions deploy only ships the `functions/` tree, so the bank has to live there. `triviaCorrect` increments only when `triviaChoice` matches that answer. A missing or wrong choice is the 10 XP attempt and does not move the counter.

A badge the profile already shows (array, map, or display field) gets a `badge_awards` row with `source: legacy`, 0 XP, and no live pool point. Favor for that badge is the backfill. An award row that already exists returns before the pool doc is read.

Trail exams (`trail_*`) are graded in the browser from the question bank. No callable stores a pass, and a client badge id is not accepted as one.

These hidden and profile badges are pure client UI state. Nothing the server already does records them:

- `speed_runner` — 15 channels opened in one browser session
- `marathon` — a 30-minute session timer
- `rabbit_hole` — a 3-hour session timer
- `early_adopter`, `early_bird`, `night_owl`, `ghost_mode`, `insomniac`, `weekend_warrior` — the device clock or the weekend, not a server timestamp
- `triple_threat` — sessionStorage flags for a quest, a chat, and a channel in one sitting
- `search_sleuth` — which search boxes were opened
- `block_42` — a local "found it" flag
- `whitepaper_pilgrim` — a local count of whitepaper opens. Opening the channel once is `genesis`; the ten-session count is not stored
- `contrarian` — a local minority-vote count. The poll vote is stored, but not whether it was the minority at the time
- `dust_collector` — a local 21-day faucet streak. Paid invoices increment `satsWithdrawn`, which is a different badge
- `the_plebeian` — client-computed leaderboard rank. Rank is not a field on the user
- `nacho_*`, including `nacho_friend`, `nacho_curious`, `nacho_10q`, `nacho_20q`, `nacho_50q` — local click and question counts. No callable records a Nacho question
- `bookmark_collector`, `collector`, `bookmarks_*`, `favs_*` — local bookmark and favorite lists
- `nacho_closet_full` — the local closet item list. `spinClosetAwards` counts server closet rolls, which is a different badge
- `pvp_streak` — a localStorage win streak. `settlePvpMatch` stores wins, not a streak
- `market_browse`, `market_saved_5`, `bookworm` — local browsing and reading flags
- `daily_1` through `daily_100` — old visit-count ids with no counter of their own. The streak and all-five badges are the server versions
- Title duplicates with no criterion of their own (`spin_set_t`, `tip_magnet_t`, `flex_legend_t`) and the prefixed families `lb_lurker_`, `chat_lurker_`, `fun_`, `chat_streak_`, `pvp_win_streak_`, `story_`, `dj_`, `react_`, `irl_`, `pow_`, `cert_`, `beats_`, and the old Timechain TV minute badges

Hidden-badge XP is no longer paid by the client. Firestore rules deny client writes to `hiddenBadges` and to the counters above. The client `spinCount` field stays writable and does not satisfy a spin badge.

## Waiting on another change

Nothing in this deploy writes `plebTalkSessions`, so those claims fail closed. `replyBonusCount` is incremented inside `claimReplyBonus`.

`questDays` is written once per offset day in `gradeQuest` when the score is at least 3 and the account is not banned. `tctvWatchDays` increments when `tctvWatchHeartbeat` creates the daily ticket claim. `giftsSent` counts peer keys that were actually used. `onboardingComplete` is set when onboarding finishes. `pushEnabled` is set by `onPushDeviceWritten` after a device token is stored. `pushToken` is not the proof field. Scholar badges read `scholar_exam_keys`, not the client cert flags.

Badge XP, a peer using your key, and a first accepted peer request go through `applyDailyXp`. That hook calls `planDailyXp` (`planBadgeDailyXp` is the same function). Full XP until the daily total is 500, half (floored) until 900, a quarter (floored) until 1,000, then 0. The day starts at 5:00 UTC. The rest is dropped. Nothing is banked. There is no separate +5 XP per topic comment. Every topic post is a topic conversation, and the reply payout is topic-conversation XP (+5, ledger source `topic_conversation`). Peer-key use writes `users/{uid}/xp_ledger/pk_{keyId}` with source `peer_key_use` (requested, awarded, and day). A first accepted peer request writes `pa_{pairId}_{uid}` with source `peer_accept`. The topic-comment badge counter increments the original topic post after it stays visible for 24 hours, at most 5 posts on the offset day the nightly job is running. Posts over that cap are not counted, and their pending docs are deleted so they cannot fill a later run. A mirrored forum copy, or a reply mirrored back from Pleb Talk, does not increment the counter. `creditMatureTopicComments` reads only pending docs older than 24 hours, oldest first, and deletes a pending doc when the decision is final.

## Not revoked

Existing `badge_awards` and `visibleBadges` entries are left in place. `functions/dry-run-badge-criteria.js` lists, in aggregate, how many held paying badges would fail the new rules. It does not write.

`scripts/backfill-badge-favor.js` writes missing contributor docs for canonical badge ids that appear in `badge_awards` or in `badges`, `visibleBadges`, or `donationBadges`. A `hiddenBadges` id is credited only when that same id also appears in one of those sources. Ids that appear only in `hiddenBadges` are excluded, because live clients could write that field before these rules. Ids that show up only on client-writable fields (`earnedHidden`, `displayBadge`, `equippedBadge`), and ids that are not in the catalog, are excluded too. Dry-run prints those excluded counts by reason (`hidden-only`, `client-writable-field`, `not-in-catalog`). It skips banned users and any badge already credited by `{uid}_badge_{badgeId}`, `{uid}_badge_{sanitized name}`, or `{uid}_{YYYY-MM-DD}_badge_{sanitized id or name}`. Each new doc has `pointsAdded: 1`, `source: 'backfill'`, and the user's faction or null. `--apply` increments that faction's total, or `factionTotals.unaffiliated`, by the number written. It does not change live pool points or the Favor window. Dry-run is the default and prints counts per faction. It has not been run. The prior dry-run planned 3,247 docs; about 695 of those came only from `hiddenBadges`, so the filtered plan is about 2,552 docs.

## Account deletion

`deleteAccount` removes `market_listing_counts`, `market_listing_daily`, `market_message_counts`, and `market_sale_counts` for that user after the sign-in is deleted.

## This badge deploy

Deploy `firestore.rules` and `firestore.indexes.json` (the `topic_comment_pending` index on `open` + `createdAtMs`) before or with the functions. `sendKeys` reads `faucet_ledger/{uid}` inside its transaction and rejects with `permission-denied` when `rewardBlocked` is true, so a banned account cannot send keys or earn key-send XP.

Functions: `awardPoints`, `openGift`, `sendKeys`, `decryptCipher`, `claimCipherWin`, `adminMarkCipherWinPaid`, `tctvWatchHeartbeat`, `gradeQuest`, `spendTickets`, `spendTicketsForFreeze`, `managePeer`, `monthlyRaffleDraw`, `payWeeklyPredictors`, `payMonthlyPredictors`, `totpVerify`, `chooseFaction`, `claimOnboardingQuestStep`, `onPushDeviceWritten`, `postTopicComment`, `moderateTopicPost`, `deleteTopicComment`, `creditMatureTopicComments`, `refreshBadgeDistribution`, `refreshBadgeDistributionHttp`, `mergeAnonBadges`.

`refreshBadgeDistribution` and `refreshBadgeDistributionHttp` rebuild badge stats from `badgeRules.isKnown`. `mergeAnonBadges` recomputes with `verifiedIds`. Both need this deploy because the catalog gained badges. `creditMatureTopicComments` needs Cloud Scheduler (05:15 UTC).

`functions/scripts/backfill_badge_counters.js` raises the new counters from existing records and writes badge rows. Dry-run is the default. `--apply` writes counters and badges. `--pay-xp` (with `--apply`) also pays catalog XP, bypassing the daily cap, and the one Favor point plus any rank-up Favor. That payment writes `xp_ledger/{badgeId}` with source `badge_backfill`, which `backfill_badge_xp.js` will not pay again. Without `--pay-xp` the award row stays at 0 XP. A legacy profile badge subtracts its old table XP first (`first_purchase` old 100 pays 0). It skips banned users. On `--apply` it writes one `notifications/badge_backfill_v1_{uid}` summary and `users/{uid}.badgeBackfillToast`, and skips both when that notice already exists. Favor faction totals increment in that same user batch. The owner clears the toast flag with `ackBadgeBackfillToast`. A deep link does not clear it until the toast has been shown. It has not been run. `functions/scripts/backfill_badge_xp.js` is a different script and is not part of this run.

## Deploy order

1. `firestore.rules` — profile denylist of server-only fields (live client saves stay writable, including `notificationPrefs`, `beatsShowUncensored`, `completedQuests`, `lqProgress`, and the client `spinCount` field; `referredBy` and `mergedAnon` are denied client writes; `lastTriviaDate`, `lastPollDate`, `lastQuestDate`, `hiddenBadges`, and the family counters `flexTotals`, `flexAllDays`, `triviaCorrect`, `triviaStreakDay`, `questsPassed`, `lqPassed`, `spinDays`, `spinStreak`, `spinHitRare`, `spinClosetAwards`, `tipsVerified`, `tipsSentSats`, `tipsReceived`, `raidDamageAllTime`, `raidBossesDefeated`, `raidWins`, and `streakFreezesUsed` are server-only), `poll_votes` client writes off, server-only `market_listing_daily`, `market_message_counts`, `market_sale_counts`, and `polls/{day}/votes`.
2. Functions — `awardBadge` on every grant path (badges, donations, weekly hero, peers, combos, counters), `contributeFavor` without `badge_earned`, `dailyPollVote`, listing cap, message and sale triggers, activity counters, `claimSayHi` / `armSayHi`, trifecta credit with `rewardBlocked`, nightly reconcile, distribution refresh, anon-badge recompute, donation cap, peer grants.
3. Hosting. The service worker placeholder is `btc-archive-v2362` and is renumbered at ship. `index.html` and `404.html` stay identical.

Merged collection bonuses are granted inside `awardBadge` after a newly granted member badge, so the functions above must be redeployed together. `onBadgeAwardCreated` retries that grant when `users/{uid}/badge_awards/{badgeId}` is created, which covers a crash after the last member commit. Existing award docs do not fire it, so a deploy does not pay historical completions. The client cannot claim a collection bonus. Completion counts `badge_awards` plus `badges`, `visibleBadges`, and `donationBadges`. A `hiddenBadges` id counts only when that same id is already in one of those sources. It does not count `earnedHidden`, `displayBadge`, or `equippedBadge`. The bonus is the server-paid XP of the old sets (9,150 across the 11 collections), including 0 for Fun and Fitness. Completion requires every member the server can award. Entertainment's three provable badges pay 150. Fun and Fitness has no such member, so it requires all 19 server-held badges, pays 0 XP, and still records Favor and the congrats. The first record adds ten Satoshi's Favor points (`pointsAdded: 10` on `contributors/{uid}_badge_{bonusId}`, the same increment on `userSfPoints` and `factionTotals`, and the pool math `contributeFavor` uses for more than one point). After that transaction commits, Nacho posts one Global Chat message with a deterministic id. When `public_profiles/{uid}.username` is a real username, the text has one `@username` and `mentionUid` is that uid, and a `chat_mention` notification is written so the mention still notifies even though `onChatMessageCreated` skips `nacho-bot`. A missing username, or the literal Anonymous, is not tagged. `functions/scripts/backfill_collection_bonus.js` counts users who already qualify with that same held set and prints Favor at 10 per bonus it would record. It also prints how much of each full bonus a fresh day would drop under the 1,000 XP cap. Dry-run is the default and prints counts only. `--apply` pays the remainder through `grantCollectionBonus` and `applyDailyXp` and does not post chat. It skips banned users. It has not been run. `firestore.rules` did not change.

`claimSayHi` and `armSayHi` must be deployed. Production had no Say hi claims; the callable is the only writer, App Check stays enforced, and a failed claim now toasts and retries once. A message timestamped before the arm is still rejected.

## Nightly job

`reconcileDailyProofs` at 05:15 UTC grants a missed trifecta point and the all-five badge for the previous server day (5:00 UTC). It is idempotent per uid and day. It skips anonymous users. Trifecta credit and the all-five payout both use `rewardBlocked` (`ban_reason`, `banned`, `satsDisabled`, and `faucet_ledger/{uid}.banned`).
