# Auth backup restore and verify

Restore tests run from **Phil's machine only, never the shared box**.

The Cloud Function `dailyAuthExport` cannot decrypt. Decrypt with the official
`age` CLI and Phil's offline identity, then pipe plaintext into
`functions/scripts/auth-export-verify.js`. Do not copy a private key, a
plaintext export, or a decrypted file onto the box.

## Find the latest complete backup

Object names are unique per run:

`auth/<ET date>/<HHmmss>Z-<runId>.jsonl.age` plus a matching `.manifest.json`.

`--latest-from` ranks by the GCS server-set `timeCreated` (not the manifest's
`finishedAt`, which a planted file can set). Put a sidecar
`<stamp>.meta.json` with `{ "timeCreated": "<RFC3339>" }` next to each
manifest (from `gcloud storage objects describe --format=json` or the JSON
API). It flags more than one complete run on the same ET day, and any run
whose `timeCreated` is outside the backup window (default 3:29–3:50 AM
America/New_York; override with `--window-start`, `--window-end`,
`--window-zone`).

```sh
node functions/scripts/auth-export-verify.js --latest-from ./auth/2026-11-18 --print-latest
```

That prints flags, then the object name and `timeCreated` of the newest
in-window complete backup. Then decrypt that object on Phil's machine.

## Verify (pipe only)

```sh
age -d -i ~/bq-auth-backup.key 083000Z-ab12cd34ef56ab78.jsonl.age \
  | node functions/scripts/auth-export-verify.js \
      --latest-from ./auth/2026-11-18 --expect 26615
```

`--file` is supported for fixtures, but it means a plaintext Auth export
(emails, phones, password hashes, hash config) is on disk. Prefer a pipe, and
delete any plaintext file when you are done.

## Provenance (required for any --import)

`--import` (dry run or `--apply`) fails closed unless both of these are
present and valid. Verify-only can omit them.

1. `--object-meta metadata.json` — the GCS object resource for the ciphertext
   (and, when checking the pair, the manifest). Use the server-set
   `timeCreated` field from `gcloud storage objects describe gs://<bucket>/<object> --format=json`
   or the JSON API. GCS objects have no creator field. Do **not** trust custom
   metadata (`metadata.creator`, `metadata.createdBy`, or any uploader-set
   key). `timeCreated` must fall inside the backup window (default 3:29–3:50
   AM ET), not merely match the manifest's own `finishedAt`.

2. `--audit-log audit.json` — a Cloud Audit Logs export whose
   `storage.objects.create` entry for that object has
   `protoPayload.authenticationInfo.principalEmail` equal to
   `fn-daily-auth-export@<project>.iam.gserviceaccount.com`. Phil exports
   this from his machine, for example:

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

Signing the manifest with a Cloud KMS asymmetric key that only
`fn-daily-auth-export` can use is an optional later improvement. It is not
required for the nightly backup or for these provenance checks.

## Staging restore test

Staging only (`--project bitcoin-quest-staging`). Never point this at
production.

- Sample (default): `--import --project bitcoin-quest-staging --sample 100 --apply --delete-after --object-meta m.json --audit-log audit.json`
- All users: `--import --project bitcoin-quest-staging --all --apply --delete-after --object-meta m.json --audit-log audit.json`

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
2. On a staging run, download `timeCreated` with `gcloud storage objects describe`
   and the matching audit log with `gcloud logging read` (examples above),
   then decrypt and verify on your own machine — never on the shared box.
3. Optional later: sign the manifest with a Cloud KMS asymmetric key usable
   only by `fn-daily-auth-export`.
