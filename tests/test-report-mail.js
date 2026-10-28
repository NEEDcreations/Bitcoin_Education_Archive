#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const mail = require('../functions/src/reportMail');

const root = path.join(__dirname, '..');
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
    } catch (err) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
    }
}

async function testAsync(name, fn) {
    try {
        await fn();
        console.log('  ok  ' + name);
    } catch (err) {
        failed++;
        console.log('  FAIL ' + name + ': ' + (err && err.message ? err.message : err));
    }
}

function memoryDb() {
    const docs = new Map();
    function ref(docPath) {
        return {
            path: docPath,
            collection: function(name) {
                return { doc: function(id) { return ref(docPath + '/' + name + '/' + id); } };
            },
            get: function() {
                if (!docs.has(docPath)) {
                    return Promise.resolve({ exists: false, data: function() { return undefined; } });
                }
                const data = JSON.parse(JSON.stringify(docs.get(docPath)));
                return Promise.resolve({ exists: true, data: function() { return data; } });
            },
            set: function(data) {
                docs.set(docPath, JSON.parse(JSON.stringify(data)));
                return Promise.resolve();
            },
        };
    }
    return {
        docs: docs,
        collection: function(name) {
            return { doc: function(id) { return ref(name + '/' + id); } };
        },
        runTransaction: function(fn) {
            const tx = {
                get: function(r) { return r.get(); },
                set: function(r, data) { docs.set(r.path, JSON.parse(JSON.stringify(data))); },
            };
            return Promise.resolve().then(function() { return fn(tx); });
        },
    };
}

function sample(id) {
    return {
        path: 'reports/' + id,
        source: 'User report (profiles, DMs, marketplace, or Buddy)',
        reason: 'spam',
        reporterName: 'phil',
        reportedName: 'alice',
        reporterUid: 'reporter1',
        reportedUid: 'victim123456',
        target: 'alice',
        excerpt: '',
        link: '',
        atMs: Date.UTC(2026, 9, 28, 16, 30, 0),
    };
}

test('subject, ET, escaped html, short uids, and a 300-character cap', function() {
    const when = Date.UTC(2026, 9, 28, 16, 30, 0);
    assert.strictEqual(mail.formatEt(when), 'Oct 28, 2026, 12:30 PM ET');
    assert.strictEqual(mail.shortUid('reporter1'), 'report');
    assert.strictEqual(mail.shortUid('ab'), 'ab');
    const nasty = '<script>alert(1)</script> & "quote"';
    assert.ok(mail.escHtml(nasty).indexOf('<') === -1);
    assert.ok(mail.escHtml(nasty).includes('&lt;script&gt;'));
    const long = 'A'.repeat(400) + 'TAIL';
    const built = mail.buildEmail({
        source: 'Topic comment',
        reason: 'comment',
        reporterName: 'phil <admin>',
        reportedName: 'alice',
        reporterUid: 'reporter1',
        reportedUid: 'victim123456',
        target: long,
        excerpt: 'mail me at secret@example.com from 203.0.113.4 ' + long,
        link: 'https://bitcoineducation.quest/#topic=mining&post=post1',
        atMs: when,
    }, [], 0);
    assert.strictEqual(built.to, 'info.603btc@gmail.com');
    assert.ok(built.subject.indexOf('[BQ] Report: comment on ') === 0);
    assert.ok(built.subject.length < 220);
    assert.ok(!built.subject.includes('\n'));
    assert.ok(built.html.includes('&lt;admin&gt;') || built.html.includes('phil &lt;admin&gt;'));
    assert.ok(!built.html.includes('<script>'));
    assert.ok(!built.html.includes('secret@example.com'));
    assert.ok(!built.html.includes('203.0.113.4'));
    assert.ok(built.html.includes('[redacted]'));
    assert.ok(!built.html.includes('reporter1'));
    assert.ok(!built.html.includes('victim123456'));
    assert.ok(built.html.includes('(report)'));
    assert.ok(built.html.includes('(victim)'));
    assert.ok(built.html.includes('12:30 PM ET'));
    assert.ok(built.html.includes('Topic comment'));
    assert.ok(built.html.includes('topic=mining'));
    assert.ok(built.html.includes('post=post1'));
    assert.ok(!built.html.includes('TAIL'));
    assert.ok(!built.text.includes('TAIL'));
    assert.ok(!built.text.includes('secret@example.com'));
    const excerptLine = built.text.split('\n').filter(function(line) { return line.indexOf('Excerpt: ') === 0; })[0];
    assert.ok(excerptLine);
    assert.ok(excerptLine.length <= 'Excerpt: '.length + mail.EXCERPT_MAX);
});

test('ten sends then the next email summarises what was held', function() {
    let limit = null;
    const now = 1_700_000_000_000;
    for (let i = 0; i < mail.MAX_PER_HOUR; i++) {
        const step = mail.applyLimit(limit, sample('r' + i), now);
        assert.strictEqual(step.send, true, 'send ' + i);
        limit = step.limit;
    }
    assert.strictEqual(limit.sent, 10);
    const heldA = mail.applyLimit(limit, Object.assign(sample('h1'), { reason: 'harassment' }), now);
    assert.strictEqual(heldA.send, false);
    const heldB = mail.applyLimit(heldA.limit, Object.assign(sample('h2'), { reason: 'scam' }), now);
    assert.strictEqual(heldB.send, false);
    assert.strictEqual(heldB.limit.held.length, 2);
    const nextReport = Object.assign(sample('next'), { reason: 'impersonation' });
    const next = mail.applyLimit(heldB.limit, nextReport, now + mail.HOUR_MS);
    assert.strictEqual(next.send, true);
    assert.strictEqual(next.limit.sent, 1);
    assert.strictEqual(next.limit.held.length, 0);
    assert.strictEqual(next.prior.length, 2);
    const built = mail.buildEmail(nextReport, next.prior, next.overflow);
    assert.ok(built.subject === '[BQ] Report: impersonation on alice');
    assert.ok(built.text.includes('Also stored since the last email:'));
    assert.ok(built.text.includes('harassment'));
    assert.ok(built.text.includes('scam'));
    assert.ok(built.html.includes('Also stored since the last email'));
    assert.ok(!built.html.includes('reporter1'));
});

test('held list caps and the overflow is named on the next email', function() {
    let limit = null;
    const now = 1_700_000_000_000;
    for (let i = 0; i < mail.MAX_PER_HOUR; i++) {
        limit = mail.applyLimit(limit, sample('s' + i), now).limit;
    }
    for (let i = 0; i < mail.HELD_MAX; i++) {
        const step = mail.applyLimit(limit, sample('h' + i), now);
        assert.strictEqual(step.send, false);
        limit = step.limit;
    }
    const extra = mail.applyLimit(limit, sample('extra'), now);
    assert.strictEqual(extra.limit.held.length, mail.HELD_MAX);
    assert.strictEqual(extra.limit.heldOverflow, 1);
    const next = mail.applyLimit(extra.limit, sample('next'), now + mail.HOUR_MS);
    const built = mail.buildEmail(sample('next'), next.prior, next.overflow);
    assert.ok(built.text.includes('1 more report was stored and is not listed.'));
    assert.ok(built.html.includes('1 more report was stored and is not listed.'));
});

test('a foreign link is dropped', function() {
    const built = mail.buildEmail(Object.assign(sample('x'), {
        link: 'https://evil.example/phish',
    }), [], 0);
    assert.ok(!built.html.includes('evil.example'));
    assert.ok(!built.text.includes('Admin link'));
});

function userEvent(id, over) {
    const data = Object.assign({
        reportedUid: 'victim123456',
        reportedName: 'alice',
        reporterUid: 'reporter1',
        reporterName: 'phil',
        reason: 'spam',
        status: 'pending',
        createdAt: { toMillis: function() { return Date.UTC(2026, 9, 28, 16, 30, 0); } },
        email: 'hidden@example.com',
        ip: '198.51.100.20',
    }, over || {});
    return { params: { reportId: id }, data: { data: function() { return data; } } };
}

(async function main() {
    await testAsync('handlers mail the three paths and share one hourly cap', async function() {
        const db = memoryDb();
        const sent = [];
        let now = 1_700_000_000_000;
        await db.collection('users').doc('reporter1').set({
            username: 'phil',
            email: 'phil@example.com',
            ip: '203.0.113.9',
        });
        await db.collection('users').doc('author9').set({
            username: 'ada',
            email: 'ada@example.com',
        });
        await db.collection('beats_tracks').doc('track1').set({
            title: 'Orange Pill',
            artist: 'ada',
            authorId: 'author9',
            email: 'track@example.com',
        });
        await db.collection('topic_discussions').doc('mining').collection('posts').doc('post1').set({
            name: 'alice',
            uid: 'victim123456',
            text: '<b>hello</b> ' + 'A'.repeat(400) + 'TAIL',
            email: 'post@example.com',
        });
        await db.collection('reports').doc('kept').set({ reportedUid: 'victim123456', reason: 'spam' });
        const handlers = mail.createReportHandlers({
            db: db,
            now: function() { return now; },
            sendMail: async function(msg) { sent.push(msg); },
        });
        await handlers.onUserReport(userEvent('rep1'));
        assert.strictEqual(sent.length, 1);
        assert.strictEqual(sent[0].to, 'info.603btc@gmail.com');
        assert.strictEqual(sent[0].subject, '[BQ] Report: spam on alice');
        assert.ok(sent[0].html.includes('User report (profiles, DMs, marketplace, or Buddy)'));
        assert.ok(sent[0].html.includes('12:30 PM ET'));
        assert.ok(!sent[0].html.includes('hidden@example.com'));
        assert.ok(!sent[0].html.includes('198.51.100.20'));
        assert.ok(!sent[0].html.includes('phil@example.com'));
        assert.ok(!sent[0].text.includes('hidden@example.com'));
        assert.ok(db.docs.has('reports/kept'));

        await handlers.onBeatsReport({
            params: { reportId: 'beat1' },
            data: { data: function() {
                return {
                    trackId: 'track1',
                    reporterId: 'reporter1',
                    reason: 'stolen beat email me at thief@example.com from 203.0.113.4',
                    createdAt: { toMillis: function() { return Date.UTC(2026, 9, 28, 16, 30, 0); } },
                };
            } },
        });
        assert.strictEqual(sent.length, 2);
        assert.ok(sent[1].subject.indexOf('[BQ] Report: ') === 0);
        assert.ok(sent[1].subject.includes(' on Orange Pill'));
        assert.ok(!sent[1].subject.includes('thief@example.com'));
        assert.ok(!sent[1].html.includes('thief@example.com'));
        assert.ok(!sent[1].html.includes('203.0.113.4'));
        assert.ok(!sent[1].html.includes('track@example.com'));
        assert.ok(!sent[1].html.includes('ada@example.com'));
        assert.ok(sent[1].html.includes('Beats track'));
        assert.ok(sent[1].html.includes('#beats/track1'));
        assert.ok(sent[1].html.includes('ada'));
        assert.ok(!sent[1].html.includes('author9'));

        await handlers.onTopicReport({
            params: { channelId: 'mining', postId: 'post1', reportId: 'reporter1' },
            data: { data: function() {
                return { uid: 'reporter1', reason: '', createdAtMs: Date.UTC(2026, 9, 28, 16, 30, 0) };
            } },
        });
        assert.strictEqual(sent.length, 3);
        assert.ok(sent[2].subject.indexOf('[BQ] Report: comment on ') === 0);
        assert.ok(sent[2].html.includes('Topic comment'));
        assert.ok(sent[2].html.includes('&lt;b&gt;hello&lt;/b&gt;'));
        assert.ok(!sent[2].html.includes('<b>'));
        assert.ok(!sent[2].html.includes('TAIL'));
        assert.ok(!sent[2].html.includes('post@example.com'));
        assert.ok(!sent[2].html.includes('victim123456'));
        assert.ok(sent[2].html.includes('topic=mining'));
        assert.ok(sent[2].html.includes('post=post1'));

        for (let i = 0; i < 7; i++) await handlers.onUserReport(userEvent('more' + i, { reason: 'scam' }));
        assert.strictEqual(sent.length, 10);
        await handlers.onUserReport(userEvent('over', { reason: 'harassment' }));
        assert.strictEqual(sent.length, 10);
        assert.ok(db.docs.has('reports/kept'));
        now += mail.HOUR_MS;
        await handlers.onUserReport(userEvent('after', { reason: 'impersonation' }));
        assert.strictEqual(sent.length, 11);
        assert.ok(sent[10].text.includes('Also stored since the last email:'));
        assert.ok(sent[10].text.includes('harassment'));
        assert.ok(sent[10].html.includes('Also stored since the last email'));
        assert.strictEqual(sent[10].subject, '[BQ] Report: impersonation on alice');
    });

    await testAsync('a failed send retries once and does not spend a second slot', async function() {
        const db = memoryDb();
        const sent = [];
        let down = true;
        const handlers = mail.createReportHandlers({
            db: db,
            now: function() { return 1_700_000_000_000; },
            sendMail: async function(msg) {
                if (down) throw new Error('smtp down');
                sent.push(msg);
            },
        });
        await assert.rejects(function() { return handlers.onUserReport(userEvent('rep1')); });
        down = false;
        await handlers.onUserReport(userEvent('rep1'));
        await handlers.onUserReport(userEvent('rep1'));
        assert.strictEqual(sent.length, 1);
        const limit = db.docs.get('report_mail_limits/reporter1');
        assert.strictEqual(limit.sent, 1);
    });

    await testAsync('wiring reads the two secrets and not functions.config()', async function() {
        const src = fs.readFileSync(path.join(root, 'functions/src/reportMail.js'), 'utf8');
        const index = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
        assert.ok(!src.includes('functions.config'));
        assert.ok(index.includes("defineSecret('REPORT_MAIL_USER')"));
        assert.ok(index.includes("defineSecret('REPORT_MAIL_PASS')"));
        const section = index.slice(index.indexOf('Instant mail for user reports'));
        assert.ok(section.includes('exports.onUserReportCreated'));
        assert.ok(section.includes('exports.onBeatsReportCreated'));
        assert.ok(section.includes('exports.onTopicCommentReportCreated'));
        assert.ok(section.includes("document: 'reports/{reportId}'"));
        assert.ok(section.includes("document: 'beats_reports/{reportId}'"));
        assert.ok(section.includes('topic_discussions/{channelId}/posts/{postId}/reports/{reportId}'));
        assert.ok(section.includes('secrets: [reportMailUser, reportMailPass]'));
        assert.ok(section.includes('nodemailer'));
        assert.ok(section.includes('reportMailUser.value()'));
        assert.ok(section.includes('reportMailPass.value()'));
        assert.ok(!section.includes('functions.config'));
        assert.strictEqual(mail.MAIL_TO, 'info.603btc@gmail.com');
        assert.strictEqual(mail.MAX_PER_HOUR, 10);
        assert.strictEqual(mail.EXCERPT_MAX, 300);
    });

    console.log(failed ? '\n' + failed + ' failed' : '\nreport mail ok');
    process.exit(failed ? 1 : 0);
})();
