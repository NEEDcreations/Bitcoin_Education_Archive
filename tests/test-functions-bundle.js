#!/usr/bin/env node
// A Cloud Functions deploy uploads only functions/. The tier module has to
// load from that tree, with nothing from the site root beside it.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const functionsDir = path.join(root, 'functions');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log('✅ ' + name); passed++; }
    catch (e) { console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e)); failed++; }
}

test('the server tier module is inside functions/ and matches the browser file', () => {
    const service = fs.readFileSync(path.join(functionsDir, 'src', 'referralService.js'), 'utf8');
    const backfill = fs.readFileSync(path.join(functionsDir, 'scripts', 'backfill_referral_maxi_count.js'), 'utf8');
    assert.ok(service.includes("require('../referral-tiers')"));
    assert.strictEqual(service.includes("require('../../referral-tiers')"), false);
    assert.ok(backfill.includes("require('../referral-tiers')"));
    assert.strictEqual(backfill.includes('../../referral-tiers'), false);
    assert.ok(fs.existsSync(path.join(functionsDir, 'referral-tiers.js')));
    assert.strictEqual(
        fs.readFileSync(path.join(root, 'referral-tiers.js'), 'utf8'),
        fs.readFileSync(path.join(functionsDir, 'referral-tiers.js'), 'utf8')
    );
});

test('functions/index.js resolves from a copy of functions/ alone', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fn-only-'));
    const dest = path.join(tmp, 'functions');
    fs.cpSync(functionsDir, dest, {
        recursive: true,
        filter: function (src) {
            return src.split(path.sep).indexOf('node_modules') === -1;
        }
    });
    fs.symlinkSync(path.join(functionsDir, 'node_modules'), path.join(dest, 'node_modules'));
    assert.strictEqual(fs.existsSync(path.join(tmp, 'referral-tiers.js')), false);
    const result = spawnSync(process.execPath, ['-e', [
        'require("./src/referralService.js");',
        'const tiers = require("./referral-tiers.js");',
        'if (tiers.MAXI_RANK_POINTS !== 2140) throw new Error("threshold");',
        'try { require("./index.js"); }',
        'catch (e) {',
        '  const msg = String(e && e.message || e);',
        '  if (msg.indexOf("referral-tiers") !== -1 || msg.indexOf("Cannot find module") !== -1) throw e;',
        '}'
    ].join('\n')], { cwd: dest, encoding: 'utf8' });
    if (result.status !== 0) {
        throw new Error((result.stderr || result.stdout || 'load failed').slice(0, 500));
    }
    fs.rmSync(tmp, { recursive: true, force: true });
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
