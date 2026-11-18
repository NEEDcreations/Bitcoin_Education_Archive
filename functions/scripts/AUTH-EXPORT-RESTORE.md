# Auth backup restore and verify

Restore tests run from **Phil's machine only, never the shared box**.

The Cloud Function `dailyAuthExport` cannot decrypt. For a verify-only
count check you may decrypt with the official `age` CLI and Phil's offline
identity, then pipe plaintext into `functions/scripts/auth-export-verify.js`.
For any `--import` (dry run or `--apply`), this tool decrypts `--ciphertext`
itself (`age -d -i <identity>`; the key stays with the age CLI). Do not copy
a private key, a plaintext export, or a decrypted file onto the box.

## Find the latest complete backup

Object names are unique per run:

`auth/<ET date>/<HHmmss>Z-<runId>.jsonl.age` plus a matching `.manifest.json`.

`--latest-from` ranks only by the GCS server-set `timeCreated` in a
`<stamp>.meta.json` sidecar (from `gcloud storage objects describe
--format=json` or the JSON API). It never falls back to the manifest's
`timeCreated` or `finishedAt`, which a planted file can set. A missing
sidecar counts as missing `timeCreated`: that run is flagged and excluded.

It also flags more than one complete run on the same ET day, and any run
whose `timeCreated` is outside the backup window (default 3:29–3:50 AM
America/New_York; override with `--window-start`, `--window-end`,
`--window-zone`).

```sh
node functions/scripts/auth-export-verify.js --latest-from ./auth/2026-11-18 --print-latest
```

That prints flags, then the object name and `timeCreated` of the newest
in-window complete backup. Then download that object's ciphertext, manifest,
server metadata, and audit log (examples below).

## Verify (pipe only, no --import)

```sh
age -d -i ~/bq-auth-backup.key 083000Z-ab12cd34ef56ab78.jsonl.age \
  | node functions/scripts/auth-export-verify.js \
      --manifest 083000Z-ab12cd34ef56ab78.manifest.json --expect 26615
```

`--file` is supported for fixtures, but it means a plaintext Auth export
(emails, phones, password hashes, hash config) is on disk. Prefer a pipe, and
delete any plaintext file when you are done. `--import` does not accept
`--file` or a plaintext pipe.

## Provenance and ciphertext binding (required for any --import)

`--import` (dry run or `--apply`) fails closed unless all of the following
are present and valid. Verify-only can omit them and still use a pipe.
Phil makes the `--object-meta` and `--audit-log` files himself with
`gcloud`, never from the bucket, the shared box, or an agent.

1. `--manifest <file>` or `--latest-from <dir>` — the manifest must include
   `object`, `plaintextSha256` and `ciphertextSha256`.

2. `--ciphertext <file.jsonl.age>` — the exact downloaded ciphertext. Its
   sha256 must equal `manifest.ciphertextSha256`. Its md5 and crc32c must
   equal the server-set `md5Hash` and `crc32c` on the object metadata. The
   tool then decrypts that file with `--identity` and checks that the
   plaintext sha equals `plaintextSha256`.

3. `--identity <age identity file>` — passed only to `age -d -i`. This
   script never reads the key.

4. `--object-meta metadata.json` — the GCS object resource for the
   ciphertext. Phil makes this file himself with
   `gcloud storage objects describe gs://<bucket>/<object> --format=json`
   (never from the bucket, the shared box, or an agent). Required server-set fields: `name`, `generation`,
   `timeCreated`, `md5Hash`, `crc32c`. `name` must equal `manifest.object`
   exactly (no substring match). `timeCreated` must fall inside the backup
   window (default 3:29–3:50 AM ET). Do **not** trust custom metadata
   (`metadata.creator`, `metadata.createdBy`, or any uploader-set key).

5. `--audit-log audit.json` — a Cloud Audit Logs export Phil makes himself
   with `gcloud logging read` (never from the bucket, the shared box, or an
   agent). Every `storage.objects.create` entry for that exact object name
   must have `protoPayload.authenticationInfo.principalEmail` equal to
   `fn-daily-auth-export@<project>.iam.gserviceaccount.com`. There must be
   exactly one create for that name, and its generation must match
   `metadata.generation`. Example:

   ```sh
   gcloud logging read \
     'resource.type="gcs_bucket"
      AND resource.labels.bucket_name="<project>-auth-backups"
      AND protoPayload.methodName="storage.objects.create"
      AND timestamp>="2026-11-18T08:00:00Z"
      AND timestamp<="2026-11-18T09:30:00Z"' \
     --project=<project> --freshness=2d --format=json > audit.json
   ```

   **Data-access (DATA_WRITE) logging must be enabled for the
   `<project>-auth-backups` bucket.** Without it, `storage.objects.create`
   has no principalEmail to check, and `--import` will refuse. This is one of
   Phil's console steps (below).

Ciphertext md5/crc32c binding against the server metadata is what ties the
file you decrypt to the object the audit log describes. Signing the manifest
with a Cloud KMS asymmetric key that only `fn-daily-auth-export` can use is
an optional later improvement. It is not required for the nightly backup or
for these checks.

## Staging restore test

Staging only (`--project bitcoin-quest-staging`). Never point this at
production.

```sh
node functions/scripts/auth-export-verify.js \
  --ciphertext 083000Z-ab12cd34ef56ab78.jsonl.age \
  --identity ~/bq-auth-backup.key \
  --manifest 083000Z-ab12cd34ef56ab78.manifest.json \
  --object-meta metadata.json \
  --audit-log audit.json \
  --import --project bitcoin-quest-staging --sample 100 --apply --delete-after
```

- Sample (default): add `--sample 100 --apply --delete-after` as above.
- All users: replace `--sample 100` with `--all` (still needs `--delete-after`).

`--all` requires `--delete-after` so real emails and hashes are not left in
staging. `customClaims` are not imported unless you also pass `--keep-claims`
(which prints a warning). Use `--keep-claims` only after the audit-log
creator checks out, and only when you intend to restore claims.

If an import crashes mid-way, the script runs `--delete-after` in a `finally`
block when that flag was set. If users may still be in staging, it prints the
exact cleanup command, for example:

```sh
node functions/scripts/auth-export-verify.js --cleanup --project bitcoin-quest-staging --uids-file /tmp/bq-auth-restore-uids-….txt
```

`--cleanup` is staging-only and deletes the uids listed in that file.

## Phil's console steps (for this restore path)

In addition to the live-backup setup (service account, bucket protection,
alerts, second recipient key):

1. Enable **Data Access** audit logs for Cloud Storage on the
   `<project>-auth-backups` bucket, including `ADMIN_READ`/`DATA_WRITE` as
   needed so every `storage.objects.create` is logged with
   `principalEmail`. Confirm a staging run produces an entry for
   `fn-daily-auth-export@…`.
2. On a staging run, download the ciphertext and manifest, then make the
   metadata and audit-log files yourself with
   `gcloud storage objects describe --format=json` (`timeCreated`, `name`,
   `generation`, `md5Hash`, `crc32c`) and `gcloud logging read` (examples
   above). Those two files must come from your own `gcloud` — never from
   the bucket, the shared box, or an agent. Then run the verify or
   `--import` command on your own machine — never on the shared box.
3. Optional later: sign the manifest with a Cloud KMS asymmetric key usable
   only by `fn-daily-auth-export`.
