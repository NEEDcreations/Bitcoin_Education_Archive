'use strict';

// CIPHER_ROLL_SECRET lives in Secret Manager. Only functions that list
// cipherRollSecret in their `secrets` option receive it. Read at call time,
// never at module load, and never put this name in functions/.env.
// Never log or print the value.
const { defineSecret } = require('firebase-functions/params');
const key = require('./cipherRollKey');

const cipherRollSecret = defineSecret(key.SECRET_ENV);

module.exports = {
    SECRET_ENV: key.SECRET_ENV,
    MIN_SECRET_LEN: key.MIN_SECRET_LEN,
    cipherRollSecret: cipherRollSecret,
    cipherRollKey: key.cipherRollKey,
    secretReady: key.secretReady,
};
