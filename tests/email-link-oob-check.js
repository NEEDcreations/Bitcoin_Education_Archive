#!/usr/bin/env node
'use strict';

// Asks the Auth emulator whether a failed email-link linkWithCredential
// consumes the one-time oob code. Not part of run-all.js. Run under
// `firebase emulators:exec --only auth`.

const PROJECT = process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT || 'demo-btc';
const HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const BASE = 'http://' + HOST + '/identitytoolkit.googleapis.com/v1';
const KEY = 'fake-api-key';

async function post(path, body) {
    const res = await fetch(BASE + path + '?key=' + KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json().catch(function () { return {}; });
    return { status: res.status, data: data };
}

async function oobCodes() {
    const res = await fetch('http://' + HOST + '/emulator/v1/projects/' + PROJECT + '/oobCodes');
    if (!res.ok) throw new Error('oob list ' + res.status);
    const data = await res.json();
    return data.oobCodes || data || [];
}

async function main() {
    const email = 'returning-' + Date.now() + '@example.com';
    const anon = await post('/accounts:signUp', { returnSecureToken: true });
    if (!anon.data.idToken) throw new Error('anon signup failed ' + JSON.stringify(anon.data));
    const existing = await post('/accounts:signUp', {
        email: email,
        password: 'correct-horse',
        returnSecureToken: true,
    });
    if (!existing.data.localId) throw new Error('email signup failed ' + JSON.stringify(existing.data));
    const sent = await post('/accounts:sendOobCode', {
        requestType: 'EMAIL_SIGNIN',
        email: email,
        continueUrl: 'http://127.0.0.1/finish',
        canHandleCodeInApp: true,
    });
    if (sent.status >= 400) throw new Error('sendOobCode failed ' + JSON.stringify(sent.data));
    const listed = await oobCodes();
    const row = (Array.isArray(listed) ? listed : []).filter(function (item) {
        return item && (item.email === email || item.requestType === 'EMAIL_SIGNIN');
    }).pop();
    if (!row || !row.oobCode) throw new Error('emulator did not list an oob code: ' + JSON.stringify(listed));
    const link = await post('/accounts:signInWithEmailLink', {
        email: email,
        oobCode: row.oobCode,
        idToken: anon.data.idToken,
    });
    const again = await post('/accounts:signInWithEmailLink', {
        email: email,
        oobCode: row.oobCode,
    });
    const linkMessage = (link.data && link.data.error && link.data.error.message) || '';
    const againMessage = (again.data && again.data.error && again.data.error.message) || '';
    const consumed = again.status >= 400 && /INVALID_OOB_CODE|EXPIRED_OOB_CODE|INVALID_ACTION_CODE/.test(againMessage);
    console.log(JSON.stringify({
        linkStatus: link.status,
        linkError: linkMessage,
        retryStatus: again.status,
        retryError: againMessage,
        consumed: consumed,
    }));
    if (!/EMAIL_EXISTS|EMAIL_ALREADY/.test(linkMessage) && link.status < 400) {
        throw new Error('expected the link attempt to fail because the email is already registered');
    }
}

main().catch(function (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
});
