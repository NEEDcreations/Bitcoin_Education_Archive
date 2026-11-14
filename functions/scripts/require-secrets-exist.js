#!/usr/bin/env node
'use strict';

// Functions predeploy guard: refuse to deploy unless every Secret Manager
// secret the functions bind exists and its latest version is ENABLED.
// Reads version METADATA only (versions/latest), never the value-access endpoint,
// so no secret value is fetched, held, or printed. Prints names and HTTP
// status codes only.
//
// Credentials: Application Default Credentials (GOOGLE_APPLICATION_CREDENTIALS
// or `gcloud auth application-default login`). Fails closed when none are
// available. Project: GCLOUD_PROJECT (set by the Firebase CLI for hooks),
// else --project <id>, else the .firebaserc default.
const fs = require('fs');
const path = require('path');
const { REQUIRED_SECRET_NAMES } = require('../src/sensitiveSecrets');

function projectId(argv, env) {
    const i = argv.indexOf('--project');
    if (i !== -1 && argv[i + 1]) return argv[i + 1];
    if (env.GCLOUD_PROJECT) return env.GCLOUD_PROJECT;
    if (env.GOOGLE_CLOUD_PROJECT) return env.GOOGLE_CLOUD_PROJECT;
    try {
        const rc = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.firebaserc'), 'utf8'));
        if (rc && rc.projects && rc.projects.default) return rc.projects.default;
    } catch (err) { /* fall through */ }
    return '';
}

async function defaultToken() {
    const { applicationDefault } = require('firebase-admin/app');
    const t = await applicationDefault().getAccessToken();
    return t && t.access_token;
}

// Returns { ok, missing: [{ name, why }] }. Never returns or logs a value.
async function checkSecrets(opts) {
    const names = opts.names || REQUIRED_SECRET_NAMES;
    const project = opts.project;
    const doFetch = opts.fetch || global.fetch;
    const missing = [];
    if (!project) return { ok: false, missing: names.map(function (n) { return { name: n, why: 'no project id' }; }) };
    let token;
    try { token = await (opts.getToken || defaultToken)(); }
    catch (err) { token = ''; }
    if (!token) return { ok: false, missing: names.map(function (n) { return { name: n, why: 'no credentials' }; }) };
    for (let i = 0; i < names.length; i++) {
        const name = names[i];
        const url = 'https://secretmanager.googleapis.com/v1/projects/' + encodeURIComponent(project) +
            '/secrets/' + encodeURIComponent(name) + '/versions/latest';
        let res;
        try { res = await doFetch(url, { headers: { authorization: 'Bearer ' + token } }); }
        catch (err) { missing.push({ name: name, why: 'request failed' }); continue; }
        if (res.status !== 200) { missing.push({ name: name, why: 'http ' + res.status }); continue; }
        let body = {};
        try { body = await res.json(); } catch (err) { body = {}; }
        if (body.state !== 'ENABLED') missing.push({ name: name, why: 'latest version ' + String(body.state || 'unknown').slice(0, 20) });
    }
    return { ok: missing.length === 0, missing: missing };
}

async function main() {
    const project = projectId(process.argv.slice(2), process.env);
    const result = await checkSecrets({ project: project });
    if (result.ok) {
        console.log('required secrets present: ' + REQUIRED_SECRET_NAMES.length + '/' + REQUIRED_SECRET_NAMES.length);
        return 0;
    }
    console.error('Deploy blocked: these Secret Manager secrets are missing or not enabled in ' + (project || '(no project)') + ':');
    result.missing.forEach(function (m) { console.error('  ' + m.name + ' (' + m.why + ')'); });
    console.error('Create them with `firebase functions:secrets:set NAME` (paste the value at the prompt, never on the command line), then deploy again.');
    return 1;
}

module.exports = { checkSecrets: checkSecrets, projectId: projectId };

if (require.main === module) {
    main().then(function (code) { process.exit(code); }, function () {
        console.error('Deploy blocked: secret check crashed.');
        process.exit(1);
    });
}
