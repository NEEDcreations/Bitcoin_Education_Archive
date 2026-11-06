#!/usr/bin/env node
'use strict';

// awardPoints('Daily Spin', 200) must grant 0 XP. dailySpin is the only
// server path that pays a wheel reward, and a direct call still pays.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');

function freeFirestorePort(start) {
    const script = [
        "const net = require('net');",
        'const start = ' + start + ';',
        'function tryPort(p) {',
        '  if (p > start + 30) { console.log(String(start)); process.exit(0); }',
        '  const server = net.createServer();',
        "  server.once('error', function () { tryPort(p + 1); });",
        "  server.listen(p, '127.0.0.1', function () {",
        "    server.close(function () { console.log(String(p)); process.exit(0); });",
        '  });',
        '}',
        'tryPort(start);',
    ].join('\n');
    const out = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8' });
    const port = parseInt(String(out.stdout || '').trim(), 10);
    return Number.isFinite(port) ? port : start;
}

function sliceBetween(src, startMark, endMark) {
    const start = src.indexOf(startMark);
    const end = src.indexOf(endMark);
    assert.ok(start > 0 && end > start, startMark);
    return src.slice(start, end);
}

function evalConstArray(body, name) {
    const mark = 'const ' + name + ' = ';
    const at = body.indexOf(mark);
    assert.ok(at >= 0, name);
    const open = body.indexOf('[', at);
    let depth = 0;
    let i = open;
    for (; i < body.length; i++) {
        if (body[i] === '[') depth++;
        else if (body[i] === ']') {
            depth--;
            if (depth === 0) {
                i++;
                break;
            }
        }
    }
    return vm.runInNewContext('(' + body.slice(open, i) + ')', {}, { filename: name + '.js' });
}

function assertSpinTablePays(indexSrc) {
    const spin = sliceBetween(indexSrc, 'exports.dailySpin = functionsV1.https.onCall', 'exports.pvpStoreAnswerKey');
    assert.strictEqual(spin.indexOf('data.pts'), -1);
    assert.strictEqual(spin.indexOf('data.tickets'), -1);
    assert.strictEqual(spin.indexOf('data.rewardIndex'), -1);
    assert.ok(spin.indexOf('let totalPts = reward.pts') > 0);
    assert.ok(spin.indexOf('totalPts = 25') > 0);
    assert.ok(spin.indexOf('if (totalPts > 0) update.points = admin.firestore.FieldValue.increment(totalPts)') > 0);
    assert.ok(spin.indexOf('if (totalTickets > 0) update.orangeTickets = admin.firestore.FieldValue.increment(totalTickets)') > 0);
    assert.ok(spin.indexOf('if (totalFreezes > 0) update.streakFreezes = admin.firestore.FieldValue.increment(totalFreezes)') > 0);
    const outcomes = evalConstArray(spin, 'outcomes');
    const rare = evalConstArray(spin, 'rareOutcomes');
    assert.strictEqual(outcomes.length, 10);
    assert.strictEqual(outcomes[2].pts, 10);
    assert.strictEqual(outcomes[4].pts, 25);
    assert.strictEqual(outcomes[7].pts, 50);
    assert.strictEqual(outcomes[5].closet, true);
    assert.ok(outcomes[5].pts === 0);
    assert.ok(outcomes.some(function (row) { return row.tickets > 0; }));
    assert.ok(outcomes.some(function (row) { return row.freezes > 0; }));
    assert.ok(rare.length > 0);
    rare.forEach(function (row) { assert.ok(row.tickets > 0); });
    return { outcomes: outcomes, rare: rare };
}

function assertAwardPaysNothing() {
    const awardActions = require(path.join(root, 'functions/src/awardActions'));
    const mem = {
        users: { u: { points: 40, orangeTickets: 3, pendingOverflow: 1, ban_reason: '' } },
        claims: {},
        counts: {},
        daily: { u: { total: 100 } },
    };
    const result = awardActions.applyAward(mem, 'u', {
        action: 'Daily Spin',
        reason: 'Daily Spin',
        pts: 200,
        tickets: 50,
        streakFreezes: 4,
    });
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.awarded, 0);
    assert.strictEqual(result.tickets, 0);
    assert.strictEqual(result.id, 'daily_spin');
    assert.strictEqual(mem.users.u.points, 40);
    assert.strictEqual(mem.users.u.orangeTickets, 3);
    assert.strictEqual(mem.daily.u.total, 100);
    assert.strictEqual(Object.keys(mem.claims).length, 0);
    assert.strictEqual(Object.keys(mem.counts).length, 0);
    const again = awardActions.applyAward(mem, 'u', { reason: 'Daily Spin', pts: 200 });
    assert.strictEqual(again.success, true);
    assert.strictEqual(again.awarded, 0);
    assert.strictEqual(mem.users.u.points, 40);
}

function unit() {
    const indexSrc = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const award = sliceBetween(indexSrc, 'exports.awardPoints = functionsV1.https.onCall', 'exports.getFaucetStats = functionsV1.https.onCall');
    const gate = award.indexOf("resolved.id === 'daily_spin'");
    const transaction = award.indexOf('db.runTransaction');
    assert.ok(gate > 0 && transaction > gate);
    assert.ok(award.indexOf('return { success: true, awarded: 0, tickets: 0 };') > gate);
    assertAwardPaysNothing();
    assertSpinTablePays(indexSrc);
    console.log('daily spin unit ok');
}

function legalReward(reward, tables) {
    const idx = reward.rewardIndex;
    assert.ok(Number.isInteger(idx) && idx >= 0 && idx < tables.outcomes.length);
    const row = tables.outcomes[idx];
    assert.strictEqual(reward.label, row.label);
    assert.strictEqual(reward.closet, row.closet);
    assert.strictEqual(reward.rare, row.rare);
    if (row.closet) {
        assert.strictEqual(reward.pts, 25);
        assert.strictEqual(reward.tickets, 0);
        assert.strictEqual(reward.freezes, 0);
    } else if (row.rare) {
        assert.strictEqual(reward.pts, 0);
        assert.strictEqual(reward.freezes, 0);
        const match = tables.rare.filter(function (drop) {
            return drop.tickets === reward.tickets && drop.label === reward.rareLabel;
        });
        assert.strictEqual(match.length, 1);
    } else {
        assert.strictEqual(reward.pts, row.pts);
        assert.strictEqual(reward.tickets, row.tickets);
        assert.strictEqual(reward.freezes, row.freezes);
    }
    assert.ok(reward.pts > 0 || reward.tickets > 0 || reward.freezes > 0);
}

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    unit();
    const port = freeFirestorePort(8085);
    const cfg = JSON.parse(fs.readFileSync(path.join(root, 'firebase.json'), 'utf8'));
    cfg.emulators = cfg.emulators || {};
    cfg.emulators.firestore = Object.assign({}, cfg.emulators.firestore, { port: port });
    const cfgPath = path.join('/tmp', 'firebase-spin-grant-' + port + '.json');
    fs.writeFileSync(cfgPath, JSON.stringify(cfg));
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--config', cfgPath,
        '--only', 'firestore',
        '--project', 'demo-spin-grant',
        'node tests/test-daily-spin-grant.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

let firebaseConfig = {};
try { firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG || '{}'); } catch (e) { firebaseConfig = {}; }
if (!firebaseConfig.projectId) firebaseConfig.projectId = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-spin-grant';
process.env.FIREBASE_CONFIG = JSON.stringify(firebaseConfig);
process.env.GCLOUD_PROJECT = firebaseConfig.projectId;
process.env.GOOGLE_CLOUD_PROJECT = firebaseConfig.projectId;
require('./totp-emulator-auth');

const admin = require('../functions/node_modules/firebase-admin');
const fns = require('../functions/index.js');
const db = admin.firestore();

function ctx(uid) {
    return {
        auth: {
            uid: uid,
            token: {
                firebase: { sign_in_provider: 'password' },
                auth_time: Math.floor(Date.now() / 1000),
            },
        },
    };
}

async function main() {
    const indexSrc = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const tables = assertSpinTablePays(indexSrc);
    const uid = 'spin-grant-user';
    const userRef = db.collection('users').doc(uid);
    await userRef.set({
        points: 40,
        orangeTickets: 1,
        streakFreezes: 2,
        ban_reason: '',
        banned: false,
    });

    const blocked = await fns.awardPoints.run({
        pts: 200,
        action: 'Daily Spin',
        reason: 'Daily Spin',
        tickets: 50,
        streakFreezes: 9,
    }, ctx(uid));
    assert.strictEqual(blocked.success, true);
    assert.strictEqual(blocked.awarded, 0);
    assert.strictEqual(blocked.tickets, 0);
    let user = (await userRef.get()).data();
    assert.strictEqual(user.points, 40);
    assert.strictEqual(user.orangeTickets, 1);
    assert.strictEqual(user.streakFreezes, 2);
    assert.ok(!user.lastSpinDate);
    const claims = await userRef.collection('award_claims').get();
    assert.strictEqual(claims.size, 0);

    const spun = await fns.dailySpin.run({}, ctx(uid));
    assert.strictEqual(spun.success, true);
    legalReward(spun.reward, tables);
    user = (await userRef.get()).data();
    assert.ok(user.points >= 40 + spun.reward.pts);
    assert.strictEqual(user.orangeTickets, 1 + spun.reward.tickets);
    assert.strictEqual(user.streakFreezes, 2 + spun.reward.freezes);
    assert.ok(user.lastSpinDate);

    const afterSpin = {
        points: user.points,
        orangeTickets: user.orangeTickets,
        streakFreezes: user.streakFreezes,
    };
    const again = await fns.awardPoints.run({
        pts: 200,
        action: 'Daily Spin',
        reason: 'Daily Spin',
    }, ctx(uid));
    assert.strictEqual(again.success, true);
    assert.strictEqual(again.awarded, 0);
    assert.strictEqual(again.tickets, 0);
    user = (await userRef.get()).data();
    assert.strictEqual(user.points, afterSpin.points);
    assert.strictEqual(user.orangeTickets, afterSpin.orangeTickets);
    assert.strictEqual(user.streakFreezes, afterSpin.streakFreezes);

    console.log('daily spin direct call ok ' + JSON.stringify({
        rewardIndex: spun.reward.rewardIndex,
        pts: spun.reward.pts,
        tickets: spun.reward.tickets,
        freezes: spun.reward.freezes,
    }));
}

main().then(function () {
    process.exit(0);
}).catch(function (err) {
    console.error(err && err.stack ? err.stack : err);
    process.exit(1);
});
