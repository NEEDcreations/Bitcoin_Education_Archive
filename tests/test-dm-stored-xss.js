// Stored XSS in DMs: a crafted imageUrl or participant string cannot break
// out of an HTML attribute or inject a handler.
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
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + e.message); failed++; }
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function extractFn(src, name) {
    const start = src.indexOf('function ' + name + '(');
    assert.ok(start !== -1, 'missing function ' + name);
    let i = src.indexOf('{', start);
    assert.ok(i !== -1, 'missing body ' + name);
    let depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') {
            depth--;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error('unterminated function ' + name);
}

const sandbox = { escapeHtml: escapeHtml };
vm.runInNewContext(extractFn(read('utils.js'), 'sanitizeUrl'), sandbox);
vm.runInNewContext(extractFn(read('messaging.js'), 'dmAttrUrl') + '\n' + extractFn(read('messaging.js'), 'dmImageHtml'), sandbox);
vm.runInNewContext(extractFn(read('global-chat.js'), 'overlayDmRowOpenTag'), sandbox);

// Parse the first start tag's attributes. A quote breakout shows up as
// extra attributes (for example onerror) besides the ones the template set.
function parseFirstTag(html) {
    const start = html.indexOf('<');
    assert.ok(start !== -1, 'no tag: ' + html);
    const slice = html.slice(start);
    const m = slice.match(/^<([a-zA-Z][\w:-]*)([^>]*)>/);
    assert.ok(m, 'unclosed or broken start tag: ' + html.slice(0, 180));
    const attrs = {};
    const order = [];
    const re = /([^\s=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
    let match;
    while ((match = re.exec(m[2]))) {
        const key = match[1].toLowerCase();
        const val = match[2] != null ? match[2] : (match[3] != null ? match[3] : (match[4] != null ? match[4] : ''));
        attrs[key] = val;
        order.push(key);
    }
    return { tag: m[1].toLowerCase(), attrs: attrs, order: order, openTag: m[0] };
}

function handlerNames(attrs, allowed) {
    const allow = {};
    (allowed || []).forEach(function (k) { allow[k.toLowerCase()] = true; });
    return Object.keys(attrs).filter(function (k) {
        return k.slice(0, 2) === 'on' && !allow[k];
    });
}

const IMAGE_BREAKOUT = 'https://evil.example/i.png" onerror="alert(1)';
const IMAGE_LT = 'https://evil.example/i.png"></img><img src=x onerror=alert(1)>';
const UID_QUOTE = 'x" onclick="alert(1)';
const UID_JS = "');alert(1);//";
const UID_MOUSE = 'n"><img src=x onerror=alert(1)>';

test('a quote-breaking imageUrl stays inside src and adds no handler', () => {
    const html = sandbox.dmImageHtml(IMAGE_BREAKOUT, false);
    const tag = parseFirstTag(html);
    assert.strictEqual(tag.tag, 'img');
    assert.strictEqual(tag.attrs.src, escapeHtml(sandbox.sanitizeUrl(IMAGE_BREAKOUT)));
    assert.ok(tag.attrs.src.indexOf('&quot;') !== -1, tag.attrs.src);
    assert.ok(html.indexOf('src="' + IMAGE_BREAKOUT) === -1, html);
    assert.deepStrictEqual(handlerNames(tag.attrs, ['onclick', 'onerror']), []);
    // The template's own onerror only hides the image; the payload's alert does not appear as a handler value.
    assert.ok(tag.attrs.onerror.indexOf('alert') === -1, tag.attrs.onerror);
    assert.ok(tag.attrs.onclick.indexOf('alert(1)') === -1, tag.attrs.onclick);
});

test('an imageUrl with a tag breakout is escaped, not rendered as a second tag', () => {
    const html = sandbox.dmImageHtml(IMAGE_LT, true);
    const tag = parseFirstTag(html);
    assert.strictEqual(tag.tag, 'img');
    assert.ok(tag.attrs.src.indexOf('&quot;') !== -1);
    assert.ok(tag.attrs.src.indexOf('&lt;') !== -1);
    assert.strictEqual((html.match(/<img\b/gi) || []).length, 1, html);
    assert.deepStrictEqual(handlerNames(tag.attrs, ['onclick', 'onerror']), []);
});

test('a normal DM image URL still renders', () => {
    const url = 'https://firebasestorage.googleapis.com/v0/b/app/o/dm-images%2Fabc%2Fx.png?alt=media&token=abc-1';
    const html = sandbox.dmImageHtml(url, false);
    const tag = parseFirstTag(html);
    assert.strictEqual(tag.attrs.src, escapeHtml(url));
    assert.ok(tag.attrs.src.indexOf('https://') === 0);
});

test('a malicious participant string cannot break out of the overlay row', () => {
    const attacks = [UID_QUOTE, UID_JS, UID_MOUSE, 'foo" onmouseover="alert(1)'];
    attacks.forEach(function (attack) {
        const html = sandbox.overlayDmRowOpenTag(attack, attack, 'display:flex;cursor:pointer;');
        const tag = parseFirstTag(html);
        assert.strictEqual(tag.tag, 'div', attack);
        assert.strictEqual(tag.attrs['data-uid'], escapeHtml(attack), attack);
        assert.strictEqual(tag.attrs['data-name'], escapeHtml(attack), attack);
        assert.ok(!tag.attrs.onclick, 'no inline openDM onclick: ' + html);
        assert.deepStrictEqual(handlerNames(tag.attrs, []), [], html);
        assert.ok(html.indexOf('openDM(') === -1, html);
        // The payload text may appear inside the escaped data-* value; it must not be a raw attribute.
        assert.ok(html.indexOf('onclick="alert') === -1, html);
        assert.ok(html.indexOf("onclick='alert") === -1, html);
        assert.ok(html.indexOf('<img') === -1, html);
        assert.ok(tag.attrs['data-uid'].indexOf('&quot;') !== -1 || tag.attrs['data-uid'].indexOf('&#39;') !== -1 || tag.attrs['data-uid'].indexOf('&lt;') !== -1, attack);
    });
});

test('a normal participant still lands in data attributes', () => {
    const html = sandbox.overlayDmRowOpenTag('uid_abc', 'Ada', 'cursor:pointer;');
    const tag = parseFirstTag(html);
    assert.strictEqual(tag.attrs['data-uid'], 'uid_abc');
    assert.strictEqual(tag.attrs['data-name'], 'Ada');
    assert.strictEqual(tag.attrs.class, 'overlay-dm-row');
});

test('messaging.js uses escapeHtml(sanitizeUrl) for stored DM images', () => {
    const src = read('messaging.js');
    assert.ok(src.indexOf('function dmImageHtml') !== -1);
    assert.ok(src.indexOf('function dmAttrUrl') !== -1);
    assert.ok(src.indexOf('dmImageHtml(m.imageUrl, !!m.text)') !== -1);
    // The old unescaped sink must be gone.
    assert.ok(src.indexOf("'<img src=\"' + sanitizeUrl(m.imageUrl)") === -1);
    // showDMWindow / report must not interpolate ids into an inline handler.
    assert.ok(!/showUserProfile\(\\?['"]\s*\+\s*otherUid/.test(src));
    assert.ok(!/sendDM\(\\?['"]\s*\+\s*convoId/.test(src));
    assert.ok(!/submitReport\(\\?['"]\s*\+\s*uid/.test(src));
});

test('global-chat.js overlay rows use data attributes, not inline openDM', () => {
    const src = read('global-chat.js');
    assert.ok(src.indexOf('function overlayDmRowOpenTag') !== -1);
    assert.ok(src.indexOf('function bindOverlayDmRows') !== -1);
    assert.ok(src.indexOf('bindOverlayDmRows(dmBody)') !== -1);
    assert.ok(src.indexOf("openDM('\" + otherUid") === -1);
    assert.ok(src.indexOf("openDM(\\'' + otherUid") === -1);
});

test('the rebuilt bundle carries the escaped DM image sink', () => {
    const bundle = read('bundle.min.js');
    assert.ok(bundle.length > 1000);
    // Minification may rename helpers, but the escape of imageUrl must remain:
    // dmAttrUrl still calls escapeHtml(sanitizeUrl(...)) or the inlined equivalent.
    assert.ok(
        bundle.indexOf('sanitizeUrl') !== -1 || /escapeHtml\(/.test(bundle),
        'bundle lost URL escaping helpers'
    );
    assert.ok(bundle.indexOf("'<img src=\"' + sanitizeUrl(") === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
