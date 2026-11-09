'use strict';

// Non-secret config for dailyAuthExport.
//
// AGE_RECIPIENTS holds PUBLIC age keys only ("age1..."). Phil makes the
// keypair in Cloud Shell (see the PHIL-KEYGEN steps), keeps the private key
// (AGE-SECRET-KEY-1...) offline, and pastes only the public key here in a
// reviewed PR. A public key can encrypt but never decrypt, so it is safe to
// commit. Changing it needs a PR, which is the point: nobody can quietly
// point the backup at a key they hold.
//
// Empty list = the export refuses to run (fails closed, writes no plaintext).
const AGE_RECIPIENTS = Object.freeze([]);

function authBackupBucket(projectId) {
    return projectId + '-auth-backups';
}

module.exports = {
    AGE_RECIPIENTS: AGE_RECIPIENTS,
    authBackupBucket: authBackupBucket,
    PREFIX: 'auth/',
    TIME_ZONE: 'America/New_York',
};
