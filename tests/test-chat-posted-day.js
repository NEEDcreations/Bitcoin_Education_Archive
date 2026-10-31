#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const posted = require('../functions/src/chatPostedDay');

const root = path.join(__dirname, '..');
let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        Promise.resolve(fn()).then(function () {
            console.log('✅ ' + name);
            passed++;
        }).catch(function (e) {
            console.log('❌ ' + name + ': ' + (e && e.message));
            failed++;
        });
        return;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function fakeDb(docs) {
    return {
        collection: function (name) {
            return {
                doc: function (id) {
                    return { _path: name + '/' + id };
                }
            };
        },
        runTransaction: function (fn) {
            const tx = {
                get: function (ref) {
                    const data = docs[ref._path];
                    return Promise.resolve({
                        exists: data != null,
                        data: function () { return data; }
                    });
                },
                update: function (ref, patch) {
                    docs[ref._path] = Object.assign({}, docs[ref._path] || {}, patch);
                }
            };
            return fn(tx);
        }
    };
}

const noon = Date.parse('2026-10-28T18:00:00Z');
const day = '2026-10-28';

test('a real global chat post stamps the offset day and does not pay XP', async function () {
    const docs = { 'users/phil': { points: 10, orangeTickets: 3 } };
    const db = fakeDb(docs);
    const res = await posted.stampChatPostedDay(db, { uid: 'phil', text: 'gm' }, noon);
    assert.strictEqual(res.stamped, true);
    assert.strictEqual(res.day, day);
    assert.strictEqual(docs['users/phil'].chatPostedDay, day);
    assert.strictEqual(docs['users/phil'].points, 10);
    assert.strictEqual(docs['users/phil'].orangeTickets, 3);
    assert.strictEqual(docs['users/phil'].sayHiClaimedDay, undefined);
    const again = await posted.stampChatPostedDay(db, { uid: 'phil', text: 'still here' }, noon);
    assert.strictEqual(again.stamped, false);
    assert.strictEqual(again.reason, 'same-day');
});

test('bots, system posts, and empty text do not stamp', async function () {
    const docs = { 'users/phil': { points: 1 } };
    const db = fakeDb(docs);
    const skip = [
        { uid: 'nacho-bot', text: 'hi' },
        { uid: 'nacho-dj', text: 'hi' },
        { uid: 'system', text: 'hi' },
        { uid: 'tg_12345', text: 'hi' },
        { uid: 'phil', text: 'hi', isSystemPost: true },
        { uid: 'phil', text: 'hi', isNachoAuto: true },
        { uid: 'phil', text: 'hi', source: 'telegram' },
        { uid: 'phil', text: 'hi', fromTelegram: true },
        { uid: 'phil', text: 'hi', bridgedFrom: 'telegram' },
        { uid: 'phil', text: '   ' },
        { uid: 'phil' }
    ];
    for (const msg of skip) {
        const res = await posted.stampChatPostedDay(db, msg, noon);
        assert.strictEqual(res.stamped, false, JSON.stringify(msg));
    }
    assert.strictEqual(docs['users/phil'].chatPostedDay, undefined);
    const missing = await posted.stampChatPostedDay(fakeDb({}), { uid: 'phil', text: 'hi' }, noon);
    assert.strictEqual(missing.reason, 'no-user');
});

test('a gif caption counts and the next offset day stamps again', async function () {
    const docs = { 'users/phil': { chatPostedDay: '2026-10-27' } };
    const res = await posted.stampChatPostedDay(fakeDb(docs), {
        uid: 'phil',
        text: '',
        caption: 'hello',
        isGif: true
    }, noon);
    assert.strictEqual(res.stamped, true);
    assert.strictEqual(docs['users/phil'].chatPostedDay, day);
    assert.strictEqual(posted.shouldStampChatPostedDay({ uid: 'phil', text: 'hi' }, day, day), false);
    assert.strictEqual(posted.shouldStampChatPostedDay({ uid: 'phil', text: 'hi' }, day, '2026-10-29'), true);
});

test('the chat trigger records the day without changing the ticket grant', function () {
    const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    const start = index.indexOf('exports.onChatMessageCreated');
    const body = index.slice(start, index.indexOf('function _pushUidOk'));
    const grantAt = body.indexOf("grantServerTickets(data.uid, 'daily_chat_ticket')");
    const stampAt = body.indexOf('stampChatPostedDay(db, data)');
    const statsAt = body.indexOf("chatMessages: admin.firestore.FieldValue.increment(1)");
    const bothAt = body.indexOf('await Promise.all([chatDay, chatStats])');
    assert.ok(grantAt > 0);
    assert.ok(stampAt > grantAt);
    assert.ok(statsAt > stampAt);
    assert.ok(bothAt > statsAt);
    assert.ok(body.includes('Display only'));
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    const keys = rules.slice(rules.indexOf('function userProfileServerOnlyKeys()'), rules.indexOf('match /users/{userId}'));
    assert.ok(keys.includes("'chatPostedDay'"));
});

setTimeout(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
}, 50);
