// Sensitive Cloud Functions settings live in Secret Manager. A function
// receives a value only when its own options list the param. Reading is
// call-time process.env inside the handler, the same pattern as NWC_URL.
// Never call .value() at module load, and never put these names in
// functions/.env or functions/.env.<project>: Firebase injects that file
// into every function, and deploy refuses a name that is both a plain env
// var and a secret.
//
// CF_API_TOKEN is intentionally not a param. No function reads it.
// BRIDGE_SECRET is a param so the value can leave plain env, but no
// deployed function reads it: chat mirrors use TG_BOT_TOKEN, and
// bridgeToTelegram only acknowledges. The operator script
// functions/mirror-shoutout.js reads it at call time when run by hand.
const { defineSecret } = require('firebase-functions/params');

const PLAIN_ENV_NAMES = [
    'ADMIN_TOKEN',
    'BRIDGE_SECRET',
    'CF_AI_TOKEN',
    'CF_API_TOKEN',
    'NWC_URL',
    'STRAVA_CLIENT_SECRET',
    'TG_BOT_TOKEN',
    'TURNSTILE_SECRET_KEY',
    'X_ACCESS_SECRET',
    'X_ACCESS_TOKEN',
    'X_API_KEY',
    'X_API_SECRET',
];

// Every Secret Manager secret a deployed function binds from this module.
// The functions predeploy hook (scripts/require-secrets-exist.js) refuses
// to deploy unless each one exists with an enabled latest version.
const REQUIRED_SECRET_NAMES = [
    'ADMIN_TOKEN',
    'BRIDGE_SECRET',
    'CF_AI_TOKEN',
    'STRAVA_CLIENT_SECRET',
    'TG_BOT_TOKEN',
    'TURNSTILE_SECRET_KEY',
    'X_ACCESS_SECRET',
    'X_ACCESS_TOKEN',
    'X_API_KEY',
    'X_API_SECRET',
];

const adminTokenSecret = defineSecret('ADMIN_TOKEN');
const bridgeSecretParam = defineSecret('BRIDGE_SECRET');
const cfAiTokenSecret = defineSecret('CF_AI_TOKEN');
const stravaClientSecretParam = defineSecret('STRAVA_CLIENT_SECRET');
const tgBotTokenSecret = defineSecret('TG_BOT_TOKEN');
const turnstileSecret = defineSecret('TURNSTILE_SECRET_KEY');
const xAccessSecretSecret = defineSecret('X_ACCESS_SECRET');
const xAccessTokenSecret = defineSecret('X_ACCESS_TOKEN');
const xApiKeySecret = defineSecret('X_API_KEY');
const xApiSecretSecret = defineSecret('X_API_SECRET');

const xPostSecrets = [xApiKeySecret, xApiSecretSecret, xAccessTokenSecret, xAccessSecretSecret];
const hotTopicSecrets = [cfAiTokenSecret].concat(xPostSecrets);

function readBound(name) {
    return process.env[name] || '';
}

function adminToken() { return readBound('ADMIN_TOKEN'); }
function bridgeSecret() { return readBound('BRIDGE_SECRET'); }
function cfAiToken() { return readBound('CF_AI_TOKEN'); }
function stravaClientSecret() { return readBound('STRAVA_CLIENT_SECRET'); }
function tgBotToken() { return readBound('TG_BOT_TOKEN'); }
function turnstileSecretKey() { return readBound('TURNSTILE_SECRET_KEY'); }
function xAccessSecret() { return readBound('X_ACCESS_SECRET'); }
function xAccessToken() { return readBound('X_ACCESS_TOKEN'); }
function xApiKey() { return readBound('X_API_KEY'); }
function xApiSecret() { return readBound('X_API_SECRET'); }

module.exports = {
    PLAIN_ENV_NAMES: PLAIN_ENV_NAMES,
    REQUIRED_SECRET_NAMES: REQUIRED_SECRET_NAMES,
    adminTokenSecret: adminTokenSecret,
    bridgeSecretParam: bridgeSecretParam,
    cfAiTokenSecret: cfAiTokenSecret,
    stravaClientSecretParam: stravaClientSecretParam,
    tgBotTokenSecret: tgBotTokenSecret,
    turnstileSecret: turnstileSecret,
    xAccessSecretSecret: xAccessSecretSecret,
    xAccessTokenSecret: xAccessTokenSecret,
    xApiKeySecret: xApiKeySecret,
    xApiSecretSecret: xApiSecretSecret,
    xPostSecrets: xPostSecrets,
    hotTopicSecrets: hotTopicSecrets,
    adminToken: adminToken,
    bridgeSecret: bridgeSecret,
    cfAiToken: cfAiToken,
    stravaClientSecret: stravaClientSecret,
    tgBotToken: tgBotToken,
    turnstileSecretKey: turnstileSecretKey,
    xAccessSecret: xAccessSecret,
    xAccessToken: xAccessToken,
    xApiKey: xApiKey,
    xApiSecret: xApiSecret,
};
