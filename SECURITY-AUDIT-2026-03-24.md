# 🔒 Security Audit — Bitcoin Education Archive
**Date:** March 24, 2026  
**Auditor:** Automated + Manual Review  
**Scope:** All source JS files, index.html, Firestore rules, SW

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 2 |
| 🟠 HIGH | 5 |
| 🟡 MEDIUM | 6 |
| 🟢 LOW | 4 |

Your Firestore rules are **well-written** — points capped at +2200, username validation, auth checks on most collections. The main risks are client-side XSS vectors, NWC wallet secrets in localStorage, and missing rate limits on some Firestore writes.

---

## 🔴 CRITICAL

### C1. NWC Wallet Secret Stored in Plain localStorage
**File:** `lightning.js`  
**Issue:** The NWC connection string (including the private `secret` key) is saved to `localStorage.btc_ln_state` in plain text. Any XSS vulnerability or browser extension can read this and steal the user's wallet funds.

**Fix:** Encrypt before storing, or don't persist the secret at all — require users to re-enter the NWC URI each session.
```js
// Option A: Don't persist secrets
// In the save function, strip nwcSecret before saving:
if ('nwc' === e.method) {
    t.nwcRelay = e.nwcRelay;
    t.nwcPubkey = e.nwcPubkey;
    // DON'T save: t.nwcSecret = e.nwcSecret;
}
```

### C2. Chat Image Data URLs Stored in Firestore Without Size Cap Enforcement
**File:** `global-chat.js` (line ~1309)  
**Issue:** Base64 image data URLs up to ~900KB are written directly to Firestore documents. A crafted large image could approach the 1MB Firestore doc limit. More critically, these data URLs are rendered via `innerHTML` with `<img src="...">` — a malicious data URL starting with `data:text/html;base64,...` could bypass image rendering.

**Fix:** Validate that data URLs start with `data:image/` before storing:
```js
// In sendImageMessage():
if (!dataUrl.startsWith('data:image/')) {
    showToast('Invalid image format');
    return;
}
```

---

## 🟠 HIGH

### H1. innerHTML XSS in Chat Message Rendering
**File:** `global-chat.js` (line ~330)  
**Issue:** `formatChatText()` processes `esc(m.text)` which escapes HTML, but then runs regex replacements that re-introduce HTML (URL linking, @mentions). A crafted message like `@<img src=x onerror=alert(1)>` could survive the escapeHtml + formatChatText pipeline depending on the `esc()` → regex ordering.

**Fix:** Ensure `formatChatText` only produces safe HTML by running sanitization AFTER all regex transforms:
```js
// After all transforms in formatChatText, strip any remaining tags except allowed ones:
text = text.replace(/<(?!\/?(?:a|strong|em|span|div)\b)[^>]+>/gi, '');
```

### H2. Points/Tickets Awarded Client-Side
**File:** `ranking.js` (line ~1638)  
**Issue:** `awardPoints()` increments points directly via Firestore client writes. While Firestore rules cap single updates at +2200, a user could call `awardPoints(2200, 'hack')` repeatedly from the console. The daily cap logic is client-side only.

**Fix (low priority — noted in MEMORY.md):** Move points to Cloud Functions. Short-term: add a server-side daily cap by writing a `lastPointsDate` + `dailyPointsAwarded` field validated in Firestore rules.

### H3. Admin Check is Client-Side Email Comparison
**Files:** `app.js`, `global-chat.js`, `forum.js`  
**Issue:** Admin privileges (delete any message, bypass tier locks) check `auth.currentUser.email === 'needcreations@gmail.com'` client-side. If someone gains access to a Firebase Auth account with that email (e.g., credential stuffing), they get full admin access. Firestore rules also use this pattern.

**Fix:** Use Firebase Custom Claims instead:
```js
// In Cloud Functions, set admin claim:
admin.auth().setCustomUserClaims(uid, { admin: true });
// In Firestore rules:
allow delete: if request.auth.token.admin == true;
// In client:
var isAdmin = auth.currentUser.getIdTokenResult().then(r => r.claims.admin);
```

### H4. Forum/Marketplace Image Uploads to Firebase Storage Lack Auth Validation
**File:** `marketplace.js` (line ~983), `beats.js` (line ~611)  
**Issue:** Images are uploaded to Firebase Storage paths like `marketplace/{uid}/...`. If Storage rules aren't restrictive, any authenticated user could upload to another user's path or upload non-image files.

**Fix:** Verify Firebase Storage rules restrict writes to the user's own path:
```
match /marketplace/{userId}/{allPaths=**} {
  allow write: if request.auth.uid == userId
               && request.resource.contentType.matches('image/.*')
               && request.resource.size < 5 * 1024 * 1024;
}
```

### H5. DM Conversations Readable by Any Participant
**File:** `messaging.js`, Firestore rules  
**Issue:** DM conversations use `participants` array-contains queries. If a user knows another conversation's document ID, the `dm_messages` subcollection may be readable. Verify rules restrict reads to participants only.

**Fix:** In Firestore rules for dm_messages:
```
match /dm_conversations/{convoId}/messages/{msgId} {
  allow read: if request.auth.uid in get(/databases/$(database)/documents/dm_conversations/$(convoId)).data.participants;
}
```

---

## 🟡 MEDIUM

### M1. No Rate Limit on Forum Post Creation
**File:** `forum.js`  
**Issue:** Chat has a 3-second rate limit, but forum post creation has no client-side rate limit. A user could spam-create posts rapidly.

**Fix:** Add rate limiting similar to chat:
```js
var _lastForumPost = 0;
// In submitForumPost():
if (Date.now() - _lastForumPost < 30000) { showToast('Wait 30s between posts'); return; }
_lastForumPost = Date.now();
```

### M2. No Rate Limit on Marketplace Listing Creation
**File:** `marketplace.js`  
**Issue:** Same as M1 — no rate limit on creating marketplace listings.

**Fix:** Add 60-second cooldown between listings.

### M3. Notification Creation Open to Any Auth User
**File:** Firestore rules — `notifications` collection  
**Issue:** `allow create: if request.auth != null;` — any authenticated user can create notifications for any other user. A malicious user could spam fake notifications.

**Fix:** Restrict notification creation to Cloud Functions, or validate the sender:
```
allow create: if request.auth != null
              && request.resource.data.senderId == request.auth.uid;
```

### M4. `new Function()` Used for Dynamic onclick Handlers
**File:** `app.js` (line ~3055, ~3103)  
**Issue:** `btn.onclick = new Function(action)` where `action` comes from `APP_PAGES` data. While this data is hardcoded, if it ever incorporated user input, it would be a code injection vector.

**Fix:** Replace with a lookup table:
```js
var actionMap = { '_nacho': enterNachoMode, '_forum': function(){ go('forum') }, ... };
btn.onclick = actionMap[item.id] || function() { eval(item.action); };
```

### M5. Service Worker Caches Sensitive Data
**File:** `sw.js`  
**Issue:** The SW pre-caches `bundle.js` which contains the full app logic. Offline cache also stores channel data. If a device is shared, cached data persists.

**Fix:** Add a cache-clear on logout:
```js
// In logout function:
caches.keys().then(k => k.forEach(c => caches.delete(c)));
```

### M6. Firebase App Check Not Enforced
**Issue:** The Firebase App Check SDK is loaded but not enforced. Without enforcement, anyone can call Firestore APIs directly using your project's public config.

**Fix:** Enable App Check with reCAPTCHA Enterprise (noted in MEMORY.md as future work).

---

## 🟢 LOW

### L1. Cloudflare API Token in Source
**File:** Various deployment scripts  
**Issue:** CF API token appears in MEMORY.md / deploy scripts. If the workspace is ever exposed, the token grants DNS/cache purge access.

**Fix:** Use environment variables exclusively. Already partially done via `.env`.

### L2. sanitizeInput Only Used 3 Times
**File:** `ranking.js`  
**Issue:** `sanitizeInput()` is only called in 3 places (username, email, suggestion). Forum posts, marketplace listings, and DMs use `isCleanText()` (profanity only) but no HTML sanitization beyond `escapeHtml`.

**Fix:** Apply `sanitizeInput()` to all user-generated text before Firestore writes.

### L3. Profanity Filter is Basic String Match
**File:** `global-chat.js` (line ~56)  
**Issue:** The profanity filter uses exact word matching. Easy to bypass with character substitutions (already partially handled by `isCleanTextV2` in audit-fixes).

**Fix:** Already improved in audit-fixes-v2. Consider a more comprehensive list.

### L4. No HTTPS Enforcement in Service Worker
**File:** `sw.js`  
**Issue:** SW doesn't force HTTPS. GitHub Pages serves HTTPS by default, but explicit enforcement adds defense in depth.

**Fix:** Already handled by Cloudflare's "Always Use HTTPS" setting. No code change needed.

---

## ✅ What's Already Good

- **Firestore rules** are well-structured with auth checks, field validation, and points cap (+2200)
- **Username validation** enforced both client-side and in Firestore rules (3-20 chars)
- **escapeHtml/esc()** used consistently in chat rendering
- **Rate limiting** on chat messages (3s cooldown)
- **Profanity filters** on chat, forum, and marketplace
- **File size limits** on all upload paths
- **Admin email check** is at least consistent (same email everywhere)
- **Anonymous users blocked** from creating forum posts, chat messages, DMs
- **Global chat text size** validated in Firestore rules (≤300 chars or ≤1MB for images)
- **Default deny** rule at the bottom of firestore.rules catches unmatched paths

---

## Recommended Priority

1. **C1** — NWC secret in localStorage (fix now — user funds at risk)
2. **H1** — Chat XSS hardening (fix now — affects all users)
3. **C2** — Validate data URL format (quick fix)
4. **M3** — Notification spam protection (Firestore rule change)
5. **M1/M2** — Rate limits on forum/marketplace (quick client-side fix)
6. **H3** — Custom Claims for admin (requires Cloud Functions setup)
7. **M6** — Firebase App Check (requires reCAPTCHA Enterprise)
