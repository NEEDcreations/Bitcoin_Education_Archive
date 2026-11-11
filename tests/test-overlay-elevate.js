// Dynamic overlays must be elevated above the settings modal (z-index 2100008).
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const stack = fs.readFileSync(path.join(root, 'popup-stack.js'), 'utf8');
assert.ok(stack.indexOf('btcElevateOverlay') !== -1);
assert.ok(stack.indexOf('7000000') !== -1);
assert.ok(stack.indexOf('MutationObserver') !== -1);

const quests = fs.readFileSync(path.join(root, 'quests.js'), 'utf8');
assert.ok(quests.indexOf("z-index:7000000") !== -1);
assert.strictEqual(quests.indexOf('z-index:490000'), -1, 'cosmetics pickers must sit above settings');
assert.ok(quests.indexOf('btcElevateOverlay') !== -1);

const favor = fs.readFileSync(path.join(root, 'satoshi-favor.js'), 'utf8');
assert.ok(favor.indexOf('clampSfTip') !== -1);
assert.ok(favor.indexOf('translateX') !== -1);

console.log('✅ overlays elevate above the settings modal; SF tip clamps');
