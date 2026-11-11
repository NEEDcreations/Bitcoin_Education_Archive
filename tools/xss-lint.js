#!/usr/bin/env node
// XSS sink inventory + lint (no CI needed).
//
//   node tools/xss-lint.js                 lint: fail on NEW risky sinks vs baseline
//   node tools/xss-lint.js --inventory F   write every sink (JSON) to F
//   node tools/xss-lint.js --update-baseline   accept the current set (needs review!)
//
// Risky (fails when new):
//   INLINE_DYN   an on*= handler built in a string with a concatenated / ${} value
//   HTML_DYN     innerHTML / outerHTML / insertAdjacentHTML / document.write / .html()
//                whose same statement interpolates a value that is not wrapped in an
//                escaper (BQSafe.esc, escapeHtml, esc, fEsc, …) or a number coercion
//   URL_DYN      href= / src= / action= / formaction= built from an unwrapped value
//   EVAL         eval(, new Function(, setTimeout/setInterval with a string
// Reported only:
//   INLINE_STATIC  constant on*= handler (blocks dropping CSP 'unsafe-inline')
//   HTML_STATIC    HTML sink with constant / pre-built content
//   MSG            addEventListener('message') listeners
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const BASELINE = path.join(__dirname, 'xss-lint-baseline.json');

const SKIP = [/^tests\//, /^tools\//, /(^|\/)node_modules\//, /^bundle(\.min|\.src)?\.js$/, /\.src$/, /^data\//,
    /^docs\//, /^og\//, /^dev\//, /\.min\.js$/, /^functions\/(scripts|private-bank)\//];
function files() {
    let list;
    try { list = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 }).split('\n'); }
    catch (_) { list = []; }
    // include untracked new files under the repo root too (new modules)
    try { list = list.concat(execSync('git ls-files --others --exclude-standard', { cwd: ROOT, encoding: 'utf8' }).split('\n')); } catch (_) {}
    return [...new Set(list)].filter((f) => /\.(js|html|mjs)$/.test(f) && !SKIP.some((r) => r.test(f)) && fs.existsSync(path.join(ROOT, f)));
}

// Wrappers that make an interpolated value safe for HTML text/attribute context.
const SAFE_WRAP = /^(?:!*\s*)?(?:window\.)?(?:BQSafe\.(?:esc|attr|url|img|id|act)|escapeHtml|_?esc|escHtml|escAttr|fEsc|fId|fSafeUrl|_safeCover|sanitizeUrl|_esc|safeText|encodeURIComponent|encodeURI|Number|parseInt|parseFloat|Math\.\w+|String\(Number|JSON\.stringify|bqEsc|_e|e|h|escape\w*|sanitize\w*|safe\w*|fmt\w*|format\w*|timeAgo|fmtNum|toLocaleString)\s*\(/;
const NUMERIC = /(\.length|\.toFixed\(\d*\)|\.toLocaleString\([^)]*\)|\bMath\.\w+\([^)]*\)|^\d+(\.\d+)?$|^-?\d|^(i|j|k|n|idx|index|count|pct|percent|w|h|x|y|size|level|lvl|rank|pos|xp|sats|amount|total|num|len|width|height|delay|ms|sec|secs|min|mins|hours|days|score|points|pts|qty|max|min|step|opacity|zIndex|top|left|right|bottom)$)/i;
const USERISH = /(name|user|display|title|body|text|msg|message|comment|bio|desc|caption|reason|label|note|url|link|href|src|avatar|photo|image|img|\bid\b|Id\b|uid|author|artist|dj|seller|buyer|tag|faction|email|query|\bq\b|search|err|content|reply|post|track|playlist|listing|location|city|country|handle|nostr|npub|lnaddr|address|website|social|status|emoji|sender|recipient|from|to\b|data\.|\.val)/i;

function splitInterps(stmt) {
    // returns expressions concatenated into string literals or ${} in templates
    const out = [];
    const tpl = stmt.match(/\$\{([^}]*)\}/g) || [];
    tpl.forEach((t) => out.push(t.slice(2, -1).trim()));
    // ' + expr + '   |   " + expr + "   |  = expr +   (rough)
    const re = /['"`]\s*\+\s*([\s\S]*?)\s*\+\s*(?=['"`])/g;
    let m;
    while ((m = re.exec(stmt))) { out.push(m[1].trim()); re.lastIndex = m.index + m[0].length; }
    const tail = /['"`]\s*\+\s*([^'"`;+]+?)\s*;?\s*$/.exec(stmt);
    if (tail) out.push(tail[1].trim());
    return out.filter(Boolean);
}
function exprSafe(e) {
    e = e.replace(/^\(+|\)+$/g, '').trim();
    if (!e) return true;
    if (/^['"`][^'"`]*['"`]$/.test(e)) return true;            // literal
    if (SAFE_WRAP.test(e)) return true;
    if (NUMERIC.test(e)) return true;
    if (/^\(?\s*typeof (escapeHtml|esc|BQSafe)/.test(e)) return true; // (typeof escapeHtml==='function'?escapeHtml(x):x)
    if (/\?\s*['"`][^'"`]*['"`]\s*:\s*['"`][^'"`]*['"`]\s*$/.test(e)) return true; // cond ? 'a' : 'b'
    if (/^(true|false|null|undefined)$/.test(e)) return true;
    if (/^[A-Z_][A-Z0-9_]*$/.test(e)) return true;             // CONSTANT
    if (/^(style|css|cls|className|color|bg|border|icon|emoji|html|inner|rows|items|body|out|s|h|btns?|buttons|actions?|row|cell|extra|badge|pill)\w*$/i.test(e) && !/name|text|title|msg/i.test(e)) return true; // pre-built fragments (their own sinks are scanned)
    return false;
}

function statementFrom(lines, i) {
    let s = lines[i];
    let j = i;
    while (j < lines.length - 1 && j - i < 30 && !/;\s*(\/\/.*)?$/.test(lines[j]) && !/^\s*$/.test(lines[j + 1])) { j++; s += '\n' + lines[j]; }
    return s;
}

function scanFile(f) {
    const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const lines = src.split('\n');
    const hits = [];
    const isHtml = f.endsWith('.html');
    const add = (kind, i, snippet, extra) => hits.push(Object.assign({ file: f, line: i + 1, kind, snippet: snippet.trim().slice(0, 240) }, extra || {}));
    let inScript = !isHtml;
    for (let i = 0; i < lines.length; i++) {
        const L = lines[i];
        if (isHtml) {
            if (/<script\b/i.test(L)) inScript = true;
            if (/<\/script>/i.test(L)) { /* same line close handled below */ }
        }
        const minified = L.length > 2000;
        // --- inline handlers
        const onRe = /(?:\s|['"`])on[a-z]{3,20}\s*=\s*(\\?["'])/gi;
        let m;
        while ((m = onRe.exec(L))) {
            if (isHtml && !inScript) { add('INLINE_STATIC', i, L.slice(Math.max(0, m.index - 20), m.index + 140)); continue; }
            // inside JS: dynamic if the handler's string segment is concatenated
            // handler value: from the opening quote to the closing one (a crude
            // walk that skips over ' + expr + ' concatenations)
            const q = m[1].slice(-1);
            let k = m.index + m[0].length, depth = 0, seg = '';
            const lim = Math.min(L.length, k + (minified ? 600 : 3000));
            while (k < lim) {
                const c = L[k];
                if (c === q && depth === 0 && L[k - 1] !== '\\') break;
                if (c === "'" && /^\s*\+/.test(L.slice(k + 1))) depth = 1;          // literal ends, expr starts
                else if (c === "'" && depth === 1 && /\+\s*$/.test(L.slice(Math.max(0, k - 40), k))) depth = 0;
                seg += c; k++;
            }
            const exprs = [];
            const er = /'\s*\+\s*([\s\S]*?)\s*\+\s*'/g; let em;
            while ((em = er.exec(seg))) exprs.push(em[1]);
            const te = seg.match(/\$\{[^}]*\}/g) || [];
            te.forEach((t) => exprs.push(t.slice(2, -1)));
            const bad = exprs.filter((e) => !/^\(?\s*(BQSafe\.(jsStr|num|esc|act)|Number|parseInt|JSON\.stringify)\s*\(/.test(e.trim()) && !/^-?\d+$/.test(e.trim()));
            const dyn = bad.length > 0;
            add(dyn ? 'INLINE_DYN' : (exprs.length ? 'INLINE_SAFE' : 'INLINE_STATIC'), i, L.slice(Math.max(0, m.index - 30), m.index + 170), dyn ? { exprs: bad.slice(0, 6) } : undefined);
        }
        if (isHtml && /<\/script>/i.test(L)) inScript = false;
        if (isHtml && !inScript) continue;
        // --- HTML sinks
        const sinkRe = /(\.innerHTML\s*\+?=|\.outerHTML\s*\+?=|insertAdjacentHTML\s*\(|document\.write(?:ln)?\s*\(|\.html\s*\(\s*[^)\s])/g;
        while ((m = sinkRe.exec(L))) {
            const stmt = minified ? L.slice(m.index, m.index + 600) : statementFrom(lines, i).slice(statementFrom(lines, i).indexOf(m[0]));
            const rhs = stmt.slice(m[0].length);
            const interps = splitInterps(rhs);
            const bareVar = /^\s*([A-Za-z_$][\w$.\[\]'"]*)\s*[;)]?\s*$/.exec(rhs.split('\n')[0]);
            const unsafe = interps.filter((e) => !exprSafe(e));
            if (unsafe.length) add('HTML_DYN', i, L.slice(Math.max(0, m.index - 40), m.index + 200), { exprs: unsafe.slice(0, 8), userish: unsafe.some((e) => USERISH.test(e)) });
            else if (interps.length) add('HTML_ESCAPED', i, L.slice(Math.max(0, m.index - 40), m.index + 200), { exprs: interps.slice(0, 8) });
            else if (bareVar && !/^['"`]/.test(rhs.trim())) add('HTML_VAR', i, L.slice(Math.max(0, m.index - 40), m.index + 200), { exprs: [bareVar[1]] });
            else add('HTML_STATIC', i, L.slice(Math.max(0, m.index - 40), m.index + 160));
        }
        // --- URL attributes built from values
        const urlRe = /\s(href|src|action|formaction|xlink:href|poster|data)\s*=\s*\\?["']\s*['"]\s*\+\s*([^+]{1,120}?)\s*\+/gi;
        while ((m = urlRe.exec(L))) {
            const e = m[2].trim();
            if (!URL_SAFE.test(e) && !/^['"]/.test(e))
                add('URL_DYN', i, L.slice(Math.max(0, m.index - 20), m.index + 180), { exprs: [e], userish: USERISH.test(e) });
        }
        const tplUrl = /\s(href|src)\s*=\s*["']\$\{([^}]+)\}/gi;
        while ((m = tplUrl.exec(L))) {
            const e = m[2].trim();
            if (!URL_SAFE.test(e)) add('URL_DYN', i, L.slice(Math.max(0, m.index - 20), m.index + 180), { exprs: [e], userish: USERISH.test(e) });
        }
        if (/\.(href|src)\s*=\s*(?!['"`])[^=;]/.test(L) && !/\.(href|src)\s*=\s*(BQSafe|sanitizeUrl|_safeCover|safeUrl|location|window\.location|url\b|['"`])/.test(L) && /location\.|params|search|hash|\.url|\.link|data\./.test(L))
            add('URL_PROP', i, L.slice(0, 200));
        if (/setAttribute\(\s*['"](href|src|on\w+|style|action|formaction)['"]\s*,\s*(?!['"])/.test(L) && !/BQSafe\.|sanitizeUrl|_safeCover/.test(L))
            add('SETATTR', i, L.slice(0, 200));
        // --- eval family
        if (/(^|[^.\w])eval\s*\(|new\s+Function\s*\(|set(?:Timeout|Interval)\s*\(\s*['"`]/.test(L)) add('EVAL', i, L.slice(0, 200));
        if (/addEventListener\(\s*['"]message['"]|onmessage\s*=/.test(L)) add('MSG', i, L.slice(0, 200));
        if (/location\.(search|hash)|URLSearchParams/.test(L) && /innerHTML|insertAdjacentHTML|document\.write/.test(L)) add('URL_REFLECT', i, L.slice(0, 200));
    }
    return hits;
}

function fingerprint(h) {
    // stable across line moves: file + kind + normalized snippet
    return h.file + '|' + h.kind + '|' + h.snippet.replace(/\s+/g, ' ').slice(0, 160);
}
// A URL value is safe when it passes a scheme allowlist, optionally inside an escaper.
const URL_SAFE = /^(?:(?:BQSafe\.(?:esc|attr)|escapeHtml|escHtml|escXml|_?esc|fEsc|escAttr)\(\s*)?(?:BQSafe\.(?:url|img)|sanitizeUrl|_safeCover|fSafeUrl|safeUrl|safeHttpUrl|encodeURI)/;
const RISKY = new Set(['INLINE_DYN', 'HTML_DYN', 'URL_DYN', 'EVAL']);

function main() {
    const args = process.argv.slice(2);
    const all = [];
    files().forEach((f) => { try { all.push(...scanFile(f)); } catch (e) { console.error('scan error', f, e.message); } });
    const counts = {};
    all.forEach((h) => { counts[h.kind] = (counts[h.kind] || 0) + 1; });
    const invAt = args.indexOf('--inventory');
    if (invAt !== -1) {
        fs.writeFileSync(args[invAt + 1], JSON.stringify({ counts, hits: all }, null, 1));
        console.log('inventory written', counts);
        return 0;
    }
    const risky = all.filter((h) => RISKY.has(h.kind));
    if (args.includes('--update-baseline')) {
        const fps = [...new Set(risky.map(fingerprint))].sort();
        fs.writeFileSync(BASELINE, JSON.stringify({ note: 'Accepted pre-existing XSS-lint findings. Shrink only; never add without Security review.', count: fps.length, fingerprints: fps }, null, 1) + '\n');
        console.log('baseline updated:', fps.length);
        return 0;
    }
    let base = new Set();
    try { base = new Set(JSON.parse(fs.readFileSync(BASELINE, 'utf8')).fingerprints); } catch (_) {}
    const fresh = risky.filter((h) => !base.has(fingerprint(h)));
    console.log('xss-lint:', JSON.stringify(counts));
    if (args.includes('--summary')) {
        const byFile = {};
        risky.forEach((h) => { byFile[h.file] = byFile[h.file] || {}; byFile[h.file][h.kind] = (byFile[h.file][h.kind] || 0) + 1; });
        console.log(JSON.stringify(byFile, null, 1));
    }
    if (fresh.length) {
        console.log('❌ ' + fresh.length + ' new risky sink(s) (not in tools/xss-lint-baseline.json):');
        fresh.slice(0, 200).forEach((h) => console.log('  ' + h.file + ':' + h.line + ' ' + h.kind + '  ' + h.snippet.slice(0, 150) + (h.exprs ? '   <= ' + h.exprs.join(' | ').slice(0, 120) : '')));
        console.log('Use BQSafe.esc()/BQSafe.url()/BQSafe.act() (xss-safe.js) or textContent instead.');
        return 1;
    }
    console.log('✅ no new risky sinks (' + risky.length + ' baselined)');
    return 0;
}
if (require.main === module) process.exit(main());
module.exports = { scanFile, files, fingerprint, exprSafe, splitInterps };
