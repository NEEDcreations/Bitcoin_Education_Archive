# Restore a Bitcoin Quest backup

Do not print key material. Read a key from Secret Manager only on the machine
where you will use it, save it in a password manager, then clear the screen
and the shell history. These steps are a runbook. They do not run themselves.

The auth export inside R2 is double-encrypted. The outer layer is the R2 seal
(`BQR2`, key `BACKUP_ENCRYPTION_KEY`). The inner file is the auth export
(`BQAE`, key `AUTH_BACKUP_KEY`). Decrypt the outer layer first.

## Firestore

The dated export lives in `gs://bitcoin-education-archive-backups/YYYY-MM-DD/`.
Import it into a database you choose. A production import overwrites data, so
confirm the target database before you run it.

```bash
gcloud firestore import gs://bitcoin-education-archive-backups/YYYY-MM-DD \
  --project=bitcoin-education-archive \
  --database='(default)'
```

The bucket retention lock keeps each object for 90 days and cannot be
shortened. Soft delete then keeps a deleted object for up to 7 more days, so
a copy can exist for about 97 days. The import uses the live object, not the
soft-deleted one.

## Uploads

The uploads mirror is `gs://bitcoin-education-archive-uploads-backup`. It is
the bucket to restore from. Copy a prefix back only after you have decided
which names should replace live files.

```bash
gcloud storage cp -r \
  gs://bitcoin-education-archive-uploads-backup/SOME/PREFIX \
  gs://bitcoin-education-archive.firebasestorage.app/SOME/PREFIX
```

## Cloudflare R2

R2 holds ciphertext only. Dated keys are `YYYY-MM-DD/...`. Each uploads
object is stored once as `uploads/<name>#<generation>`. The night's
`YYYY-MM-DD/uploads-manifest.json` lists `{name, generation, md5, bytes, dest, sha256}`.
`sha256` is the plaintext hash for objects streamed that night. A retry that
skips an object already in R2 leaves `sha256` off that row. Dated Firestore,
auth, and config objects record the same hash in `YYYY-MM-DD/manifest.json`.
The upload does not rewrite an object to attach the hash.

Uploads cleanup uses every readable `uploads-manifest.json` from the last 90
days. A manifest that has vanished is skipped on its own. After
`BACKUP_ENCRYPTION_KEY` changes, manifests sealed with the previous key
cannot be opened, so uploads cleanup pauses until those manifests age out
or you re-seal them with the new key. Dated keys older than 90 days are
still deleted during that pause. The pause does not fail the night. The r2
detail counts it, and the third night in a row logs `uploads cleanup
skipped 3 nights in a row`.

1. Download with the bucket-scoped Object Read & Write token. Do not use a
   token that can administer the account.
2. Decrypt one object. `--dest` is the R2 object key, because that key is
   bound into the seal:

```bash
BACKUP_ENCRYPTION_KEY='...' node scripts/decrypt_r2_object.js \
  --file object.bin --out restored.bin --dest 'YYYY-MM-DD/firestore/...'
```

A bad authentication tag leaves no restored file. The temporary file is
mode 0600 and is deleted on failure. Older keys may be listed, comma
separated, in `BACKUP_ENCRYPTION_KEYS`. The header key id selects the key.

3. For a bulk copy, list the keys, download each object, and run the same
   decrypt with that object's key as `--dest`. Decrypt the manifest first if
   you need the uploads index. Uploads ciphertext uses the same command with
   `--dest 'uploads/<name>#<generation>'`.

## Auth export

After the outer R2 decrypt, the file is still the auth export. Decrypt it
with the auth key and the original object name:

```bash
AUTH_BACKUP_KEY='...' node scripts/decrypt_auth_export.js \
  --file users.jsonl.gz.enc --out users.jsonl \
  --dest 'auth/YYYY-MM-DD/users.jsonl.gz.enc'
```

`scripts/restore_auth_export.js` prints a dry run unless you pass `--apply`.
Pass the same `--dest`. It does not import users unless `--apply` is set.
Owner cannot read the auth bucket. The deploy account downloads the object,
or Phil grants himself `roles/storage.objectViewer` on that bucket first.
