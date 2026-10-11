# Gifting System — Design Spec
**Date:** 2026-10-11  
**Status:** Approved for implementation  
**Author:** Rufus

---

## Overview

Peer-to-peer gifting system modeled on Pokémon GO's gifting mechanic. Users earn gifts from the daily wheel spin, send them to peers, and recipients open them to reveal Orange Tickets. The ticket count is sealed server-side and never exposed until the gift is opened.

---

## User Flow

1. User spins the daily wheel → always receives 5 gifts added to inventory (plus normal wheel reward)
2. User views their gift inventory (in Settings → Gifts tab)
3. User sends a gift to a peer → +25 XP awarded to sender
4. If target is not a peer, show "Add Peer first" option with inline peer request button
5. Recipient gets a notification with an inline "🎁 Open Gift" button
6. Opening triggers a brief animation, reveals ticket count, adds tickets to recipient's `orangeTickets`

---

## Constraints

- **Gifts earned per spin:** 5 (guaranteed, in addition to normal spin reward)
- **Send limit:** No daily cap — unlimited sends as long as inventory has gifts
- **Open limit:** Max 20 gifts opened per day (enforced server-side)
- **Ticket odds:** 1 ticket = 60%, 2 tickets = 30%, 3 tickets = 10%
- **Peers only:** Can only send to mutual peers; non-peers see "Add Peer" prompt

---

## Data Model

### Collection: `gifts/{giftId}`

```
{
  ownerId:      string,   // UID of current holder (sender's inventory or pending for recipient)
  status:       'inventory' | 'sent' | 'opened',
  ticketCount:  1 | 2 | 3,   // sealed server-side; NEVER included in client reads until status='opened'
  createdAt:    timestamp,
  createdDateKey: string,  // 'YYYY-MM-DD' (5 AM UTC offset, matches getDailyKey)

  // Set on send:
  sentTo:       string | null,
  sentBy:       string | null,
  sentByName:   string | null,
  sentAt:       timestamp | null,
  sentDateKey:  string | null,   // 'YYYY-MM-DD' — used for open-cap enforcement

  // Set on open:
  openedAt:     timestamp | null,
  openedBy:     string | null,
}
```

**Field exposure rules (enforced by Cloud Function responses, not raw Firestore reads):**
- `ticketCount` is always returned as `null` in client reads until `status === 'opened'`
- The CF response from `openGift` is the only place `ticketCount` is revealed

---

## Cloud Functions

### 1. `awardDailyGifts` (callable)
- Called client-side after successful wheel spin result
- Auth: non-anonymous only
- Guard: checks `users/{uid}.lastGiftSpinDate` server-side; if already equals today's `getDailyKey()`, returns `{alreadyAwarded: true}` — idempotent
- Writes 5 new `gifts/{id}` docs with `status='inventory'`, `ownerId=uid`, random `ticketCount` (60/30/10 weighted), sealed (client cannot see ticketCount at this stage)
- Updates `users/{uid}.lastGiftSpinDate = today` atomically in same transaction
- Returns `{success: true, giftsAdded: 5}`

### 2. `sendGift(giftId, recipientUid)` (callable)
- Auth: non-anonymous only
- Validates:
  1. Gift doc exists and `ownerId === callerUid` and `status === 'inventory'`
  2. `recipientUid !== callerUid`
  3. Caller's `users/{uid}.peers` array contains `recipientUid` (mutual peer check)
  4. `recipientUid` is a valid, non-anonymous user
- Atomically in a transaction:
  - Updates gift: `status='sent'`, `sentTo`, `sentBy`, `sentByName`, `sentAt`, `sentDateKey`
  - Updates `ownerId = recipientUid` (gift now belongs to recipient)
- Awards sender 25 XP via `awardPoints` helper
- Creates notification for recipient: `type='gift_received'`, with `giftId` attached
- Returns `{success: true}`
- **Exploit mitigations:**
  - Peers check is server-side only (can't be bypassed client-side)
  - Gift ownership verified before status change
  - No client field for `ticketCount` is ever written by the sender

### 3. `openGift(giftId)` (callable)
- Auth: non-anonymous only
- Validates:
  1. Gift doc exists, `ownerId === callerUid`, `status === 'sent'`
  2. Caller is `sentTo` (prevent opening someone else's gift if ownerId ever got confused)
  3. Daily open count: query `gifts` where `openedBy=callerUid` AND `sentDateKey=today` AND `status='opened'`, count must be < 20
- Atomically in a transaction:
  - Updates gift: `status='opened'`, `openedAt`, `openedBy`
  - Increments `users/{uid}.orangeTickets` by `ticketCount`
- Returns `{success: true, ticketCount: N}` — this is the ONLY time ticketCount is revealed
- **Exploit mitigations:**
  - Daily cap enforced server-side via Firestore query count
  - Idempotency: if gift already `status='opened'`, return error `already-opened`
  - `ticketCount` only returned in response, never stored visibly before this point

---

## Firestore Rules Changes

### 1. Add `gifts` collection rule
```
match /gifts/{giftId} {
  // Participants (sender or recipient) can read their own gifts
  // ticketCount is excluded in CF responses pre-open; rules allow read but CF masks the field
  allow read: if request.auth != null
              && (resource.data.ownerId == request.auth.uid
                  || resource.data.sentBy == request.auth.uid);
  // ALL writes are Cloud Function only (Admin SDK)
  allow write: if false;
}
```

### 2. Add `lastGiftSpinDate` to users denylist
In the `users/{userId}` `allow update` denylist, add:
```
'lastGiftSpinDate',
```
This prevents a client from resetting their own `lastGiftSpinDate` to a past date and claiming 5 gifts multiple times per day.

### 3. Note on notifications
`gift_received` notifications are written by CF via Admin SDK (bypasses rules). The existing notifications collection CF-write pattern already handles this correctly — no rule change needed for notification creation.

---

## Frontend — `gifting.js` (new file)

### Spin hook
- After successful spin animation resolves (existing `resultDiv.innerHTML` block around line 945 of `app.js`), call `awardDailyGifts()` CF
- Show toast: "🎁 +5 gifts added to your inventory!"
- Non-blocking — don't delay spin result display

### Gift inventory UI
- New tab in Settings: "🎁 Gifts" 
- Shows count: "X gifts in inventory"  
- Lists gifts as cards with peer picker dropdown (only shows peers)
- "Send" button per gift → calls `sendGift(giftId, peerUid)` → success toast
- If no peers: "Add peers to start sending gifts!" with link to Peers tab

### Send from user profile
- Add "🎁 Send Gift" button to `showUserProfile()` modal
- If already peers AND inventory > 0: show gift picker → send
- If not peers: "Add as peer first 🧡" → triggers `managePeer('send', targetUid)`
- If peers but inventory = 0: "No gifts in inventory — spin the daily wheel!"

### Notification enhancements
- In `showNotifications()` in `notifications.js`, handle two new types:
  - `type === 'peer_request'`: show Accept / Decline buttons (already exists, but ensure inline buttons render)
  - `type === 'gift_received'`: show "🎁 Open Gift" button → triggers open flow
- Opening from notification: show gift open modal inline or as overlay

### Gift open animation + reveal
- CSS animation: gift box (🎁) scale-up bounce ~0.4s → shake ~0.3s → explode/fade to reveal
- Reveal card: "🎫 You got **N Orange Ticket(s)**!" with ticket count large and centered
- Orange confetti burst (reuse existing `launchConfetti` if available)
- Toast: "+N 🎫 Orange Tickets added!"
- Update `currentUser.orangeTickets` locally after successful open

---

## Security Summary

| Threat | Mitigation |
|---|---|
| Client claiming gifts without spinning | `lastGiftSpinDate` in user denylist + CF guard |
| Client opening >20 gifts/day | Server-side count query in `openGift` CF |
| Opening another user's gift | `sentTo === callerUid` check in CF |
| Sending to non-peer | `peers[]` array check server-side in `sendGift` |
| Double-opening a gift | `status === 'sent'` check; already-opened returns error |
| Client reading ticketCount early | CF never exposes `ticketCount` in responses until open; Firestore rules allow read but field is only meaningful post-open via CF response |
| Client self-awarding tickets | `orangeTickets` already in users denylist; only CF increments it |
| Sending gift you don't own | `ownerId === callerUid` check in `sendGift` CF |
| Anonymous user exploits | All three CFs gate on non-anonymous auth |

---

## Bundle Integration

`gifting.js` is a **lazy-loaded** file. Add to `index.html` with `?v=` suffix. Does NOT go in bundle.js. Loaded on-demand when user opens the gifts UI or notifications.

---

## Files Changed

| File | Change |
|---|---|
| `gifting.js` | New file — all frontend gifting logic |
| `functions/index.js` | 3 new Cloud Functions: `awardDailyGifts`, `sendGift`, `openGift` |
| `firestore.rules` | Add `gifts` collection rule + `lastGiftSpinDate` to denylist |
| `app.js` | Hook into spin complete to call `awardDailyGifts` |
| `notifications.js` | Add inline action buttons for `gift_received` type |
| `ranking.js` | Add "🎁 Send Gift" button to user profile modal |
| `index.html` | Add `gifting.js?v=...` lazy-load script tag |
