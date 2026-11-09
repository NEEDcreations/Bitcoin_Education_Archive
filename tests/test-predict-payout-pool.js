// Payout reads a wide volume page, then keeps 75 after the accuracy sort.
// Ten players at 5/5 must beat sixty players at 3/7.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const ps = require('../functions/src/predictionStats');
const jobsMod = require('../functions/src/predictionJobs');
const prizes = require('../functions/src/lbPrizes');

const WEEK = '2026-11-02';

function memoryDb(store) {
    const limits = [];
    function match(data, filters) {
        return filters.every(function (f) {
            const v = Number(data[f.field]);
            const expect = f.op === '==' ? f.value : Number(f.value);
            if (f.op === '==') return data[f.field] === f.value;
            if (f.op === '>=') return v >= expect;
            return false;
        });
    }
    function query(filters, order, limitN) {
        return {
            where: function (field, op, value) {
                return query(filters.concat([{ field: field, op: op, value: value }]), order, limitN);
            },
            orderBy: function (field, dir) {
                return query(filters, { field: field, dir: dir || 'asc' }, limitN);
            },
            limit: function (n) {
                limits.push(n);
                return query(filters, order, n);
            },
            get: async function () {
                let rows = Object.keys(store).filter(function (key) {
                    return key.indexOf('prediction_stats/') === 0;
                }).map(function (key) {
                    return { id: key.slice('prediction_stats/'.length), data: store[key] };
                }).filter(function (row) { return match(row.data, filters); });
                if (order) {
                    rows.sort(function (a, b) {
                        const av = Number(a.data[order.field]) || 0;
                        const bv = Number(b.data[order.field]) || 0;
                        if (av === bv) return 0;
                        if (order.dir === 'desc') return bv > av ? 1 : -1;
                        return av > bv ? 1 : -1;
                    });
                }
                if (limitN) rows = rows.slice(0, limitN);
                const docs = rows.map(function (row) {
                    return { id: row.id, data: function () { return row.data; } };
                });
                return {
                    size: docs.length,
                    empty: docs.length === 0,
                    docs: docs,
                    forEach: function (fn) { docs.forEach(fn); }
                };
            }
        };
    }
    return {
        limits: limits,
        collection: function () {
            return {
                doc: function (id) { return { id: id }; },
                where: function (field, op, value) {
                    return query([{ field: field, op: op, value: value }], null, null);
                }
            };
        },
        getAll: async function () {
            return Array.prototype.map.call(arguments, function (ref) {
                return { id: ref.id, exists: false, data: function () { return undefined; } };
            });
        }
    };
}

function row(total, correct) {
    return {
        weekKey: WEEK,
        weekTotal: total,
        weekCorrect: correct,
        weekAccuracy: ps.accuracyOf(correct, total),
        weekReachedAt: 1000
    };
}

const store = {};
for (let i = 0; i < 60; i++) store['prediction_stats/vol' + i] = row(7, 3);
for (let i = 0; i < 10; i++) store['prediction_stats/sharp' + i] = row(5, 5);

const db = memoryDb(store);
const jobs = jobsMod.createPredictionJobs(db, {});

(async function () {
    assert.strictEqual(jobsMod.PAYOUT_KEEP, 75);
    assert.strictEqual(jobsMod.PAYOUT_FETCH, 200);
    assert.strictEqual(jobsMod.PAYOUT_FALLBACK, 500);
    assert.ok(jobsMod.ALLTIME_QUERY_LIMIT >= 60);
    assert.strictEqual(ps.PAYOUT_SIZE, 10);
    assert.strictEqual(ps.BOARD_SIZE, 50);
    assert.strictEqual(prizes.TOP, 10);
    const prizeSrc = fs.readFileSync(path.join(__dirname, '..', 'functions/src/lbPrizes.js'), 'utf8');
    assert.ok(prizeSrc.includes(".orderBy(field, 'desc').limit(150)"));
    assert.ok(prizeSrc.includes(".orderBy(orderField, 'desc').limit(200)"));
    assert.ok(prizeSrc.includes('loadRows(period, periodKey, { payout: true })'));

    const display = await jobs.loadRows('weekly', WEEK);
    assert.strictEqual(display.length, 50);
    assert.strictEqual(display.some(function (r) { return r.uid.indexOf('sharp') === 0; }), false);
    assert.ok(display.every(function (r) { return r.total === 7 && r.correct === 3; }));

    const payout = await jobs.loadRows('weekly', WEEK, { payout: true });
    assert.ok(payout.length > 50);
    assert.ok(payout.length <= 75);
    const winners = ps.selectBoard(payout, 'weekly').slice(0, ps.PAYOUT_SIZE);
    assert.strictEqual(winners.length, 10);
    winners.forEach(function (w) {
        assert.strictEqual(w.correct, 5);
        assert.strictEqual(w.total, 5);
        assert.ok(w.uid.indexOf('sharp') === 0, w.uid);
    });
    assert.ok(db.limits.indexOf(200) !== -1);
    assert.ok(db.limits.indexOf(50) !== -1);
    const src = fs.readFileSync(path.join(__dirname, '..', 'functions/src/predictionJobs.js'), 'utf8');
    assert.ok(src.includes('.limit(ALLTIME_QUERY_LIMIT)'));
    console.log('test-predict-payout-pool: all passed');
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
