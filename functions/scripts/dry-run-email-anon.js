'use strict';

// Read-only dry run. Looks up whether an email sits on an Auth user or a
// profile, and whether that user looks like a guest account that picked up
// the address. Prints truncated uids only. Never writes. Does not run unless
// this file is the program you started.

function normalizeEmail(raw) {
    return String(raw || '').trim().toLowerCase();
}

function truncUid(uid) {
    var s = String(uid || '');
    if (!s) return '';
    if (s.length <= 8) return s.slice(0, 2) + '…' + s.slice(-2);
    return s.slice(0, 4) + '…' + s.slice(-4);
}

function classifyAuthUser(user) {
    var providers = [];
    var rows = (user && user.providerData) || [];
    var i;
    for (i = 0; i < rows.length; i++) {
        if (rows[i] && rows[i].providerId) providers.push(String(rows[i].providerId));
    }
    var uid = String((user && user.uid) || '');
    var anonymous = providers.length === 0 || providers.indexOf('anonymous') !== -1;
    var lightning = uid.indexOf('ln:') === 0;
    var linkedGuest = !anonymous && !lightning && uid.indexOf('nostr:') !== 0 && providers.length === 1 && providers[0] === 'password';
    return {
        uid: truncUid(uid),
        anonymous: anonymous,
        lightning: lightning,
        linkedGuest: linkedGuest,
        providers: providers,
    };
}

function printClass(prefix, info) {
    console.log(prefix + ' ' + (info.uid || 'none'));
    console.log('anonymous ' + (info.anonymous ? 'yes' : 'no'));
    console.log('lightning ' + (info.lightning ? 'yes' : 'no'));
    console.log('linked-guest ' + (info.linkedGuest ? 'yes' : 'no'));
    console.log('providers ' + (info.providers.length ? info.providers.join(',') : 'none'));
}

async function main() {
    var email = normalizeEmail(process.argv[2]);
    if (!email || email.indexOf('@') < 1) {
        console.error('usage: node functions/scripts/dry-run-email-anon.js <email>');
        process.exit(1);
    }
    console.log('dry-run');
    console.log('read-only');
    var admin = require('firebase-admin');
    if (!admin.apps.length) admin.initializeApp({ projectId: 'bitcoin-education-archive' });
    var authUser = null;
    try {
        authUser = await admin.auth().getUserByEmail(email);
    } catch (err) {
        var code = err && (err.code || (err.errorInfo && err.errorInfo.code)) || '';
        if (code !== 'auth/user-not-found' && code !== 'user-not-found') {
            console.log('auth lookup failed');
            process.exit(1);
        }
    }
    if (!authUser) {
        console.log('auth none');
        console.log('anonymous no');
        console.log('lightning no');
        console.log('linked-guest no');
        console.log('providers none');
    } else {
        printClass('auth', classifyAuthUser(authUser));
    }
    try {
        var snap = await admin.firestore().collection('users').where('email', '==', email).limit(5).get();
        if (!snap || snap.empty) {
            console.log('profile none');
        } else {
            snap.forEach(function (doc) {
                console.log('profile ' + truncUid(doc.id));
            });
        }
    } catch (err) {
        console.log('profile lookup failed');
    }
}

if (require.main === module) {
    main().catch(function () {
        console.error('dry-run failed');
        process.exit(1);
    });
}

module.exports = {
    normalizeEmail: normalizeEmail,
    truncUid: truncUid,
    classifyAuthUser: classifyAuthUser,
};
