# Payout guard TTL policy (PR #286 deploy blocker)

**Do not apply until Phil OKs the #286 deploy.** Nobody has run these yet.

`functions/src/antiDrain.js` writes `expireAt` (a Firestore Timestamp, now + 30 days) on
every write to `payout_guard_users/{hmac}` and `payout_guard_wallets/{hmac}`.
A Firestore TTL policy on that field deletes stale guard docs. Without the
policy the docs just stay, which breaks the User Data/Backups 30-day promise.

TTL only removes these two guard collections. Epoch, payout, reward and
audit records have no `expireAt` and stay permanently.

## Before
- Run a full Firestore export (at least 95% of the nightly file count).
- Use the deploy identity on project `bitcoin-education-archive`, `(default)` database.

## Apply (one per collection group)
```bash
gcloud firestore fields ttls update expireAt \
  --collection-group=payout_guard_users \
  --enable-ttl \
  --project=bitcoin-education-archive \
  --database='(default)' \
  --async

gcloud firestore fields ttls update expireAt \
  --collection-group=payout_guard_wallets \
  --enable-ttl \
  --project=bitcoin-education-archive \
  --database='(default)' \
  --async
```

## Verify
```bash
gcloud firestore fields ttls list \
  --project=bitcoin-education-archive \
  --database='(default)'
# Expect both groups, field expireAt, state ACTIVE (CREATING for a while first).
gcloud firestore operations list --project=bitcoin-education-archive --database='(default)'
```

## Notes
- Do not use `firebase deploy --only firestore:indexes` for this. It can drop
  indexes that exist only in the project.
- TTL deletes usually happen within about 24 hours after `expireAt`, not
  exactly at that time. The guard logic prunes events to the 24h window
  itself, so it never relies on TTL timing.
- Roll back with `--disable-ttl` and the same flags.
