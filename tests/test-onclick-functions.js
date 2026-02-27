// =============================================
// ONCLICK FUNCTION EXISTENCE TESTS
// Ensures every onclick handler in the app references
// a function that actually exists and is globally accessible.
// Run: node tests/test-onclick-functions.js
// =============================================
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

let passed = 0, failed = 0;

function test(name, fn) {
    try { fn(); passed++; }
    catch (e) { console.log(`❌ ${name}: ${e.message}`); failed++; }
}

// Collect all globally accessible functions from all JS files
const globalFuncs = new Set();

// Built-in / DOM methods (not our functions)
const BUILTINS = new Set([
    'if', 'return', 'this', 'event', 'function', 'document', 'window',
    'localStorage', 'sessionStorage', 'parseInt', 'parseFloat', 'Date',
    'Math', 'Object', 'Array', 'String', 'Number', 'JSON', 'console',
    'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
    'alert', 'confirm', 'prompt', 'Error', 'Promise', 'fetch',
    'encodeURIComponent', 'decodeURIComponent', 'encodeURI', 'decodeURI',
    'atob', 'btoa', 'navigator', 'location', 'history',
    // DOM methods called as .method()
    'getElementById', 'querySelector', 'querySelectorAll', 'createElement',
    'appendChild', 'removeChild', 'remove', 'classList', 'addEventListener',
    'removeEventListener', 'preventDefault', 'stopPropagation', 'focus',
    'blur', 'click', 'submit', 'reset', 'play', 'pause', 'load',
    'scrollTo', 'scrollIntoView', 'reload', 'replace', 'assign',
    'open', 'close', 'log', 'warn', 'error', 'info', 'debug',
    'push', 'pop', 'shift', 'unshift', 'splice', 'slice', 'map',
    'filter', 'forEach', 'reduce', 'find', 'findIndex', 'indexOf',
    'includes', 'join', 'split', 'replace', 'match', 'test', 'exec',
    'keys', 'values', 'entries', 'has', 'set', 'get', 'delete',
    'add', 'clear', 'toString', 'toFixed', 'toLocaleString',
    'stringify', 'parse', 'resolve', 'reject', 'then', 'catch',
    'finally', 'race', 'all', 'allSettled', 'assign', 'freeze',
    'getItem', 'setItem', 'removeItem', 'toggle', 'closest', 'back',
    'writeText', 'select', 'contains',
]);

// Scan all JS files for function definitions
const jsFiles = fs.readdirSync(root).filter(f => f.endsWith('.js') && !f.startsWith('test'));
jsFiles.forEach(file => {
    const code = fs.readFileSync(path.join(root, file), 'utf8');
    // function xxx()
    for (const m of code.matchAll(/function\s+(\w+)\s*\(/g)) {
        globalFuncs.add(m[1]);
    }
    // window.xxx = function / async function
    for (const m of code.matchAll(/window\.(\w+)\s*=\s*(?:async\s+)?function/g)) {
        globalFuncs.add(m[1]);
    }
    // window.xxx = (arrow)
    for (const m of code.matchAll(/window\.(\w+)\s*=\s*(?:async\s*)?\(/g)) {
        globalFuncs.add(m[1]);
    }
});

// Also scan inline scripts
for (const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
    const code = m[1];
    for (const fm of code.matchAll(/function\s+(\w+)\s*\(/g)) {
        globalFuncs.add(fm[1]);
    }
    for (const fm of code.matchAll(/(?:var|let|const|window\.)\s*(\w+)\s*=\s*function/g)) {
        globalFuncs.add(fm[1]);
    }
}

// Extract onclick function calls from HTML and JS-generated HTML
const allSources = [html];
jsFiles.forEach(file => {
    allSources.push(fs.readFileSync(path.join(root, file), 'utf8'));
});

const onclickFuncs = new Set();
allSources.forEach(src => {
    for (const m of src.matchAll(/onclick=["'][^"']*?(\w+)\s*\(/g)) {
        const func = m[1];
        if (!BUILTINS.has(func)) {
            onclickFuncs.add(func);
        }
    }
});

// Test each onclick function
onclickFuncs.forEach(func => {
    test(`onclick handler '${func}()' exists`, () => {
        assert(globalFuncs.has(func), `Function '${func}' referenced in onclick but never defined`);
    });
});

if (failed === 0) {
    console.log(`✅ All ${passed} onclick handlers have matching function definitions`);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
