#!/usr/bin/env node
// Every vetted KB question should show that KB answer through the real client router.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { pathToFileURL } = require('url');

const kbFile = path.join(__dirname, '../workers/nacho-search/kb-data.mjs');
if (!fs.existsSync(kbFile)) {
    console.log('KB routing skipped on this branch');
    process.exit(0);
}

function visible(html) {
    return String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

(async function main() {
    const logic = await import(pathToFileURL(path.join(__dirname, '../workers/nacho-search/nacho-logic.mjs')).href);
    const entries = logic.kbEntries();
    assert.ok(entries.length >= 1049, 'entries ' + entries.length);

    const mem = {};
    const ctx = {
        console: console,
        setTimeout: setTimeout,
        clearTimeout: clearTimeout,
        setInterval: setInterval,
        clearInterval: clearInterval,
        Date: Date,
        Promise: Promise,
        location: { hash: '', pathname: '/' },
        navigator: {},
        document: { getElementById: function () { return null; }, querySelector: function () { return null; } }
    };
    ctx.localStorage = {
        getItem: function (key) { return Object.prototype.hasOwnProperty.call(mem, key) ? mem[key] : null; },
        setItem: function (key, value) { mem[key] = String(value); },
        removeItem: function (key) { delete mem[key]; }
    };
    ctx.window = ctx;
    ctx.globalThis = ctx;
    ctx.self = ctx;
    ctx.auth = { currentUser: { getIdToken: async function () { return 'routing-token'; } } };
    ctx.fetch = async function (_url, opts) {
        const body = JSON.parse(opts.body);
        const result = await logic.answerTurn({ question: body.question }, {
            aiRun: async function () { return { response: 'MODEL_FALLBACK_NOT_KB' }; }
        });
        return { ok: true, json: async function () { return result; } };
    };
    vm.createContext(ctx);
    const root = path.join(__dirname, '..');
    vm.runInContext(fs.readFileSync(path.join(root, 'features.registry.js'), 'utf8'), ctx, { filename: 'features.registry.js' });
    vm.runInContext(fs.readFileSync(path.join(root, 'nacho-qa.js'), 'utf8'), ctx, { filename: 'nacho-qa.js' });

    const today = new Date().toISOString().slice(0, 10);
    let passed = 0;
    const missed = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        mem.btc_nacho_ai_uses = JSON.stringify({ date: today, count: 0 });
        const result = await new Promise(function (resolve) {
            ctx.nachoUnifiedAnswer(entry.question, resolve);
        });
        const shown = visible(result && result.answer);
        const want = String(entry.answer || '').replace(/\s+/g, ' ').trim();
        const hit = (result && result.kbId === entry.id) || (want && shown.indexOf(want.slice(0, Math.min(48, want.length))) !== -1);
        if (hit) passed += 1;
        else if (missed.length < 12) missed.push(entry.id + ' -> ' + shown.slice(0, 80));
    }
    const rate = passed / entries.length;
    console.log('KB routing ' + passed + '/' + entries.length + ' (' + (rate * 100).toFixed(1) + '%)');
    if (missed.length) console.log(missed.join('\n'));
    assert.ok(rate >= 0.95, 'KB routing ' + passed + '/' + entries.length);
})().catch(function (err) {
    console.error(err);
    process.exit(1);
});
