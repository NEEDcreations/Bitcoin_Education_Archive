// Small in-memory Firestore for payout tests. Transactions run one at a time,
// which is the outcome Firestore guarantees for conflicting transactions.
'use strict';

function makeAdmin() {
    const FieldValue = {
        increment: function(n) { return { __op: 'inc', n: n }; },
        delete: function() { return { __op: 'del' }; },
        serverTimestamp: function() { return { __op: 'ts' }; },
        arrayUnion: function() { return { __op: 'union', v: Array.prototype.slice.call(arguments) }; },
    };
    const Timestamp = {
        fromMillis: function(ms) { return { ms: ms, toMillis: function() { return ms; } }; },
        now: function() { const ms = Date.now(); return { ms: ms, toMillis: function() { return ms; } }; },
    };
    return { firestore: { FieldValue: FieldValue, Timestamp: Timestamp } };
}

function applyPatch(base, patch, merge) {
    const out = merge ? Object.assign({}, base || {}) : {};
    Object.keys(patch).forEach(function(k) {
        const v = patch[k];
        if (v && v.__op === 'inc') out[k] = (Number(out[k]) || 0) + v.n;
        else if (v && v.__op === 'del') delete out[k];
        else if (v && v.__op === 'ts') out[k] = { ms: Date.now(), toMillis: function() { return this.ms; } };
        else if (v && v.__op === 'union') {
            const list = Array.isArray(out[k]) ? out[k].slice() : [];
            v.v.forEach(function(x) { if (list.indexOf(x) === -1) list.push(x); });
            out[k] = list;
        } else out[k] = JSON.parse(JSON.stringify(v));
    });
    return out;
}

function makeDb(seed) {
    const store = Object.assign({}, seed || {});
    let chain = Promise.resolve();
    let commits = 0;
    function ref(path) {
        return {
            path: path,
            id: path.split('/').pop(),
            collection: function(name) { return { doc: function(id) { return ref(path + '/' + name + '/' + id); } }; },
            get: async function() { return snap(path); },
        };
    }
    function snap(path) {
        const has = Object.prototype.hasOwnProperty.call(store, path);
        const data = has ? JSON.parse(JSON.stringify(store[path])) : undefined;
        return { exists: has, id: path.split('/').pop(), data: function() { return data; } };
    }
    const db = {
        store: store,
        commits: function() { return commits; },
        collection: function(name) { return { doc: function(id) { return ref(name + '/' + id); } }; },
        runTransaction: function(fn) {
            const run = chain.then(async function() {
                const writes = [];
                const t = {
                    get: async function(r) { return snap(r.path); },
                    set: function(r, data, opts) { writes.push([r.path, data, !!(opts && opts.merge), false]); return t; },
                    update: function(r, data) { writes.push([r.path, data, true, true]); return t; },
                    delete: function(r) { writes.push([r.path, null, false, false]); return t; },
                };
                const result = await fn(t);
                writes.forEach(function(w) {
                    if (w[1] === null) { delete store[w[0]]; return; }
                    if (w[3] && !Object.prototype.hasOwnProperty.call(store, w[0])) throw new Error('NOT_FOUND ' + w[0]);
                    store[w[0]] = applyPatch(store[w[0]], w[1], w[2]);
                });
                commits++;
                return result;
            });
            chain = run.catch(function() {});
            return run;
        },
    };
    return { db: db, ref: ref };
}

module.exports = { makeAdmin: makeAdmin, makeDb: makeDb };
