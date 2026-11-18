#!/usr/bin/env node
// Satoshi's Favor self-claims: clients (winners, non-winners, admins in the
// browser, signed-out) can never write the history, results, claims, payout
// records, counters, audit rows or the claims config. Only the server writes.
// Throwaway Firestore emulator on 8191 (same config as the kill switch suite).
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const cfg = path.join(root, 'firebase.killswitch.json');
    const javaBins = ['/tmp/jre/bin', '/home/box/jre/bin', '/home/box/jdk/jdk-21.0.13+9-jre/bin'].filter(function (d) {
        return fs.existsSync(path.join(d, 'java'));
    });
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools', 'emulators:exec', '--only', 'firestore',
        '--project', 'demo-sf-claims', '--config', cfg,
        'node tests/rules/sf-block-claims-rules.js',
    ], {
        cwd: root, stdio: 'inherit',
        env: Object.assign({}, process.env, {
            CI: 'true', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8191',
            PATH: javaBins.concat([process.env.PATH || '']).join(path.delimiter),
        }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, updateDoc, deleteDoc, getDoc, addDoc, collection } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const parts = process.env.FIRESTORE_EMULATOR_HOST.split(':');

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-sf-claims',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8191) },
    });
    async function expect(name, run, allow) {
        try {
            if (allow) await assertSucceeds(run()); else await assertFails(run());
            console.log((allow ? 'ALLOW' : 'DENY ') + '  ' + name + '  \u2713');
        } catch (e) {
            failed++;
            console.log((allow ? 'ALLOW' : 'DENY ') + '  ' + name + '  \u2717 ' + (e.message || e));
        }
    }
    const pw = { firebase: { sign_in_provider: 'password' } };
    await env.withSecurityRulesDisabled(async function (ctx) {
        const db = ctx.firestore();
        await setDoc(doc(db, 'sfPoolHistory', 'h1'), { epochNumber: 1, blocks: [{ uid: 'winner' }], totalSats: 21000 });
        await setDoc(doc(db, 'sf_payout_results', 'epoch_1'), { epoch: 1, blocks: [{ uid: 'winner', amount: 4200 }] });
        await setDoc(doc(db, 'sf_block_claims', 'e1_b0'), { uid: 'winner', status: 'claimable' });
        await setDoc(doc(db, 'sf_block_payouts', 'e1_b0'), { amount: 4200 });
        await setDoc(doc(db, 'sf_claim_counters', 'site_2026-11-14'), { sats: 0 });
        await setDoc(doc(db, 'sf_claim_audit', 'a1'), { code: 'paid' });
        await setDoc(doc(db, 'config', 'satoshiFavorPayouts'), { claimsEnabled: false, enabledEpochs: [1] });
    });
    const who = {
        winner: env.authenticatedContext('winner', pw).firestore(),
        stranger: env.authenticatedContext('stranger', pw).firestore(),
        admin: env.authenticatedContext('admin1', Object.assign({ admin: true }, pw)).firestore(),
        anon: env.unauthenticatedContext().firestore(),
    };
    const targets = [
        ['sfPoolHistory', 'h1'], ['sfPoolHistory', 'forged'],
        ['sf_payout_results', 'epoch_1'], ['sf_payout_results', 'epoch_9001'],
        ['sf_block_claims', 'e1_b0'], ['sf_block_claims', 'e1_b1'],
        ['sf_block_payouts', 'e1_b0'], ['sf_block_payouts', 'e1_b1'],
        ['sf_claim_counters', 'site_2026-11-14'], ['sf_claim_audit', 'a1'],
        ['config', 'satoshiFavorPayouts'],
    ];
    for (const name of Object.keys(who)) {
        const db = who[name];
        for (const t of targets) {
            const ref = doc(db, t[0], t[1]);
            await expect(name + ' set ' + t.join('/'), function () { return setDoc(ref, { uid: name, status: 'paid', amount: 4200, blocks: [{ uid: name }] }); }, false);
            await expect(name + ' update ' + t.join('/'), function () { return updateDoc(ref, { status: 'claimable', uid: name }); }, false);
            await expect(name + ' delete ' + t.join('/'), function () { return deleteDoc(ref); }, false);
        }
        for (const c of ['sfPoolHistory', 'sf_block_claims', 'sf_block_payouts', 'sf_claim_audit']) {
            await expect(name + ' add ' + c, function () { return addDoc(collection(db, c), { uid: name, epochNumber: 1, blocks: [] }); }, false);
        }
    }
    // Reads: history is public; claims/payouts/counters/audit are server-only; results/config admin-read.
    await expect('anon read sfPoolHistory', function () { return getDoc(doc(who.anon, 'sfPoolHistory', 'h1')); }, true);
    await expect('winner read own claim doc (server-only)', function () { return getDoc(doc(who.winner, 'sf_block_claims', 'e1_b0')); }, false);
    await expect('stranger read results', function () { return getDoc(doc(who.stranger, 'sf_payout_results', 'epoch_1')); }, false);
    await expect('stranger read payout record', function () { return getDoc(doc(who.stranger, 'sf_block_payouts', 'e1_b0')); }, false);
    await expect('stranger read counters', function () { return getDoc(doc(who.stranger, 'sf_claim_counters', 'site_2026-11-14')); }, false);
    await expect('admin read results', function () { return getDoc(doc(who.admin, 'sf_payout_results', 'epoch_1')); }, true);
    await expect('admin read config', function () { return getDoc(doc(who.admin, 'config', 'satoshiFavorPayouts')); }, true);
    await env.cleanup();
    console.log(failed ? '\n' + failed + ' rule check(s) failed' : '\nAll SF block-claim rule checks passed');
    process.exit(failed ? 1 : 0);
})().catch(function (e) { console.error(e); process.exit(1); });
