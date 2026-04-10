# Internal Security Audit Report
**Date:** 2026-04-10
**Scope:** All .js files, firestore.rules, Cloud Functions, Workers
**Auditor:** Rufus (post-ProofOfCash fixes)

---

## Summary Table

| # | Severity | Title | File | Status |
|---|----------|-------|------|--------|
| F1 | Critical | Hardcoded bot token + admin key | workers/rss-feed/worker.js:14,19 | KNOWN — waiting on Wrangler secrets |
| F2 | High | Telegram bridge source spoofable in Firestore rules | firestore.rules:508-512 | NEW — needs fix |
| F3 | High | Username backslash XSS in onclick handlers (report/block/DM) | messaging.js:290-294,532-534,629,640,901,942 | NEW — needs fix |
| F4 | Medium | HTML injection in /announce link field | workers/rss-feed/worker.js:294 | KNOWN — needs fix with worker update |
| F5 | Medium | lnAuthChallenge has no rate limiting | functions/index.js:518 | NEW |
| F6 | Low | PVP leaderboard title attribute unescaped | ranking.js:2900 | NEW |
| F7 | Info | new Function() used for onclick restoration | app.js:3104,3152 | Internal only, not user-controlled |

---

## F2. Telegram Bridge Source Spoofable (HIGH)

**File:** `firestore.rules:505-512`

Any authenticated user can write to `global_chat` with `source: 'telegram'`, spoofing any UID and name. The Telegram bridge rule has no restriction on WHO can use the `source: 'telegram'` path — only that the data has the right shape.

**Impact:** Impersonate any Telegram user or make messages appear to come from Telegram. Bypass the `uid == request.auth.uid` check by using the Telegram path.

**Fix:** Restrict Telegram bridge writes to admin emails only (the CF Worker uses a service account, but the Firestore rules should also restrict):

```
// Telegram bridge: only admin/service account
&& (request.auth.token.email == 'needcreations@gmail.com'
    || request.auth.token.email == 'info.603btc@gmail.com')
```

Or use a dedicated service account UID check.

---

## F3. Username Backslash XSS in onclick Handlers (HIGH)

**File:** `messaging.js:290-294, 522, 532-534, 629, 640, 901, 942`

Multiple onclick handlers use `.replace(/'/g, "\\'")` to escape single quotes in usernames. A username containing a backslash breaks out of the string (same vector as H3 lightning field).

The lightning field was patched with `.replace(/[\\'"]/g, '')` but these other handlers still use the old vulnerable pattern.

**Impact:** If a user sets their Firestore `username` to contain `\');alert(1);//`, anyone viewing their profile or DM list gets XSS.

**Note:** The `username` field is validated (3-20 chars, profanity filter) but backslashes are NOT stripped. The Firestore rules don't block special characters in usernames beyond length.

**Fix:** Replace all instances of `.replace(/'/g, "\\'")` with `.replace(/[\\'"]/g, '')` in messaging.js.

---

## F5. lnAuthChallenge No Rate Limiting (MEDIUM)

**File:** `functions/index.js:518`

`lnAuthChallenge` creates a Firestore document per call with no rate limiting. An attacker can spam it to create millions of `lnauth_challenges` documents (billing attack on Firestore).

**Fix:** Add IP-based rate limiting (same pattern as nostrAuth).
