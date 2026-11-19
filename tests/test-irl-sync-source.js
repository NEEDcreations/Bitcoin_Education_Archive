// irl-sync.js is built from irl-sync.js.src. This suite checks the readable
// source still matches the shipped file, so edits land in both.
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'irl-sync.js.src'), 'utf8');
const SHIPPED = fs.readFileSync(path.join(ROOT, 'irl-sync.js'), 'utf8');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); passed++; console.log('  PASS ' + name); }
    catch (e) { failed++; console.log('  FAIL ' + name + ': ' + e.message); }
}

let HAVE_TERSER = true;
try { execFileSync('terser', ['--version'], { stdio: 'pipe' }); } catch (e) { HAVE_TERSER = false; }

// Fallback when terser is missing: drops whitespace and comments outside
// strings, templates and regex literals, and the optional semicolon before a
// closing brace. Both files are terser output, so this is enough to compare.
function stripLayout(src) {
    let out = '', i = 0, tpl = [];
    const n = src.length;
    const isId = c => /[A-Za-z0-9_$\u0080-\uffff]/.test(c);
    function prevSig() { for (let j = out.length - 1; j >= 0; j--) if (out[j] !== ' ') return out[j]; return ''; }
    function prevWord() { const m = /([A-Za-z_$][\w$]*)\s*$/.exec(out); return m ? m[1] : ''; }
    let pendingSpace = false;
    function emit(s) { if (pendingSpace && out && isId(out[out.length - 1]) && isId(s[0])) out += ' '; pendingSpace = false; out += s; }
    while (i < n) {
        const c = src[i], d = src[i + 1];
        if (/\s/.test(c)) { pendingSpace = true; i++; continue; }
        if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
        if (c === '/' && d === '*') { i = src.indexOf('*/', i + 2) + 2; continue; }
        if (c === '"' || c === "'") {
            let j = i + 1; while (src[j] !== c) { if (src[j] === '\\') j++; j++; }
            emit(src.slice(i, j + 1)); i = j + 1; continue;
        }
        if (c === '`' || (c === '}' && tpl.length && tpl[tpl.length - 1] === 0)) {
            if (c === '}') tpl.pop();
            let j = i + 1;
            while (j < n) {
                if (src[j] === '\\') { j += 2; continue; }
                if (src[j] === '`') { j++; break; }
                if (src[j] === '$' && src[j + 1] === '{') { j += 2; tpl.push(0); break; }
                j++;
            }
            emit(src.slice(i, j)); i = j; continue;
        }
        if (c === '/') {
            const p = prevSig(), w = prevWord();
            if (!p || /[(,=:[!&|?{};+\-*%<>~^]/.test(p) || /^(return|typeof|case|in|of|void)$/.test(w) && out.endsWith(w)) {
                let j = i + 1, cls = false;
                while (j < n) { const e = src[j]; if (e === '\\') { j += 2; continue; } if (e === '[') cls = true; else if (e === ']') cls = false; else if (e === '/' && !cls) break; j++; }
                j++; while (/[a-z]/.test(src[j] || '')) j++;
                emit(src.slice(i, j)); i = j; continue;
            }
        }
        if (tpl.length && (c === '{')) tpl[tpl.length - 1]++;
        if (tpl.length && c === '}' && tpl[tpl.length - 1] > 0) tpl[tpl.length - 1]--;
        emit(c); i++;
    }
    return out.replace(/;(?=})/g, '').replace(/;$/, '');
}
// With terser, reprint each file from its parsed tree so layout and
// optional parentheses do not matter.
function normalize(file) {
    if (HAVE_TERSER) return execFileSync('terser', [path.join(ROOT, file)], { encoding: 'utf8' });
    return stripLayout(fs.readFileSync(path.join(ROOT, file), 'utf8'));
}

function firstDiff(a, b) {
    let k = 0;
    while (k < a.length && a[k] === b[k]) k++;
    return k;
}

console.log('irl-sync source vs shipped');

test('source is readable, not one long line', () => {
    const lines = SRC.split('\n');
    if (lines.length < 100) throw new Error('only ' + lines.length + ' lines');
    const long = lines.filter(l => l.length > 400).length;
    if (long * 20 > lines.length) throw new Error(long + ' of ' + lines.length + ' lines over 400 chars');
});

test('source has the id check, the action list and the pay map', () => {
    for (const s of ['IRL_ID_RE', 'function irlIdOk(', 'window._irlIdOk = irlIdOk', 'IRL_ACTIONS', 'irlPayMap', 'function irlNotePay(', 'window._irlEventPay']) {
        if (SRC.indexOf(s) === -1) throw new Error('missing ' + s);
    }
});

test('shipped file has the same pieces', () => {
    for (const s of ['IRL_ID_RE', 'function irlIdOk(', 'IRL_ACTIONS', 'irlPayMap', 'window._irlEventPay']) {
        if (SHIPPED.indexOf(s) === -1) throw new Error('missing ' + s);
    }
});

test('source parses', () => {
    new Function(SRC);
});

test('source and shipped file match after normalizing', () => {
    const a = normalize('irl-sync.js.src'), b = normalize('irl-sync.js');
    if (a !== b) {
        const k = firstDiff(a, b);
        throw new Error('differ at ' + k + ': ' + JSON.stringify(a.slice(Math.max(0, k - 40), k + 40)) + ' vs ' + JSON.stringify(b.slice(Math.max(0, k - 40), k + 40)));
    }
});

if (HAVE_TERSER) test('documented build of the source gives the shipped bytes', () => {
    const out = execFileSync('terser', [path.join(ROOT, 'irl-sync.js.src'), '--format', 'quote_style=3'], { encoding: 'utf8' }).replace(/\n$/, '');
    if (out !== SHIPPED) throw new Error('differ at byte ' + firstDiff(out, SHIPPED));
});
else console.log('  (terser not on PATH: byte check skipped, layout-stripped compare used)');

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
