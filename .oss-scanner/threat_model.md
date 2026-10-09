# Threat Model — Bitcoin Education Archive

## Project Overview

Bitcoin Education Archive (bitcoineducation.quest) is a public Bitcoin education web app with:
- User authentication (Firebase Auth: Google, Nostr, Lightning, email/password)
- XP/points/badge system stored in Firestore
- Satoshi's Favor: a mining game that pays real sats via NWC (Nostr Wallet Connect)
- Lightning Network tipping (WebLN / NWC — user-controlled wallets only)
- PVP games with server-side round resolution (Firebase Cloud Functions)
- Community features: forum, global chat, meetup builder, marketplace
- Raid Boss: community XP events with Firestore-backed state
- Firebase Cloud Functions (Node.js) for all privileged server-side logic

## What to Scan

### High Priority
- **Firebase Cloud Functions** (`functions/src/`, `functions/index.js`) — handle sats payouts, XP mutations, PVP resolution, Telegram webhooks. Any auth bypass or logic flaw here has real monetary impact.
- **Firestore security rules** (`firestore.rules`) — ~87KB of rules governing all user data access. Look for rules that are overly permissive, allow unauthorized writes to XP/sats/badge fields, or can be bypassed via crafted queries.
- **satoshi-favor.js** — client-side mining game that calls `hashForFavor` Cloud Function. Look for replay attacks, hash spoofing, or rate limit bypasses that could drain the sats faucet.
- **lightning.js / lightning-tips.js** — NWC wallet integration. Look for unauthorized payment execution or wallet drain paths.
- **Authentication flows** (`nacho.js`, `onboarding.js`) — Nostr, Lightning, and email auth. Look for session fixation, token reuse, or privilege escalation.

### Medium Priority
- **User-generated content rendering** (forum, global chat, messaging) — XSS via unsanitized HTML/Markdown rendering
- **nacho-qa.js** (`~561KB`) — quiz/question system. Look for answer spoofing or XP farming exploits
- **ranking.js** (`~527KB`) — leaderboard logic. Look for score manipulation
- **workers/** — Cloudflare Workers handling routing and API proxying. Look for SSRF or path traversal

### Lower Priority / Out of Scope
- Static content files (images, fonts, CSS)
- Third-party service internals (Firebase platform itself, Cloudflare, Lichess)
- Rate limiting on non-sensitive read endpoints
- Self-XSS requiring attacker to run their own browser
- Theoretical attacks with no practical exploit path

## Adversarial Inputs

Treat these as untrusted/adversarial:
- All Firestore reads/writes from unauthenticated or authenticated users
- All Cloud Function HTTP request bodies and headers
- User-supplied usernames, display names, forum posts, chat messages
- Nostr event payloads (npub, signed events)
- Lightning invoice strings
- URL parameters and hash fragments
- WebSocket messages (global chat)

## Severity Rubric

- **Critical**: Real sats drained from NWC wallet; admin privilege escalation; Firestore rules allow mass user data exfiltration
- **High**: XP/badge minting without earning; auth bypass; stored XSS in chat/forum; Cloud Function auth bypass
- **Medium**: Logic flaws allowing moderate XP farming; info disclosure of other users' private data; CSRF on state-changing actions
- **Low**: Minor info disclosure; non-exploitable misconfigurations; issues requiring physical device access

## Report Format

Please include:
1. Vulnerability title and severity
2. Affected file(s) and line numbers
3. Description of the flaw
4. Step-by-step reproduction
5. Suggested fix or patch (even minimal PoC patch is helpful)

Deduplication: treat separate exploitable paths as separate findings even if root cause overlaps.
