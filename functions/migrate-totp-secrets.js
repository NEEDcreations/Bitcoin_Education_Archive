#!/usr/bin/env node
'use strict';

// One-time Admin SDK migration for authenticator secrets.
//
// Production totpCheck does not have TOTP_ENCRYPTION_KEY set, so existing
// secrets are plaintext. This script reads totp_secrets and totp_pending.
// Without --apply it only reads and prints counts. With --apply it encrypts
// each plaintext secret in place. It never prints a secret or the key.
//
// Create the secret, grant the Cloud Functions runtime access, and deploy the
// bound functions BEFORE --apply. Those functions are totpSetup, totpVerify,
// totpCheck, totpDisable, and regenerateRecoveryCodes.
//
//   openssl rand -hex 32 | gcloud secrets create TOTP_ENCRYPTION_KEY \
//     --project=bitcoin-education-archive \
//     --replication-policy=automatic \
//     --data-file=-
//   gcloud secrets add-iam-policy-binding TOTP_ENCRYPTION_KEY \
//     --project=bitcoin-education-archive \
//     --member=serviceAccount:bitcoin-education-archive@appspot.gserviceaccount.com \
//     --role=roles/secretmanager.secretAccessor
//   firebase deploy --project bitcoin-education-archive --only \
//     functions:totpSetup,functions:totpVerify,functions:totpCheck,functions:totpDisable,functions:regenerateRecoveryCodes
//
//   cd functions
//   export TOTP_ENCRYPTION_KEY="$(gcloud secrets versions access latest --secret=TOTP_ENCRYPTION_KEY --project=bitcoin-education-archive)"
//   node migrate-totp-secrets.js
//   node migrate-totp-secrets.js --apply
//   unset TOTP_ENCRYPTION_KEY

const admin = require('firebase-admin');
const { migratePlaintextSecrets, encryptionKeyConfigured } = require('./src/secondFactor');

const projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'bitcoin-education-archive';
if (!admin.apps.length) admin.initializeApp({ projectId: projectId });

async function main() {
    const apply = process.argv.indexOf('--apply') !== -1;
    if (apply && !encryptionKeyConfigured()) {
        console.error('Refusing to apply: TOTP_ENCRYPTION_KEY is missing or not 64 hex characters.');
        process.exit(1);
    }
    const summary = await migratePlaintextSecrets(admin.firestore(), { apply: apply });
    console.log(JSON.stringify(summary));
}

main().then(function () {
    process.exit(0);
}).catch(function (err) {
    console.error(err && err.code === 'missing-key' ? 'TOTP_ENCRYPTION_KEY missing' : 'Migration failed');
    process.exit(1);
});
