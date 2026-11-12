# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| Current `gh-pages` | Yes |

The app is deployed from the `gh-pages` branch. There are no versioned releases to patch separately. A fix lands on that branch.

## Reporting a vulnerability

Do not open a public GitHub issue, pull request, or commit for a security vulnerability. Do not post exploit details in chat, on social media, or in a public gist.

Report privately, either way:

- Email [info.603btc@gmail.com](mailto:info.603btc@gmail.com)
- GitHub private vulnerability reporting: [Open a security advisory](https://github.com/NEEDcreations/Bitcoin_Education_Archive/security/advisories/new)

If private reporting is not enabled on the repository, use email.

### Encrypting your report

To encrypt an email report, use this PGP key. It is also in [`security-pgp-key.asc`](security-pgp-key.asc).

- User ID: `Bitcoin Quest Security <info.603btc@gmail.com>`
- Fingerprint: `A7E7 5CED 9B66 B252 FB10  9B95 28EA AF43 E798 EE5E`
- Encryption subkey: `6FBC 8829 3FB9 B759 2705  4120 8233 540E 9845 A237`
- Created 2026-11-12, expires 2028-11-11

Check the fingerprint before you use the key.

```
-----BEGIN PGP PUBLIC KEY BLOCK-----

mDMEavYEPRYJKwYBBAHaRw8BAQdAC0fmE+T9AnU55n0oy76N/v0VkBiOfwJW1VOQ
e360NWe0LkJpdGNvaW4gUXVlc3QgU2VjdXJpdHkgPGluZm8uNjAzYnRjQGdtYWls
LmNvbT6IsgQTFgoAWhYhBKfnXO2bZrJS+xCblSjqr0PnmO5eBQJq9gQ9GxSAAAAA
AAQADm1hbnUyLDIuNSsxLjEyLDAsMwIbAwUJA8JnAAULCQgHAgYVCgkICwIEFgID
AQIeAQIXgAAKCRAo6q9D55juXgTZAQCAtXuL8idcQkIU3wxDVu2qiPnuSenBrSmp
iyv68wzywwD/bbdqaQYuXx7B+EbTOVQrDw2SPYqbwcw9mQrtPWwyowe4OARq9gSN
EgorBgEEAZdVAQUBAQdAEtki/gV8evmNHttS2XQw/Q/MFVQuiU8QtYFpJRx3DDkD
AQgHiJoEGBYKAEIWIQSn51ztm2ayUvsQm5Uo6q9D55juXgUCavYEjRsUgAAAAAAE
AA5tYW51MiwyLjUrMS4xMiwwLDMCGwwFCQPCZwAACgkQKOqvQ+eY7l7DVwEA+XIe
DAz+OdyS3UsRlrdjT3O+IyKqn5llk20vvhyMof4A/iYwY+oCTvPaNgQN+2Kw9itd
EGAlzyE0Y6G2kZYqZ+YB
=c6LA
-----END PGP PUBLIC KEY BLOCK-----
```

Please include:

- What is affected (page, function, rule, or endpoint)
- Steps to reproduce, including any account state the steps need
- Impact you believe is realistic
- A suggested fix, if you have one

Stop once you can show the issue. You do not need to keep going to prove the worst case.

## Scope

In scope:

- The public site served from this repository, including the staging and dev hosts published by its workflows
- Authentication and session handling
- Firestore and Storage rules that allow a read or write the caller should not have
- Cross-site scripting in content a player can submit
- Unauthorized Lightning payments or wallet actions
- Injection in Cloud Functions or Workers
- Credentials or tokens committed or exposed to the client
- Logic that mints XP, sats, badges, or other rewards the server should refuse

Out of scope:

- Attacks that need physical access, or social engineering of staff or players
- Issues in third-party services (Firebase, Cloudflare, wallet apps, relays)
- Missing rate limits on endpoints that do not change accounts, money, or rewards
- Self-XSS that requires the player to attack their own browser
- Clickjacking on pages that do not require a session
- Findings with no practical path to affect another person or the service
- Automated scanning output with no demonstrated impact

## What not to do

- Do not test on real player accounts. Do not sign in as someone else, reuse a session you do not own, or read or change another person's data. Use the local Firebase emulators and the `demo-` project ids described in [CONTRIBUTING.md](CONTRIBUTING.md).
- Do not run denial-of-service, load, spam, or resource-exhaustion tests against production, staging, or dev.
- If a test shows you someone else's data, stop. Report what you saw and delete local copies when we ask.
- Do not exploit an issue past the smallest proof you need to report it. Do not retain access, move money, or change data that is not your own test data on an emulator.
- Do not publicly disclose the issue until we have had a reasonable time to fix it.

## Response expectations

These are targets, not a guarantee.

- We aim to acknowledge a report within 48 hours.
- For an issue we treat as critical, we aim to reply with a timeline within 7 days of that acknowledgement.
- We will keep you posted when there is something new to say.
- We will credit you in the fix notes if you want credit. Say so if you prefer to stay unnamed.

A report that is out of scope, duplicate, or not reproducible may be closed with a short explanation.

## Safe harbor

If you follow this policy in good faith, 603BTC LLC will not pursue a legal claim against you for that research. This is not a bug-bounty offer and it does not promise a payment. It does not bind anyone other than 603BTC LLC.

The harbor does not cover activity that uses or damages another person's account, disrupts the service, discloses the issue publicly before we have had a reasonable time to fix it, or breaks the law aside from the access needed to show the vulnerability. We may still suspend access that is harming players or the service.
