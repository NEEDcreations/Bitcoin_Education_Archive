#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const questBoard = require('../functions/src/questBoard');
const backfill = require('../functions/scripts/backfill_leaderboard_sort_keys');
const identity = require('../functions/src/leaderboardIdentity');

const root = path.join(__dirname, '..');

function memoryDb() {
    const store = {};
    return {
        store: store,
        collection: function (name) {
            return {
                doc: function (id) {
                    const key = name + '/' + id;
                    return {
                        update: async function (patch) {
                            if (!store[key]) {
                                const err = new Error('No document to update');
                                err.code = 5;
                                throw err;
                            }
                            Object.keys(patch).forEach(function (field) { store[key][field] = patch[field]; });
                        }
                    };
                }
            };
        }
    };
}

async function main() {
    assert.strictEqual(backfill.parseArgs([]).apply, false);
    assert.strictEqual(backfill.parseArgs(['--apply']).apply, true);
    assert.strictEqual(backfill.safeError(new Error('mail ada@secret.test failed')).indexOf('secret.test'), -1);

    const questPatch = backfill.planQuest({
        passes: 5,
        attempts: 8,
        passedAttempts: 6,
        reachedAt: 0,
        weekPasses: 0,
        weekAttempts: 0,
        weekPassedAttempts: 0,
        weekReachedAt: 0,
        monthPasses: 0,
        monthAttempts: 0,
        monthPassedAttempts: 0,
        monthReachedAt: 0
    }, { username: 'SixEight', ghostMode: true, email: 'six@secret.test' });
    assert.strictEqual(questPatch.passRate, questBoard.passRateOf(6, 8));
    assert.strictEqual(questPatch.reachedSort, questBoard.REACHED_UNKNOWN);
    assert.strictEqual(questPatch.nameKey, 'sixeight');
    assert.strictEqual(questPatch.ghostMode, true);
    assert.strictEqual(JSON.stringify(questPatch).indexOf('secret.test'), -1);
    assert.strictEqual(backfill.planQuest(questBoard.stampSortKeys({
        passes: 5, attempts: 8, passedAttempts: 6, reachedAt: 0,
        weekPasses: 0, weekAttempts: 0, weekPassedAttempts: 0, weekReachedAt: 0,
        monthPasses: 0, monthAttempts: 0, monthPassedAttempts: 0, monthReachedAt: 0,
        ghostMode: true
    }, 'SixEight'), { username: 'SixEight', ghostMode: true }), null);

    const userPatch = backfill.planUser({ username: 'Azi_Za', email: 'azi@secret.test' });
    assert.strictEqual(userPatch.nameKey, 'azi_za');
    assert.strictEqual(userPatch.streakReachedAt, 0);
    assert.strictEqual(userPatch.bestStreakAt, 0);
    assert.strictEqual(JSON.stringify(userPatch).indexOf('secret.test'), -1);
    assert.strictEqual(backfill.planUser({
        username: 'Azi_Za',
        nameKey: 'azi_za',
        streakReachedAt: 0,
        bestStreakAt: 50
    }), null);

    const predictPatch = backfill.planPredict({ predTotal: 10 }, { ghostMode: true, email: 'g@secret.test' });
    assert.deepStrictEqual(predictPatch, { ghostMode: true });
    assert.strictEqual(backfill.planPredict({ ghostMode: false }, { ghostMode: false }), null);

    const names = questBoard.selectBoard([
        { uid: 'b', username: 'Yuv_s', passes: 3, attempts: 5, passedAttempts: 3, reachedAt: 0 },
        { uid: 'a', username: 'Suraz2', passes: 3, attempts: 5, passedAttempts: 3, reachedAt: 0 }
    ], 'alltime').map(function (row) { return row.username; });
    assert.deepStrictEqual(names, ['Suraz2', 'Yuv_s']);
    const rates = questBoard.selectBoard([
        { uid: 'low', username: 'FiveSeven', passes: 5, attempts: 7, passedAttempts: 5, reachedAt: 1 },
        { uid: 'high', username: 'SixEight', passes: 5, attempts: 8, passedAttempts: 6, reachedAt: 1 }
    ], 'alltime').map(function (row) { return row.username; });
    assert.deepStrictEqual(rates, ['SixEight', 'FiveSeven']);
    assert.ok(questBoard.passRateOf(6, 8) > questBoard.passRateOf(5, 7));

    const ghostOn = identity.identityPatch(
        { username: 'Ada', ghostMode: false, nameKey: 'ada' },
        { username: 'Ada', ghostMode: true, nameKey: 'ada' }
    );
    assert.strictEqual(ghostOn.predict, true);
    assert.strictEqual(ghostOn.ghostMode, true);
    assert.strictEqual(ghostOn.user, false);
    const healed = identity.identityPatch(
        { username: 'Ada', ghostMode: true, nameKey: 'ada' },
        { username: 'Ada', ghostMode: true, nameKey: 'ada' }
    );
    assert.strictEqual(healed, null);

    const db = memoryDb();
    db.store['quest_lb_stats/ada'] = { passes: 1 };
    db.store['prediction_stats/ada'] = { predTotal: 1 };
    db.store['users/ada'] = { username: 'Ada', ghostMode: false };
    const first = await identity.syncBoardIdentity(db, 'ada', null, { username: 'Ada', ghostMode: true });
    assert.strictEqual(db.store['quest_lb_stats/ada'].ghostMode, true);
    assert.strictEqual(db.store['quest_lb_stats/ada'].nameKey, 'ada');
    assert.strictEqual(db.store['prediction_stats/ada'].ghostMode, true);
    assert.strictEqual(db.store['users/ada'].nameKey, 'ada');
    assert.ok(first.patched >= 1);
    const again = await identity.syncBoardIdentity(db, 'ada',
        { username: 'Ada', ghostMode: true, nameKey: 'ada' },
        { username: 'Ada', ghostMode: true, nameKey: 'ada' }
    );
    assert.strictEqual(again.patched, 0);

    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const grade = fs.readFileSync(path.join(root, 'functions/src/questCallables.js'), 'utf8');
    assert.ok(index.indexOf('syncBoardIdentity') !== -1);
    assert.ok(grade.indexOf('stampSortKeys') !== -1);
    const script = fs.readFileSync(path.join(root, 'functions/scripts/backfill_leaderboard_sort_keys.js'), 'utf8');
    assert.ok(script.indexOf('prints counts only') !== -1 || script.indexOf('Prints counts only') !== -1);
    assert.strictEqual(script.indexOf('console.log(stats'), -1);

    console.log('leaderboard sort key tests passed');
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
