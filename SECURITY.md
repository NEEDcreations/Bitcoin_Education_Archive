# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| Current (gh-pages) | ✅ Active |

Bitcoin Education Archive is a continuously deployed web application. Security fixes are applied to the live branch immediately — there are no versioned releases to backport.

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

Report security issues privately by emailing:

📧 **info.603btc@gmail.com**

Include in your report:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested mitigations (optional)

We aim to acknowledge reports within **48 hours** and provide a resolution timeline within **7 days** for critical issues.

## Scope

This project handles:
- Bitcoin education content and quizzes
- User XP/points system (non-custodial)
- Lightning Network tipping (WebLN / NWC — user-controlled wallets only)
- Satoshi's Favor faucet (small sats payouts via NWC)
- User authentication (Firebase Auth — Google, Nostr, Lightning, email)
- Firestore user data (usernames, XP, badges, settings)

**In scope:**
- Authentication bypasses
- Firestore rules that allow unauthorized reads/writes
- XSS vulnerabilities in user-generated content
- Lightning/NWC wallet drain or unauthorized payment execution
- SSRF or injection in Cloud Functions
- Exposed credentials or API keys
- Logic flaws that allow fake XP, sats, or badge minting

**Out of scope:**
- Theoretical attacks with no practical exploit path
- Issues in third-party services (Firebase, Cloudflare, Lichess)
- Rate limiting on non-sensitive endpoints
- Self-XSS (requires the attacker to execute their own browser)
- Clickjacking on non-authenticated pages

## Security Measures

- Firebase App Check (Turnstile-enforced) on all Firestore and Cloud Function access
- Firestore security rules with field-level validation
- Server-side round resolution for PVP games (tamper-proof)
- Custom claim-based admin access (no hardcoded emails)
- Subresource Integrity (SRI) on all CDN-loaded scripts
- Security headers: `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `CSP frame-ancestors`

## Disclosure Policy

We follow **responsible disclosure**. We ask that you:
1. Give us reasonable time to fix the issue before public disclosure
2. Avoid accessing or modifying data that isn't yours
3. Not perform denial-of-service testing

We will credit researchers in release notes (or keep disclosure anonymous on request).
