# Backup hardening (Nov 17, 2026) — Phil-only steps, NOT applied

Goal: a stolen cloud key must not be able to delete the backups first and then
wipe or ransom live data (the 2026 "delete backups, then encrypt" pattern).
Nothing in this file has been run. Every command changes live IAM, buckets or
the database, so each one needs Phil's OK and is run by Phil (or by an agent
only after Phil's explicit OK for that exact step). Staging first where noted.

Projects / buckets:
- Live: `bitcoin-education-archive`, nightly exports in `gs://bitcoin-education-archive-backups/<YYYY-MM-DD>/` (90-day lifecycle delete).
- Vault: `gs://bitcoin-education-archive-offline-vault` (US, 10-year retention, unlocked, public access blocked, uniform access; created Nov 14).
- Staging: `bitcoin-quest-staging`, exports in `gs://bitcoin-quest-staging-backups-use1`.

Always read the current config first and paste it into the Security room before changing anything:

```bash
P=bitcoin-education-archive
gcloud storage buckets describe gs://$P-backups --format='json(location,retention_policy,soft_delete_policy,versioning_enabled,lifecycle_config)'
gcloud storage buckets describe gs://$P-offline-vault --format='json(location,default_storage_class,retention_policy,soft_delete_policy,lifecycle_config)'
gcloud firestore databases describe --database='(default)' --project $P --format='yaml(pointInTimeRecoveryEnablement,versionRetentionPeriod,deleteProtectionState)'
```

## 1. Copy every nightly export into the vault (PR: `nightlyVaultCopy`)

Code is in `functions/src/vaultCopy.js`, scheduled 3:00 AM UTC (10 PM ET), ~1h after `dailyFirestoreBackup` (its metadata lands ~2:05-2:15 UTC). Copies only finished exports, never deletes or overwrites (`ifGenerationMatch: 0`), verifies object count and bytes, writes `nightly/<day>/_VAULT_MANIFEST.json` last, and catches up yesterday if a night failed. Server-side copy inside the US multi-region: no egress, no bot usage.

IAM it needs (create BEFORE deploying the function, or the deploy fails):

```bash
P=bitcoin-education-archive
SA=fn-vault-copy@$P.iam.gserviceaccount.com
gcloud iam service-accounts create fn-vault-copy --project $P --display-name "Nightly vault copy (read backups, create in vault)"
gcloud storage buckets add-iam-policy-binding gs://$P-backups        --member serviceAccount:$SA --role roles/storage.objectViewer
gcloud storage buckets add-iam-policy-binding gs://$P-offline-vault  --member serviceAccount:$SA --role roles/storage.objectCreator
gcloud storage buckets add-iam-policy-binding gs://$P-offline-vault  --member serviceAccount:$SA --role roles/storage.objectViewer
# gen2 scheduled function: the account must be able to invoke its own Cloud Run service
# (grant after first deploy, scoped to the service):
gcloud run services add-iam-policy-binding nightlyvaultcopy --region us-central1 --project $P --member serviceAccount:$SA --role roles/run.invoker
# The deployer needs actAs on this one account only:
gcloud iam service-accounts add-iam-policy-binding $SA --project $P --member "user:<PHIL_DEPLOYER_EMAIL>" --role roles/iam.serviceAccountUser
```

Never grant it objectAdmin, Firestore, Auth or project-level roles. No JSON key is ever created for it.

Cost: User Data measures about 65 GiB of new vault data per year. With the Archive-class rule below (~$0.0012/GB-month) that is well under $1/month per year of history. Re-measure with `gcloud storage du -s gs://$P-backups/<day>`.

Alternative (User Data's spec): a Storage Transfer Service GCS-to-GCS job doing the same copy. It needs no code, but it can't easily target "today's folder only", verify count and bytes, or fail closed, so the function is the default. Either way the copier gets its own account with read on backups, create + read on the vault, no delete and no IAM, and the existing backup-reader key is NOT reused.

Vault lifecycle (**`--lifecycle-file` replaces the whole lifecycle config**; the vault has none today, re-check first):

```json
{ "rule": [ { "action": { "type": "SetStorageClass", "storageClass": "ARCHIVE" },
              "condition": { "age": 1, "matchesPrefix": ["nightly/"], "matchesStorageClass": ["STANDARD"] } } ] }
```

```bash
gcloud storage buckets update gs://$P-offline-vault --lifecycle-file=vault-lifecycle.json
```

Lock the vault retention only after the first restore test from a vault copy passes (Phil's Nov 14 rule). Locking is irreversible.

Staging dry run first: create `fn-vault-copy` in `bitcoin-quest-staging`, set `BQ_BACKUP_BUCKET=bitcoin-quest-staging-backups-use1` and `BQ_VAULT_BUCKET=<staging vault bucket>` in `functions/.env.bitcoin-quest-staging`, deploy `functions:nightlyVaultCopy` by name, trigger it once from Cloud Scheduler, check the manifest.

## 2. Protect the main backup bucket (soft delete + retention + versioning)

Today a key with delete rights on `-backups` can wipe all 90 days in one command. Three layers, cheapest first:

```bash
P=bitcoin-education-archive
# a) Soft delete: deleted/overwritten objects stay restorable for 30 days (default is 7).
gcloud storage buckets update gs://$P-backups --soft-delete-duration=30d
# b) Retention policy (UNLOCKED): no object can be deleted or overwritten until it is 30 days old.
#    The existing 90-day lifecycle delete still works (90 > 30).
gcloud storage buckets update gs://$P-backups --retention-period=30d
# c) Versioning + noncurrent cleanup: already documented in docs/KILL-SWITCH-RUNBOOK.md
#    ("Retention, versioning, and lifecycle"); use docs/kill-switch-lifecycle.json, which keeps the 90-day rule.
```

Notes: a retention policy blocks the lifecycle from deleting objects younger than the period, so keep it shorter than 90 days. An unlocked policy can still be removed by someone with `storage.buckets.update`; that is why item 4 below (no key holds both) matters. Locking it is irreversible and puts a lien on the project; only after a restore drill, Phil's call. Repeat a) and b) on staging first.

## 3. Firestore point-in-time recovery (7-day roll-back to the minute)

```bash
gcloud firestore databases update --database='(default)' --project $P --enable-pitr
# optional, also blocks deleting the whole database:
gcloud firestore databases update --database='(default)' --project $P --delete-protection
```

PITR keeps versions from the moment it is turned on, costs PITR storage (roughly the database size again), and lets us read or export the database as of any minute in the last 7 days. The kill-switch preflight already checks for it. Check: `pointInTimeRecoveryEnablement: POINT_IN_TIME_RECOVERY_ENABLED`, `versionRetentionPeriod: 604800s`. Staging first.

## 4. Keys and access (Phil-only, console sign-in)

- Scope the backup-reader key (used by GitHub Actions for the R2 copy) to `-backups` only: remove its access to `-offline-vault`. Delete the extra copy of that key on the shared box (User Data found 2).
- Turn on uniform bucket-level access on `-backups` (`gcloud storage buckets update gs://$P-backups --uniform-bucket-level-access`), so no legacy per-object ACL can make an export public.
- List who can read each backup bucket: `gcloud storage buckets get-iam-policy gs://$P-backups` and the same for the vault (our reader key gets 403 on IAM, so only Phil can run this).

- `dailyFirestoreBackup` still runs as the default account, which holds `roles/editor` (it can delete the backups it writes and every Firestore doc). Follow-up PR after this one: run it as `fn-firestore-backup` with the existing `killSwitchExport` custom role (export + operations.get only) and `roles/storage.objectCreator` on `-backups`. Then phase 2 of the runtime-SA plan removes `roles/editor` from the default account.
- List and rotate every long-lived JSON key, including the ones stored on the shared box: `gcloud iam service-accounts keys list --iam-account <sa> --managed-by user`. Rule: no single principal can both delete Firestore data and delete or change the backup buckets.

## 5. Audit-log alerts (folds into the event-alerts PR)

See `docs/event-alerts-audit-logs.md`.
