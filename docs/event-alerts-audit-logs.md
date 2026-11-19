# Event alerts: mass reads, exports and deletes (User Data item 6)

Folds into the post-reset event-alerts PR (thresholds: Spam/Abuse file of Nov 17). Design only; nothing enabled.

## Logs to turn on (Phil OK: Data Access logs cost money)

- Firestore **Admin Activity** logs are always on: `ExportDocuments`, `ImportDocuments`, `DeleteDatabase`, `UpdateDatabase` (PITR or delete protection turned off), index changes.
- Firestore **Data Access** (`DATA_READ`, `DATA_WRITE`) is off by default. Turning it on for `datastore.googleapis.com` logs every read (large volume). Recommend: enable `ADMIN_READ` + `DATA_WRITE` only, plus `DATA_READ` exempting the Cloud Functions runtime accounts, so client reads are covered and the server isn't double-billed. Re-measure log volume on staging for 24h first.
- Cloud Storage Data Access on the two backup buckets only (`storage.objects.delete`, `storage.objects.get` by anything other than `fn-vault-copy` and the R2 reader).
- IAM: `CreateServiceAccountKey`, `SetIamPolicy` (Admin Activity, always on).

## Log-based metrics + alert policies (no bot usage; Cloud Monitoring emails/SMS Phil)

| Alert | Filter (sketch) | Fire when |
|---|---|---|
| Unexpected export | `protoPayload.methodName="google.firestore.admin.v1.FirestoreAdmin.ExportDocuments"` and caller not the backup/kill-switch SA | any |
| Import over live data | `...ImportDocuments` | any |
| PITR / delete-protection changed | `...UpdateDatabase` | any |
| Mass delete | `protoPayload.methodName=~"Commit|BatchWrite|DeleteDocument"` with deletes, grouped by principal | > 500 deletes / 5 min by one principal |
| Mass read | Data Access `RunQuery`/`BatchGetDocuments` grouped by principal | > 20k docs / 10 min by one non-server principal |
| Backup object deleted | `resource.type="gcs_bucket"` bucket in (`-backups`,`-offline-vault`) `methodName="storage.objects.delete"` not by lifecycle | any |
| Bucket policy changed | `storage.setIamPermissions` or `storage.buckets.update` on those buckets | any |
| New SA key / IAM change | `CreateServiceAccountKey` or `SetIamPolicy` on the project | any |
| Vault copy failed | `resource.labels.service_name="nightlyvaultcopy" severity>=ERROR` | any, or no `[VAULT]` success log by 6 AM UTC |

Thresholds are starting points for Spam/Abuse to tune on staging. Admin Activity alerts are free; Data Access logs are billed by volume.
