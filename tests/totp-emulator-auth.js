'use strict';

// The Firestore client asks for application-default credentials even when
// FIRESTORE_EMULATOR_HOST is set. Tests point that lookup at a local signer
// that never contacts Google. The emulator treats "Bearer owner" as admin.
const path = require('path');
const { GoogleAuth } = require(require.resolve('google-auth-library', {
    paths: [path.join(__dirname, '..', 'functions', 'node_modules', 'google-gax')],
}));

GoogleAuth.prototype.getClient = async function () {
    return {
        universeDomain: 'googleapis.com',
        getRequestHeaders: async function () {
            return { Authorization: 'Bearer owner' };
        },
    };
};
