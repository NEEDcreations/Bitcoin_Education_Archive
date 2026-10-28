// A #cert/ link must not show Nacho's first-visit welcome or the tap hint.
// Those stay for a later visit that is not a certificate link.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const src = fs.readFileSync(path.join(__dirname, '..', 'nacho.js'), 'utf8');
const match = src.match(/function nachoHoldFirstVisit\(\) \{[\s\S]*?\n\}/);
assert.ok(match, 'nachoHoldFirstVisit is missing');

function hold(hash) {
    const ctx = { window: { location: { hash: hash } }, result: null };
    vm.createContext(ctx);
    vm.runInContext(match[0] + '\nresult = nachoHoldFirstVisit();', ctx);
    return ctx.result;
}

assert.strictEqual(hold('#cert/abc'), true);
assert.strictEqual(hold('#cert/'), true);
assert.strictEqual(hold('#CERT/Demo'), true);
assert.strictEqual(hold('#cert'), true);
assert.strictEqual(hold(''), false);
assert.strictEqual(hold('#home'), false);
assert.strictEqual(hold('#certificate'), false);

const welcomeAt = src.indexOf('Welcome after delay');
const spinAt = src.indexOf('Try the Daily Spin');
const welcomeGuard = src.indexOf('nachoHoldFirstVisit()', welcomeAt);
assert.ok(welcomeGuard !== -1 && welcomeGuard < spinAt, 'the welcome popup must check the certificate hash before it shows');

const hintFn = src.indexOf('function maybeShowNachoAskHint()');
const hintShow = src.indexOf('hint.hidden = false', hintFn);
const hintGuard = src.indexOf('nachoHoldFirstVisit()', hintFn);
assert.ok(hintGuard !== -1 && hintGuard < hintShow, 'the hint must check the certificate hash before it shows');
assert.ok(src.indexOf("localStorage.setItem(NACHO_HINT_KEY", hintFn) === -1 || src.indexOf("localStorage.setItem(NACHO_HINT_KEY", hintFn) > hintShow);

console.log('✅ certificate links hold Nacho\'s first visit');
