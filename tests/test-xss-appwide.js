#!/usr/bin/env node
// =============================================
// App-wide XSS regression tests (jsdom).
//   - BQSafe helpers (xss-safe.js): esc, url, img, jsStr, act, cleanHtml
//   - the delegated action dispatcher (no inline handlers needed)
//   - utils.js escapeHtml / sanitizeUrl
//   - firestore.rules doc-id + markup guards on client-create paths
//   - tools/xss-lint.js finds no new risky sinks
// Payloads come from tests/xss/payloads.json (shared with QA's harness).
// Run: node tests/test-xss-appwide.js   (needs: cd tests/xss && npm ci)
// =============================================
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
let JSDOM;
try { ({ JSDOM } = require(path.join(__dirname, 'xss', 'node_modules', 'jsdom'))); }
catch (_) { ({ JSDOM } = require('jsdom')); }

const FIX = JSON.parse(fs.readFileSync(path.join(__dirname, 'xss', 'payloads.json'), 'utf8'));
const SAFE_SRC = fs.readFileSync(path.join(ROOT, 'xss-safe.js'), 'utf8');

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ❌ ' + msg); } }

function makeDom(extraScripts) {
    const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
        runScripts: 'dangerously', url: 'https://bitcoineducation.quest/', pretendToBeVisual: true,
    });
    const w = dom.window;
    w.__pwned = 0;
    w.alert = () => { w.__pwned = 1; };
    w.eval(SAFE_SRC);
    (extraScripts || []).forEach((s) => w.eval(s));
    return w;
}
function fire(w, el, type) {
    const Ev = type === 'click' ? w.MouseEvent : w.Event;
    el.dispatchEvent(new Ev(type, { bubbles: true, cancelable: true }));
}
function flushImages(w) { w.document.querySelectorAll('img').forEach((i) => i.dispatchEvent(new w.Event('error'))); }

// ---------------------------------------------------------------
console.log('BQSafe.esc');
{
    const w = makeDom();
    const S = w.BQSafe;
    ok(S.esc(`&<>"'\``) === '&amp;&lt;&gt;&quot;&#39;&#96;', 'esc covers & < > " \' `');
    ok(S.esc(null) === '' && S.esc(undefined) === '' && S.esc(0) === '0', 'esc null/undefined/0');
    ok(typeof w.escapeHtml === 'function' && w.escapeHtml('<b>') === '&lt;b&gt;', 'escapeHtml defined early');
    const root = w.document.getElementById('root');
    for (const p of FIX.payloads) {
        root.innerHTML = '<div title="' + S.esc(p) + '">' + S.esc(p) + '</div>' +
            "<span title='" + S.esc(p) + "'>x</span><textarea>" + S.esc(p) + '</textarea>';
        flushImages(w);
        ok(root.querySelectorAll('img,svg,script,a').length === 0, 'esc text/attr no elements: ' + JSON.stringify(p));
        ok(root.firstChild.getAttribute('title') === p, 'esc round-trips attr: ' + JSON.stringify(p));
        ok(root.querySelector('textarea').value === p, 'esc textarea round-trip: ' + JSON.stringify(p));
        const all = [...root.querySelectorAll('*')];
        ok(all.every((el) => [...el.attributes].every((a) => !/^on/i.test(a.name))), 'esc no on* attrs: ' + JSON.stringify(p));
    }
    ok(w.__pwned === 0, 'no payload executed (esc)');
}

// ---------------------------------------------------------------
console.log('BQSafe.url / img');
{
    const w = makeDom();
    const S = w.BQSafe;
    const bad = ['javascript:alert(1)', 'java\tscript:alert(1)', 'java\nscript:alert(1)', ' \u0001javascript:alert(1)',
        'JaVaScRiPt:alert(1)', 'data:text/html,<script>alert(1)</script>', 'vbscript:msgbox(1)', '//evil.example/x',
        '/\\evil.example', '\\\\evil.example', 'https:', 'https:///x', 'blob:https://x/1', 'file:///etc/passwd',
        'data:image/svg+xml;base64,PHN2Zz4=', '\u00a0javascript:alert(1)'];
    for (const u of bad) ok(S.url(u) === '', 'url rejects ' + JSON.stringify(u));
    for (const u of bad) ok(S.img(u) === '', 'img rejects ' + JSON.stringify(u));
    ok(S.url('https://example.com/a?b=1#c') === 'https://example.com/a?b=1#c', 'url keeps https');
    ok(S.url('http://example.com') === 'http://example.com', 'url keeps http');
    ok(S.url('images/x.png') === 'images/x.png' && S.url('/a/b') === '/a/b' && S.url('#forum') === '#forum', 'url keeps relative');
    ok(S.url('https://e.com/"><img src=x onerror=alert(1)>') === 'https://e.com/%22%3E%3Cimg%20src=x%20onerror=alert(1)%3E', 'url percent-encodes breakout chars');
    ok(S.url('mailto:a@b.c') === '' && S.url('mailto:a@b.c', { schemes: ['mailto'] }) === 'mailto:a@b.c', 'url scheme allowlist opt-in');
    for (const u of ['http://x.example/', 'javascript:alert(1)', '/rel', 'https:', "https://e.com/&#39;);alert(1)//"]) ok(!S.https(u) || S.https(u).indexOf("'") === -1 && /^https:\/\//.test(S.https(u)), 'https() only https and attribute-safe: ' + JSON.stringify(u));
    ok(S.https('http://x.example/') === '' && S.https('https://x.example/a') === 'https://x.example/a', 'https() https only');
    ok(S.img('data:image/png;base64,iVBORw0KGgo=') === 'data:image/png;base64,iVBORw0KGgo=', 'img keeps png data URL');
    // In a real anchor, a rejected URL must not navigate to script
    const root = w.document.getElementById('root');
    for (const p of FIX.payloads) {
        root.innerHTML = '<a id="l" href="' + S.esc(S.url(p)) + '">x</a><img src="' + S.esc(S.img(p)) + '">';
        const href = root.querySelector('a').getAttribute('href');
        ok(!/^\s*(javascript|data|vbscript):/i.test(href.replace(/[\t\n\r]/g, '')), 'href not script: ' + JSON.stringify(p));
        ok(root.querySelectorAll('img').length === 1 && root.querySelectorAll('svg,script').length === 0, 'url/img no injection: ' + JSON.stringify(p));
    }
}

// ---------------------------------------------------------------
console.log('BQSafe.jsStr inside legacy inline handlers');
{
    const w = makeDom();
    const S = w.BQSafe;
    const got = [];
    w.recv = (v) => got.push(v);
    const root = w.document.getElementById('root');
    for (const p of FIX.payloads.concat(FIX.docIdPayloads)) {
        root.innerHTML = '<button onclick="recv(\'' + S.jsStr(p) + '\')">a</button>' +
            "<button onclick='recv(\"" + S.jsStr(p) + "\")'>b</button>";
        got.length = 0;
        root.querySelectorAll('button').forEach((b) => fire(w, b, 'click'));
        ok(got.length === 2 && got[0] === p && got[1] === p, 'jsStr exact value in handler: ' + JSON.stringify(p));
    }
    ok(w.__pwned === 0, 'no payload executed (jsStr)');
    ok(S.num('1);alert(1') === 0 && S.num('42') === 42, 'num coerces');
    ok(S.lit('true') === true && S.lit('3') === 3 && S.lit('x') === 'x' && S.lit(undefined) === null, 'lit');
}

// ---------------------------------------------------------------
console.log('BQSafe.act delegated dispatcher');
{
    const w = makeDom();
    const S = w.BQSafe;
    const calls = [];
    w.openThing = function (a, b) { calls.push(['openThing', a, b, this]); };
    w.parentAct = function () { calls.push(['parentAct']); };
    w.App = { nested: { go(x) { calls.push(['nested', x]); } } };
    const root = w.document.getElementById('root');
    for (const p of FIX.payloads.concat(FIX.docIdPayloads)) {
        calls.length = 0;
        root.innerHTML = '<div' + S.act('parentAct', []) + '><button id="b"' + S.act('openThing', [p, 7]) + '>x</button></div>';
        flushImages(w);
        fire(w, w.document.getElementById('b'), 'click');
        ok(calls.length === 2 && calls[0][1] === p && calls[0][2] === 7 && calls[1][0] === 'parentAct',
            'act passes exact arg + bubbles: ' + JSON.stringify(p));
        ok(calls[0][3] === w.document.getElementById('b'), 'act this === element');
    }
    // stop: parent action skipped, other listeners on the same element still run
    calls.length = 0;
    root.innerHTML = '<div' + S.act('parentAct', []) + '><button id="b"' + S.act('openThing', ['s'], { stop: 1 }) + '>x</button></div>';
    let own = 0, outer = 0;
    w.document.getElementById('b').addEventListener('click', () => { own++; });
    root.addEventListener('click', () => { outer++; });
    fire(w, w.document.getElementById('b'), 'click');
    ok(calls.length === 1 && calls[0][0] === 'openThing', 'stop prevents parent action');
    ok(own === 1, 'stop keeps listeners on the same element (inline semantics)');
    ok(outer === 0, 'stop blocks ancestor listeners');
    // a second click must not run stale armed handlers twice
    calls.length = 0;
    fire(w, w.document.getElementById('b'), 'click');
    ok(calls.length === 1, 'one call per click (no stale handlers)');
    // EL / EV sentinels
    let seen = null;
    w.withEl = (el, ev) => { seen = [el, ev]; };
    root.innerHTML = '<span id="s"' + S.act('withEl', [S.EL, S.EV]) + '>x</span>';
    fire(w, w.document.getElementById('s'), 'click');
    ok(seen && seen[0] === w.document.getElementById('s') && seen[1] && seen[1].type === 'click', 'EL/EV sentinels');
    // dotted names
    calls.length = 0;
    root.innerHTML = '<i id="n"' + S.act('App.nested.go', ['q']) + '>x</i>';
    fire(w, w.document.getElementById('n'), 'click');
    ok(calls.length === 1 && calls[0][1] === 'q', 'dotted handler');
    // injected markup cannot call functions the page never registered
    w.evil = () => { w.__pwned = 1; };
    root.innerHTML = '<b id="e" data-bq-click="evil">x</b><b id="e2" data-bq-click="eval" data-bq-click-args=\'["window.__pwned=1"]\'>y</b>' +
        '<b id="e3" data-bq-click="openThing.constructor" data-bq-click-args=\'["window.__pwned=1"]\'>z</b>';
    ['e', 'e2', 'e3'].forEach((id) => fire(w, w.document.getElementById(id), 'click'));
    ok(w.__pwned === 0, 'unregistered / prototype handler names are ignored');
    ok(!S._allowed('evil') && !S._allowed('eval'), 'allowlist only has page-registered names');
    // window.open guard
    const opened = [];
    w.open = function (u) { opened.push(u); };
    root.innerHTML = '<a id="o1"' + S.act('open', ['javascript:alert(1)', '_blank']) + '>x</a><a id="o2"' + S.act('open', ['https://ok.example/', '_blank']) + '>y</a>';
    fire(w, w.document.getElementById('o1'), 'click');
    fire(w, w.document.getElementById('o2'), 'click');
    ok(opened.length === 1 && opened[0] === 'https://ok.example/', 'window.open only gets http(s)');
    // change / error events
    let changed = null, errored = 0;
    w.onPick = (v) => { changed = v; };
    w.onImgErr = (el) => { errored++; el.style.display = 'none'; };
    root.innerHTML = '<select id="sel"' + S.act('onPick', ['k'], { on: 'change' }) + '><option>1</option></select><img id="im" src="x"' + S.act('onImgErr', [S.EL], { on: 'error' }) + '>';
    fire(w, w.document.getElementById('sel'), 'change');
    w.document.getElementById('im').dispatchEvent(new w.Event('error'));
    ok(changed === 'k' && errored === 1, 'change + error events');
    let threw = false;
    try { S.act('alert(1)', []); } catch (_) { threw = true; }
    ok(threw, 'act rejects non-identifier handler names');
}

// ---------------------------------------------------------------
console.log('BQSafe.cleanHtml');
{
    const w = makeDom();
    const S = w.BQSafe;
    const root = w.document.getElementById('root');
    for (const p of FIX.payloads) {
        root.innerHTML = S.cleanHtml('<b>hi</b> ' + p);
        flushImages(w);
        const els = [...root.querySelectorAll('*')];
        ok(els.every((el) => /^(B|STRONG|EM|I|U|S|BR|SPAN|SMALL|CODE|DIV|P|A)$/.test(el.tagName)), 'cleanHtml tags allowlisted: ' + JSON.stringify(p));
        ok(els.every((el) => [...el.attributes].every((a) => /^(class|title|style|href)$/.test(a.name))), 'cleanHtml attrs allowlisted: ' + JSON.stringify(p));
        ok([...root.querySelectorAll('a')].every((a) => !a.hasAttribute('href') || /^#/.test(a.getAttribute('href'))), 'cleanHtml href only #: ' + JSON.stringify(p));
    }
    ok(S.cleanHtml('<b style="color:red">x</b>') === '<b style="color:red">x</b>', 'cleanHtml keeps simple formatting');
    ok(S.cleanHtml('<b style="background:url(javascript:alert(1))">x</b>') === '<b>x</b>', 'cleanHtml drops url() style');
    ok(w.__pwned === 0, 'no payload executed (cleanHtml)');
}

// ---------------------------------------------------------------
console.log('utils.js escapeHtml / sanitizeUrl');
{
    const src = fs.readFileSync(path.join(ROOT, 'utils.js'), 'utf8');
    const grab = (name) => { const m = src.match(new RegExp('function ' + name + '\\([\\s\\S]*?\\n}\\n')); return m ? m[0] : ''; };
    const w = makeDom([grab('escapeHtml'), grab('sanitizeUrl')]);
    ok(w.escapeHtml(`<>"'&\``) === '&lt;&gt;&quot;&#39;&amp;&#96;', 'utils escapeHtml escapes quote + backtick');
    for (const u of ['javascript:alert(1)', 'java\tscript:alert(1)', '\u0001javascript:x', 'vbscript:x', 'data:text/html,x', 'file:///x', 'blob:x'])
        ok(w.sanitizeUrl(u) === '', 'sanitizeUrl rejects ' + JSON.stringify(u));
    ok(!/["'<>`]/.test(w.sanitizeUrl('https://x.example/"><img onerror=1>')), 'sanitizeUrl percent-encodes breakouts');
    // DOM fallback when BQSafe is missing
    const w2 = new JSDOM('<!doctype html><body></body>', { runScripts: 'dangerously' }).window;
    w2.eval(grab('escapeHtml'));
    ok(w2.escapeHtml(`<'"\``) === '&lt;&#39;&quot;&#96;', 'escapeHtml DOM fallback escapes quotes');
}

// ---------------------------------------------------------------
console.log('Server-side escapers');
{
    const seo = fs.readFileSync(path.join(ROOT, 'workers/seo-router/worker.js'), 'utf8');
    const m = seo.match(/function escapeHtml\([\s\S]*?\n}\n/);
    ok(!!m, 'seo-router escapeHtml found');
    if (m) {
        const f = new Function(m[0] + '; return escapeHtml;')();
        ok(f(`<>"'&\``) === '&lt;&gt;&quot;&#39;&amp;&#96;', 'seo-router escapeHtml covers quote + backtick');
    }
    ok(/'Content-Security-Policy-Report-Only'/.test(seo) && /script-src-attr 'none'/.test(seo) && /\/csp-report/.test(seo), 'seo-router sends CSP phase-2 report-only');
    const fn = fs.readFileSync(path.join(ROOT, 'functions/index.js'), 'utf8');
    const e = fn.match(/function _escHtml\(s\) \{[^\n]*\}/);
    ok(!!e && new Function(e[0] + '; return _escHtml;')()(`<'"\``) === '&lt;&#39;&quot;&#96;', 'functions _escHtml (admin email) escapes quotes');
    const rss = fs.readFileSync(path.join(ROOT, 'workers/rss-feed/worker.js'), 'utf8');
    ok(!/href="(?:\$\{|' \+ )escXml\((item|body)\.link\)/.test(rss) && /safeHttpUrl\(body\.link\)/.test(rss), 'rss-feed Telegram links go through safeHttpUrl');
    const fb = JSON.parse(fs.readFileSync(path.join(ROOT, 'firebase.json'), 'utf8'));
    ok(JSON.stringify(fb).includes('Content-Security-Policy-Report-Only'), 'firebase.json has CSP report-only');
}

// ---------------------------------------------------------------
console.log('firestore.rules id + markup guards');
{
    const rules = fs.readFileSync(path.join(ROOT, 'firestore.rules'), 'utf8');
    const idRe = /^[A-Za-z0-9_-]+$/;
    ok(/function clientDocIdOk\(id, maxLen\)[\s\S]*?\^\[A-Za-z0-9_-\]\+\$/.test(rules), 'clientDocIdOk helper present');
    ok(/function noMarkup\(v\)[\s\S]*?\^\[\^<>\]\*\$/.test(rules), 'noMarkup helper present');
    for (const p of FIX.docIdPayloads) ok(!idRe.test(p), 'doc-id regex rejects ' + JSON.stringify(p));
    ok(idRe.test('aZ09_-AbCdEfGhIjKlMnOp'), 'doc-id regex accepts Firestore auto ids');
    function block(name) {
        const i = rules.search(new RegExp('match /' + name + '/\\{[A-Za-z]+\\} \\{'));
        if (i < 0) return '';
        let depth = 0, j = rules.indexOf('{', rules.indexOf('}', i));
        for (let k = j; k < rules.length; k++) {
            if (rules[k] === '{') depth++;
            else if (rules[k] === '}') { depth--; if (depth === 0) return rules.slice(i, k + 1); }
        }
        return '';
    }
    function createRule(b) {
        const m = b.match(/allow (?:create|write)[^:]*:[\s\S]*?;\n/);
        return m ? m[0] : '';
    }
    const need = ['playlists', 'forum_posts', 'forum_replies', 'marketplace_messages', 'dm_conversations', 'messages',
        'reports', 'irl_events', 'beats_tracks', 'comments', 'articles', 'article_replies', 'global_chat'];
    for (const c of need) {
        const b = block(c);
        ok(!!b, 'rules block exists: ' + c);
        ok(/(clientDocIdOk|forumDocIdOk)\(/.test(createRule(b)) || /allow create[^;]*if false/.test(b), 'client create checks doc id: ' + c);
    }
    const adm = block('admin_notifications');
    ok(/allow write: if false/.test(adm), 'admin_notifications not client-writable');
    ok(/allow write: if false/.test(block('timechain_viewers')), 'timechain_viewers not client-writable');
    const notifCreate = rules.slice(rules.indexOf('match /notifications/{notifId} {\n      allow read: if request.auth != null\n                  && request.auth.uid == resource.data.recipientId'));
    ok(/noMarkup\(request\.resource\.data\.senderName\)/.test(notifCreate) && /noMarkup\(request\.resource\.data\.message\)/.test(notifCreate), 'notifications senderName/message noMarkup');
    const typeList = (notifCreate.match(/data\.type in \[[^\]]*\]/) || [''])[0];
    ok(/quest team/.test(notifCreate) && typeList && !/'security'/.test(typeList), 'no look-alike system notices from clients');
}

// ---------------------------------------------------------------
console.log('xss-lint (no new risky sinks)');
{
    let out = '', code = 0;
    try { out = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'xss-lint.js')], { cwd: ROOT, encoding: 'utf8' }); }
    catch (e) { code = e.status; out = String(e.stdout || '') + String(e.stderr || ''); }
    ok(code === 0, 'tools/xss-lint.js passes against baseline' + (code ? '\n' + out.slice(0, 2000) : ''));
}

// ---------------------------------------------------------------
console.log('No strip-only URL handlers');
{
    const files = fs.readdirSync(ROOT).filter((f) => /\.js$/.test(f) && !/^bundle/.test(f));
    const bad = [];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
        if (/onclick=[^\n]{0,40}window\.open\(\\'' *\+ *(?!BQSafe)/.test(src)) bad.push(f + ': window.open with concatenated URL');
        if (/\(\\'' *\+ *escapeHtml\(/.test(src)) bad.push(f + ': escapeHtml inside a JS string in a handler');
    }
    ok(bad.length === 0, 'no strip-only / HTML-escaped values inside handler JS strings: ' + bad.join('; '));
    const rk = fs.readFileSync(path.join(ROOT, 'ranking.js'), 'utf8');
    ok((rk.match(/BQSafe\.act\('open', \[BQSafe\.https\(link\), '_blank'\]\)/g) || []).length === 2, 'newsletter links use https-only delegated open');
}

// ---------------------------------------------------------------
console.log('Stored-payload cleanup script is dry-run only');
{
    const tool = path.join(ROOT, 'tools', 'xss-stored-sweep-dryrun.js');
    const src = fs.readFileSync(tool, 'utf8');
    ok(!/require\(['"](firebase-admin|@google-cloud\/firestore|firebase)['"]\)/.test(src), 'cleanup script never connects to Firestore');
    ok(!/\.(set|update|delete|add)\(/.test(src.replace(/\/\/.*$/gm, '')), 'cleanup script has no write calls');
    let code = 0;
    try { execFileSync(process.execPath, [tool, '--apply'], { stdio: 'pipe' }); } catch (e) { code = e.status; }
    ok(code === 2, 'cleanup script refuses --apply');
    const out = execFileSync(process.execPath, [tool, '--json'], { encoding: 'utf8' });
    const plan = JSON.parse(out);
    ok(plan.dryRun === true && plan.plan.length >= 10, 'cleanup plan lists the stored-payload docs');
    ok(plan.plan.some((p) => /\/messages\//.test(p.shown)), 'cleanup plan covers the DM messages subdoc path');
    ok(plan.plan.every((p) => p.shown.split('/').every((seg, k) => k % 2 === 0 || /^.{1,4}…$/.test(seg))), 'built-in plan only shows masked ids');
    const { proposeClean } = require(tool);
    for (const p of FIX.payloads) ok(!/[<>]|\bon[a-z]+\s*=|javascript:/i.test(proposeClean(p)), 'proposeClean strips markup: ' + JSON.stringify(p));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
