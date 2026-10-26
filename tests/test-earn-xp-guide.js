// Default disclosure state for the How to Earn XP guide.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'earn-xp-guide.js'), 'utf8');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function loadGuide(location) {
    const listeners = {};
    const els = {};
    const document = {
        els: els,
        getElementById: function (id) {
            if (id === 'earnXpDisclosureStyle') return { id: id };
            return els[id] || null;
        },
        addEventListener: function (type, fn, capture) {
            listeners[type] = fn;
            if (capture === true) listeners[type + ':capture'] = true;
        },
        createElement: function () { return { id: '', textContent: '' }; },
        head: { appendChild: function () {} },
        documentElement: { appendChild: function () {} }
    };
    const context = {
        console: console,
        document: document,
        location: location || { hash: '', search: '' },
        setTimeout: setTimeout,
        addEventListener: function () {}
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(src, context, { filename: 'earn-xp-guide.js' });
    context.document = document;
    context._listeners = listeners;
    context._els = els;
    return context;
}

function sectionsIn(html) {
    const out = [];
    const re = /id="((?:faq-)?ep_[a-z]+)_btn" class="earn-xp-toggle" aria-expanded="(true|false)" aria-controls="((?:faq-)?ep_[a-z]+)"/g;
    let match;
    while ((match = re.exec(html))) {
        const id = match[3];
        const panelAt = html.indexOf('id="' + id + '"');
        const panel = html.slice(panelAt, panelAt + 180);
        out.push({
            buttonId: match[1],
            open: match[2] === 'true',
            controls: id,
            hidden: / hidden/.test(panel)
        });
    }
    return out;
}

function fakeControl(id, open) {
    const attrs = { 'aria-expanded': open ? 'true' : 'false', 'aria-controls': id };
    const btn = {
        _earnXpFromKey: false,
        getAttribute: function (name) { return attrs[name]; },
        setAttribute: function (name, value) { attrs[name] = value; },
        closest: function (sel) { return sel === '.earn-xp-toggle' ? btn : null; }
    };
    const panel = {
        hidden: !open,
        removeAttribute: function (name) { if (name === 'hidden') panel.hidden = false; },
        setAttribute: function (name) { if (name === 'hidden') panel.hidden = true; }
    };
    return { btn: btn, panel: panel };
}

test('only Reading & Exploring starts open', function () {
    const guide = loadGuide();
    const html = guide.renderEarnXpGuide();
    const sections = sectionsIn(html);
    assert.strictEqual(sections.length, guide.EARN_XP_SECTIONS.length);
    assert.strictEqual(sections[0].controls, 'ep_read');
    assert.strictEqual(sections[0].open, true);
    assert.strictEqual(sections[0].hidden, false);
    for (let i = 1; i < sections.length; i++) {
        assert.strictEqual(sections[i].open, false, sections[i].controls);
        assert.strictEqual(sections[i].hidden, true, sections[i].controls);
        assert.strictEqual(sections[i].buttonId, sections[i].controls);
    }
    assert.ok(html.includes('min-height:44px'));
    assert.ok(html.includes('class="earn-xp-chevron"'));
    assert.ok(html.includes('✅ Daily Activities (12)'));
    assert.ok(html.includes('📚 Reading &amp; Exploring (3)'));
    assert.ok(html.includes('🎁 Gifts, Keys &amp; Ciphers (7)'));
    assert.ok(html.includes('Publish an article: <strong>30 XP</strong>, once per article, up to 2 a day, at least 300 characters and 50 words'));
    assert.ok(html.includes('type="button"'));
    const guideJs = fs.readFileSync(path.join(root, 'guide.js'), 'utf8');
    assert.ok(guideJs.includes("renderEarnXpGuide('faq-')"));
    const faq = guide.renderEarnXpGuide('faq-');
    const faqSections = sectionsIn(faq);
    assert.strictEqual(faqSections[0].open, true);
    assert.strictEqual(faqSections[0].controls, 'faq-ep_read');
    assert.strictEqual(faqSections[1].open, false);
    assert.strictEqual(faqSections[1].controls, 'faq-ep_daily');
});

test('a deep link or search opens that section', function () {
    const linked = loadGuide({ hash: '#ep_daily', search: '' });
    const html = linked.renderEarnXpGuide();
    const sections = sectionsIn(html);
    assert.strictEqual(sections[0].open, false);
    assert.strictEqual(sections[1].controls, 'ep_daily');
    assert.strictEqual(sections[1].open, true);
    assert.strictEqual(sections[1].hidden, false);
    for (let i = 0; i < sections.length; i++) {
        if (sections[i].controls !== 'ep_daily') assert.strictEqual(sections[i].open, false);
    }
    const otherHash = loadGuide({ hash: '#lightning', search: '' });
    const other = sectionsIn(otherHash.renderEarnXpGuide());
    assert.strictEqual(other[0].open, true);
    assert.strictEqual(other[0].controls, 'ep_read');
    for (let i = 1; i < other.length; i++) assert.strictEqual(other[i].open, false);
    assert.strictEqual(linked.openEarnXpSection('publish an article'), false);
    linked._els.ep_social = fakeControl('ep_social', false).panel;
    linked._els.ep_social_btn = fakeControl('ep_social', false).btn;
    const social = fakeControl('ep_social', false);
    linked._els.ep_social = social.panel;
    linked._els.ep_social_btn = social.btn;
    assert.strictEqual(linked.openEarnXpSection('Publish an article'), true);
    assert.strictEqual(social.btn.getAttribute('aria-expanded'), 'true');
    assert.strictEqual(social.panel.hidden, false);
});

test('Enter and Space toggle a section without a second click', function () {
    const guide = loadGuide();
    const made = fakeControl('ep_quiz', false);
    guide._els.ep_quiz = made.panel;
    guide._els.ep_quiz_btn = made.btn;
    const event = {
        key: 'Enter',
        target: made.btn,
        preventDefault: function () { event.prevented = true; },
        stopPropagation: function () {},
        prevented: false
    };
    assert.strictEqual(guide._listeners['click:capture'], true);
    guide._listeners.keydown(event);
    assert.strictEqual(event.prevented, true);
    assert.strictEqual(made.btn.getAttribute('aria-expanded'), 'true');
    assert.strictEqual(made.panel.hidden, false);
    guide._listeners.click({ target: made.btn, stopPropagation: function () {} });
    assert.strictEqual(made.btn.getAttribute('aria-expanded'), 'true');
    event.key = ' ';
    event.prevented = false;
    guide._listeners.keydown(event);
    assert.strictEqual(made.btn.getAttribute('aria-expanded'), 'false');
    assert.strictEqual(made.panel.hidden, true);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
