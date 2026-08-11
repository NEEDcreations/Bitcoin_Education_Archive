# Badge System Audit Report
**File audited:** `badges.js` (supporting checks in `ranking.js`, `app.js`, `engagement.js`)
**Date:** 2026-08-11

---

## 1. Executive Summary

The badge system relies on a **local `earnedBadges` Set** that is seeded from `localStorage('btc_badges')` on load, and then later back-filled from Firestore `currentUser.visibleBadges` via `markVisibleBadgesReady()`. Badge checks run on a 30-second timer guarded by `window._visibleBadgesReady`. The Cloud Function `awardPoints` is the only writer of `visibleBadges` (good). However, there are **critical race conditions** and **data-loss paths** that can cause:

- Re-award toasts for badges already owned (race on slow networks / sign-out)
- Permanent loss of anonymous user badges on sign-in to existing accounts
- Loss of locally-tracked badge progress on new devices or after logout
- Combo / set badges re-firing on new devices because their `check()` relies on `localStorage` sentinel keys that are not synced to Firestore

---

## 2. Root Cause of Re-Earning

### Bug A – Firestore sync timeout race
- `initBadges()` starts a 30-second `checkBadges()` interval immediately (`badges.js:630`).
- `checkBadges()` bails if `!window._visibleBadgesReady` (`badges.js:727`).
- `markVisibleBadgesReady()` (ranking.js:1352,1637,1681,1892) sets `window._visibleBadgesReady = true` **only after** `loadUser()` completes and Firestore data is loaded.
- A **20-second safety timeout** (`badges.js:723`) will force `_visibleBadgesReady = true` if Firestore hasn't responded yet.
- If `loadUser()` takes >20 s, or the guard fires before `currentUser` is populated, the next `checkBadges()` tick runs with `earnedBadges` seeded **only from localStorage** (`badges.js:632`).
- Any badge whose `check()` evaluates to `true` against local state will be **re-added to `earnedBadges`, toast shown, and `awardPoints` called again**.
- `awardPoints` ultimately hits the Cloud Function, which should deduplicate (return `badgeDuplicate` or `success:false`), causing `checkBadges()`'s `.then` handler to **roll back the badge** from `earnedBadges` (`badges.js:773-776`).
- **Result:** The user sees spurious toasts and celebration modals for badges they already own. The XP is not double-granted server-side, but the UX is broken.

### Bug B – Sign-out clears badge localStorage
- `signOutUser()` (ranking.js:6373) calls `clearUserLocalStorage()`.
- `clearUserLocalStorage()` (ranking.js:6358) deletes **every** `btc_*` key **except** an explicit preserve list (`btc_theme_oled`, `btc_font_size`, etc.).
- `btc_badges` is **NOT preserved**.
- On the next sign-in, `earnedBadges` starts empty until `markVisibleBadgesReady()` restores it from Firestore. If the safety timeout fires first → Bug A triggers.

### Bug C – `_claimSetBonus` and `_checkBadgeSets` re-fire on new device / cache clear
- `_claimSetBonus` (badges.js:1389–1420) guards against re-claim with a **localStorage sentinel** (`btc_badge_earned_` + `set.bonusId`).
- The sentinel is **only restored** in `markVisibleBadgesReady()` from the `earnedBadges` set (`badges.js:685-705`), which itself comes from `visibleBadges`.
- If `visibleBadges` is missing a set badge (e.g., awarded before the Cloud Function wrote it, or on an anonymous account), the sentinel is never restored.
- On a new device or after `clearUserLocalStorage()`, the sentinel is gone. `_checkBadgeSets()` sees `window.earnedBadges.has()` for all constituent badges and calls `_claimSetBonus()`, which awards the set badge again.
- `_claimSetBonus` sets the sentinel and shows the toast **even if `awardPoints` later returns a duplicate** (it lacks the rollback logic that `checkBadges` has for normal badges).

### Bug D – Engagement combo badges (`engagement.js`)
- `engagement.js` line 97 sets `localStorage.setItem('btc_badge_earned_' + tier.badge, '1')` and calls `awardPoints(..., tier.badge)`.
- If the CF succeeds, the badge is in `visibleBadges`. If the CF fails (network), the client still wrote the sentinel. On next load, `checkBadges()` sees the badge in `earnedBadges` (from localStorage `btc_badges`). No re-earning.
- **But** if `btc_badges` is cleared (sign-out) and the badge IS in Firestore, `markVisibleBadgesReady` will restore it. If it is NOT in Firestore (CF never succeeded), it is lost. Then when the user re-earns the combo, it is a first-time award again, causing double XP if the CF later retro-actively succeeds? Actually the CF dedups using `badge_awards` collection. So server-side XP is protected. The primary issue remains UX re-toasting.

---

## 3. Firestore Write Path Analysis

- **No client-side direct writes** to `users/{uid}/visibleBadges` — this is correctly blocked in Firestore rules (comment `badges.js:811`).
- The client calls `firebase.functions().httpsCallable('awardPoints')` (`ranking.js:2193`) with `badgeId` in the payload.
- The Cloud Function is expected to append the badge to `visibleBadges` via `arrayUnion` (or equivalent server-side logic).
- Because only the server mutates `visibleBadges`, there is **no direct merge/overwrite vulnerability** from the client.
- However, the client **does** write `users/{uid}/earnedTitles` directly (`badges.js:858`) via `db.collection('users').doc(auth.currentUser.uid).update({ earnedTitles: merged })`. This is a client-side write but is for titles, not badges, and uses `update` (field-only), which is safe against clobbering other fields as long as the document exists.

---

## 4. localStorage-Only Badges

These badge IDs evaluate their `check()` exclusively (or primarily) against `localStorage` keys that **are not synced to Firestore** by `loadUser()`. On a new device or after `clearUserLocalStorage()`, their conditions read `0`/empty, so they effectively vanish until the user re-performs the actions.

| Badge ID(s) | LocalStorage key(s) read | Synced to Firestore? |
|-------------|--------------------------|----------------------|
| `nacho_quester` | `btc_onboarding_quest_done` | ❌ No |
| `bookworm`, `favs_10`, `favs_25` | `btc_favs` | ✅ Yes (favorites) but only after loadUser merges; still check reads localStorage directly |
| `night_owl`, `early_bird` | none (Date) | N/A |
| `cert_scholar` | `btc_scholar_prop_passed` | ❌ No |
| `tctv_tuned_in`, `tctv_couch_potato`, `tctv_binge_watcher`, `tctv_couch_king`, `tctv_satellite` | `btc_tctv_watch_time` | ❌ No |
| `tctv_channel_hopper` … `tctv_timechain_surfer` | `btc_tctv_channel_switches` | ❌ No |
| `cert_tech` | `btc_scholar_tech_passed` | ❌ No |
| `nacho_chatterbox`, `nacho_bestie`, `nacho_whisper` | `btc_nacho_interactions` | ❌ No |
| `chat_first` … `chat_500` | `btc_chat_msgs` | ❌ No |
| `chat_streak_3`, `chat_streak_7`, `chat_streak_30` | `btc_chat_streak` | ❌ No |
| `dj_first` … `dj_listener_50` | `btc_dj_sets`, `btc_dj_songs`, `btc_dj_listens` | ❌ No |
| `producer_1`, `producer_10` | `btc_beats_uploads` | ❌ No |
| `pvp_first` … `pvp_played_50`, `pvp_win_streak_*` | `btc_pvp_wins`, `btc_pvp_losses`, `btc_pvp_win_streak` | ❌ No |
| `forum_first` … `forum_reply_10`, `article_5`, `article_10` | `btc_forum_post_count`, `btc_articles_published`, `btc_forum_reply_count` | ❌ No |
| `first_purchase` | `btc_fp_completed` | ❌ No |
| `lightning_setup` | `btc_lightning_setup` | ❌ No |
| `spin_1` … `spin_100`, `spin_streak_*`, `spin_jackpot` | `btc_spin_count`, `btc_spin_streak`, `btc_spin_hit_rare` | Partially (spinCount synced) but `streak` and `hit_rare` are not |
| `trail_*` | `btc_trail_passed` | ❌ No |
| `sf_first_hash` … `sf_block_solver`, `sf_contributor` … `sf_contributor_10`, `sf_lucky_*`, `sf_unlucky_*` | `btc_sf_hashes`, `btc_sf_best_hash`, `btc_sf_solved_block`, `btc_sf_activations`, `btc_sf_lucky_count`, `btc_sf_unlucky_count` | ❌ No |
| `raid_boss_slayer` … `raid_winner` | `btc_raid_bosses_defeated` | ❌ No |
| `trivia_first` | `btc_trivia_state` | ❌ No |
| `poll_first` | `btc_poll_state` | ❌ No |
| `daily_triple_1` | `btc_daily_activities` | ❌ No |
| `market_browse`, `market_saved_5` | `btc_market_rules_accepted`, `btc_market_saved` | ❌ No |
| `bookmarks_1`, `bookmarks_10` | `btc_bookmarks` | ✅ Yes (synced), but check reads localStorage directly |
| `dm_first`, `dm_10`, `dm_buddy` | `btc_dms_sent`, `btc_buddy_matched` | ❌ No |
| `react_5`, `react_50`, `react_200`, `react_10`, `react_100`, `react_500` | `btc_chat_reactions` | ❌ No |
| `tip_first`, `tip_10`, `tip_whale`, `tip_sats_10k` | `btc_tips_sent`, `btc_tips_total_sats` | ❌ No |
| `tip_received_1`, `tip_magnet`, `tip_received_50` | `btc_tips_received` | ❌ No |
| `predict_10` … `predict_correct_100` | `currentUser.predictions` | ✅ Firestore field |
| `streak_3` … `streak_365`, `streak_14`, `streak_60`, `streak_200` | `currentUser.bestStreak` | ✅ Firestore field |
| `sats_*` | `currentUser.satsWithdrawn` | ✅ Firestore field |
| `referral_*` | `currentUser.referralCount` | ✅ Firestore field |
| `raid_first` … `raid_100` | `currentUser.raidDamageAllTime` | ✅ Firestore field |
| `beats_first_listen` … `beats_liked_50` | `btc_beats_play_count`, `btc_beats_liked` | ❌ No |
| `nacho_asked_10`, `nacho_asked_100` | `btc_nacho_sent` | ❌ No |
| `nacho_eli5` | `btc_nacho_eli5` | ❌ No |
| `story_begun` … `story_complete` | `btc_nacho_story_awarded` | ❌ No |
| `flex_rookie` … `flex_all_once` | `btc_flex_state` | ❌ No |
| `hall_of_fame` … `satoshis_cipher` | `btc_badges` (count) | ✅ Synced from `visibleBadges` to `btc_badges`, so OK after sync |
| `all_certs` | `btc_scholar_prop_passed`, `btc_scholar_tech_passed`, `btc_trail_passed` | Partially (trails not synced) |
| `jack_of_all` | `btc_badges` array membership | ✅ Synced |
| `combo_trio`, `combo_mega`, `combo_legend`, `weekly_hero` | `btc_badge_earned_combo_*` | ❌ No sentinel (only restored from visibleBadges) |
| `set_miner_complete` … `set_spin_complete`, `set_profile_complete`, `set_pow_complete`, `set_irl_complete`, etc. | `btc_badge_earned_set_*` | ❌ No sentinel (only restored from visibleBadges) |

---

## 5. Device-Switch Risk

When a signed-in user opens the app on a **new device / browser / incognito window** with empty `localStorage`:

1. `earnedBadges` starts empty (`badges.js:621`).
2. `initBadges()` loads `btc_badges` from localStorage → still empty (`badges.js:632`).
3. `loadUser()` fetches Firestore doc and calls `markVisibleBadgesReady()`.
4. `markVisibleBadgesReady()` merges `currentUser.visibleBadges` into `earnedBadges` and writes them to `btc_badges` (`badges.js:685-705`).
5. **For badges stored in `visibleBadges`**, they are restored. No re-earning.
6. **For badges whose `check()` reads localStorage keys not synced to Firestore**, the badge is in `earnedBadges`, so `checkBadges()` skips them (`earnedBadges.has(id)`). This is fine for **not re-earning**.
7. **However**, the user loses the ability to see those badges in UI lists that read `localStorage` directly (e.g., custom stats). Also, `_checkBadgeSets` relies on `window.earnedBadges.has()` which is seeded from `visibleBadges`, so set badges should work.
8. **Anonymous users** have **no Firestore `visibleBadges`**. All badges are in `btc_badges` only. Signing out wipes `btc_badges` permanently. Signing in from anonymous to an existing account does **not** merge anonymous `visibleBadges` (anonymous users never write to Firestore badges). The anonymous badges are lost.

---

## 6. Race Conditions

### Condition 1: `checkBadges()` vs Firestore load
- **Trigger:** Slow network, or `loadUser()` stalls.
- **Code:** `badges.js:723` `setTimeout(..., 20000)` forces `_visibleBadgesReady = true`.
- **Impact:** `checkBadges()` runs before `currentUser.visibleBadges` is known. The `_fsVisibleBadges` guard (`badges.js:731-735`) requires `currentUser` to be defined; if it isn't, the guard is a no-op. Badges already satisfied locally will be re-awarded (toast + `awardPoints` CF call). The CF dedup prevents double XP, but UX is degraded.
- **Severity:** Medium. Visible to users on slow 3G, shared devices, or when Firebase is throttled.

### Condition 2: `_checkBadgeSets()` vs badge restoration
- **Trigger:** `showBadgeToast()` for any badge calls `window._checkBadgeSets()` after 500 ms (`badges.js:793`).
- **Impact:** If `earnedBadges` was just rolled back due to a CF rejection, `_checkBadgeSets()` might see a full constituent set and attempt to claim the set bonus again. But `_claimSetBonus` checks the sentinel, so it's safe on the same device. On a new device with missing sentinel, it re-claims.

### Condition 3: `awardPoints` re-throw on network failure
- `awardPoints` throws on CF failure (`ranking.js:2253`), and `checkBadges()` rolls back the badge from `earnedBadges`.
- Because `earnedBadges` no longer has the badge, the **next** `checkBadges()` tick (30 s later) will re-evaluate the `check()` and re-award. This loops until the network recovers or the local condition becomes false.
- For time-based badges (`night_owl`, `fun_friday`, etc.), the condition may stay true for hours, causing repeated attempts.

---

## 7. Sign-Out / Logout Path

| Component | Line | Behavior |
|-----------|------|----------|
| `signOutUser()` | `ranking.js:6373` | Clears **ServiceWorker caches**, clears **all `localStorage` `btc_*` keys**, then `auth.signOut()` + `location.reload()` |
| `clearUserLocalStorage()` | `ranking.js:6358` | Preserve list is ONLY theme/font/volume/lang/haptics/soundscape/ticker/iOS dismiss/PWA dismiss/swipe hint/auth UID and pending signup fields. **NO badge keys preserved.** |

**Consequences:**
- `btc_badges` → deleted (will be restored from Firestore on next sign-in via `markVisibleBadgesReady()`).
- `btc_badge_earned_*` sentinels → deleted (restored from `visibleBadges`).
- `btc_hidden_badges` → deleted (restored from `currentUser.hiddenBadges` in `loadUser()`).
- Unsynced keys (chat messages, DJ sets, PVP stats, TCTV stats, etc.) → **permanently deleted**.
- On shared/public computers, this is by design (privacy). On personal devices, this is overly aggressive and causes data-loss UX on the next visit until Firestore repopulates localStorage.

---

## 8. Anonymous-to-Signed-In Data Loss

| Component | Line | Behavior |
|-----------|------|----------|
| Anonymous path | `ranking.js:2080-2140` | `awardPoints` returns early for `_isLocal` users. No CF call, no `visibleBadges` write. Badges are stored **only** in `localStorage('btc_badges')`. |
| `saveAnonData()` / redirect recovery | `ranking.js:139-179` | When signing in, if the target Firestore doc **does not exist**, the FULL anonymous doc (`btc_anon_data`) is written. This **includes** `visibleBadges` if the anon doc had them. Good. |
| Existing account merge | `ranking.js:161-177` | If the target Firestore doc **already exists**, the code only awards up to 500 XP via `awardPoints` and sets `mergedAnon: true`. It **does NOT merge** `visibleBadges`, `hiddenBadges`, `earnedTitles`, `readChannels`, bookmarks, or any other badge-related fields from the anonymous session. |

**Impact:** An anonymous user who earned 30 badges and then signs in with an existing Google/Email account **loses all 30 badges** permanently. The Cloud Function cannot retroactively award badges that were never recorded in Firestore.

---

## 9. Specific Line Numbers for Every Bug

### Bug A – 20-second safety timeout allows premature badge checks
- `badges.js:723` `setTimeout(function() { ... window._visibleBadgesReady = true; }, 20000);`
- `badges.js:727-735` `checkBadges()` guard and `_fsVisibleBadges` sync.

### Bug B – `clearUserLocalStorage` wipes badge data
- `ranking.js:6358` `clearUserLocalStorage()` — `btc_badges` not in preserve list.
- `ranking.js:6373` `signOutUser()` calls the clear function.

### Bug C – `_claimSetBonus` has no server-rejection rollback
- `badges.js:1389-1420` `_claimSetBonus` sets sentinel and toasts unconditionally. Does not roll back `earnedBadges` or sentinel on CF rejection.

### Bug D – `_checkBadgeSets` relies on localStorage sentinel that isn't synced
- `badges.js:1423-1430` `_checkBadgeSets` reads `window.earnedBadges` and localStorage sentinel.
- `badges.js:685-705` Sentinels restored only from `earnedBadges` (which comes from Firestore). Missing for badges never written to Firestore.

### Bug E – Anonymous badge loss on merge to existing account
- `ranking.js:161-177` Existing account case: only points merged, no badge field merge.

### Bug F – Many badges read localStorage keys never synced to Firestore
- `badges.js:37` `nacho_quester` -> `btc_onboarding_quest_done`
- `badges.js:59` `bookworm` -> `btc_favs`
- `badges.js:94-98` TCTV watch badges -> `btc_tctv_watch_time`
- `badges.js:100-106` TCTV switch badges -> `btc_tctv_channel_switches`
- `badges.js:108-109` `cert_tech` -> `btc_scholar_tech_passed`
- `badges.js:143-175` Chat / DJ / Producer badges -> various `btc_` keys
- `badges.js:216-226` Forum / article badges -> `btc_forum_post_count`, etc.
- `badges.js:255` `first_purchase` -> `btc_fp_completed`
- `badges.js:256` `lightning_setup` -> `btc_lightning_setup`
- `badges.js:319-331` Spin badges -> `btc_spin_count`, `btc_spin_streak`, `btc_spin_hit_rare`
- `badges.js:333-341` Trail badges -> `btc_trail_passed`
- `badges.js:347-389` Satoshi's Favor badges -> `btc_sf_*`
- `badges.js:391-399` Raid badges -> `btc_raid_bosses_defeated`
- `badges.js:401-406` Trivia badges -> `btc_trivia_state`
- `badges.js:408-411` Poll badges -> `btc_poll_state`
- `badges.js:413-416` Daily triple -> `btc_daily_activities`
- `badges.js:418-421` Marketplace badges -> `btc_market_rules_accepted`, `btc_market_saved`
- `badges.js:423-426` Bookmarks / favorites -> `btc_bookmarks`, `btc_favs`
- `badges.js:428-430` DM / reaction -> `btc_dms_sent`, `btc_buddy_matched`, `btc_chat_reactions`
- `badges.js:432-435` Tips -> `btc_tips_sent`, `btc_tips_total_sats`, `btc_tips_received`
- `badges.js:473-479` IRL attendance -> `btc_irl_attended`, `btc_irl_hosted`
- `badges.js:481-485` Music / beats -> `btc_beats_play_count`, `btc_beats_liked`
- `badges.js:487-490` Nacho questions -> `btc_nacho_sent`, `btc_nacho_eli5`
- `badges.js:492-494` Nacho story -> `btc_nacho_story_awarded`
- `badges.js:506-514` Flex -> `btc_flex_state`
- `badges.js:433-435`, `441-458` Combo / set badges -> `btc_badge_earned_combo_*`, `btc_badge_earned_set_*`
- `engagement.js:97` Sets combo sentinel directly.

### Bug G – `awardPoints` re-throw causes `checkBadges` retry loop
- `ranking.js:2253` `throw e;` inside `awardPoints` after `console.warn`.
- `badges.js:773-783` `.catch` rolls back `earnedBadges`, causing re-check next tick.

---

## 10. Recommended Fixes

### Fix 1 – Increase safety timeout or make it conditional
**File:** `badges.js`
- Remove or extend the unconditional 20-second timeout (`line 723`).
- Instead, only set `_visibleBadgesReady = true` inside `markVisibleBadgesReady()` after Firestore data is actually available.
- If Firestore is truly unreachable, the user is anonymous anyway; badge checks can safely run against localStorage only if `!auth.currentUser || auth.currentUser.isAnonymous`.

### Fix 2 – Harden `_fsVisibleBadges` guard inside `checkBadges`
**File:** `badges.js:731-735`
```javascript
// BEFORE:
var _fsVisibleBadges = (typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.visibleBadges))
    ? currentUser.visibleBadges : [];

// AFTER: also require that _visibleBadgesReady was set by markVisibleBadgesReady, not the timeout
var _firestoreReady = window._visibleBadgesReady && typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.visibleBadges);
var _fsVisibleBadges = _firestoreReady ? currentUser.visibleBadges : [];
```
This prevents the guard from being a no-op when `currentUser` is undefined.

### Fix 3 – Preserve `btc_badges` and key sentinels on sign-out
**File:** `ranking.js:6358`
Add `'btc_badges'` and all `btc_badge_earned_*` keys to the `preserve` array (or prefix-match them into the preserve logic). This prevents the race condition on next sign-in because `initBadges()` will seed `earnedBadges` from localStorage immediately.

### Fix 4 – Sync missing localStorage counters to Firestore
**File:** `ranking.js` `loadUser()`
For every localStorage-only counter used by badges (e.g., `btc_chat_msgs`, `btc_sf_hashes`, `btc_tips_sent`, etc.), either:
- Add Firestore fields and sync them bidirectionally (max of local / server), **OR**
- Change the badge `check()` to read from Firestore fields instead, and ensure those fields are updated by their respective modules.

Short-term mitigation: In `loadUser()`, push all local-only keys up to Firestore if they are larger than Firestore's values.

### Fix 5 – Merge anonymous badges on sign-in to existing account
**File:** `ranking.js:161-177`
If `anonData.visibleBadges` exists and the existing account does not have `mergedAnon`, union the anonymous `visibleBadges` into the existing account's `visibleBadges` using a Cloud Function or a batched write, then set `mergedAnon: true`.

**Do NOT merge** on the client directly to `users/{uid}/visibleBadges` if rules block it; use a dedicated `mergeAnonymousData` Cloud Function.

### Fix 6 – Make `_claimSetBonus` idempotent with server dedup
**File:** `badges.js:1389-1420`
```javascript
// BEFORE: calls showBadgeToast unconditionally after awardPoints
// AFTER: chain on .then and only toast if server confirms (or if it returns badgeDuplicate)
```
Add the same rollback logic that `checkBadges()` uses for normal badges:
- If server returns `success === false` and not `badgeDuplicate`, do not set the sentinel and do not toast.

### Fix 7 – Seed `earnedBadges` from `currentUser.visibleBadges` eagerly in `loadUser`, not just `markVisibleBadgesReady`
**File:** `ranking.js:1482-1486`
The code already merges `visibleBadges` into `localStorage('btc_badges')`. Ensure this happens **before** `markVisibleBadgesReady()` is called. It does, but verify ordering.

### Fix 8 – Reduce `checkBadges` interval or make it event-driven
**File:** `badges.js:633`
30-second polling is unnecessary. Change to:
- Run once immediately after `_visibleBadgesReady`.
- Run on specific events (channel read, quest complete, spin, chat message) instead of polling. This reduces the window for race-condition re-awarding and Toast spam.

### Fix 9 – De-dupe toasts across reloads for rolled-back badges
**File:** `badges.js`
Consider adding a `localStorage`-backed `btc_toasted_badges_v2` list with timestamps, so that even if `earnedBadges` is rolled back and the page reloaded, the badge does not re-toast within the same calendar day. The current `_toastedThisSession` Set is lost on every reload.

---

## 11. Quick Priority Table

| Priority | Issue | File(s) | Impact |
|----------|-------|---------|--------|
| **P0** | Re-earning race on slow networks (20s timeout) | `badges.js:723` | Users see duplicate celebration modals |
| **P0** | Anonymous badge loss on sign-in to existing account | `ranking.js:161-177` | Permanent data loss |
| **P1** | `clearUserLocalStorage` wipes all badge localStorage | `ranking.js:6358` | Causes P0 race and forces re-sync |
| **P1** | `_claimSetBonus` no rollback on rejection | `badges.js:1389-1420` | Re-toasts set completion repeatedly |
| **P2** | 30-second polling retry loop on network errors | `badges.js:633`, `ranking.js:2253` | Toast spam, unnecessary CF calls |
| **P2** | ~80 badges read localStorage-only keys not synced to Firestore | `badges.js` | Missing badges on new devices until actions re-performed |
