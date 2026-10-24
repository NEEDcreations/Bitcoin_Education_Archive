#!/usr/bin/env node
// Live chat and shoutouts keep the gh-pages scam patterns, with no warning-word skip.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const current = require('../functions/src/chatProfanity');
const blocked = [
    "Don't sleep on this: guaranteed 10x returns, DM me",
    "Double your bitcoin today, don't miss it",
    'Never seen this before? send me 2 btc and get 4'
];

function loadGhPages() {
    const src = execFileSync('git', ['show', 'origin/gh-pages:functions/src/chatProfanity.js'], { encoding: 'utf8' });
    const sandbox = { module: { exports: {} }, exports: {} };
    sandbox.module.exports = sandbox.exports;
    vm.runInNewContext(src, sandbox, { filename: 'gh-pages-chatProfanity.js' });
    return sandbox.module.exports;
}

const previous = loadGhPages();
const source = fs.readFileSync(path.join(__dirname, '../functions/src/chatProfanity.js'), 'utf8');
assert.ok(!/warningOrQuestion/.test(source), 'warning skip must stay out of the chat filter');

blocked.forEach(function (text) {
    assert.strictEqual(previous.classifyChatText(text), 'scam', 'gh-pages classify ' + text);
    assert.strictEqual(previous.chatTextBlocked(text), 'scam', 'gh-pages blocked ' + text);
    assert.strictEqual(current.classifyChatText(text), previous.classifyChatText(text), 'classify ' + text);
    assert.strictEqual(current.chatTextBlocked(text), previous.chatTextBlocked(text), 'blocked ' + text);
});

assert.strictEqual(current.classifyChatText('How do people get scammed with guaranteed returns?'), 'scam');
assert.strictEqual(current.classifyChatText('hello there'), '');
console.log('chat scam regression ok');
