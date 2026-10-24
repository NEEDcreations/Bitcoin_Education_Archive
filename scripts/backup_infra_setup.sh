#!/usr/bin/env bash
# Bitcoin Quest nightly backup infrastructure.
#
# Review this file, then run it yourself from a machine logged into
# bitcoin-education-archive. The Cloud Agent does not run it.
#
# This script does not delete buckets, objects, or databases, and it does
# not set a retention policy or a retention lock.
#
# What it does:
#   - Enables the APIs the nightly functions call
#   - Creates gs://bitcoin-education-archive-auth-backups (90-day lifecycle)
#   - Creates gs://bitcoin-education-archive-uploads-backup in a DIFFERENT
#     region from the live *.firebasestorage.app bucket, with versioning and
#     a 90-day lifecycle for noncurrent (deleted/overwritten) generations
#   - Turns on uniform bucket-level access and public access prevention
#     (enforced) for those buckets and for gs://bitcoin-education-archive-backups
#   - Enables Firestore point-in-time recovery and delete protection
#   - Grants the Cloud Functions runtime service account only the roles below
#   - Creates empty Secret Manager secrets (no key material)
#
# AUTH_BACKUP_KEY (32 bytes). Create a version after this script. The value
# stays in Secret Manager and must never be committed:
#   openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \
#     --project=bitcoin-education-archive --data-file=-
#
# Alert mail uses nodemailer over Gmail SMTP, the same library as the forum
# notifier in functions/index.js. Put the mailbox and app password in:
#   printf '%s' 'sender@gmail.com' | gcloud secrets versions add ALERT_SMTP_USER \
#     --project=bitcoin-education-archive --data-file=-
#   printf '%s' 'app-password' | gcloud secrets versions add ALERT_SMTP_PASS \
#     --project=bitcoin-education-archive --data-file=-
# Optional overrides (not secrets): ALERT_SMTP_HOST (default smtp.gmail.com),
# ALERT_SMTP_PORT (default 465). The only recipient is info.603btc@gmail.com.
#
# Then deploy:
#   firebase deploy --only functions:dailyFirestoreBackup,functions:nightlyAuthExport,functions:nightlyUploadsCopy,functions:nightlyConfigSnapshot,functions:backupHealthCheck

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-bitcoin-education-archive}"
FIRESTORE_BACKUP_BUCKET="${FIRESTORE_BACKUP_BUCKET:-bitcoin-education-archive-backups}"
AUTH_BACKUP_BUCKET="${AUTH_BACKUP_BUCKET:-bitcoin-education-archive-auth-backups}"
UPLOADS_BACKUP_BUCKET="${UPLOADS_BACKUP_BUCKET:-bitcoin-education-archive-uploads-backup}"
SOURCE_UPLOADS_BUCKET="${SOURCE_UPLOADS_BUCKET:-bitcoin-education-archive.firebasestorage.app}"
AUTH_BACKUP_LOCATION="${AUTH_BACKUP_LOCATION:-us}"

echo "Project: ${PROJECT_ID}"
echo "This script does not delete buckets or lock retention."
gcloud config set project "${PROJECT_ID}" >/dev/null

echo "Enabling APIs..."
gcloud services enable \
  firestore.googleapis.com \
  firebaserules.googleapis.com \
  cloudscheduler.googleapis.com \
  storagetransfer.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com \
  firebase.googleapis.com \
  --project "${PROJECT_ID}"

PROJECT_NUMBER="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
FUNCTIONS_SA="${FUNCTIONS_SA:-${PROJECT_NUMBER}-compute@developer.gserviceaccount.com}"
DETECTED="$(gcloud functions describe dailyFirestoreBackup --gen2 --region=us-central1 --project="${PROJECT_ID}" --format='value(serviceConfig.serviceAccountEmail)' 2>/dev/null || true)"
if [[ -n "${DETECTED}" ]]; then
  FUNCTIONS_SA="${DETECTED}"
fi
FIRESTORE_SA="service-${PROJECT_NUMBER}@gcp-sa-firestore.iam.gserviceaccount.com"
echo "Functions service account: ${FUNCTIONS_SA}"

echo "Resolving the Storage Transfer service agent..."
STS_SA="project-${PROJECT_NUMBER}@storage-transfer-service.iam.gserviceaccount.com"
TOKEN="$(gcloud auth print-access-token)"
if STS_JSON="$(curl -fsS -H "Authorization: Bearer ${TOKEN}" \
  "https://storagetransfer.googleapis.com/v1/googleServiceAccounts/${PROJECT_ID}" 2>/dev/null)"; then
  PARSED="$(printf '%s' "${STS_JSON}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("accountEmail",""))' 2>/dev/null || true)"
  if [[ -n "${PARSED}" ]]; then
    STS_SA="${PARSED}"
  fi
fi
echo "Storage Transfer service agent: ${STS_SA}"

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
  echo "Source uploads bucket location: ${src}" >&2
  echo "Uploads backup location: ${dest}" >&2
  printf '%s' "${dest}"
}

UPLOADS_LOCATION="$(choose_uploads_location)" || exit 1

TMP="$(mktemp -d)"
trap 'rm -rf "${TMP}"' EXIT

cat > "${TMP}/auth-lifecycle.json" <<'EOF'
{
  "rule": [
    { "action": { "type": "Delete" }, "condition": { "age": 90 } },
    { "action": { "type": "Delete" }, "condition": { "daysSinceNoncurrentTime": 90 } }
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
    echo "gs://${name} already exists. Updating access settings only."
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

echo "Creating auth backup bucket..."
create_bucket "${AUTH_BACKUP_BUCKET}" "${AUTH_BACKUP_LOCATION}" "${TMP}/auth-lifecycle.json"
echo "Creating uploads backup bucket..."
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

# objectUser can create, read, and overwrite objects. legacyBucketReader adds
# storage.buckets.get, which object listing needs. Fall back to objectAdmin
# if this gcloud does not know objectUser yet.
bind_bucket_writer() {
  local bucket="$1"
  local member="$2"
  if ! bind_bucket "${bucket}" "${member}" "roles/storage.objectUser"; then
    echo "roles/storage.objectUser is unavailable. Granting roles/storage.objectAdmin on gs://${bucket}."
    bind_bucket "${bucket}" "${member}" "roles/storage.objectAdmin"
  fi
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

echo "Granting bucket roles..."
# Firestore's service agent writes the managed export. Grant this before
# uniform access is enforced on the existing backup bucket.
bind_bucket "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${FIRESTORE_SA}" "roles/storage.admin"
bind_bucket_writer "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
bind_bucket_writer "${AUTH_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
bind_bucket_writer "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${FUNCTIONS_SA}" "roles/storage.objectViewer"
bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${FUNCTIONS_SA}" "roles/storage.legacyBucketReader"

bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.objectViewer"
bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.legacyBucketReader"
bind_bucket "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.legacyBucketWriter"
bind_bucket "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${STS_SA}" "roles/storage.objectViewer"

echo "Enforcing uniform access and public access prevention on the existing Firestore backup bucket..."
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
  if gcloud secrets describe "${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "Secret ${name} already exists. Versions were not changed."
  else
    gcloud secrets create "${name}" --project "${PROJECT_ID}" --replication-policy="automatic"
    echo "Created empty secret ${name}. Add a version yourself. No key was generated."
  fi
  if ! gcloud secrets add-iam-policy-binding "${name}" \
    --project "${PROJECT_ID}" \
    --member "serviceAccount:${FUNCTIONS_SA}" \
    --role "roles/secretmanager.secretAccessor" \
    --condition=None; then
    gcloud secrets add-iam-policy-binding "${name}" \
      --project "${PROJECT_ID}" \
      --member "serviceAccount:${FUNCTIONS_SA}" \
      --role "roles/secretmanager.secretAccessor"
  fi
}

echo "Creating secret shells (no versions)..."
ensure_secret AUTH_BACKUP_KEY
ensure_secret ALERT_SMTP_USER
ensure_secret ALERT_SMTP_PASS

echo "Granting project roles to the functions service account..."
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/datastore.importExportAdmin"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/datastore.viewer"
# Narrowest predefined role that can write the backup_alerts/{date} dedupe doc.
# It can read and write every document. Firestore rules deny clients. The
# health-check code only touches backup_alerts.
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/datastore.user"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/firebaserules.viewer"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/cloudscheduler.viewer"
bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/storagetransfer.user"

AUTH_ROLE_READY=0
if gcloud iam roles describe authBackupReader --project "${PROJECT_ID}" >/dev/null 2>&1; then
  if gcloud iam roles update authBackupReader --project "${PROJECT_ID}" \
    --permissions "firebaseauth.users.get,firebaseauth.configs.get" \
    --stage GA; then
    AUTH_ROLE_READY=1
  fi
elif gcloud iam roles create authBackupReader --project "${PROJECT_ID}" \
  --title "Auth backup reader" \
  --description "List Auth users and read the hash config for the encrypted nightly export" \
  --permissions "firebaseauth.users.get,firebaseauth.configs.get" \
  --stage GA; then
  AUTH_ROLE_READY=1
fi
if [[ "${AUTH_ROLE_READY}" == "1" ]] && bind_project "serviceAccount:${FUNCTIONS_SA}" "projects/${PROJECT_ID}/roles/authBackupReader"; then
  echo "Granted projects/${PROJECT_ID}/roles/authBackupReader"
else
  echo "Custom auth role was not granted. Granting roles/firebaseauth.viewer instead."
  bind_project "serviceAccount:${FUNCTIONS_SA}" "roles/firebaseauth.viewer"
fi

echo "Enabling Firestore point-in-time recovery..."
if ! gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' --enable-pitr; then
  gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' \
    --point-in-time-recovery-enablement=POINT_IN_TIME_RECOVERY_ENABLED
fi

echo "Enabling Firestore delete protection..."
if ! gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' --delete-protection; then
  gcloud firestore databases update --project "${PROJECT_ID}" --database='(default)' \
    --delete-protection-state=DELETE_PROTECTION_ENABLED
fi

cat <<EOF

Done. No buckets were deleted and no retention lock was set.

Before deploy, add secret versions (do not commit them):

  openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \\
    --project=${PROJECT_ID} --data-file=-
  printf '%s' 'SENDER_GMAIL' | gcloud secrets versions add ALERT_SMTP_USER \\
    --project=${PROJECT_ID} --data-file=-
  printf '%s' 'GMAIL_APP_PASSWORD' | gcloud secrets versions add ALERT_SMTP_PASS \\
    --project=${PROJECT_ID} --data-file=-

If passwordHashCount in the auth manifest stays 0 for accounts that have
passwords, the reader role is not enough. Grant roles/firebaseauth.admin
to ${FUNCTIONS_SA} only in that case.

Deploy:

  firebase deploy --only functions:dailyFirestoreBackup,functions:nightlyAuthExport,functions:nightlyUploadsCopy,functions:nightlyConfigSnapshot,functions:backupHealthCheck

EOF
