# bq-r2-nightly-backup

Cloudflare cron Worker + Workflow that copies one completed Firestore export from
`gs://bitcoin-education-archive-backups/<label>/` (read-only) into the private R2
bucket `bq-user-backups` as a single `tar.gz.age`, encrypted **only** to the
owner's age public key. Cloudflare never holds a decryption key or passphrase.

Replaces `.github/workflows/r2-nightly-backup.yml` (0 runs) and the box fallback
`r2-nightly-backup-age.sh`. Plan: `/workspace/private/gh-to-cf/PLAN.md` (box).

## Flow (all streaming, constant memory)

1. `resolve-export`: RS256 JWT (WebCrypto) -> OAuth token (`devstorage.read_only`),
   require `<label>/<label>.overall_export_metadata`, list objects, require > 10 files.
2. `pack-encrypt-upload`: for each object (3 opened ahead, pinned by generation):
   tar header -> bytes (sha256 + md5 checked against GCS) -> gzip (`CompressionStream`)
   -> age (X25519, 64 KiB STREAM chunks) -> R2 multipart (8 MiB parts). Writes
   `manifest.json` with every file's path, size and sha256, tar/gzip/ciphertext
   size + sha256, source folder and export completion time.
3. `verify-r2`: reads the R2 object back, checks size, sha256 and age header, then
   writes `_health/last-success.json`.
4. Any failure writes `_health/last-error.json` (no secrets) and fails the instance.

Every write is confined to `KEY_ROOT` (`staging-test/age/firestore/` in staging).

## Config

- Secrets (`wrangler secret put`, never in git): `GCP_BACKUP_READER_CLIENT_EMAIL`,
  `GCP_BACKUP_READER_PRIVATE_KEY`.
- Vars: `KEY_ROOT`, `GCS_BUCKET`, `BACKUP_AGE_RECIPIENT`, `CRON_ENABLED`.
- Requires **Workers Paid** (`limits.cpu_ms`, > 50 subrequests per step). On Free
  the deploy is rejected (`CPU limits are not supported for the Free plan`).
- Staging has **no cron** (`triggers.crons: []`) and `CRON_ENABLED=false`.

## Run / test

```sh
npm ci && npm test
# manual run (no HTTP surface; the fetch handler always 404s)
npx wrangler workflows trigger bq-r2-nightly-backup-staging-wf '{"exportPrefix":"pre-ship-324-20261114T233946Z"}'
# list only
npx wrangler workflows trigger bq-r2-nightly-backup-staging-wf '{"exportPrefix":"2026-11-14","mode":"list"}'
```

## Restore check (owner only, on his own computer; never on the box)

```sh
age -d -i <private-key-file> bq-firestore-<label>.tar.gz.age > x.tar.gz
sha256sum x.tar.gz          # must equal manifest.gzip.sha256
tar -tzf x.tar.gz | wc -l   # must equal manifest.totals.files
```
