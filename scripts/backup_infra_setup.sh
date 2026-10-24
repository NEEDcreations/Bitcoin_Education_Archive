#!/usr/bin/env bash
# Bitcoin Quest nightly backup infrastructure.
#
# Dry run by default. This prints every change and does not call gcloud.
# Pass --apply to mutate bitcoin-education-archive. The Cloud Agent does
# not run this script.
#
#   bash scripts/backup_infra_setup.sh
#   bash scripts/backup_infra_setup.sh --apply
#
# This script does not delete buckets, objects, or databases, and it does
# not set a retention policy or a retention lock. It does not create SMTP
# secrets. Backup results stay in Firestore for an external checker.
#
# With --apply it:
#   - Enables the APIs the nightly functions call
#   - Creates gs://bitcoin-education-archive-auth-backups
#     Versioning stays on. Live objects are deleted at age 90, which makes
#     them noncurrent, and noncurrent generations are deleted after 1 day.
#     Retention is 90 days, not 180.
#   - Creates gs://bitcoin-education-archive-uploads-backup in a DIFFERENT
#     region from the live *.firebasestorage.app bucket, with versioning and
#     a 90-day lifecycle for noncurrent generations only
#   - Turns on uniform bucket-level access and public access prevention
#     (enforced) for those buckets and for gs://bitcoin-education-archive-backups
#     (the existing Firestore backup bucket keeps its current lifecycle)
#   - Enables Firestore point-in-time recovery and delete protection
#   - Enables a TTL policy on backup_history.expireAt (documents set expireAt
#     to finishedAt plus 90 days)
#   - Creates bq-auth-backup@PROJECT.iam.gserviceaccount.com for nightlyAuthExport
#     only. That account gets the custom Auth role (including getHashConfig),
#     secretAccessor on AUTH_BACKUP_KEY, and object create/read on the auth
#     backup bucket. The shared compute account does not get those.
#   - Creates an empty AUTH_BACKUP_KEY secret (no key material, no version)
#
# AUTH_BACKUP_KEY (32 bytes). Create a version after --apply. The value
# stays in Secret Manager and must never be committed or logged:
#   openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \
#     --project=bitcoin-education-archive --data-file=-
#
# Then deploy (after --apply and the secret version):
#   firebase deploy --only functions:dailyFirestoreBackup,functions:nightlyAuthExport,functions:nightlyUploadsCopy,functions:nightlyConfigSnapshot,functions:backupHealthCheck

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-bitcoin-education-archive}"
FIRESTORE_BACKUP_BUCKET="${FIRESTORE_BACKUP_BUCKET:-bitcoin-education-archive-backups}"
AUTH_BACKUP_BUCKET="${AUTH_BACKUP_BUCKET:-bitcoin-education-archive-auth-backups}"
UPLOADS_BACKUP_BUCKET="${UPLOADS_BACKUP_BUCKET:-bitcoin-education-archive-uploads-backup}"
SOURCE_UPLOADS_BUCKET="${SOURCE_UPLOADS_BUCKET:-bitcoin-education-archive.firebasestorage.app}"
AUTH_BACKUP_LOCATION="${AUTH_BACKUP_LOCATION:-us}"
AUTH_BACKUP_SA="${AUTH_BACKUP_SA:-bq-auth-backup@${PROJECT_ID}.iam.gserviceaccount.com}"

APPLY=0
for arg in "$@"; do
  case "${arg}" in
    --apply) APPLY=1 ;;
    -h|--help)
      echo "Usage: bash scripts/backup_infra_setup.sh [--apply]"
      echo "Default is a dry run. It prints WOULD lines and changes nothing."
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      echo "Usage: bash scripts/backup_infra_setup.sh [--apply]" >&2
      exit 2
      ;;
  esac
done

cat <<EOF
Project: ${PROJECT_ID}
Mode: $([[ "${APPLY}" == "1" ]] && echo APPLY || echo DRY-RUN)
No buckets are deleted. No retention lock is set. No email secrets are created.

WOULD enable APIs:
  firestore.googleapis.com
  firebaserules.googleapis.com
  cloudscheduler.googleapis.com
  storagetransfer.googleapis.com
  secretmanager.googleapis.com
  storage.googleapis.com
  identitytoolkit.googleapis.com
  firebase.googleapis.com
  cloudfunctions.googleapis.com
  iam.googleapis.com

WOULD detect the gen2 service account on dailyFirestoreBackup, else
  PROJECT_NUMBER-compute@developer.gserviceaccount.com
WOULD create ${AUTH_BACKUP_SA} if it is missing. nightlyAuthExport runs as
  this account. The shared compute account is not given the Auth role, the
  backup key, or object create on the auth backup bucket.

WOULD create gs://${AUTH_BACKUP_BUCKET} in ${AUTH_BACKUP_LOCATION} if missing.
WOULD set uniform bucket-level access, public access prevention enforced,
  and versioning on gs://${AUTH_BACKUP_BUCKET}.
WOULD set its lifecycle so a live object is deleted at age 90 days. With
  versioning, that delete makes the object noncurrent. Noncurrent generations
  are deleted after 1 day, so retention is 90 days rather than 180.

WOULD read the location of gs://${SOURCE_UPLOADS_BUCKET}.
WOULD put gs://${UPLOADS_BACKUP_BUCKET} in us-east1, or us-west1 when the
  source is us-east1. UPLOADS_BACKUP_LOCATION overrides that choice.
WOULD refuse a destination that matches the source region.
WOULD create that bucket if missing, then set uniform bucket-level access,
  public access prevention enforced, and versioning.
WOULD set its lifecycle to delete noncurrent generations after 90 days and
  abort incomplete multipart uploads after 7 days. Live objects are not
  deleted by age.

WOULD leave the lifecycle on gs://${FIRESTORE_BACKUP_BUCKET} unchanged.
WOULD set uniform bucket-level access and public access prevention enforced
  on that existing bucket.

WOULD grant roles/storage.objectAdmin and roles/storage.legacyBucketReader
  on gs://${FIRESTORE_BACKUP_BUCKET} to the Firestore service agent BEFORE
  uniform access is turned on. That replaces per-object ACLs the export uses
  today. roles/storage.admin is not granted.
WOULD grant roles/storage.objectCreator, roles/storage.objectViewer, and
  roles/storage.legacyBucketReader on the Firestore backup bucket and the
  uploads backup bucket to the functions service account. That account can
  create and read backup objects. It is not granted a role that deletes them.
WOULD grant ${AUTH_BACKUP_SA} roles/storage.objectCreator,
  roles/storage.objectViewer, and roles/storage.legacyBucketReader on
  gs://${AUTH_BACKUP_BUCKET} only.
WOULD grant the functions service account roles/storage.objectViewer and
  roles/storage.legacyBucketReader on gs://${AUTH_BACKUP_BUCKET} so the
  health check can read the manifest and object metadata. It cannot create
  objects there.
WOULD grant roles/storage.objectViewer and roles/storage.legacyBucketReader
  on gs://${SOURCE_UPLOADS_BUCKET} to the functions service account.
WOULD grant the Storage Transfer service agent objectViewer and
  legacyBucketReader on the source, and legacyBucketWriter plus objectViewer
  on gs://${UPLOADS_BACKUP_BUCKET}.

WOULD create empty secret AUTH_BACKUP_KEY if it is missing, without adding
  a version, and grant roles/secretmanager.secretAccessor to ${AUTH_BACKUP_SA}
  only.

WOULD grant the functions service account:
  roles/datastore.importExportAdmin
  roles/datastore.viewer
  roles/datastore.user
  roles/firebaserules.viewer
  roles/cloudscheduler.viewer
  roles/storagetransfer.user
  roles/cloudfunctions.viewer
WOULD create or update custom role authBackupReader with
  firebaseauth.users.get, firebaseauth.configs.get, and
  firebaseauth.configs.getHashConfig, and bind it only to ${AUTH_BACKUP_SA}.
WOULD stop if that custom role cannot be created or bound.
WOULD grant roles/iam.serviceAccountUser on ${AUTH_BACKUP_SA} to the Cloud
  Functions service agent so deploy can run nightlyAuthExport as that account.

WOULD enable Firestore point-in-time recovery on (default).
WOULD enable Firestore delete protection on (default).
WOULD enable a TTL policy on collection group backup_history field expireAt:
  gcloud firestore fields ttls update expireAt \\
    --collection-group=backup_history --enable-ttl --project=${PROJECT_ID}
  Writers set expireAt to finishedAt plus 90 days.

EOF

if [[ "${APPLY}" != "1" ]]; then
  echo "Dry run only. Re-run with --apply to make these changes."
  exit 0
fi

echo "APPLY: starting mutations for ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "APPLY: enabling APIs"
gcloud services enable \
  firestore.googleapis.com \
  firebaserules.googleapis.com \
  cloudscheduler.googleapis.com \
  storagetransfer.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com \
  firebase.googleapis.com \
  cloudfunctions.googleapis.com \
  iam.googleapis.com \
  --project "${PROJECT_ID}"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
FUNCTIONS_SA="${FUNCTIONS_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
DETECTED="$(gcloud functions describe dailyFirestoreBackup --gen2 --region=us-central1 --project="${PROJECT_ID}" --format='value(serviceConfig.serviceAccountEmail)' 2>/dev/null || true)"
if [[ -n "${DETECTED}" ]]; then
  FUNCTIONS_SA="${DETECTED}"
fi
FIRESTORE_SA="service-${PROJECT_NUMBER}@gcp-sa-firestore.iam.gserviceaccount.com"
echo "APPLY: functions service account ${FUNCTIONS_SA}"

echo "APPLY: resolving the Storage Transfer service agent"
STS_SA="project-${PROJECT_NUMBER}@storage-transfer-service.iam.gserviceaccount.com"
TOKEN="$(gcloud auth print-access-token)"
if STS_JSON="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  "https://storagetransfer.googleapis.com/v1/googleServiceAccounts/${PROJECT_ID}" 2>/dev/null)"; then
  PARSED="$(printf '%s' "${STS_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("accountEmail",""))' 2>/dev/null || true)"
  if [[ -n "${PARSED}" ]]; then
    STS_SA="${PARSED}"
  fi
fi
echo "APPLY: Storage Transfer service agent ${STS_SA}"

choose_uploads_location() {
  local src
  src="$(gcloud storage buckets describe "gs://${SOURCE_UPLOADS_BUCKET}" --project "${PROJECT_ID}" --format='value(location)')"
  src="$(printf '%s' "${src}" | tr '[:lower:]' '[:upper:]')"
  local dest
  case "${src}" in
    US-EAST1) dest="us-west1" ;;
    US-WEST1|US-WEST2|US-WEST3|US-WEST4) dest="us-east1" ;;
    *) dest="us-east1" ;;
  esac
  if [[ -n "${UPLOADS_BACKUP_LOCATION:-}" ]]; then
    dest="${UPLOADS_BACKUP_LOCATION}"
  fi
  dest="$(printf '%s' "${dest}" | tr '[:upper:]' '[:lower:]')"
  if [[ "${src}" == "$(printf '%s' "${dest}" | tr '[:lower:]' '[:upper:]')" ]]; then
    echo "Refusing to put the uploads backup in the same region as the source (${src})." >&2
    exit 1
  fi
  echo "APPLY: source uploads bucket location ${src}" >&2
  echo "APPLY: uploads backup location ${dest}" >&2
  printf '%s' "${dest}"
}

UPLOADS_LOCATION="$(choose_uploads_location)" || exit 1

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

cat > "${TMP}/auth-lifecycle.json" <<'EOF'
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "age": 90 } },
    { "action": { "type": "Delete" }, "condition": { "daysSinceNoncurrentTime": 1 } }
  ]
}
EOF

cat > "${TMP}/uploads-lifecycle.json" <<'EOF'
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "daysSinceNoncurrentTime": 90 } },
    { "action": { "type": "AbortIncompleteMultipartUpload" }, "condition": { "age": 7 } }
  ]
}
EOF

harden_bucket() {
  local name="$1"
  gcloud storage buckets update "gs://${name}" --project "${PROJECT_ID}" --uniform-bucket-level-access
  if ! gcloud storage buckets update "gs://${name}" --project "${PROJECT_ID}" --public-access-prevention; then
    gcloud storage buckets update "gs://${name}" --project "${PROJECT_ID}" --pap=enforced
  fi
  gcloud storage buckets update "gs://${name}" --project "${PROJECT_ID}" --versioning
  local pap
  pap="$(gcloud storage buckets describe "gs://${name}" --project "${PROJECT_ID}" --format='value(iamConfiguration.publicAccessPrevention)')"
  if [[ "${pap}" != "enforced" ]]; then
    echo "Public access prevention on gs://${name} is '${pap}', expected enforced." >&2
    exit 1
  fi
}

create_bucket() {
  local name="$1"
  local location="$2"
  local lifecycle="$3"
  if gcloud storage buckets describe "gs://${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "APPLY: gs://${name} already exists. Updating access settings only."
  elif ! gcloud storage buckets create "gs://${name}" \
      --project "${PROJECT_ID}" \
      --location "${location}" \
      --uniform-bucket-level-access \
      --public-access-prevention; then
    gcloud storage buckets create "gs://${name}" \
      --project "${PROJECT_ID}" \
      --location "${location}" \
      --uniform-bucket-level-access
  fi
  harden_bucket "${name}"
  gcloud storage buckets update "gs://${name}" --project "${PROJECT_ID}" --lifecycle-file "${lifecycle}"
}

echo "APPLY: auth backup bucket"
create_bucket "${AUTH_BACKUP_BUCKET}" "${AUTH_BACKUP_LOCATION}" "${TMP}/auth-lifecycle.json"
echo "APPLY: uploads backup bucket"
create_bucket "${UPLOADS_BACKUP_BUCKET}" "${UPLOADS_LOCATION}" "${TMP}/uploads-lifecycle.json"

bind_bucket() {
  local bucket="$1"
  local member="$2"
  local role="$3"
  gcloud storage buckets add-iam-policy-binding "gs://${bucket}" \
    --project "${PROJECT_ID}" \
    --member "${member}" \
    --role "${role}"
}

bind_bucket_creator() {
  local bucket="$1"
  local member="$2"
  bind_bucket "${bucket}" "${member}" "roles/storage.objectCreator"
  bind_bucket "${bucket}" "${member}" "roles/storage.objectViewer"
  bind_bucket "${bucket}" "${member}" "roles/storage.legacyBucketReader"
}

bind_bucket_reader() {
  local bucket="$1"
  local member="$2"
  bind_bucket "${bucket}" "${member}" "roles/storage.objectViewer"
  bind_bucket "${bucket}" "${member}" "roles/storage.legacyBucketReader"
}

bind_project() {
  if ! gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member "$1" \
    --role "$2" \
    --condition=None; then
    gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
      --member "$1" \
      --role "$2"
  fi
}

echo "APPLY: dedicated auth backup service account"
if gcloud iam service-accounts describe "${AUTH_BACKUP_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  echo "APPLY: ${AUTH_BACKUP_SA} already exists."
else
  gcloud iam service-accounts create "${AUTH_BACKUP_SA%%@*}" \
    --project "${PROJECT_ID}" \
    --display-name "Bitcoin Quest auth backup"
fi

echo "APPLY: bucket roles (Firestore agent before uniform access)"
bind_bucket "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${FIRESTORE_SA}" "roles/storage.objectAdmin"
bind_bucket "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${FIRESTORE_SA}" "roles/storage.legacyBucketReader"
bind_bucket_creator "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
bind_bucket_creator "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
bind_bucket_creator "${AUTH_BACKUP_BUCKET}" "serviceAccount:${AUTH_BACKUP_SA}"
bind_bucket_reader "${AUTH_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
bind_bucket_reader "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"

bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.objectViewer"
bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.legacyBucketReader"
bind_bucket "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.legacyBucketWriter"
bind_bucket "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.objectViewer"

echo "APPLY: uniform access and public access prevention on the existing Firestore backup bucket"
gcloud storage buckets update "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --uniform-bucket-level-access
if ! gcloud storage buckets update "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --public-access-prevention; then
  gcloud storage buckets update "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --pap=enforced
fi
EXISTING_PAP="$(gcloud storage buckets describe "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --format='value(iamConfiguration.publicAccessPrevention)')"
if [[ "${EXISTING_PAP}" != "enforced" ]]; then
  echo "Public access prevention on gs://${FIRESTORE_BACKUP_BUCKET} is '${EXISTING_PAP}', expected enforced." >&2
  exit 1
fi

ensure_secret() {
  local name="$1"
  local member="$2"
  if gcloud secrets describe "${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "APPLY: secret ${name} already exists. Versions were not changed."
  else
    gcloud secrets create "${name}" --project "${PROJECT_ID}" --replication-policy="automatic"
    echo "APPLY: created empty secret ${name}. Add a version yourself. No key was generated."
  fi
  if ! gcloud secrets add-iam-policy-binding "${name}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${member}" \
    --role "roles/secretmanager.secretAccessor" \
    --condition=None; then
    gcloud secrets add-iam-policy-binding "${name}" \
      --project "${PROJECT_ID}" \
      --member "serviceAccount:${member}" \
      --role "roles/secretmanager.secretAccessor"
  fi
}

echo "APPLY: secret shell AUTH_BACKUP_KEY for ${AUTH_BACKUP_SA} only (no version)"
ensure_secret AUTH_BACKUP_KEY "${AUTH_BACKUP_SA}"

echo "APPLY: project roles"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/datastore.importExportAdmin"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/datastore.viewer"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/datastore.user"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/firebaserules.viewer"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/cloudscheduler.viewer"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/storagetransfer.user"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/cloudfunctions.viewer"

AUTH_PERMS="firebaseauth.users.get,firebaseauth.configs.get,firebaseauth.configs.getHashConfig"
if gcloud iam roles describe authBackupReader --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam roles update authBackupReader --project "${PROJECT_ID}" \
    --permissions "${AUTH_PERMS}" \
    --stage GA
else
  gcloud iam roles create authBackupReader --project "${PROJECT_ID}" \
    --title "Auth backup reader" \
    --description "List Auth users and read the hash config, including password hashes, for the encrypted nightly export" \
    --permissions "${AUTH_PERMS}" \
    --stage GA
fi
bind_project "serviceAccount:${AUTH_BACKUP_SA}" "projects/${PROJECT_ID}/roles/authBackupReader"
echo "APPLY: granted projects/${PROJECT_ID}/roles/authBackupReader to ${AUTH_BACKUP_SA}"

GCF_AGENT="service-${PROJECT_NUMBER}@gcf-admin-robot.iam.gserviceaccount.com"
echo "APPLY: let the Cloud Functions service agent run nightlyAuthExport as ${AUTH_BACKUP_SA}"
if ! gcloud iam service-accounts add-iam-policy-binding "${AUTH_BACKUP_SA}" \
  --project "${PROJECT_ID}" \
  --member "serviceAccount:${GCF_AGENT}" \
  --role "roles/iam.serviceAccountUser" \
  --condition=None; then
  gcloud iam service-accounts add-iam-policy-binding "${AUTH_BACKUP_SA}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${GCF_AGENT}" \
    --role "roles/iam.serviceAccountUser"
fi

echo "APPLY: Firestore point-in-time recovery"
if ! gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' --enable-pitr; then
  gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' \
    --point-in-time-recovery-enablement=POINT_IN_TIME_RECOVERY_ENABLED
fi

echo "APPLY: Firestore delete protection"
if ! gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' --delete-protection; then
  gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' \
    --delete-protection-state=DELETE_PROTECTION_ENABLED
fi

echo "APPLY: TTL policy on backup_history.expireAt"
gcloud firestore fields ttls update expireAt \
  --collection-group=backup_history \
  --enable-ttl \
  --project "${PROJECT_ID}"

cat <<EOF

APPLY finished. No buckets were deleted and no retention lock was set.

Before deploy, add the auth backup key (do not commit it, do not log it):

  openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \\
    --project=${PROJECT_ID} --data-file=-

The account that runs firebase deploy needs roles/iam.serviceAccountUser
on ${AUTH_BACKUP_SA}. The Cloud Functions service agent was granted that
role above. nightlyAuthExport is the only function that uses this account.

Deploy:

  firebase deploy --only functions:dailyFirestoreBackup,functions:nightlyAuthExport,functions:nightlyUploadsCopy,functions:nightlyConfigSnapshot,functions:backupHealthCheck

An external checker reads backup_status/latest with the Admin SDK after
05:00 UTC. These scripts do not send email or chat messages.

EOF
