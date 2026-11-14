#!/usr/bin/env node
// Premium entitlements, orders, counters and config are server-only.
// Players may read their own entitlement and allowance docs, nothing else.
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
        '--project', 'demo-premium',
        'node tests/rules/premium-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, getDoc, deleteDoc } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-premium',
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
        const pw = { firebase: { sign_in_provider: 'password' }, email: 'p1@example.com', email_verified: true };
        const me = env.authenticatedContext('p1', pw).firestore();
        const other = env.authenticatedContext('p2', pw).firestore();
        const anon = env.unauthenticatedContext().firestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const a = ctx.firestore();
            await setDoc(doc(a, 'config', 'killSwitch'), { enabled: false });
            await setDoc(doc(a, 'users', 'p1'), { username: 'p1', bio: '' });
            await setDoc(doc(a, 'premium_entitlements', 'p1'), { active: true, founders: false });
            await setDoc(doc(a, 'premium_allowance', 'p1'), { cosmeticCredits: 50 });
            await setDoc(doc(a, 'premium_email_entitlements', 'abc'), { active: true });
            await setDoc(doc(a, 'premium_orders', 'o1'), { uid: 'p1', status: 'pending' });
            await setDoc(doc(a, 'premium_counters', 'founders'), { sold: 1, holds: {} });
            await setDoc(doc(a, 'premium_config', 'settings'), { checkoutEnabled: false });
            await setDoc(doc(a, 'premium_events', 'e1'), { at: 1 });
            await setDoc(doc(a, 'premium_review', 'r1'), { at: 1 });
            await setDoc(doc(a, 'premium_rate', 'k1'), { n: 1 });
            await setDoc(doc(a, 'premium_allowance_ledger', 'l1'), { n: 1 });
            await setDoc(doc(a, 'premium_trial_markers', 'c_abc'), { orderId: 'o1' });
            await setDoc(doc(a, 'premium_admin_audit', 'a1'), { action: 'revoke' });
        });
        await expect('own entitlement readable', function () { return getDoc(doc(me, 'premium_entitlements', 'p1')); }, true);
        await expect('own allowance readable', function () { return getDoc(doc(me, 'premium_allowance', 'p1')); }, true);
        await expect('other player entitlement', function () { return getDoc(doc(other, 'premium_entitlements', 'p1')); }, false);
        await expect('signed-out entitlement read', function () { return getDoc(doc(anon, 'premium_entitlements', 'p1')); }, false);
        await expect('self-grant entitlement (update)', function () { return updateDoc(doc(me, 'premium_entitlements', 'p1'), { founders: true }); }, false);
        await expect('self-grant entitlement (create)', function () { return setDoc(doc(other, 'premium_entitlements', 'p2'), { active: true }); }, false);
        await expect('delete own entitlement', function () { return deleteDoc(doc(me, 'premium_entitlements', 'p1')); }, false);
        await expect('raise own allowance', function () { return updateDoc(doc(me, 'premium_allowance', 'p1'), { cosmeticCredits: 9999 }); }, false);
        await expect('read email-held entitlement', function () { return getDoc(doc(me, 'premium_email_entitlements', 'abc')); }, false);
        await expect('write email-held entitlement', function () { return setDoc(doc(me, 'premium_email_entitlements', 'xyz'), { active: true }); }, false);
        await expect('read own order', function () { return getDoc(doc(me, 'premium_orders', 'o1')); }, false);
        await expect('mark order paid', function () { return updateDoc(doc(me, 'premium_orders', 'o1'), { status: 'paid' }); }, false);
        await expect('read Founders counter', function () { return getDoc(doc(me, 'premium_counters', 'founders')); }, false);
        await expect('reset Founders counter', function () { return setDoc(doc(me, 'premium_counters', 'founders'), { sold: 0 }); }, false);
        await expect('read premium config', function () { return getDoc(doc(me, 'premium_config', 'settings')); }, false);
        await expect('open checkout via config', function () { return setDoc(doc(me, 'premium_config', 'settings'), { checkoutEnabled: true, btcDiscountPct: 25 }); }, false);
        await expect('forge webhook event marker', function () { return setDoc(doc(me, 'premium_events', 'e2'), { at: 1 }); }, false);
        await expect('read review queue', function () { return getDoc(doc(me, 'premium_review', 'r1')); }, false);
        await expect('reset rate limit', function () { return setDoc(doc(me, 'premium_rate', 'k1'), { n: 0 }); }, false);
        await expect('write allowance ledger', function () { return setDoc(doc(me, 'premium_allowance_ledger', 'l2'), { n: 50 }); }, false);
        await expect('read trial marker', function () { return getDoc(doc(me, 'premium_trial_markers', 'c_abc')); }, false);
        await expect('delete trial marker (reset trial)', function () { return deleteDoc(doc(me, 'premium_trial_markers', 'c_abc')); }, false);
        await expect('read admin audit', function () { return getDoc(doc(me, 'premium_admin_audit', 'a1')); }, false);
        await expect('forge admin audit', function () { return setDoc(doc(me, 'premium_admin_audit', 'a2'), { action: 'restore' }); }, false);
        await expect('set users.premium on own profile', function () { return updateDoc(doc(me, 'users', 'p1'), { premium: { active: true, founders: true } }); }, false);
        await expect('control: ordinary own-profile update still works', function () { return updateDoc(doc(me, 'users', 'p1'), { ghostMode: true }); }, true);
    } finally {
        await env.cleanup();
    }
    console.log(failed ? '\n' + failed + ' rule checks failed' : '\nAll premium rule checks passed');
    process.exit(failed ? 1 : 0);
})();
