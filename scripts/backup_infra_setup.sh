#!/usr/bin/env bash
# Bitcoin Quest nightly backup infrastructure.
#
# Dry run by default. This prints every change and does not call gcloud.
# The Cloud Agent does not run this script.
#
#   bash scripts/backup_infra_setup.sh
#   bash scripts/backup_infra_setup.sh --owner-apply
#   bash scripts/backup_infra_setup.sh --apply
#
# --owner-apply is Phil, once, in Cloud Shell, with an owner login:
#   enable APIs (including Storage Transfer), create the Storage Transfer
#   service agent, create bq-auth-backup, and create the custom role plus
#   its project binding.
# --apply is the rufus2-deploy account: buckets, bucket IAM, uniform access,
#   public access prevention, the empty secret container, PITR, delete
#   protection, and the backup_history TTL. It does not enable APIs, create
#   the service account, or call the Storage Transfer create API.
#
# This script does not delete buckets, objects, or databases, and it does
# not set a retention policy or a retention lock. It does not create SMTP
# secrets. Backup results stay in Firestore for an external checker.
# It does not generate AUTH_BACKUP_KEY. Phil pipes that in Cloud Shell.
#
# AUTH_BACKUP_KEY (32 bytes). After both flags, Phil generates the version
# in Cloud Shell, never on the deploy box, and keeps an offline copy. The
# value is piped, so it is not a shell argument:
#   openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \
#     --project=bitcoin-education-archive --data-file=-

set -euo pipefail

PROJECT_ID="${PROJECT_ID:-bitcoin-education-archive}"
FIRESTORE_BACKUP_BUCKET="${FIRESTORE_BACKUP_BUCKET:-bitcoin-education-archive-backups}"
AUTH_BACKUP_BUCKET="${AUTH_BACKUP_BUCKET:-bitcoin-education-archive-auth-backups}"
UPLOADS_BACKUP_BUCKET="${UPLOADS_BACKUP_BUCKET:-bitcoin-education-archive-uploads-backup}"
SOURCE_UPLOADS_BUCKET="${SOURCE_UPLOADS_BUCKET:-bitcoin-education-archive.firebasestorage.app}"
AUTH_BACKUP_LOCATION="${AUTH_BACKUP_LOCATION:-us}"
AUTH_BACKUP_SA="${AUTH_BACKUP_SA:-bq-auth-backup@${PROJECT_ID}.iam.gserviceaccount.com}"

OWNER=0
APPLY=0
for arg in "$@"; do
  case "${arg}" in
    --owner-apply) OWNER=1 ;;
    --apply) APPLY=1 ;;
    -h|--help)
      echo "Usage: bash scripts/backup_infra_setup.sh [--owner-apply] [--apply]"
      echo "Default is a dry run. It prints WOULD lines and changes nothing."
      echo "--owner-apply is Phil, once, in Cloud Shell."
      echo "--apply is the deploy account (buckets, bucket IAM, secret container, PITR, TTL)."
      exit 0
      ;;
    *)
      echo "Unknown argument: ${arg}" >&2
      echo "Usage: bash scripts/backup_infra_setup.sh [--owner-apply] [--apply]" >&2
      exit 2
      ;;
  esac
done

cat <<EOF
Project: ${PROJECT_ID}
Mode: $([[ "${OWNER}" == "1" || "${APPLY}" == "1" ]] && echo MUTATE || echo DRY-RUN)
No buckets are deleted. No retention lock is set. No email secrets are created.
No key material is generated. Phil pipes AUTH_BACKUP_KEY in Cloud Shell.

Owner section (--owner-apply, Cloud Shell, once):
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
WOULD create the Storage Transfer service agent by reading
  googleServiceAccounts/${PROJECT_ID}. That call creates the agent.
WOULD create ${AUTH_BACKUP_SA} if it is missing.
WOULD create or update custom role authBackupReader with
  firebaseauth.users.get, firebaseauth.configs.get, and
  firebaseauth.configs.getHashConfig, and bind it only to ${AUTH_BACKUP_SA}.
WOULD stop if that custom role cannot be created or bound.

Bucket section (--apply, deploy account). Run this after --owner-apply.
It does not enable APIs and it does not call the Storage Transfer create API.
WOULD use project-PROJECT_NUMBER@storage-transfer-service.iam.gserviceaccount.com.
WOULD detect the gen2 service account on dailyFirestoreBackup, else
  PROJECT_NUMBER-compute@developer.gserviceaccount.com.

WOULD create gs://${AUTH_BACKUP_BUCKET} in ${AUTH_BACKUP_LOCATION} if missing.
WOULD set uniform bucket-level access, public access prevention enforced,
  and versioning on gs://${AUTH_BACKUP_BUCKET}.
WOULD set its lifecycle so a live object is deleted at age 90 days. With
  versioning, that delete makes the object noncurrent. Noncurrent generations
  are deleted after 1 day.
WOULD set --soft-delete-duration=0 on that bucket so soft delete does not
  keep ciphertext past the 90 day lifecycle. Privacy copy stays 90 days.
WOULD remove projectEditor, projectOwner, and projectViewer legacy bindings
  on gs://${AUTH_BACKUP_BUCKET}. Project-level Owner already covers Phil.
  The compute account holds Editor, so a leftover projectEditor binding would
  let it overwrite or delete auth backups and change bucket IAM. A missing
  binding is success, so a re-run is safe.
WOULD stop if that bucket policy still has projectEditor, projectOwner, or
  projectViewer, or if the functions service account has any role there other
  than roles/storage.objectViewer and roles/storage.legacyBucketReader.

WOULD read the location of gs://${SOURCE_UPLOADS_BUCKET}.
WOULD put gs://${UPLOADS_BACKUP_BUCKET} in us-east1, or us-west1 when the
  source is us-east1. UPLOADS_BACKUP_LOCATION overrides that choice.
WOULD refuse a destination that matches the source region.
WOULD create that bucket if missing, then set uniform bucket-level access,
  public access prevention enforced, and versioning.
WOULD leave its default projectEditor binding in place. The compute account
  overwrites the uploads checkpoint there.
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
  gs://${AUTH_BACKUP_BUCKET} only. objectCreator cannot overwrite, so a
  second auth export the same day fails closed.
WOULD grant the functions service account roles/storage.objectViewer and
  roles/storage.legacyBucketReader on gs://${AUTH_BACKUP_BUCKET} so the
  health check can read the manifest and object metadata. It cannot create
  or delete objects there.
WOULD grant roles/storage.objectViewer and roles/storage.legacyBucketReader
  on gs://${SOURCE_UPLOADS_BUCKET} to the functions service account.
WOULD grant the Storage Transfer service agent objectViewer and
  legacyBucketReader on the source, and legacyBucketWriter plus objectViewer
  on gs://${UPLOADS_BACKUP_BUCKET}.

WOULD create empty secret AUTH_BACKUP_KEY if it is missing, without adding
  a version, and grant roles/secretmanager.secretAccessor to ${AUTH_BACKUP_SA}
  only. The compute account is not given project roles by this script. It
  already has Editor. The Cloud Functions service agent is not granted a
  role on ${AUTH_BACKUP_SA}. The deploy account already has project-level
  permission to deploy a function as that account.

WOULD enable Firestore point-in-time recovery on (default).
WOULD enable Firestore delete protection on (default).
WOULD enable a TTL policy on collection group backup_history field expireAt:
  gcloud firestore fields ttls update expireAt \\
    --collection-group=backup_history --enable-ttl --project=${PROJECT_ID}
  Writers set expireAt to finishedAt plus 90 days.

Phil, in Cloud Shell, never on the deploy box, after the secret exists:

  openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \\
    --project=${PROJECT_ID} --data-file=-

Then deploy:

  firebase deploy --only functions:dailyFirestoreBackup,functions:nightlyAuthExport,functions:nightlyUploadsCopy,functions:nightlyConfigSnapshot,functions:backupHealthCheck

EOF

if [[ "${OWNER}" != "1" && "${APPLY}" != "1" ]]; then
  echo "Dry run only. Phil runs --owner-apply once in Cloud Shell. The deploy account runs --apply."
  exit 0
fi

binding_is_missing() {
  printf '%s' "$1" | grep -qiE 'not found|does not have|does not exist|did not find|not present|no binding|was not found'
}

remove_bucket_binding() {
  local bucket="$1"
  local member="$2"
  local role="$3"
  local err=""
  local status=0
  set +e
  err="$(gcloud storage buckets remove-iam-policy-binding "gs://${bucket}" \
    --project "${PROJECT_ID}" \
    --member "${member}" \
    --role "${role}" 2>&1)"
  status=$?
  set -e
  if [[ "${status}" -eq 0 ]]; then
    return 0
  fi
  if binding_is_missing "${err}"; then
    return 0
  fi
  printf '%s\n' "${err}" >&2
  return 1
}

strip_auth_bucket_legacy() {
  local members=(
    "projectEditor:${PROJECT_ID}"
    "projectOwner:${PROJECT_ID}"
    "projectViewer:${PROJECT_ID}"
  )
  local roles=(
    "roles/storage.legacyBucketOwner"
    "roles/storage.legacyObjectOwner"
    "roles/storage.legacyBucketReader"
    "roles/storage.legacyObjectReader"
  )
  local member role
  for member in "${members[@]}"; do
    for role in "${roles[@]}"; do
      remove_bucket_binding "${AUTH_BACKUP_BUCKET}" "${member}" "${role}"
    done
  done
}

assert_auth_bucket_isolated() {
  local policy
  policy="$(gcloud storage buckets get-iam-policy "gs://${AUTH_BACKUP_BUCKET}" --project "${PROJECT_ID}" --format=json)"
  POLICY_JSON="${policy}" ASSERT_PROJECT="${PROJECT_ID}" ASSERT_FUNCTIONS_SA="${FUNCTIONS_SA}" python3 - <<'AUTH_POLICY_PY'
import json, os, sys
policy = json.loads(os.environ["POLICY_JSON"])
functions_sa = "serviceAccount:" + os.environ["ASSERT_FUNCTIONS_SA"]
allowed = {"roles/storage.objectViewer", "roles/storage.legacyBucketReader"}
banned_prefixes = ("projectEditor:", "projectOwner:", "projectViewer:")
found = set()
for binding in policy.get("bindings") or []:
    role = binding.get("role") or ""
    for member in binding.get("members") or []:
        for prefix in banned_prefixes:
            if member.startswith(prefix):
                sys.stderr.write("Auth backup bucket still binds %s to %s\n" % (member, role))
                sys.exit(1)
        if member == functions_sa:
            found.add(role)
extra = sorted(found - allowed)
if extra:
    sys.stderr.write("Functions service account has extra auth-bucket roles: %s\n" % ", ".join(extra))
    sys.exit(1)
missing = sorted(allowed - found)
if missing:
    sys.stderr.write("Functions service account is missing auth-bucket read roles: %s\n" % ", ".join(missing))
    sys.exit(1)
AUTH_POLICY_PY
}

disable_auth_soft_delete() {
  gcloud storage buckets update "gs://${AUTH_BACKUP_BUCKET}" \
    --project "${PROJECT_ID}" \
    --soft-delete-duration=0
  local soft
  soft="$(gcloud storage buckets describe "gs://${AUTH_BACKUP_BUCKET}" --project "${PROJECT_ID}" --format='value(softDeletePolicy.retentionDurationSeconds)')"
  if [[ -n "${soft}" && "${soft}" != "0" ]]; then
    echo "Soft delete on gs://${AUTH_BACKUP_BUCKET} is '${soft}' seconds. Expected 0 so retention stays 90 days." >&2
    exit 1
  fi
}

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

ensure_secret() {
  local name="$1"
  local member="$2"
  if gcloud secrets describe "${name}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "APPLY: secret ${name} already exists. Versions were not changed."
  else
    gcloud secrets create "${name}" --project "${PROJECT_ID}" --replication-policy="automatic"
    echo "APPLY: created empty secret ${name}. No key was generated."
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

run_owner() {
  echo "OWNER: enabling APIs"
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

  echo "OWNER: creating the Storage Transfer service agent"
  local token="" sts_json="" parsed=""
  token="$(gcloud auth print-access-token)"
  if ! sts_json="$(curl -fsS -H "Authorization: Bearer ${token}" \
    "https://storagetransfer.googleapis.com/v1/googleServiceAccounts/${PROJECT_ID}")"; then
    unset token
    echo "Could not create the Storage Transfer service agent." >&2
    exit 1
  fi
  unset token
  parsed="$(printf '%s' "${sts_json}" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("accountEmail",""))')"
  if [[ -z "${parsed}" ]]; then
    echo "Storage Transfer service agent response had no accountEmail." >&2
    exit 1
  fi
  echo "OWNER: Storage Transfer service agent ${parsed}"

  echo "OWNER: auth backup service account"
  if gcloud iam service-accounts describe "${AUTH_BACKUP_SA}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
    echo "OWNER: ${AUTH_BACKUP_SA} already exists."
  else
    gcloud iam service-accounts create "${AUTH_BACKUP_SA%%@*}" \
      --project "${PROJECT_ID}" \
      --display-name "Bitcoin Quest auth backup"
  fi

  local auth_perms="firebaseauth.users.get,firebaseauth.configs.get,firebaseauth.configs.getHashConfig"
  if gcloud iam roles describe authBackupReader --project "${PROJECT_ID}" >/dev/null 2>&1; then
    gcloud iam roles update authBackupReader --project "${PROJECT_ID}" \
      --permissions "${auth_perms}" \
      --stage GA
  else
    gcloud iam roles create authBackupReader --project "${PROJECT_ID}" \
      --title "Auth backup reader" \
      --description "List Auth users and read the hash config, including password hashes, for the encrypted nightly export" \
      --permissions "${auth_perms}" \
      --stage GA
  fi
  bind_project "serviceAccount:${AUTH_BACKUP_SA}" "projects/${PROJECT_ID}/roles/authBackupReader"
  echo "OWNER: granted projects/${PROJECT_ID}/roles/authBackupReader to ${AUTH_BACKUP_SA}"
}

run_apply() {
  echo "APPLY: starting bucket and database changes for ${PROJECT_ID}"
  local project_number
  project_number="$(gcloud projects describe "${PROJECT_ID}" --format='value(projectNumber)')"
  FUNCTIONS_SA="${FUNCTIONS_SA:-${project_number}-compute@developer.gserviceaccount.com}"
  local detected
  detected="$(gcloud functions describe dailyFirestoreBackup --gen2 --region=us-central1 --project="${PROJECT_ID}" --format='value(serviceConfig.serviceAccountEmail)' 2>/dev/null || true)"
  if [[ -n "${detected}" ]]; then
    FUNCTIONS_SA="${detected}"
  fi
  local firestore_sa="service-${project_number}@gcp-sa-firestore.iam.gserviceaccount.com"
  local sts_sa="project-${project_number}@storage-transfer-service.iam.gserviceaccount.com"
  echo "APPLY: functions service account ${FUNCTIONS_SA}"
  echo "APPLY: Storage Transfer service agent ${sts_sa}"

  local uploads_location
  uploads_location="$(choose_uploads_location)" || exit 1

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

  echo "APPLY: auth backup bucket"
  create_bucket "${AUTH_BACKUP_BUCKET}" "${AUTH_BACKUP_LOCATION}" "${TMP}/auth-lifecycle.json"
  echo "APPLY: disable soft delete on the auth backup bucket"
  disable_auth_soft_delete
  echo "APPLY: remove projectEditor, projectOwner, and projectViewer legacy bindings"
  strip_auth_bucket_legacy

  echo "APPLY: uploads backup bucket"
  create_bucket "${UPLOADS_BACKUP_BUCKET}" "${uploads_location}" "${TMP}/uploads-lifecycle.json"

  echo "APPLY: bucket roles (Firestore agent before uniform access)"
  bind_bucket "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${firestore_sa}" "roles/storage.objectAdmin"
  bind_bucket "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${firestore_sa}" "roles/storage.legacyBucketReader"
  bind_bucket_creator "${FIRESTORE_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
  bind_bucket_creator "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
  bind_bucket_creator "${AUTH_BACKUP_BUCKET}" "serviceAccount:${AUTH_BACKUP_SA}"
  bind_bucket_reader "${AUTH_BACKUP_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"
  bind_bucket_reader "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${FUNCTIONS_SA}"

  bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${sts_sa}" "roles/storage.objectViewer"
  bind_bucket "${SOURCE_UPLOADS_BUCKET}" "serviceAccount:${sts_sa}" "roles/storage.legacyBucketReader"
  bind_bucket "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${sts_sa}" "roles/storage.legacyBucketWriter"
  bind_bucket "${UPLOADS_BACKUP_BUCKET}" "serviceAccount:${sts_sa}" "roles/storage.objectViewer"

  echo "APPLY: check the auth backup bucket no longer grants project editors or owners"
  assert_auth_bucket_isolated

  echo "APPLY: uniform access and public access prevention on the existing Firestore backup bucket"
  gcloud storage buckets update "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --uniform-bucket-level-access
  if ! gcloud storage buckets update "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --public-access-prevention; then
    gcloud storage buckets update "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --pap=enforced
  fi
  local existing_pap
  existing_pap="$(gcloud storage buckets describe "gs://${FIRESTORE_BACKUP_BUCKET}" --project "${PROJECT_ID}" --format='value(iamConfiguration.publicAccessPrevention)')"
  if [[ "${existing_pap}" != "enforced" ]]; then
    echo "Public access prevention on gs://${FIRESTORE_BACKUP_BUCKET} is '${existing_pap}', expected enforced." >&2
    exit 1
  fi

  echo "APPLY: secret shell AUTH_BACKUP_KEY for ${AUTH_BACKUP_SA} only (no version)"
  ensure_secret AUTH_BACKUP_KEY "${AUTH_BACKUP_SA}"

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
}

gcloud config set project "${PROJECT_ID}" >/dev/null

if [[ "${OWNER}" == "1" ]]; then
  run_owner
fi

if [[ "${APPLY}" == "1" ]]; then
  run_apply
fi

cat <<EOF

Changes finished. No buckets were deleted and no retention lock was set.
No key was generated.

Phil adds the auth backup key in Cloud Shell, never on the deploy box, and
keeps an offline copy. Skip this if that version is already stored:

  openssl rand -base64 32 | gcloud secrets versions add AUTH_BACKUP_KEY \\
    --project=${PROJECT_ID} --data-file=-

The deploy account already has permission to deploy nightlyAuthExport as
${AUTH_BACKUP_SA}. This script does not grant that again.

Deploy:

  firebase deploy --only functions:dailyFirestoreBackup,functions:nightlyAuthExport,functions:nightlyUploadsCopy,functions:nightlyConfigSnapshot,functions:backupHealthCheck

An external checker reads backup_status/latest with the Admin SDK after
05:00 UTC. These scripts do not send email or chat messages.

EOF
