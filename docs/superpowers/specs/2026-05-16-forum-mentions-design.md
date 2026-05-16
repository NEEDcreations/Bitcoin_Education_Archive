# Forum @Mentions Design — 2026-05-16

## Overview
Add @mention support across all PlebTalk surfaces: forum posts, forum replies, articles, and article comments. Includes live autocomplete dropdown and notifications for mentioned users.

## Scope
- **Autocomplete dropdown** on 3 textareas: `forumNewBody`, `forumReplyInput`, `articleReplyInput`
- **Render @mentions** as clickable orange links in: forum post body, forum replies, article body (mdToHtml), article comments
- **Notifications** for mentioned users via existing `sendNotification()`

## Architecture

### 1. Autocomplete System (`forumMentionAutocomplete`)
- Attaches via `MutationObserver` on `#forumContainer` — whenever a target textarea appears, bind `input`/`keydown` listeners
- On `input`: detect `@` followed by 2+ chars at cursor position using `selectionStart`
- Debounce 300ms, then query Firestore: `db.collection('users').where('username', '>=', prefix).where('username', '<=', prefix + '\uf8ff').limit(5)`
- Render dropdown absolutely positioned below the textarea
- Arrow keys navigate, Enter/Tab/click selects → inserts `@username ` at cursor position
- Escape or clicking outside dismisses
- Dropdown styled with `var(--card-bg)`, `var(--border)`, `var(--accent)` to match the app

### 2. Render Pipeline (`forumRenderMentions`)
- Single function: takes already-escaped HTML string, returns it with `@username` converted to clickable spans
- Regex: `/@([a-zA-Z0-9_\-\.]{2,20})/g`
- Replacement: `<span class="forum-mention" onclick="forumMentionClick('$1')">@$1</span>`
- Applied AFTER `fEsc()` and AFTER URL linkification (so we don't match @'s inside URLs)
- CSS: `.forum-mention { color: var(--accent); cursor: pointer; font-weight: 600; }`

### 3. Mention Click Handler (`forumMentionClick`)
- Queries Firestore for username → gets UID → calls `showUserProfile(uid)`
- Same two-step pattern as global-chat: try `username` exact match, fallback `username_lower`

### 4. Notification on Submit (`forumNotifyMentions`)
- Shared function called from `forumSubmitPost`, `forumSubmitReply`, `articleSubmitReply`
- Parse body text for `@username` patterns (same regex)
- For each unique username, query Firestore for UID
- Call `sendNotification(uid, 'mention', 'User mentioned you in "Title"', targetType, targetId)`
- Skip self-mentions (don't notify yourself)
- Existing reply/comment notifications to post/article author remain unchanged

### 5. Render Points
| Location | Current | Change |
|---|---|---|
| Forum post body (detail) | `fEsc → \n→<br> → **bold** → URLs` | Add `forumRenderMentions()` after URLs |
| Forum replies | `fEsc → \n→<br> → URLs` | Add `forumRenderMentions()` after URLs |
| Article body | `mdToHtml()` (fEsc → markdown → URLs) | Add `forumRenderMentions()` after URLs inside mdToHtml |
| Article comments | `fEsc(r.body)` only | Add `\n→<br>`, URL linkification, `forumRenderMentions()` |
| Forum post list preview | `fEsc(p.body).substring(0,120)` | No change (too short for interactive mentions) |

### Security
- All @mention text goes through `fEsc()` first — XSS safe
- Firestore prefix query is read-only on public `users` collection
- Debounce + limit(5) prevents Firestore read abuse
- Username regex restricted to `[a-zA-Z0-9_\-\.]{2,20}` — matches existing validation
- Notifications use existing `sendNotification()` which skips self-notifications
