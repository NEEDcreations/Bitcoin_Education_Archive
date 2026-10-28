#!/usr/bin/env node
// Firestore rules for reports and beats_reports.
// Starts the Firestore emulator when FIRESTORE_EMULATOR_HOST is not set.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-report-rules',
        'node tests/rules/report-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const {
    doc, setDoc, addDoc, collection, updateDoc, deleteDoc, getDoc, serverTimestamp,
} = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

function repeat(ch, n) {
    return new Array(n + 1).join(ch);
}

function userReport(over) {
    const data = Object.assign({
        reportedUid: 'victim123',
        reportedName: 'alice',
        reporterUid: 'reporter1',
        reporterName: 'phil',
        reason: 'spam',
        status: 'pending',
    }, over || {});
    if (!over || !Object.prototype.hasOwnProperty.call(over, 'createdAt')) {
        data.createdAt = serverTimestamp();
    }
    return data;
}

function beatsReport(over) {
    const data = Object.assign({
        trackId: 'track123',
        reporterId: 'reporter1',
        reason: 'copyright',
    }, over || {});
    if (!over || !Object.prototype.hasOwnProperty.call(over, 'createdAt')) {
        data.createdAt = serverTimestamp();
    }
    return data;
}

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-report-rules',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8085) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }
    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const reporter = env.authenticatedContext('reporter1', password).firestore();
        const anon = env.authenticatedContext('anon1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
        const guest = env.unauthenticatedContext().firestore();
        const admin = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();

        await env.withSecurityRulesDisabled(async function(ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'reports', 'seed1'), {
                reportedUid: 'victim123',
                reportedName: 'alice',
                reporterUid: 'reporter1',
                reporterName: 'phil',
                reason: 'spam',
                status: 'pending',
            });
            await setDoc(doc(db, 'beats_reports', 'seedb'), {
                trackId: 'track123',
                reporterId: 'reporter1',
                reason: 'copyright',
            });
            await setDoc(doc(db, 'report_mail_limits', 'reporter1'), { sent: 10 });
            await setDoc(doc(db, 'report_mail_state', 'reports_seed1'), { status: 'sent' });
        });

        const reasons = ['spam', 'scam', 'harassment', 'inappropriate', 'impersonation'];
        for (let i = 0; i < reasons.length; i++) {
            await expect('report reason ' + reasons[i], function() {
                return addDoc(collection(reporter, 'reports'), userReport({ reason: reasons[i] }));
            }, true);
        }
        await expect('report reportedName of 63', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedName: repeat('n', 63) }));
        }, true);
        await expect('report reportedUid of 127', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedUid: repeat('u', 127) }));
        }, true);
        await expect('report empty reportedName', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedName: '' }));
        }, true);
        await expect('anonymous report', function() {
            return addDoc(collection(anon, 'reports'), userReport({
                reporterUid: 'anon1',
                reporterName: 'Anonymous',
            }));
        }, true);

        await expect('ATTACK report signed out', function() {
            return addDoc(collection(guest, 'reports'), userReport());
        }, false);
        await expect('ATTACK report extra key', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ email: 'a@b.com' }));
        }, false);
        await expect('ATTACK report ip field', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ ip: '203.0.113.4' }));
        }, false);
        await expect('ATTACK report reason other', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reason: 'other' }));
        }, false);
        await expect('ATTACK report self', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedUid: 'reporter1' }));
        }, false);
        await expect('ATTACK report uid 128', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedUid: repeat('u', 128) }));
        }, false);
        await expect('ATTACK report empty uid', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedUid: '' }));
        }, false);
        await expect('ATTACK report name 64', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reportedName: repeat('n', 64) }));
        }, false);
        await expect('ATTACK report status', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ status: 'open' }));
        }, false);
        await expect('ATTACK report client time', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ createdAt: new Date() }));
        }, false);
        await expect('ATTACK report forged reporter', function() {
            return addDoc(collection(reporter, 'reports'), userReport({ reporterUid: 'someoneelse' }));
        }, false);
        await expect('ATTACK report missing status', function() {
            const data = userReport();
            delete data.status;
            return addDoc(collection(reporter, 'reports'), data);
        }, false);
        await expect('reporter cannot read reports', function() {
            return getDoc(doc(reporter, 'reports', 'seed1'));
        }, false);
        await expect('admin can read reports', function() {
            return getDoc(doc(admin, 'reports', 'seed1'));
        }, true);
        await expect('ATTACK report update', function() {
            return updateDoc(doc(reporter, 'reports', 'seed1'), { status: 'closed' });
        }, false);
        await expect('ATTACK admin report update', function() {
            return updateDoc(doc(admin, 'reports', 'seed1'), { status: 'closed' });
        }, false);
        await expect('ATTACK report delete', function() {
            return deleteDoc(doc(reporter, 'reports', 'seed1'));
        }, false);

        await expect('beats report', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport());
        }, true);
        await expect('beats reason 500', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ reason: repeat('r', 500) }));
        }, true);
        await expect('beats empty reason', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ reason: '' }));
        }, true);
        await expect('ATTACK beats signed out', function() {
            return addDoc(collection(guest, 'beats_reports'), beatsReport());
        }, false);
        await expect('ATTACK beats reason 501', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ reason: repeat('r', 501) }));
        }, false);
        await expect('ATTACK beats extra key', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ email: 'a@b.com' }));
        }, false);
        await expect('ATTACK beats trackId number', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ trackId: 12 }));
        }, false);
        await expect('ATTACK beats empty trackId', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ trackId: '' }));
        }, false);
        await expect('ATTACK beats forged reporter', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ reporterId: 'someoneelse' }));
        }, false);
        await expect('ATTACK beats client time', function() {
            return addDoc(collection(reporter, 'beats_reports'), beatsReport({ createdAt: new Date() }));
        }, false);
        await expect('ATTACK beats read', function() {
            return getDoc(doc(reporter, 'beats_reports', 'seedb'));
        }, false);
        await expect('ATTACK admin beats read', function() {
            return getDoc(doc(admin, 'beats_reports', 'seedb'));
        }, false);
        await expect('ATTACK beats update', function() {
            return updateDoc(doc(reporter, 'beats_reports', 'seedb'), { reason: 'nope' });
        }, false);
        await expect('ATTACK beats delete', function() {
            return deleteDoc(doc(reporter, 'beats_reports', 'seedb'));
        }, false);

        await expect('ATTACK mail limit read', function() {
            return getDoc(doc(reporter, 'report_mail_limits', 'reporter1'));
        }, false);
        await expect('ATTACK mail limit write', function() {
            return setDoc(doc(reporter, 'report_mail_limits', 'reporter1'), { sent: 0 });
        }, false);
        await expect('ATTACK mail state read', function() {
            return getDoc(doc(admin, 'report_mail_state', 'reports_seed1'));
        }, false);
        await expect('ATTACK mail state write', function() {
            return setDoc(doc(admin, 'report_mail_state', 'reports_seed1'), { status: 'sent' });
        }, false);
    } finally {
        await env.cleanup();
    }
    process.exit(failed > 0 ? 1 : 0);
})().catch(function(e) {
    console.error(e);
    process.exit(1);
});
