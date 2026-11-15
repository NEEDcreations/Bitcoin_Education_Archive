'use strict';
// Admin 2FA enrollment nudge: shown only to signed-in admins who have
// neither an authenticator app nor a phone factor. "Remind me later"
// hides it for the rest of the session. A Google passkey is not a factor.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('\u2705 ' + name);
        passed++;
    } catch (e) {
        console.log('\u274c ' + name + ': ' + (e && e.stack || e));
        failed++;
    }
}

function makeStorage() {
    const map = new Map();
    return {
        getItem(k) { return map.has(String(k)) ? map.get(String(k)) : null; },
        setItem(k, v) { map.set(String(k), String(v)); },
        removeItem(k) { map.delete(String(k)); },
        clear() { map.clear(); },
        _map: map,
    };
}

function makeDoc() {
    const byId = new Map();
    function makeEl(tag) {
        const el = {
            tagName: String(tag || 'div').toUpperCase(),
            _id: '',
            className: '',
            style: { cssText: '' },
            attributes: {},
            children: [],
            parentNode: null,
            _text: '',
            listeners: {},
            type: '',
            get id() { return this._id; },
            set id(v) {
                if (this._id && byId.get(this._id) === this) byId.delete(this._id);
                this._id = v;
                if (v) byId.set(v, this);
            },
            get textContent() { return this._text; },
            set textContent(v) { this._text = String(v == null ? '' : v); },
            setAttribute(k, v) { this.attributes[k] = String(v); },
            getAttribute(k) { return this.attributes[k]; },
            addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
            removeEventListener(t, fn) {
                const arr = this.listeners[t] || [];
                this.listeners[t] = arr.filter(function (x) { return x !== fn; });
            },
            click() {
                (this.listeners.click || []).forEach((fn) => fn({ target: this, preventDefault() {} }));
            },
            appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
            remove() {
                if (this.parentNode && this.parentNode.removeChild) this.parentNode.removeChild(this);
            },
            removeChild(c) {
                const i = this.children.indexOf(c);
                if (i >= 0) this.children.splice(i, 1);
                c.parentNode = null;
                if (c._id && byId.get(c._id) === c) byId.delete(c._id);
            },
            querySelector() { return null; },
            focus() {},
            scrollIntoView() {},
        };
        Object.defineProperty(el.style, 'cssText', {
            get() { return this._css || ''; },
            set(v) { this._css = String(v || ''); },
            enumerable: true,
            configurable: true,
        });
        return el;
    }
    const body = makeEl('body');
    const head = makeEl('head');
    const doc = {
        body: body,
        head: head,
        _byId: byId,
        getElementById(id) {
            const el = byId.get(id);
            if (!el) return null;
            let n = el;
            while (n.parentNode) n = n.parentNode;
            return (n === body || n === head) ? el : null;
        },
        createElement: makeEl,
        addEventListener() {},
        removeEventListener() {},
    };
    return doc;
}

function nudgeChunk() {
    const src = read('ranking.js');
    const start = src.indexOf('function bqAdminHasPhoneFactor()');
    const endMark = 'window.bqDismissAdmin2faNudgeLater = bqDismissAdmin2faNudgeLater;';
    const end = src.indexOf(endMark) + endMark.length;
    assert.ok(start > 0 && end > start, 'nudge block found');
    return src.slice(start, end);
}

function sandbox(opts) {
    const o = opts || {};
    const doc = o.doc || makeDoc();
    const sessionStorage = o.sessionStorage || makeStorage();
    const user = o.user !== undefined ? o.user : {
        uid: 'admin-1',
        isAnonymous: false,
        multiFactor: { enrolledFactors: o.phoneFactors || [] },
    };
    const win = {
        _isAdminClaim: o.admin === true,
        _mfaStatus: o.mfaStatus,
        _btcTotpHold: o.hold === true,
        showSettingsCalls: 0,
        showSettingsPageCalls: [],
        startTotpSetupCalls: 0,
    };
    const currentUser = o.currentUser !== undefined ? o.currentUser : { uid: 'admin-1', totpEnabled: o.totp === true };
    const sb = {
        window: win,
        document: doc,
        auth: { currentUser: user },
        currentUser: currentUser,
        sessionStorage: sessionStorage,
        showSettings: function () { win.showSettingsCalls++; },
        showSettingsPage: function (tab) { win.showSettingsPageCalls.push(tab); },
        startTotpSetup: function () { win.startTotpSetupCalls++; },
        setTimeout: function (fn) { fn(); return 0; },
        console: console,
        Object: Object,
        String: String,
        Promise: Promise,
    };
    sb.window.window = win;
    sb.window._isAdminClaim = win._isAdminClaim;
    sb.window._mfaStatus = win._mfaStatus;
    sb.window._btcTotpHold = win._btcTotpHold;
    vm.runInNewContext(nudgeChunk() + '\nthis.__api = { bqMaybeShowAdmin2faNudge: bqMaybeShowAdmin2faNudge, bqCloseAdmin2faNudge: bqCloseAdmin2faNudge, bqShowAdmin2faNudge: bqShowAdmin2faNudge, bqOpenAdmin2faEnrollment: bqOpenAdmin2faEnrollment, bqAdmin2faNudgeShouldShow: bqAdmin2faNudgeShouldShow, bqDismissAdmin2faNudgeLater: bqDismissAdmin2faNudgeLater, bqAdminHasPhoneFactor: bqAdminHasPhoneFactor, bqAdminHasTotpFactor: bqAdminHasTotpFactor };', sb, { filename: 'ranking-nudge.js' });
    return { doc: doc, win: win, api: sb.__api, sessionStorage: sessionStorage, sb: sb };
}

function overlay(doc) {
    return doc.getElementById('bqAdmin2faNudgeOverlay');
}

function readyAdmin(extra) {
    return Object.assign({ admin: true, totp: false, mfaStatus: { enabled: false }, phoneFactors: [] }, extra || {});
}

test('non-admins never see the nudge', function () {
    const s = sandbox({ admin: false, totp: false, mfaStatus: { enabled: false } });
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), false);
    assert.ok(!overlay(s.doc));
});

test('anonymous users never see the nudge', function () {
    const s = sandbox(readyAdmin({ user: { uid: 'anon', isAnonymous: true, multiFactor: { enrolledFactors: [] } } }));
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);
    assert.ok(!overlay(s.doc));
});

test('an admin with an authenticator app does not see the nudge', function () {
    const s = sandbox(readyAdmin({ totp: true, mfaStatus: { enabled: true } }));
    assert.strictEqual(s.api.bqAdminHasTotpFactor(), true);
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), false);
    assert.ok(!overlay(s.doc));
});

test('an admin with only a phone factor does not see the nudge', function () {
    const s = sandbox(readyAdmin({
        totp: false,
        mfaStatus: { enabled: false },
        phoneFactors: [{ uid: 'ph1', factorId: 'phone' }],
    }));
    assert.strictEqual(s.api.bqAdminHasPhoneFactor(), true);
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);
    assert.ok(!overlay(s.doc));
});

test('the nudge waits until TOTP status is known', function () {
    const s = sandbox({
        admin: true,
        totp: false,
        currentUser: null,
        mfaStatus: undefined,
        phoneFactors: [],
    });
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);
    assert.ok(!overlay(s.doc));
});

test('a loaded profile is not enough; the nudge waits for totpStatus', function () {
    const s = sandbox({
        admin: true,
        totp: false,
        currentUser: { uid: 'admin-1', totpEnabled: false },
        mfaStatus: undefined,
        phoneFactors: [],
    });
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), false);
    assert.ok(!overlay(s.doc));
});

test('the nudge closes if totpStatus later says the admin has a factor', function () {
    const s = sandbox(readyAdmin());
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), true);
    assert.ok(overlay(s.doc));
    s.win._mfaStatus = { enabled: true };
    s.sb.window._mfaStatus = { enabled: true };
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), false);
    assert.ok(!overlay(s.doc), 'overlay auto-closes once TOTP is known on');
});

test('an admin with no app TOTP and no phone sees the modal, with the right copy and buttons', function () {
    const s = sandbox(readyAdmin());
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), true);
    const el = overlay(s.doc);
    assert.ok(el, 'overlay mounted');
    assert.strictEqual(el.getAttribute('role'), 'dialog');
    assert.strictEqual(el.getAttribute('aria-modal'), 'true');
    const title = s.doc.getElementById('bqAdmin2faNudgeTitle');
    const body = s.doc.getElementById('bqAdmin2faNudgeBody');
    const phone = s.doc.getElementById('bqAdmin2faNudgePhone');
    const totp = s.doc.getElementById('bqAdmin2faNudgeTotp');
    const later = s.doc.getElementById('bqAdmin2faNudgeLater');
    assert.ok(title && body && phone && totp && later);
    assert.strictEqual(title.textContent, 'Add a second factor for admin tools');
    assert.strictEqual(phone.textContent, 'Add phone');
    assert.strictEqual(totp.textContent, 'Set up authenticator app');
    assert.strictEqual(later.textContent, 'Remind me later');
    const copy = body.textContent;
    assert.ok(copy.indexOf('fresh 2FA code') !== -1);
    assert.ok(copy.indexOf('payouts and user data') !== -1);
    assert.ok(copy.indexOf("passkey on your Google account doesn't count") !== -1 || copy.indexOf('passkey on your Google account does not count') !== -1);
    assert.ok(copy.indexOf('Add a phone number at minimum') !== -1);
    assert.ok(copy.indexOf('authenticator app (recommended, stronger)') !== -1);
    assert.ok(copy.indexOf('\u2014') === -1 && copy.indexOf('\u2013') === -1, 'no em- or en-dashes');
    assert.ok(!/Satoshimon|Citadel Spark|Bitcoin Beats|Satoshi.s Favor|Bitcoin Quest/i.test(copy), 'no public game names');
    assert.ok(!/Satoshimon|Citadel Spark|Bitcoin Beats|Satoshi.s Favor|Bitcoin Quest/i.test(title.textContent));
    assert.ok(/max-width:\s*380px/.test((el.children[0] && el.children[0].style && el.children[0].style.cssText) || ''), 'card is 380px for 390px screens');
});

test('Remind me later dismisses for this session and does not show again', function () {
    const store = makeStorage();
    const s = sandbox(readyAdmin({ sessionStorage: store }));
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), true);
    s.doc.getElementById('bqAdmin2faNudgeLater').click();
    assert.ok(!overlay(s.doc), 'overlay closed');
    assert.strictEqual(store.getItem('bqAdmin2faNudgeLater:admin-1'), '1');
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), false);
    assert.ok(!overlay(s.doc));
});

test('a new session (empty sessionStorage) shows the nudge again until a factor is added', function () {
    const s = sandbox(readyAdmin({ sessionStorage: makeStorage() }));
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), true);
    s.api.bqCloseAdmin2faNudge();
    const s2 = sandbox(readyAdmin({ sessionStorage: makeStorage() }));
    assert.strictEqual(s2.api.bqMaybeShowAdmin2faNudge(), true);
    assert.ok(overlay(s2.doc));
});

test('Add phone and Set up authenticator app open the Settings Security enrollment flows', function () {
    const s = sandbox(readyAdmin());
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), true);
    s.doc.getElementById('bqAdmin2faNudgePhone').click();
    assert.ok(!overlay(s.doc), 'modal closes before opening settings');
    assert.strictEqual(s.win.showSettingsCalls, 1);
    assert.deepStrictEqual(s.win.showSettingsPageCalls, ['security']);
    assert.strictEqual(s.win.startTotpSetupCalls, 0);

    const s2 = sandbox(readyAdmin());
    assert.strictEqual(s2.api.bqMaybeShowAdmin2faNudge(), true);
    s2.doc.getElementById('bqAdmin2faNudgeTotp').click();
    assert.ok(!overlay(s2.doc));
    assert.strictEqual(s2.win.showSettingsCalls, 1);
    assert.deepStrictEqual(s2.win.showSettingsPageCalls, ['security']);
    assert.strictEqual(s2.win.startTotpSetupCalls, 1);
});

test('the nudge is not shown while a TOS modal is open or a TOTP hold is on', function () {
    const doc = makeDoc();
    const tos = doc.createElement('div');
    tos.id = 'tosModal';
    doc.body.appendChild(tos);
    const s = sandbox(readyAdmin({ doc: doc }));
    assert.strictEqual(s.api.bqAdmin2faNudgeShouldShow(), false);

    const s2 = sandbox(readyAdmin({ hold: true }));
    assert.strictEqual(s2.api.bqAdmin2faNudgeShouldShow(), false);
});

test('signed-out or lost admin claim closes a visible nudge', function () {
    const s = sandbox(readyAdmin());
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), true);
    assert.ok(overlay(s.doc));
    s.win._isAdminClaim = false;
    s.sb.window._isAdminClaim = false;
    assert.strictEqual(s.api.bqMaybeShowAdmin2faNudge(), false);
    assert.ok(!overlay(s.doc));
});

test('hooks live in ranking.js next to claim settle, profile load, and totpStatus', function () {
    const src = read('ranking.js');
    assert.ok(src.includes('window.bqMaybeShowAdmin2faNudge = bqMaybeShowAdmin2faNudge'));
    assert.ok(src.includes("if (window._isAdminClaim === true) {\n            if (typeof window.bqMaybeShowAdmin2faNudge === 'function') window.bqMaybeShowAdmin2faNudge();"));
    assert.ok(src.includes("settleAdminClaim();\n    if (typeof window.bqMaybeShowAdmin2faNudge === 'function') window.bqMaybeShowAdmin2faNudge();"));
    assert.ok(src.includes("window._mfaStatus = data;\n    if (typeof window.bqMaybeShowAdmin2faNudge === 'function') window.bqMaybeShowAdmin2faNudge();"));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
