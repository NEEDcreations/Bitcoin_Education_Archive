// Popup quests wait while the reader is typing or inside a sheet.
// Skipping does not call awardPoints and does not mark the quest submitted.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');

var activeDoc = null;

function makeEl(tag) {
    var el = {
        nodeType: 1,
        tagName: String(tag).toUpperCase(),
        id: '',
        className: '',
        hidden: false,
        value: '',
        type: 'text',
        textContent: '',
        style: {},
        childNodes: [],
        parentNode: null,
        attrs: {},
        listeners: {}
    };
    el.classList = {
        contains: function(name) {
            return (' ' + (el.className || '') + ' ').indexOf(' ' + name + ' ') !== -1;
        },
        add: function(name) {
            if (!this.contains(name)) el.className = (el.className ? el.className + ' ' : '') + name;
        },
        remove: function(name) {
            el.className = (el.className || '').split(/\s+/).filter(function(part) { return part && part !== name; }).join(' ');
        }
    };
    el.setAttribute = function(name, value) { el.attrs[name] = String(value); };
    el.getAttribute = function(name) {
        return Object.prototype.hasOwnProperty.call(el.attrs, name) ? el.attrs[name] : null;
    };
    el.hasAttribute = function(name) { return Object.prototype.hasOwnProperty.call(el.attrs, name); };
    el.appendChild = function(child) {
        if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
        el.childNodes.push(child);
        child.parentNode = el;
        return child;
    };
    el.insertBefore = function(child, before) {
        if (child.parentNode && child.parentNode.removeChild) child.parentNode.removeChild(child);
        var index = before ? el.childNodes.indexOf(before) : el.childNodes.length;
        if (index < 0) index = el.childNodes.length;
        el.childNodes.splice(index, 0, child);
        child.parentNode = el;
        return child;
    };
    el.removeChild = function(child) {
        var index = el.childNodes.indexOf(child);
        if (index >= 0) el.childNodes.splice(index, 1);
        child.parentNode = null;
        return child;
    };
    el.contains = function(node) {
        while (node) {
            if (node === el) return true;
            node = node.parentNode;
        }
        return false;
    };
    el.addEventListener = function(type, fn) {
        el.listeners[type] = el.listeners[type] || [];
        el.listeners[type].push(fn);
    };
    el.focus = function() { if (activeDoc) activeDoc.activeElement = el; };
    el.click = function() {
        (el.listeners.click || []).forEach(function(fn) {
            fn({ preventDefault: function() {}, stopPropagation: function() {} });
        });
    };
    el.querySelectorAll = function(sel) { return collect(el, sel); };
    return el;
}

function matches(el, sel) {
    sel = String(sel || '').trim();
    if (!sel || !el || el.nodeType !== 1) return false;
    if (sel.charAt(0) === '#') return el.id === sel.slice(1);
    if (sel.charAt(0) === '.') return el.classList && el.classList.contains(sel.slice(1));
    if (sel.indexOf('[contenteditable') === 0) return el.getAttribute && el.getAttribute('contenteditable') === 'true';
    return el.tagName === sel.toUpperCase();
}

function collect(root, sel) {
    var parts = String(sel || '').split(',');
    var found = [];
    function walk(node) {
        if (!node || node.nodeType !== 1) return;
        for (var i = 0; i < parts.length; i++) {
            if (matches(node, parts[i])) { found.push(node); break; }
        }
        (node.childNodes || []).forEach(walk);
    }
    (root.childNodes || []).forEach(walk);
    if (root.nodeType === 1) {
        for (var s = 0; s < parts.length; s++) {
            if (matches(root, parts[s])) { found.unshift(root); break; }
        }
    }
    return found;
}

function boot() {
    var document = {
        activeElement: null,
        addEventListener: function() {},
        createElement: makeEl,
        querySelectorAll: function(sel) { return collect(html, sel); }
    };
    activeDoc = document;
    var html = makeEl('html');
    var body = makeEl('body');
    html.appendChild(body);
    document.documentElement = html;
    document.body = body;
    document.getElementById = function(id) {
        var found = null;
        function walk(node) {
            if (!node || found) return;
            if (node.id === id) { found = node; return; }
            (node.childNodes || []).forEach(walk);
        }
        walk(html);
        return found;
    };
    var modal = makeEl('div');
    modal.id = 'questModal';
    modal.hidden = true;
    modal.style.display = 'none';
    var inner = makeEl('div');
    inner.id = 'questInner';
    modal.appendChild(inner);
    body.appendChild(modal);
    var area = makeEl('textarea');
    area.id = 'topic-discussion-input';
    body.appendChild(area);
    var sheet = makeEl('div');
    sheet.id = 'topic-convo-modal';
    sheet.hidden = true;
    body.appendChild(sheet);

    var shown = [];
    var gen = [];
    var awards = 0;
    var backs = 0;
    var sandbox = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        Date: Date,
        document: document,
        history: {
            pushState: function() {},
            back: function() { backs += 1; }
        },
        BTC_QUEST_IDLE_MS: 40,
        showQuest: function(quest) {
            shown.push(quest);
            modal.classList.add('open');
            modal.hidden = false;
            modal.style.display = 'flex';
            return quest;
        },
        closeQuest: function() {
            modal.classList.remove('open');
        },
        generateAndShowQuest: function(manual) { gen.push(manual); },
        skipQuest: function() {},
        awardPoints: function() { awards += 1; }
    };
    sandbox.window = sandbox;
    vm.runInNewContext(fs.readFileSync(path.join(root, 'quest-defer.js'), 'utf8'), sandbox, { filename: 'quest-defer.js' });
    sandbox.document = document;
    return {
        sandbox: sandbox,
        document: document,
        modal: modal,
        area: area,
        sheet: sheet,
        shown: shown,
        gen: gen,
        awards: function() { return awards; },
        backs: function() { return backs; }
    };
}

function wait(ms) {
    return new Promise(function(resolve) { setTimeout(resolve, ms); });
}

(async function() {
    var env = boot();
    var window = env.sandbox;
    assert.strictEqual(window.btcUserBusy(), false);

    env.area.focus();
    assert.strictEqual(window.btcUserBusy(), true, 'focused field');
    window.document.activeElement = window.document.body;
    assert.strictEqual(window.btcUserBusy(), false);

    env.area.value = 'unsent draft';
    assert.strictEqual(window.btcUserBusy(), true, 'visible draft');
    env.area.value = '';
    assert.strictEqual(window.btcUserBusy(), false);

    env.sheet.hidden = false;
    env.sheet.classList.add('open');
    assert.strictEqual(window.btcUserBusy(), true, 'conversation sheet');
    env.sheet.classList.remove('open');
    env.sheet.hidden = true;
    assert.strictEqual(window.btcUserBusy(), false);

    window._chatOverlayOpen = true;
    assert.strictEqual(window.btcUserBusy(), true, 'chat');
    window._chatOverlayOpen = false;

    window._btcGestureUntil = Date.now() + 10000;
    assert.strictEqual(window.btcUserBusy(), true, 'gesture');
    window._btcGestureUntil = 0;
    assert.strictEqual(window.btcUserBusy(), false);

    var opened = 0;
    window._nachoMode = true;
    assert.strictEqual(window.btcDeferQuestIfBusy(function() { opened += 1; }, 'auto'), true);
    assert.strictEqual(opened, 0);
    window.generateAndShowQuest(false);
    assert.deepStrictEqual(env.gen, []);
    window.generateAndShowQuest(true);
    assert.deepStrictEqual(env.gen, [true]);
    window._nachoMode = false;
    await wait(1200);
    assert.strictEqual(opened, 1, 'deferred opener runs once idle');
    assert.ok(env.gen.indexOf(false) !== -1, 'auto quest runs after idle');

    var quest = { id: 'quest-mining', title: 'Mining', questions: [] };
    window.showQuest(quest);
    assert.ok(window.document.getElementById('questNotNowBtn'));
    assert.strictEqual(env.modal.classList.contains('open'), true);
    var backs = env.backs();
    window.btcDismissQuest('button');
    assert.strictEqual(env.backs(), backs + 1);
    assert.strictEqual(env.modal.classList.contains('open'), true);
    assert.strictEqual(env.awards(), 0);
    assert.notStrictEqual(window._questSubmitted, true);
    window.btcDismissQuest('back');
    assert.strictEqual(env.modal.classList.contains('open'), false);
    assert.strictEqual(env.modal.style.display, 'none');
    assert.strictEqual(env.modal.style.pointerEvents, 'none');
    assert.strictEqual(env.modal.style.visibility, 'hidden');
    assert.strictEqual(env.awards(), 0);
    assert.notStrictEqual(window._questSubmitted, true);
    await wait(350);
    var pill = window.document.getElementById('btc-quest-pill');
    assert.ok(pill, 'skipped quest stays tappable');
    pill.click();
    assert.strictEqual(env.shown[env.shown.length - 1].id, 'quest-mining');
    assert.strictEqual(env.awards(), 0);
    assert.notStrictEqual(window._questSubmitted, true);

    var cancelled = 0;
    window.cancelScholar = function() { cancelled += 1; };
    window._scholarExamActive = true;
    window.btcDismissQuest('esc');
    assert.strictEqual(cancelled, 0);
    window._scholarExamActive = false;

    var bundle = fs.readFileSync(path.join(root, 'bundle.min.js'), 'utf8');
    assert.ok(bundle.indexOf('btcDeferQuestIfBusy') !== -1);
    assert.ok(bundle.indexOf('btcUserBusy') !== -1);

    console.log('✅ quest defer busy guard and reoffer');
    process.exit(0);
})().catch(function(err) {
    console.error(err);
    process.exit(1);
});
