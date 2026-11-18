# Auth backup restore and verify

Restore tests run from **Phil's machine only, never the shared box**.

The Cloud Function `dailyAuthExport` cannot decrypt. Decrypt with the official
`age` CLI and Phil's offline identity, then pipe plaintext into
`functions/scripts/auth-export-verify.js`. Do not copy a private key, a
plaintext export, or a decrypted file onto the box.

## Find the latest complete backup

Object names are unique per run:

`auth/<ET date>/<HHmmss>Z-<runId>.jsonl.age` plus a matching `.manifest.json`.

Download the day's (or several days') manifests and pick the latest complete
one:

```sh
node functions/scripts/auth-export-verify.js --latest-from ./auth/2026-11-18 --print-latest
```

That prints the object name and `finishedAt` of the newest manifest with
`complete: true`. Then decrypt that object on Phil's machine.

## Verify (pipe only)

```sh
age -d -i ~/bq-auth-backup.key 083000Z-ab12cd34ef56ab78.jsonl.age \
  | node functions/scripts/auth-export-verify.js \
      --latest-from ./auth/2026-11-18 --expect 26615
```

`--file` is supported for fixtures, but it means a plaintext Auth export
(emails, phones, password hashes, hash config) is on disk. Prefer a pipe, and
delete any plaintext file when you are done.

Optional: pass `--object-meta metadata.json` (GCS `timeCreated` and `creator`)
so verify can check the object was created by `fn-daily-auth-export` around the
manifest timestamp.

## Staging restore test

Staging only (`--project bitcoin-quest-staging`). Never point this at
production.

- Sample (default): `--import --project bitcoin-quest-staging --sample 100 --apply --delete-after`
- All users: `--import --project bitcoin-quest-staging --all --apply --delete-after`

`--all` requires `--delete-after` so real emails and hashes are not left in
staging. `customClaims` are not imported unless you also pass `--keep-claims`
(which prints a warning). Use `--keep-claims` only after the object creator
checks out, and only when you intend to restore claims.
