// Faction choice is one transaction. A second call, a race, and a banned user
// cannot move the unclaimed pool twice. Firestore is in memory.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { createChooseFactionHandlers } = require('../functions/src/chooseFaction');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        const pending = fn();
        if (pending && typeof pending.then === 'function') {
            return pending.then(function () {
                console.log('✅ ' + name);
                passed++;
            }).catch(function (e) {
                console.log('❌ ' + name + ': ' + e.message);
                failed++;
            });
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
    return Promise.resolve();
}

function memDb(initial) {
    const store = {};
    const versions = {};
    Object.keys(initial || {}).forEach(function (key) {
        store[key] = Object.assign({}, initial[key]);
        versions[key] = 1;
    });
    let chain = Promise.resolve();
    function lock(fn) {
        const prev = chain;
        let release;
        const gate = new Promise(function (resolve) { release = resolve; });
        chain = gate;
        return prev.then(fn).then(function (value) {
            release();
            return value;
        }, function (err) {
            release();
            throw err;
        });
    }
    function docRef(docPath) {
        return {
            path: docPath,
            id: docPath.split('/').pop(),
            collection: function (name) { return collection(docPath + '/' + name); },
        };
    }
    function collection(collPath) {
        return {
            doc: function (id) { return docRef(collPath + '/' + id); },
            where: function (field, op, value) {
                return { _query: true, collPath: collPath, field: field, op: op, value: value };
            },
        };
    }
    function queryFrom(snapStore, query) {
        const prefix = query.collPath + '/';
        const hits = Object.keys(snapStore).filter(function (docPath) {
            if (docPath.indexOf(prefix) !== 0) return false;
            if (docPath.slice(prefix.length).indexOf('/') !== -1) return false;
            const row = snapStore[docPath];
            return row && row[query.field] === query.value;
        });
        const docs = hits.map(function (docPath) {
            return {
                id: docPath.split('/').pop(),
                ref: docRef(docPath),
                data: function () { return Object.assign({}, snapStore[docPath]); },
            };
        });
        return {
            empty: docs.length === 0,
            size: docs.length,
            docs: docs,
            forEach: function (fn) { docs.forEach(fn); },
        };
    }
    async function runTransaction(fn) {
        for (let attempt = 0; attempt < 6; attempt++) {
            const snapStore = {};
            const snapVer = {};
            Object.keys(store).forEach(function (key) {
                snapStore[key] = Object.assign({}, store[key]);
                snapVer[key] = versions[key] || 0;
            });
            const reads = [];
            const writes = [];
            const t = {
                get: async function (target) {
                    await Promise.resolve();
                    if (target && target._query) {
                        const result = queryFrom(snapStore, target);
                        result.docs.forEach(function (doc) { reads.push(doc.ref.path); });
                        return result;
                    }
                    reads.push(target.path);
                    const data = snapStore[target.path];
                    return {
                        exists: data !== undefined,
                        id: target.id,
                        ref: target,
                        data: function () { return data ? Object.assign({}, data) : undefined; },
                    };
                },
                set: function (ref, data, opts) {
                    writes.push({ op: 'set', path: ref.path, data: data, merge: !!(opts && opts.merge) });
                },
                update: function (ref, data) {
                    writes.push({ op: 'update', path: ref.path, data: data });
                },
                create: function (ref, data) {
                    writes.push({ op: 'create', path: ref.path, data: data });
                },
            };
            await fn(t);
            let conflict = false;
            await lock(async function () {
                reads.forEach(function (docPath) {
                    if ((versions[docPath] || 0) !== (snapVer[docPath] || 0)) conflict = true;
                });
                if (conflict) return;
                writes.forEach(function (w) {
                    if (w.op === 'create' && store[w.path] !== undefined) {
                        const err = new Error('Document already exists.');
                        err.code = 'already-exists';
                        throw err;
                    }
                });
                writes.forEach(function (w) {
                    if (w.op === 'update') store[w.path] = Object.assign({}, store[w.path], w.data);
                    else if (w.op === 'create' || !w.merge) store[w.path] = Object.assign({}, w.data);
                    else store[w.path] = Object.assign({}, store[w.path] || {}, w.data);
                    versions[w.path] = (versions[w.path] || 0) + 1;
                });
            });
            if (conflict) continue;
            return;
        }
        const err = new Error('transaction aborted');
        err.code = 'aborted';
        throw err;
    }
    return {
        store: store,
        db: { collection: collection, runTransaction: runTransaction },
    };
}

const admin = { firestore: { FieldValue: { serverTimestamp: function () { return { ts: 1 }; } } } };

function signedIn(uid, provider) {
    return {
        auth: {
            uid: uid,
            token: { firebase: { sign_in_provider: provider || 'google.com' } },
        },
    };
}

function api(mem) {
    return createChooseFactionHandlers({ db: mem.db, admin: admin }).chooseFaction;
}

function base(extra) {
    return Object.assign({
        'users/user1': { username: 'Ada' },
        'satoshiFavor/factionTotals': { cyber_hornets: 1200, honey_badgers: 980, unaffiliated: 604 },
        'satoshiFavor/current/contributors/a': { uid: 'user1', pointsAdded: 4 },
        'satoshiFavor/current/contributors/b': { uid: 'user1', source: 'level_up_10' },
        'satoshiFavor/current/contributors/c': { uid: 'user1', faction: 'honey_badgers', pointsAdded: 9 },
        'satoshiFavor/current/contributors/other': { uid: 'user2', pointsAdded: 15 },
    }, extra || {});
}

function assertRejected(err, code) {
    assert.ok(err, 'expected a rejection');
    assert.strictEqual(err.code, code);
}

const queue = [];

queue.push(test('a double call and a race move the pool once', async function () {
    const mem = memDb(base());
    const choose = api(mem);
    const first = await choose({ faction: 'cyber_hornets' }, signedIn('user1'));
    assert.strictEqual(first.moved, 14);
    assert.strictEqual(first.pointsSynced, 14);
    let secondErr = null;
    try {
        await choose({ faction: 'honey_badgers' }, signedIn('user1'));
    } catch (e) { secondErr = e; }
    assertRejected(secondErr, 'failed-precondition');
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].unaffiliated, 590);
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].cyber_hornets, 1214);
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].honey_badgers, 980);
    assert.strictEqual(mem.store['users/user1'].faction, 'cyber_hornets');
    assert.strictEqual(mem.store['satoshiFavor/factionSyncs/users/user1'].pointsSynced, 14);
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/a'].faction, 'cyber_hornets');
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/b'].faction, 'cyber_hornets');
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/c'].faction, 'honey_badgers');
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/other'].faction, undefined);

    const race = memDb(base());
    const raceChoose = api(race);
    const raced = await Promise.allSettled([
        raceChoose({ faction: 'cyber_hornets', previousFaction: 'honey_badgers' }, signedIn('user1')),
        raceChoose({ newFaction: 'cyber_hornets' }, signedIn('user1')),
    ]);
    const ok = raced.filter(function (item) { return item.status === 'fulfilled'; });
    const bad = raced.filter(function (item) { return item.status === 'rejected'; });
    assert.strictEqual(ok.length, 1);
    assert.strictEqual(bad.length, 1);
    assert.strictEqual(ok[0].value.moved, 14);
    assert.strictEqual(bad[0].reason.code, 'failed-precondition');
    assert.strictEqual(race.store['satoshiFavor/factionTotals'].unaffiliated, 590);
    assert.strictEqual(race.store['satoshiFavor/factionTotals'].cyber_hornets, 1214);
    assert.strictEqual(race.store['satoshiFavor/factionSyncs/users/user1'].pointsSynced, 14);
    assert.strictEqual(race.store['users/user1'].faction, 'cyber_hornets');
}));

queue.push(test('a banned user is blocked before any points move', async function () {
    const cases = [
        { 'users/user1': { rewardBlocked: true } },
        { 'users/user1': { satsDisabled: true } },
        { 'users/user1': { banned: true } },
        { 'users/user1': { ban_reason: 'abuse' } },
        { 'faucet_ledger/user1': { banned: true } },
        { 'faucet_ledger/user1': { rewardBlocked: true } },
    ];
    for (let i = 0; i < cases.length; i++) {
        const mem = memDb(base(cases[i]));
        const before = JSON.stringify(mem.store);
        let err = null;
        try {
            await api(mem)({ faction: 'cyber_hornets' }, signedIn('user1'));
        } catch (e) { err = e; }
        assertRejected(err, 'permission-denied');
        assert.strictEqual(JSON.stringify(mem.store), before);
        assert.strictEqual(mem.store['satoshiFavor/factionSyncs/users/user1'], undefined);
        assert.strictEqual(mem.store['users/user1'].faction, undefined);
    }
}));

queue.push(test('a second pick is rejected', async function () {
    const already = memDb(base({ 'users/user1': { faction: 'honey_badgers' } }));
    let err = null;
    try {
        await api(already)({ faction: 'cyber_hornets' }, signedIn('user1'));
    } catch (e) { err = e; }
    assertRejected(err, 'failed-precondition');
    assert.strictEqual(already.store['satoshiFavor/factionTotals'].unaffiliated, 604);
    assert.strictEqual(already.store['satoshiFavor/current/contributors/a'].faction, undefined);
    assert.strictEqual(already.store['satoshiFavor/factionSyncs/users/user1'], undefined);

    const synced = memDb(base({
        'satoshiFavor/factionSyncs/users/user1': { uid: 'user1', faction: 'cyber_hornets', pointsSynced: 1 },
    }));
    err = null;
    try {
        await api(synced)({ faction: 'cyber_hornets' }, signedIn('user1'));
    } catch (e) { err = e; }
    assertRejected(err, 'failed-precondition');
    assert.strictEqual(synced.store['satoshiFavor/factionTotals'].cyber_hornets, 1200);
}));

queue.push(test('the moved count is the amount taken from the pool', async function () {
    const mem = memDb(base({
        'satoshiFavor/factionTotals': { cyber_hornets: 10, honey_badgers: 4, unaffiliated: 3 },
    }));
    const out = await api(mem)({ faction: 'honey_badgers' }, signedIn('user1'));
    assert.strictEqual(out.moved, 3);
    assert.strictEqual(out.pointsSynced, 3);
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].unaffiliated, 0);
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].honey_badgers, 7);
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].cyber_hornets, 10);
    assert.strictEqual(mem.store['satoshiFavor/factionSyncs/users/user1'].pointsSynced, 3);
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/a'].faction, 'honey_badgers');
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/b'].faction, 'honey_badgers');
    assert.strictEqual(mem.store['satoshiFavor/current/contributors/other'].faction, undefined);
    assert.ok(mem.store['satoshiFavor/factionTotals'].unaffiliated >= 0);
}));

queue.push(test('anonymous and unknown factions are rejected', async function () {
    const mem = memDb(base());
    let err = null;
    try { await api(mem)({ faction: 'cyber_hornets' }, signedIn('user1', 'anonymous')); }
    catch (e) { err = e; }
    assertRejected(err, 'permission-denied');
    err = null;
    try { await api(mem)({ faction: 'no_faction' }, signedIn('user1')); }
    catch (e) { err = e; }
    assertRejected(err, 'invalid-argument');
    err = null;
    try { await api(mem)({}, { auth: null }); }
    catch (e) { err = e; }
    assertRejected(err, 'unauthenticated');
    assert.strictEqual(mem.store['users/user1'].faction, undefined);
    assert.strictEqual(mem.store['satoshiFavor/factionTotals'].unaffiliated, 604);
}));

queue.push(test('rules deny a client faction write and the panel keeps the labels apart', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const chooseSrc = fs.readFileSync(path.join(root, 'functions/src/chooseFaction.js'), 'utf8');
    const favorSrc = fs.readFileSync(path.join(root, 'functions/src/satoshiFavor.js'), 'utf8');
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const notes = fs.readFileSync(path.join(root, 'patch-notes.html'), 'utf8');

    const createAt = rules.indexOf('allow create: if request.auth != null');
    const updateAt = rules.indexOf('allow update: if request.auth != null');
    const createBlock = rules.slice(createAt, updateAt);
    assert.ok(createBlock.indexOf("'faction'") === -1);
    const updateBlock = rules.slice(updateAt, rules.indexOf('match /public_profiles/{uid}'));
    assert.ok(updateBlock.indexOf("'faction'") > 0);
    assert.ok(updateBlock.indexOf("'factionSynced'") > 0);
    assert.ok(updateBlock.indexOf("'pointsSynced'") > 0);
    const syncRule = rules.slice(rules.indexOf('match /satoshiFavor/factionSyncs'));
    assert.ok(syncRule.indexOf('allow write: if false;') > 0);

    assert.strictEqual((index.match(/enforceAppCheck:\s*true/g) || []).length, 7);
    assert.ok(chooseSrc.indexOf('enforceAppCheck: true') > 0);
    assert.ok(index.indexOf('bindChooseFaction') > 0);
    assert.ok(index.indexOf('exports.chooseFaction') > 0);
    assert.ok(index.indexOf('exports.syncUserFactionPoints') > 0);
    assert.ok(favorSrc.indexOf('syncUserFactionPoints') === -1);
    assert.ok(chooseSrc.indexOf('t.create(syncRef') > 0);
    assert.ok(chooseSrc.indexOf('rewardsBlocked') > 0);

    assert.ok(ranking.indexOf("httpsCallable('chooseFaction')") > 0);
    assert.ok(ranking.indexOf('faction: 1') === -1);
    assert.ok(ranking.indexOf('update({ faction:') === -1);
    assert.ok(ranking.indexOf('extra.faction') === -1);
    assert.ok(ranking.indexOf('userData.faction') === -1);
    assert.ok(ranking.indexOf('This choice is permanent. Your unclaimed points go to the faction you pick.') > 0);
    assert.ok(ranking.indexOf('unclaimed point') > 0);

    assert.ok(quests.indexOf('Unclaimed faction points: ') > 0);
    assert.ok(quests.indexOf('Your faction: Cyber Hornets') > 0);
    assert.ok(quests.indexOf('Your faction: Honey Badgers') > 0);
    assert.ok(quests.indexOf("elU.textContent = unaffiliated.toLocaleString() + ' pts unclaimed'") > 0);
    assert.ok(quests.indexOf("'Unclaimed: ' + unaffiliated.toLocaleString() + ' pts'") === -1);
    assert.ok(quests.indexOf("These come from players who haven't picked a faction yet.") > 0);
    assert.ok(quests.indexOf("You haven't picked a faction yet, so your points count as unclaimed. Pick a side to help a team win.") > 0);
    assert.ok(quests.indexOf('id="sfNoFactionChooseBtn"') > 0);
    assert.ok(quests.indexOf('id="sfUnclaimedExplain"') > 0);
    var poolStart = quests.indexOf('id="sfUnclaimedPool"');
    var poolEnd = quests.indexOf('id="sfNoFactionNote"');
    assert.ok(poolStart > 0 && poolEnd > poolStart);
    assert.ok(quests.slice(poolStart, poolEnd).indexOf('font-family:monospace') === -1);
    assert.ok(quests.indexOf("@media (max-width:640px){#sfNoFactionChooseBtn{display:block;width:100%") > 0);
    assert.ok(quests.indexOf('var sfCanChoose = (typeof auth !== \'undefined\' && auth && auth.currentUser && !auth.currentUser.isAnonymous);') > 0);
    assert.ok(quests.indexOf("noteBody.style.display = (!userFaction && sfCanChoose) ? 'block' : 'none'") > 0);
    assert.ok(quests.indexOf("sfChoose.style.display = sfCanChoose ? 'none' : 'inline-block'") > 0);
    assert.ok(quests.indexOf("poolRow.style.display = (userFaction === 'cyber_hornets' || userFaction === 'honey_badgers') ? 'block' : 'none'") > 0);
    assert.ok(quests.indexOf('Choose a faction') > 0);
    assert.ok(quests.indexOf('sfLabel.innerHTML') === -1);
    assert.ok(quests.indexOf('elNote.innerHTML') === -1);
    assert.ok(quests.indexOf('noteText.innerHTML') === -1);
    assert.ok(quests.indexOf('window._openFactionPicker') > 0);
    assert.ok(quests.indexOf('points transfer') === -1);
    assert.ok(quests.indexOf('points move to') === -1);

    assert.ok(html.indexOf('This choice is permanent. Your unclaimed points go to the faction you pick.') > 0);
    assert.ok(notes.indexOf('Unclaimed faction points show again') > 0);
    assert.ok(notes.indexOf("Satoshi's Favor now explains that unclaimed points come from players without a faction, and shows them a button to pick one.") > 0);
    assert.strictEqual(notes.indexOf("Latest: Satoshi's Favor now explains"), -1);
    assert.ok(notes.indexOf("Latest: Sats claims and Satoshi's Favor are held on a VPN, proxy, or Tor exit. An invite reward waits and pays once that friend is on a regular connection, and the rest of the app keeps working.") > 0);
    assert.strictEqual((notes.match(/Latest:/g) || []).length, 1);
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
