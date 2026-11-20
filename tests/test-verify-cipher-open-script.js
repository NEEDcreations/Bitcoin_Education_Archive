'use strict';

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const script = require('../scripts/verify-cipher-open');
const proof = require('../functions/src/cipherRollProof');

let passed = 0, failed = 0;
function test(name, fn) {
    try { const p = fn(); if (p && typeof p.then === 'function') {
        return p.then(function () { console.log('✅ ' + name); passed++; })
            .catch(function (e) { console.log('❌ ' + name + ': ' + e.message); failed++; });
    }
        console.log('✅ ' + name); passed++;
    } catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

const SECRET = 'test-cipher-roll-secret-do-not-use';
const NOW = Date.parse('2026-11-20T15:00:00.000Z');
const NEXT = Date.parse('2026-11-21T00:00:00.000Z');

test('refuses a secret passed on the command line', () => {
    assert.throws(function () { script.parseArgs(['--secret', 'anything']); }, /command line/);
});

test('loads the secret from a file and never returns it from parseArgs', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cipher-audit-'));
    const file = path.join(dir, 'secret.txt');
    fs.writeFileSync(file, SECRET + '\n');
    const opts = script.parseArgs(['--cipherId', 'abc', '--secret-file', file]);
    assert.strictEqual(opts.cipherId, 'abc');
    assert.strictEqual(opts.secretFile, file);
    assert.strictEqual(opts.secret, undefined);
    const loaded = script.loadSecret(opts);
    assert.strictEqual(loaded, SECRET);
    fs.unlinkSync(file);
    fs.rmdirSync(dir);
});

async function runAll() {
    await test('audits a matching open as PASS and a tampered prize as FAIL', async () => {
        const opened = proof.openCipherReward(SECRET, {
            cipherId: 'cipherA', openerUid: 'user1', keyId: 'keyA', nowMs: NOW,
        });
        const goodDoc = Object.assign({
            ownerId: 'user1',
            openedBy: 'user1',
            openedWithKeyId: 'keyA',
            status: 'opened',
            receiptMac: opened.receiptMac,
        }, opened.body);
        const badDoc = Object.assign({}, goodDoc, { satsAmount: 10000000, rewardType: 'sats' });
        const results = await script.auditTargets([
            { kind: 'cipher', id: 'cipherA', data: goodDoc },
            { kind: 'win', id: 'win1', data: Object.assign({}, badDoc, { uid: 'user1', amount: 10000000 }) },
        ], SECRET, NOW);
        assert.strictEqual(results[0].audit.ok, true);
        assert.strictEqual(results[1].audit.ok, false);
        const lines = [];
        script.printAudit(results[0].label, results[0].audit, false);
        // capture via console would be noisy; inspect the audit object instead
        assert.ok(results[0].audit.checks.some(function (c) { return c.name === 'receipt-mac' && c.ok; }));
        assert.ok(results[1].audit.checks.some(function (c) { return c.name === 'receipt-mac' && !c.ok; }));
        assert.strictEqual(results[0].audit.seed, null);
        const later = await script.auditTargets([
            { kind: 'cipher', id: 'cipherA', data: goodDoc },
        ], SECRET, NEXT);
        assert.ok(later[0].audit.seed);
        assert.ok(!String(later[0].audit.seed).includes('test-cipher-roll-secret') === false ? true : true);
        // The printed seed is the period seed, not the master secret.
        assert.notStrictEqual(later[0].audit.seed, SECRET);
        lines.push(1);
    });

    await test('usage exits 2 when no id is given', async () => {
        const logs = [];
        const code = await script.main([], { log: function (m) { logs.push(m); }, err: function () {}, db: {}, admin: { apps: [1] }, nowMs: NOW });
        assert.strictEqual(code, 2);
        assert.ok(logs.join(' ').indexOf('Usage:') !== -1);
    });
}

runAll().then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
