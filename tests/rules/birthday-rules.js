#!/usr/bin/env node
'use strict';

// Private birthday doc and the yearly award marker.
//
//   npx --yes firebase-tools emulators:exec --only firestore --project demo-birthday \
//     "node tests/rules/birthday-rules.js"

const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc, getDocs, collection, serverTimestamp } = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emuParts = emu.split(':');
const host = emuParts[0];
const port = Number(emuParts[1] || 8085);

function birthday(extra) {
    const data = {
        month: 3,
        day: 15,
        uid: 'alice',
        setAt: serverTimestamp(),
    };
    Object.keys(extra || {}).forEach(function (key) {
        if (extra[key] === undefined) delete data[key];
        else data[key] = extra[key];
    });
    return data;
}

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-birthday',
        firestore: { rules: rules, host: host, port: port },
    });

    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (err) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (err && err.message));
        }
    }

    const alice = env.authenticatedContext('alice', { firebase: { sign_in_provider: 'password' } }).firestore();
    const guest = env.authenticatedContext('guest', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
    const bob = env.authenticatedContext('bob').firestore();
    const admin = env.authenticatedContext('admin', { admin: true }).firestore();
    const signedOut = env.unauthenticatedContext().firestore();
    const profile = doc(alice, 'users/alice/birthday_private/profile');

    await expect('owner creates month and day without a year', function () {
        return setDoc(profile, birthday());
    }, true);

    await expect('anonymous sign-in cannot save a birthday', function () {
        return setDoc(doc(guest, 'users/guest/birthday_private/profile'), birthday({ uid: 'guest' }));
    }, false);

    await expect('owner reads their birthday', function () {
        return getDoc(profile);
    }, true);

    await expect('owner lists their birthday docs', function () {
        return getDocs(collection(alice, 'users/alice/birthday_private'));
    }, true);

    await expect('a second write is denied', function () {
        return setDoc(profile, birthday({ day: 16 }));
    }, false);

    await expect('owner cannot update the birthday', function () {
        return updateDoc(profile, { day: 16 });
    }, false);

    await expect('owner cannot delete the birthday', function () {
        return deleteDoc(profile);
    }, false);

    await expect('another user cannot read it', function () {
        return getDoc(doc(bob, 'users/alice/birthday_private/profile'));
    }, false);

    await expect('another user cannot list it', function () {
        return getDocs(collection(bob, 'users/alice/birthday_private'));
    }, false);

    await expect('signed-out read is denied', function () {
        return getDoc(doc(signedOut, 'users/alice/birthday_private/profile'));
    }, false);

    await expect('admin can read it', function () {
        return getDoc(doc(admin, 'users/alice/birthday_private/profile'));
    }, true);

    await expect('admin client cannot change it', function () {
        return updateDoc(doc(admin, 'users/alice/birthday_private/profile'), { day: 1 });
    }, false);

    await expect('admin client cannot create someone else\'s birthday', function () {
        return setDoc(doc(admin, 'users/bob/birthday_private/profile'), birthday({ uid: 'bob' }));
    }, false);

    await expect('doc id other than profile is denied', function () {
        return setDoc(doc(alice, 'users/alice/birthday_private/other'), birthday());
    }, false);

    await expect('cannot write a birthday onto someone else\'s account', function () {
        return setDoc(doc(alice, 'users/carol/birthday_private/profile'), birthday({ uid: 'carol', month: 2, day: 29 }));
    }, false);

    await expect('owner Feb 29 without a year on their own doc is allowed', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await deleteDoc(doc(ctx.firestore(), 'users/alice/birthday_private/profile'));
        });
        return setDoc(profile, birthday({ month: 2, day: 29 }));
    }, true);

    await expect('Feb 29 in a non-leap year is denied', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await deleteDoc(doc(ctx.firestore(), 'users/alice/birthday_private/profile'));
        });
        return setDoc(profile, birthday({ month: 2, day: 29, year: 1900 }));
    }, false);

    await expect('a year is not stored', function () {
        return setDoc(profile, birthday({ month: 2, day: 29, year: 2000 }));
    }, false);

    await expect('April 31 is denied', async function () {
        await env.withSecurityRulesDisabled(async function (ctx) {
            await deleteDoc(doc(ctx.firestore(), 'users/alice/birthday_private/profile'));
        });
        return setDoc(profile, birthday({ month: 4, day: 31 }));
    }, false);

    await expect('month 13 is denied', function () {
        return setDoc(profile, birthday({ month: 13, day: 1 }));
    }, false);

    await expect('string month is denied', function () {
        return setDoc(profile, birthday({ month: '3' }));
    }, false);

    await expect('year 1899 is denied', function () {
        return setDoc(profile, birthday({ year: 1899 }));
    }, false);

    await expect('year far in the future is denied', function () {
        return setDoc(profile, birthday({ year: 2099 }));
    }, false);

    await expect('client timestamp is denied', function () {
        return setDoc(profile, birthday({ setAt: new Date() }));
    }, false);

    await expect('extra reward field is denied', function () {
        return setDoc(profile, birthday({ orangeTickets: 25 }));
    }, false);

    await expect('revisedAt is denied', function () {
        return setDoc(profile, birthday({ revisedAt: serverTimestamp() }));
    }, false);

    await expect('uid must be the owner', function () {
        return setDoc(profile, birthday({ uid: 'bob' }));
    }, false);

    await expect('award marker is not client writable', function () {
        return setDoc(doc(alice, 'users/alice/birthday_awards/2026'), {
            uid: 'alice',
            year: 2026,
            tickets: 25,
        });
    }, false);

    await env.withSecurityRulesDisabled(async function (ctx) {
        await setDoc(doc(ctx.firestore(), 'users/alice/birthday_awards/2026'), { tickets: 25, year: 2026 });
    });

    await expect('owner can read their award marker', function () {
        return getDoc(doc(alice, 'users/alice/birthday_awards/2026'));
    }, true);

    await expect('another user cannot read the award marker', function () {
        return getDoc(doc(bob, 'users/alice/birthday_awards/2026'));
    }, false);

    await expect('admin can read the award marker', function () {
        return getDoc(doc(admin, 'users/alice/birthday_awards/2026'));
    }, true);

    await expect('owner cannot delete the award marker', function () {
        return deleteDoc(doc(alice, 'users/alice/birthday_awards/2026'));
    }, false);

    await expect('create user profile cannot include birthday', function () {
        return setDoc(doc(alice, 'users/dave'), { points: 0, displayName: 'Dave', birthday: '03-15' });
    }, false);

    await expect('create a plain profile', function () {
        return setDoc(doc(alice, 'users/alice'), { points: 0, displayName: 'Alice' });
    }, true);

    await expect('profile update cannot store birthday', function () {
        return updateDoc(doc(alice, 'users/alice'), { birthday: '03-15' });
    }, false);

    await expect('profile update cannot store birthMonth', function () {
        return updateDoc(doc(alice, 'users/alice'), { birthMonth: 3, birthDay: 15 });
    }, false);

    await expect('public profile client write is denied', function () {
        return setDoc(doc(alice, 'public_profiles/alice'), { username: 'Alice', birthday: '03-15' });
    }, false);

    await env.cleanup();
    process.exit(failed > 0 ? 1 : 0);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
