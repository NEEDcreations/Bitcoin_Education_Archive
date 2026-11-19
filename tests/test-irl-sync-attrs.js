// IRL events: the event grid, detail view and edit view put event ids in
// escaped data attributes and route clicks through one listener per
// container. Ids outside the allowed pattern never reach an action.
const assert = require('assert');
const vm = require('vm');
const H = require('./helpers-markup.js');

const { test, run } = H.runner();
const SRC = H.read('irl-sync.js');
const ALLOWED = ['style', 'class', 'id', 'title', 'src', 'alt', 'href', 'target', 'rel', 'type', 'onclick', 'onchange', 'onmouseover', 'onmouseout',
    'placeholder', 'value', 'accept', 'maxlength', 'rows', 'for', 'checked', 'min', 'max', 'step', 'required', 'disabled', 'loading', 'referrerpolicy'];

function makeDb(rows) {
    function docSnap(id) { return { id: id, exists: !!rows[id], data: function() { return Object.assign({}, rows[id]); } }; }
    return {
        collection: function() {
            const q = {
                where: function() { return q; }, orderBy: function() { return q; }, limit: function() { return q; },
                get: async function() { const docs = Object.keys(rows).map(docSnap); return { empty: docs.length === 0, docs: docs, forEach: function(cb) { docs.forEach(cb); } }; },
                doc: function(id) { return { get: async function() { return docSnap(id); }, update: async function() {}, delete: async function() {} }; },
            };
            return q;
        },
    };
}

function load(rows) {
    const els = {};
    const appended = [];
    const calls = [];
    const db = makeDb(rows);
    const authObj = { currentUser: { uid: 'host1', isAnonymous: false } };
    const document = {
        readyState: 'complete',
        getElementById: function(id) { if (!els[id]) els[id] = H.makeEl(id); return els[id]; },
        createElement: function() { return H.makeEl(''); },
        addEventListener: function() {},
        querySelector: function() { return null; },
        querySelectorAll: function() { return []; },
        body: { appendChild: function(el) { appended.push(el); return el; }, insertAdjacentHTML: function() {}, style: {} },
    };
    const sandbox = {
        document: document,
        console: { log: function() {}, error: function() {}, warn: function() {} },
        setTimeout: function() { return 0; },
        localStorage: { getItem: function() { return null; }, setItem: function() {} },
        firebase: { firestore: Object.assign(function() { return db; }, { FieldValue: { arrayUnion: function() {}, arrayRemove: function() {}, serverTimestamp: function() {} } }), auth: function() { return authObj; } },
        escapeHtml: function(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;'); },
        confirm: function() { return false; },
        showToast: function() {},
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(SRC, sandbox, { filename: 'irl-sync.js' });
    ['viewEvent', 'toggleRSVP', 'editEvent', 'deleteEvent', 'submitEditEvent'].forEach(function(n) {
        sandbox['_real_' + n] = sandbox[n];
    });
    function stubActions() {
        ['viewEvent', 'toggleRSVP', 'editEvent', 'deleteEvent', 'submitEditEvent'].forEach(function(n) {
            sandbox[n] = function(id) { calls.push([n, id]); };
        });
    }
    return { win: sandbox, els: els, appended: appended, calls: calls, stubActions: stubActions };
}
async function flush() { for (let i = 0; i < 20; i++) await new Promise(function(r) { setImmediate(r); }); }

function rows() {
    const r = { evtA_1: { title: 'Meetup', date: '2099-01-01T18:00:00Z', locationName: 'Here', hostId: 'host1', attendees: [] } };
    H.ODD_IDS.forEach(function(id, i) { r[id] = { title: 'Odd' + i, date: '2099-01-02T18:00:00Z', locationName: H.ODD_NAMES[i % 3], hostId: 'host1', attendees: [] }; });
    return r;
}

test('event grid skips odd ids and keeps attributes intact', async function() {
    const t = load(rows());
    t.win.renderIRLSync();
    await flush();
    const html = t.els.eventGrid.innerHTML;
    assert.ok(html.indexOf('data-irl-action="view"') !== -1, 'grid rendered');
    assert.ok(!/MARKQ[1-8](?!\d)/.test(html));
    assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
    H.handlerTexts(html).forEach(function(h) { assert.ok(!/evtA_1|MARKQ/.test(h), h); });
    const ids = H.readTags(html).map(function(x) { return x.attrs['data-id']; }).filter(Boolean);
    assert.deepStrictEqual(Array.from(new Set(ids)), ['evtA_1']);
});

test('grid clicks route valid ids and drop odd ones', async function() {
    const t = load(rows());
    t.win.renderIRLSync();
    await flush();
    t.stubActions();
    const grid = t.els.eventGrid;
    H.click(grid, { 'data-irl-action': 'view', 'data-id': 'evtA_1' });
    H.click(grid, { 'data-irl-action': 'rsvp', 'data-id': 'evtA_1' });
    H.ODD_IDS.forEach(function(id) {
        ['view', 'rsvp', 'rsvp-detail', 'edit', 'delete', 'submit-edit'].forEach(function(a) { H.click(grid, { 'data-irl-action': a, 'data-id': id }); });
    });
    H.click(grid, { 'data-irl-action': 'constructor', 'data-id': 'evtA_1' });
    assert.deepStrictEqual(t.calls, [['viewEvent', 'evtA_1'], ['toggleRSVP', 'evtA_1']]);
});

test('detail and edit views carry ids only in data attributes', async function() {
    const t = load(rows());
    await t.win._real_viewEvent('evtA_1');
    const overlay = t.appended[0];
    assert.ok(overlay, 'detail rendered');
    const html = overlay.innerHTML;
    H.handlerTexts(html).forEach(function(h) { assert.ok(!/evtA_1/.test(h), h); });
    assert.deepStrictEqual(H.strayAttrs(html, ALLOWED), []);
    t.stubActions();
    ['rsvp-detail', 'edit', 'delete'].forEach(function(a) {
        const tag = H.readTags(html).find(function(x) { return x.attrs['data-irl-action'] === a; });
        assert.ok(tag, a);
        H.click(overlay, tag.attrs);
    });
    assert.deepStrictEqual(t.calls, [['toggleRSVP', 'evtA_1'], ['editEvent', 'evtA_1'], ['deleteEvent', 'evtA_1']]);

    const t2 = load(rows());
    await t2.win._real_editEvent('evtA_1');
    const edit = t2.appended[0];
    assert.ok(edit && /data-irl-action="submit-edit"/.test(edit.innerHTML));
    H.handlerTexts(edit.innerHTML).forEach(function(h) { assert.ok(!/evtA_1/.test(h), h); });
});

test('event actions refuse odd ids', async function() {
    const t = load(rows());
    for (const id of H.ODD_IDS) {
        await t.win._real_viewEvent(id);
        await t.win._real_editEvent(id);
    }
    assert.strictEqual(t.appended.length, 0);
    assert.strictEqual(t.win._irlIdOk('a'.repeat(128)), true);
    assert.strictEqual(t.win._irlIdOk('a'.repeat(129)), false);
});

run();
