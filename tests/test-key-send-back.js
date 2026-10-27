#!/usr/bin/env node
'use strict';

// Peer keys: tappable sender tags, one-tap send-back, and the viewer's
// own peership level. Provenance rules live in planKeySend. The emulator
// suite checks the callable.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const progress = require('../functions/src/badgeProgress');

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) {
    queue.push(Promise.resolve().then(fn).then(function() {
        console.log('✅ ' + name);
        passed++;
    }, function(e) {
        console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
        failed++;
    }));
}

test('a return never counts, and a first handoff still can', function() {
    const earned = progress.planKeySend({ status: 'inventory', label: '7F' }, 'earner', 'peer');
    assert.strictEqual(earned.inventory, true);
    assert.strictEqual(earned.skipPeerLevel, false);
    assert.strictEqual(earned.originUid, 'earner');
    assert.deepStrictEqual(earned.priorSenders, ['earner']);

    const back = progress.planKeySend({
        status: 'sent',
        sentBy: 'earner',
        sender: 'earner',
        originUid: 'earner',
        priorSenders: ['earner'],
        label: '7F',
    }, 'peer', 'earner');
    assert.strictEqual(back.held, true);
    assert.strictEqual(back.previousSender, 'earner');
    assert.strictEqual(back.skipPeerLevel, true);
    assert.strictEqual(back.originUid, 'earner');
    assert.ok(back.priorSenders.indexOf('earner') !== -1);
    assert.ok(back.priorSenders.indexOf('peer') !== -1);

    const sideways = progress.planKeySend({
        status: 'sent',
        sentBy: 'earner',
        originUid: 'earner',
        priorSenders: ['earner'],
    }, 'peer', 'stranger');
    assert.strictEqual(sideways.previousSender, 'earner');
    assert.notStrictEqual(sideways.previousSender, 'stranger');

    const opened = {
        status: 'sent',
        sentBy: 'peer',
        originUid: 'earner',
        priorSenders: ['earner', 'peer'],
        skipPeerLevel: true,
    };
    assert.strictEqual(progress.keyOpenCountsForPeerLevel(opened, 'earner'), false);
    assert.strictEqual(progress.keyOpenCountsForPeerLevel({
        status: 'sent',
        sentBy: 'earner',
        originUid: 'earner',
        priorSenders: ['earner'],
        skipPeerLevel: false,
    }, 'peer'), true);
    assert.strictEqual(progress.keyOpenCountsForPeerLevel({
        status: 'sent',
        sentBy: 'earner',
        originUid: 'earner',
        priorSenders: ['earner'],
    }, 'earner'), false);
    assert.strictEqual(progress.keyOpenCountsForPeerLevel({
        status: 'sent',
        sentBy: 'mid',
        originUid: 'earner',
        priorSenders: ['earner', 'mid'],
    }, 'earner'), false);
    // Older keys have no provenance fields. A normal peer open still counts.
    assert.strictEqual(progress.keyOpenCountsForPeerLevel({ status: 'sent', sentBy: 'earner' }, 'peer'), true);
    assert.strictEqual(progress.keyOpenCountsForPeerLevel({ status: 'inventory', sentBy: 'earner' }, 'peer'), false);
});

test('decryptCipher counts a peer open only after the return check and the pair check', function() {
    const src = read('functions/src/gifting.js');
    const send = src.slice(src.indexOf('const sendKeys'), src.indexOf('const decryptCipher'));
    const decrypt = src.slice(src.indexOf('const decryptCipher'), src.indexOf('const claimCipherWin'));
    assert.ok(send.includes('planKeySend'));
    assert.ok(send.includes('skipPeerLevel: plan.skipPeerLevel === true'));
    assert.ok(send.includes('originUid: plan.originUid'));
    assert.ok(send.includes('priorSenders: plan.priorSenders'));
    assert.strictEqual(send.indexOf('data.sender'), -1);
    assert.strictEqual(send.indexOf('data.skipPeerLevel'), -1);
    assert.ok(send.includes('rewardBlocked(recip, recipLedger)'));
    assert.ok(send.includes('blockedUsers'));
    assert.ok(decrypt.includes('keyOpenCountsForPeerLevel'));
    assert.ok(decrypt.includes('pairEligible'));
    assert.ok(decrypt.includes('applied.keyCounts'));
    assert.ok(decrypt.includes('applied.pairEligible'));
    const creditAt = decrypt.indexOf('creditPeerKeyUse');
    const levelAt = decrypt.indexOf('updatePeerLevelAfterGift');
    const gateAt = decrypt.indexOf('if (applied.pairEligible)');
    assert.ok(creditAt > 0 && gateAt > creditAt && levelAt > gateAt);
    const rules = read('firestore.rules');
    const rel = rules.slice(rules.indexOf('match /peerRelationships/{pairId}'), rules.indexOf('match /admin_audit_log'));
    assert.ok(rel.includes('resource.data.uid1 == request.auth.uid'));
    assert.ok(rel.includes('resource.data.uid2 == request.auth.uid'));
    assert.ok(rel.includes('allow write: if false'));
    const users = rules.slice(rules.indexOf('match /users/{userId}'), rules.indexOf('allow create'));
    assert.ok(users.includes('request.auth.uid == userId'));
    assert.ok(users.includes('allow list: if false'));
    const fields = read('functions/index.js');
    const pub = fields.slice(fields.indexOf('const PUBLIC_PROFILE_FIELDS'), fields.indexOf('exports.syncPublicProfile'));
    assert.ok(pub.includes("'peerCount'"));
    assert.strictEqual(pub.includes("'peerData'"), false);
    assert.strictEqual(pub.includes("'peers'"), false);
    assert.strictEqual(pub.includes("'banned'"), false);
    const hide = read('ux-patches.js');
    const hideBlock = hide.slice(hide.indexOf('var HIDE_IDS'), hide.indexOf('function _getMode'));
    assert.strictEqual(hideBlock.includes('profilePeerLevel'), false);
    assert.strictEqual(hideBlock.includes('key-send-back'), false);
});

function makeDocument() {
    const nodes = [];
    function create(tag) {
        const node = {
            tagName: String(tag).toUpperCase(),
            children: [],
            style: {},
            className: '',
            id: '',
            textContent: '',
            title: '',
            type: '',
            disabled: false,
            hidden: false,
            onclick: null,
            dataset: {},
            attributes: {},
            parentNode: null,
            appendChild: function(child) {
                child.parentNode = node;
                node.children.push(child);
                return child;
            },
            remove: function() {
                if (node.parentNode) {
                    const list = node.parentNode.children;
                    const at = list.indexOf(node);
                    if (at !== -1) list.splice(at, 1);
                }
            },
            setAttribute: function(k, v) {
                node.attributes[k] = String(v);
                if (k === 'data-profile-uid') node.dataset.profileUid = String(v);
            },
            getAttribute: function(k) { return node.attributes[k]; },
            addEventListener: function() {},
            focus: function() {},
        };
        Object.defineProperty(node, 'innerHTML', {
            configurable: true,
            get: function() { return node._html || ''; },
            set: function(v) {
                node._html = String(v);
                node.children.length = 0;
            },
        });
        nodes.push(node);
        return node;
    }
    const document = {
        createElement: create,
        createTextNode: function(text) {
            const node = create('span');
            node.textContent = String(text);
            return node;
        },
        head: create('head'),
        body: create('body'),
        getElementById: function(id) {
            for (let i = 0; i < nodes.length; i++) if (nodes[i].id === id) return nodes[i];
            return null;
        },
        querySelectorAll: function() { return []; },
    };
    return { document: document, create: create };
}

function walk(node, visit) {
    visit(node);
    (node.children || []).forEach(function(child) { walk(child, visit); });
}

function texts(node) {
    const out = [];
    walk(node, function(n) { if (n.textContent) out.push(n.textContent); });
    return out.join('\n');
}

function docs(rows) {
    return {
        docs: rows.map(function(row) {
            return {
                id: row.id,
                data: function() {
                    const copy = Object.assign({}, row);
                    delete copy.id;
                    return copy;
                },
            };
        }),
        empty: rows.length === 0,
        size: rows.length,
        forEach: function() {},
    };
}

test('sender names are escaped profile tags and send-back uses sendKeys once', async function() {
    const dom = makeDocument();
    const calls = [];
    const toasts = [];
    let profileGets = 0;
    let getAllCalls = 0;
    const profiles = {
        KRSc21: { username: 'KRSc21' },
        hostile: { username: '<img src=x onerror=alert(1)>' },
    };
    const peerKeys = [
        { id: 'k-ok', label: '7F', status: 'sent', sentBy: 'KRSc21', sentByName: 'KRSc21' },
        { id: 'k-html', label: 'F6', status: 'sent', sentBy: 'hostile', sentByName: '<img src=x onerror=alert(1)>' },
        { id: 'k-gone', label: '3A', status: 'sent', sentBy: 'deletedUser', sentByName: 'Gone' },
        { id: 'k-bad', label: 'B2', status: 'sent', sentBy: '"><img', sentByName: '<script>' },
    ];
    function query(name, filters) {
        const q = {
            where: function(field, op, value) { return query(name, filters.concat([{ field: field, value: value }])); },
            limit: function() { return q; },
            get: function() {
                const status = (filters.find(function(f) { return f.field === 'status'; }) || {}).value;
                if (name === 'keys' && status === 'sent') return Promise.resolve(docs(peerKeys));
                return Promise.resolve(docs([]));
            },
        };
        return q;
    }
    const sandbox = {
        console: console,
        document: dom.document,
        setInterval: function() { return 0; },
        clearInterval: function() {},
        setTimeout: function() { return 0; },
        auth: { currentUser: { uid: 'me', isAnonymous: false } },
        showUserProfile: function(uid) { calls.push({ profile: uid }); },
        showToast: function(msg) { toasts.push(String(msg)); },
        firebase: {
            functions: function() {
                return {
                    httpsCallable: function(name) {
                        return function(data) {
                            calls.push({ name: name, data: data });
                            return Promise.resolve({ data: { xpAwarded: 25, success: true } });
                        };
                    },
                };
            },
        },
        db: {
            getAll: function() {
                getAllCalls++;
                const refs = Array.prototype.slice.call(arguments);
                return Promise.resolve(refs.map(function(ref) {
                    const row = profiles[ref.id];
                    return { id: ref.id, exists: !!row, data: function() { return row || {}; } };
                }));
            },
            collection: function(name) {
                return {
                    doc: function(id) {
                        return {
                            id: id,
                            get: function() {
                                if (name === 'public_profiles') profileGets++;
                                return Promise.resolve({ exists: false, data: function() { return {}; } });
                            },
                        };
                    },
                    where: function(field, op, value) { return query(name, [{ field: field, value: value }]); },
                };
            },
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('gifting.js'), sandbox);
    const host = dom.document.createElement('div');
    await sandbox.renderKeysAndCiphersPanel(host);
    assert.strictEqual(getAllCalls, 1, 'sender profiles should be one batch');
    assert.strictEqual(profileGets, 0, 'batch read should not fall back to N gets');
    const joined = texts(host);
    assert.ok(joined.includes('From '));
    assert.ok(joined.includes('KRSc21'));
    assert.ok(joined.includes('<img src=x onerror=alert(1)>'));
    assert.ok(joined.includes('Deleted player'));
    let tags = 0;
    let backs = 0;
    let imgs = 0;
    walk(host, function(n) {
        if (n.tagName === 'IMG' || n.tagName === 'SCRIPT') imgs++;
        if (n.className === 'username-tag') {
            tags++;
            assert.strictEqual(n.attributes['data-profile-uid'] === 'KRSc21' || n.attributes['data-profile-uid'] === 'hostile', true);
            assert.ok(n.textContent.indexOf('<') === -1 || n.attributes['data-profile-uid'] === 'hostile');
            n.onclick({ stopPropagation: function() {} });
        }
        if (n.className === 'key-send-back-btn') {
            backs++;
            assert.strictEqual(n.textContent, 'Send key back');
        }
    });
    assert.strictEqual(imgs, 0);
    assert.strictEqual(tags, 2);
    assert.strictEqual(backs, 2);
    assert.deepStrictEqual(calls.filter(function(c) { return c.profile; }).map(function(c) { return c.profile; }), ['KRSc21', 'hostile']);
    let backBtn = null;
    walk(host, function(n) { if (!backBtn && n.className === 'key-send-back-btn') backBtn = n; });
    await backBtn.onclick();
    const sent = calls.filter(function(c) { return c.name === 'sendKeys'; });
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].data.keyIds.length, 1);
    assert.strictEqual(sent[0].data.keyIds[0], 'k-ok');
    assert.strictEqual(sent[0].data.recipientUid, 'KRSc21');
    assert.ok(read('gifting.js').includes("_keySendToast(name || 'your peer', sent)"));
    assert.ok(read('gifting.js').includes("'🔑 Sent to ' + name + '!'"));
});

test('the send modal reads peership once and shows Lv or New', async function() {
    const dom = makeDocument();
    let userGets = 0;
    let profileGets = 0;
    const sandbox = {
        console: console,
        document: dom.document,
        setInterval: function() { return 0; },
        clearInterval: function() {},
        setTimeout: function() { return 0; },
        auth: { currentUser: { uid: 'me', isAnonymous: false } },
        showToast: function() {},
        db: {
            collection: function(name) {
                return {
                    doc: function(id) {
                        return {
                            get: function() {
                                if (name === 'users') {
                                    userGets++;
                                    assert.strictEqual(id, 'me');
                                    return Promise.resolve({
                                        exists: true,
                                        data: function() {
                                            return {
                                                peers: ['KRSc21', 'fresh', 'zero'],
                                                peerData: {
                                                    KRSc21: { level: 3, levelName: 'Routing Nodes', giftsExchanged: 12 },
                                                    zero: { level: 0, giftsExchanged: 0 },
                                                },
                                            };
                                        },
                                    });
                                }
                                profileGets++;
                                const names = {
                                    KRSc21: 'KRSc21',
                                    fresh: '<b>Fresh</b>',
                                    zero: 'Alias',
                                };
                                return Promise.resolve({
                                    exists: true,
                                    data: function() { return { username: names[id] || 'Bitcoiner' }; },
                                });
                            },
                        };
                    },
                    where: function() {
                        const q = { where: function() { return q; }, limit: function() { return q; }, get: function() { return Promise.resolve(docs([])); } };
                        return q;
                    },
                };
            },
        },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('gifting.js'), sandbox);
    await sandbox.showPeerPickerForKeys(['k1']);
    assert.strictEqual(userGets, 1);
    assert.strictEqual(profileGets, 3);
    const sheet = dom.document.getElementById('peerPickerOverlay');
    const chips = [];
    let imgs = 0;
    walk(sheet, function(n) {
        if (n.className === 'peer-level-chip') chips.push(n.textContent + '|' + n.title);
        if (n.tagName === 'IMG') imgs++;
        if (n.textContent === '<b>Fresh</b>') assert.strictEqual(n.tagName, 'SPAN');
    });
    assert.strictEqual(imgs, 0);
    assert.deepStrictEqual(chips, [
        'Lv 3|Lv 3 · Routing Nodes',
        'New|No peership level yet',
        'New|No peership level yet',
    ]);
});

test('a profile shows only the viewer pair level from the viewer user doc', async function() {
    const src = read('messaging.js');
    const fill = src.slice(src.indexOf('function _fillProfilePeerLevel'), src.indexOf('// ---- USER PROFILE MODAL'));
    assert.ok(fill.includes('doc(self)'));
    assert.ok(fill.includes('data.peers'));
    assert.ok(fill.includes('data.peerData'));
    assert.strictEqual(fill.includes('peerRelationships'), false);
    assert.strictEqual(fill.includes('public_profiles'), false);
    assert.ok(src.includes("'<div id=\"profilePeerLevel\" hidden></div>'"));
    assert.ok(src.includes('!_isOwnProfile && _isPeer'));

    const byId = {};
    function make(tag) {
        const node = {
            tagName: String(tag || 'DIV').toUpperCase(),
            id: '',
            children: [],
            style: {},
            textContent: '',
            title: '',
            hidden: false,
            classList: { contains: function() { return false; }, remove: function() {}, add: function() {} },
            appendChild: function(child) { node.children.push(child); child.parentNode = node; return child; },
            remove: function() { if (node.id) delete byId[node.id]; },
            setAttribute: function() {},
            addEventListener: function() {},
        };
        return node;
    }
    function adopt(html) {
        const created = [];
        const re = /id="([^"]+)"/g;
        let match;
        while ((match = re.exec(html))) {
            const node = byId[match[1]] || make('div');
            node.id = match[1];
            byId[match[1]] = node;
            created.push(node);
        }
        return created[0] || make('div');
    }
    const document = {
        createElement: function(tag) {
            const node = make(tag);
            Object.defineProperty(node, 'innerHTML', {
                configurable: true,
                set: function(html) { node.firstChild = adopt(String(html)); },
                get: function() { return ''; },
            });
            return node;
        },
        getElementById: function(id) { return byId[id] || null; },
        body: make('body'),
        addEventListener: function() {},
        querySelectorAll: function() { return []; },
    };
    document.body.appendChild = function(child) { document.body.children.push(child); return child; };
    const reads = [];
    const sandbox = {
        console: console,
        document: document,
        setInterval: function() { return 0; },
        clearInterval: function() {},
        setTimeout: function(fn) { if (typeof fn === 'function') fn(); return 0; },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        sessionStorage: { getItem: function() { return '[]'; }, setItem: function() {} },
        navigator: { clipboard: { writeText: function() {} } },
        auth: { currentUser: null },
        db: {
            collection: function(name) {
                return {
                    doc: function(id) {
                        return {
                            get: function() {
                                reads.push(name + '/' + id);
                                if (name === 'public_profiles') {
                                    return Promise.resolve({
                                        exists: true,
                                        data: function() { return { username: 'KRSc21', points: 10, peerCount: 2 }; },
                                    });
                                }
                                return Promise.resolve({
                                    exists: true,
                                    data: function() {
                                        return {
                                            peers: ['KRSc21'],
                                            peerData: {
                                                KRSc21: { level: 3, levelName: 'Routing Nodes', giftsExchanged: 12 },
                                            },
                                        };
                                    },
                                });
                            },
                        };
                    },
                    where: function() {
                        const q = { where: function() { return q; }, limit: function() { return q; }, get: function() { return Promise.resolve({ docs: [], empty: true, forEach: function() {} }); } };
                        return q;
                    },
                };
            },
        },
        escapeHtml: function(s) { return String(s || '').replace(/</g, '&lt;'); },
        getLevel: function() { return { name: 'Newbie', emoji: '🌱' }; },
        isUserBlocked: function() { return false; },
        sanitizeUrl: function(s) { return s; },
        showToast: function() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(read('messaging.js'), sandbox);
    const none = sandbox.peershipLevelView(null);
    assert.strictEqual(none.chip, 'New');
    assert.strictEqual(none.line, 'Peership not started');
    const lv = sandbox.peershipLevelView({ level: 3, levelName: 'Routing Nodes', giftsExchanged: 12 });
    assert.strictEqual(lv.chip, 'Lv 3');
    assert.strictEqual(lv.line, 'Peership · Lv 3 · Routing Nodes · 12/21');
    sandbox.auth.currentUser = { uid: 'me', isAnonymous: false };
    sandbox._myPeers = new Set(['KRSc21']);
    sandbox.showUserProfile('KRSc21');
    await new Promise(function(resolve) { setImmediate(resolve); });
    await new Promise(function(resolve) { setImmediate(resolve); });
    await new Promise(function(resolve) { setImmediate(resolve); });
    const node = document.getElementById('profilePeerLevel');
    assert.ok(node, 'peer profile should keep the level line');
    assert.strictEqual(node.textContent, 'Peership · Lv 3 · Routing Nodes · 12/21');
    const userReads = reads.filter(function(row) { return row.indexOf('users/') === 0; });
    assert.deepStrictEqual(userReads, ['users/me']);
    assert.ok(reads.some(function(row) { return row === 'public_profiles/KRSc21'; }));
});

Promise.all(queue).then(function() {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
