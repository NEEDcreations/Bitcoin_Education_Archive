#!/usr/bin/env node
'use strict';
// Home "what's new" banner. A 6-hour cache used to skip the refetch, so a new
// patch note never replaced a dismissed or seen one, and the banner used to
// sit inside #homeHero, which signed-in users never see.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const notFoundHtml = fs.readFileSync(path.join(root, '404.html'), 'utf8');

let passed = 0;
let failed = 0;
const queue = [];

function test(name, fn) {
    try {
        const out = fn();
        if (out && typeof out.then === 'function') {
            queue.push(out.then(function () {
                console.log('✅ ' + name);
                passed++;
            }, function (e) {
                console.log('❌ ' + name + ': ' + (e && e.message ? e.message : e));
                failed++;
            }));
            return;
        }
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

function bannerScript(html) {
    const marker = html.indexOf('window._bqPatchBanner');
    assert.ok(marker > 0);
    const start = html.lastIndexOf('<script>', marker);
    const end = html.indexOf('</script>', marker);
    assert.ok(start !== -1 && end > start);
    return html.slice(start + '<script>'.length, end);
}

function assertOutsideHomeHero(html, label) {
    const start = html.indexOf('<div id="homeHero">');
    const banner = html.indexOf('<div id="patchNotesBanner"');
    assert.ok(start !== -1 && banner > start, label);
    const between = html.slice(start, banner);
    let depth = 0;
    let closed = false;
    const re = /<\/?div\b/g;
    let m;
    while ((m = re.exec(between))) {
        if (m[0] === '</div') {
            depth--;
            if (depth === 0) closed = true;
        } else {
            depth++;
        }
    }
    assert.strictEqual(depth, 0, label + ' div depth');
    assert.strictEqual(closed, true, label + ' hero closed before banner');
}

function Parser() {}
Parser.prototype.parseFromString = function (src) {
    const html = String(src);
    const id = (html.match(/<details[^>]*id="([^"]+)"/) || [])[1] || '';
    const title = (html.match(/class="patch-title">([^<]*)</) || [])[1] || '';
    const date = (html.match(/class="patch-date">([^<]*)</) || [])[1] || '';
    return {
        querySelector: function (sel) {
            if (sel !== 'details.patch[id]' || !id || !title) return null;
            return {
                id: id,
                querySelector: function (s) {
                    if (s === '.patch-title') return { textContent: title };
                    if (s === '.patch-date') return { textContent: date };
                    return null;
                }
            };
        }
    };
};

function notes(id, title, date) {
    return '<details class="patch" id="' + id + '"><span class="patch-title">' + title +
        '</span><span class="patch-date">' + date + '</span></details>';
}

function boot(opts) {
    opts = opts || {};
    const store = Object.assign({}, opts.store || {});
    const els = {};
    function el() {
        return {
            hidden: true,
            textContent: '',
            href: '',
            classList: { toggle: function () {} },
            setAttribute: function () {},
            addEventListener: function (type, fn) {
                this._on = this._on || {};
                this._on[type] = fn;
            },
            focus: function () {}
        };
    }
    const timers = [];
    let fetchCalls = 0;
    const clock = opts.now == null ? Date : frozenDate(opts.now);
    const sandbox = {
        document: {
            getElementById: function (id) {
                if (!els[id]) els[id] = el();
                return els[id];
            },
            querySelectorAll: function () { return []; }
        },
        localStorage: {
            getItem: function (k) {
                return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null;
            },
            setItem: function (k, v) { store[k] = String(v); }
        },
        Date: clock,
        Math: Math,
        JSON: JSON,
        Number: Number,
        String: String,
        encodeURIComponent: encodeURIComponent,
        setTimeout: function (fn, ms) {
            timers.push({ fn: fn, ms: ms, kind: 'timeout' });
            return timers.length;
        },
        setInterval: function (fn, ms) {
            timers.push({ fn: fn, ms: ms, kind: 'interval' });
            return timers.length;
        },
        clearInterval: function () {},
        fetch: function () {
            fetchCalls++;
            const html = opts.html || '';
            return Promise.resolve({
                ok: opts.ok !== false,
                text: function () { return Promise.resolve(html); }
            });
        }
    };
    sandbox.window = sandbox;
    if (opts.domParser) sandbox.DOMParser = Parser;
    if (opts.sw) sandbox._swVersion = opts.sw;
    vm.runInNewContext(bannerScript(indexHtml), sandbox, { filename: 'patch-notes-banner.js' });
    return {
        api: sandbox._bqPatchBanner,
        els: els,
        timers: timers,
        store: store,
        sandbox: sandbox,
        fetchCalls: function () { return fetchCalls; }
    };
}

function frozenDate(now) {
    const RealDate = Date;
    function Clock() {
        const args = [RealDate];
        for (let i = 0; i < arguments.length; i++) args.push(arguments[i]);
        return new (RealDate.bind.apply(RealDate, args))();
    }
    Clock.now = function () { return now; };
    Clock.parse = RealDate.parse;
    Clock.UTC = RealDate.UTC;
    return Clock;
}

function freshCache(extra) {
    return JSON.stringify(Object.assign({
        id: 'week-2026-11-19',
        title: 'Cached note',
        released: Date.now() - 86400000,
        at: Date.now(),
        sw: 'v2690'
    }, extra || {}));
}

const DAY = 86400000;
const script = bannerScript(indexHtml);

test('index.html and 404.html keep the same banner outside the signed-in hero', function () {
    assert.strictEqual(script, bannerScript(notFoundHtml));
    assertOutsideHomeHero(indexHtml, 'index');
    assertOutsideHomeHero(notFoundHtml, '404');
    assert.ok(script.includes('A new SW version (or an expired cache) refetches immediately'));
});

test('release day is the last calendar day in the patch date, else the id', function () {
    const api = boot().api;
    assert.strictEqual(api.releaseMs('week-2026-11-19', 'November 15\u201318, 2026'), new Date(2026, 10, 18).getTime());
    assert.strictEqual(api.releaseMs('week-2026-11-19', 'November 15\u201418, 2026'), new Date(2026, 10, 18).getTime());
    assert.strictEqual(api.releaseMs('week-2026-11-19', 'November 15-18, 2026'), new Date(2026, 10, 18).getTime());
    assert.strictEqual(api.releaseMs('week-2026-11-19', 'October 31 \u2013 November 2, 2026'), new Date(2026, 10, 2).getTime());
    assert.strictEqual(api.releaseMs('week-2026-11-19', 'November 20, 2026'), new Date(2026, 10, 20).getTime());
    assert.strictEqual(api.releaseMs('week-2026-11-19', 'November 18, 2025'), new Date(2025, 10, 18).getTime());
    assert.strictEqual(api.releaseMs('week-2026-11-19', ''), new Date(2026, 10, 19).getTime());
    assert.strictEqual(api.releaseMs('no-date', ''), 0);
});

test('banner shows for 5 days, collapses, and a new release clears a dismiss', function () {
    const now = Date.parse('2026-11-20T15:00:00Z');
    const ctx = boot({ now: now });
    ctx.api.set({ id: 'week-2026-11-20', title: 'Faster Loads', released: now - 2 * DAY });
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, false);
    assert.strictEqual(ctx.els.pnBannerTitle.textContent, 'Faster Loads');
    assert.strictEqual(ctx.els.pnBannerLink.href, '/patch-notes.html#week-2026-11-20');
    assert.strictEqual(ctx.els.pnBannerRow.hidden, false);
    assert.strictEqual(ctx.els.pnBannerPill.hidden, true);

    ctx.api.set({ id: 'week&id', title: 'Amp', released: now - DAY });
    assert.strictEqual(ctx.els.pnBannerLink.href, '/patch-notes.html#week%26id');

    ctx.els.pnBannerCollapse._on.click();
    assert.strictEqual(ctx.els.pnBannerRow.hidden, true);
    assert.strictEqual(ctx.els.pnBannerPill.hidden, false);
    assert.strictEqual(JSON.parse(ctx.store.bq_pn_banner).s, 'collapsed');

    ctx.els.pnBannerPill._on.click();
    assert.strictEqual(ctx.els.pnBannerRow.hidden, false);
    ctx.els.pnBannerClose._on.click();
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, true);
    assert.strictEqual(JSON.parse(ctx.store.bq_pn_banner).s, 'dismissed');

    ctx.api.set({ id: 'week-2026-11-21', title: 'Next', released: now - 1000 });
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, false);
    assert.strictEqual(ctx.els.pnBannerTitle.textContent, 'Next');

    ctx.api.set({ id: 'week-2026-11-21', title: 'Next', released: now - 5 * DAY });
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, false);
    ctx.api.set({ id: 'week-2026-11-21', title: 'Next', released: now - 5 * DAY - 1 });
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, true);
    ctx.api.set({ id: 'week-2026-11-21', title: 'Next', released: now + DAY });
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, true);
    ctx.api.set({ id: 'week-2026-11-21', title: 'Next', released: 0 });
    assert.strictEqual(ctx.els.patchNotesBanner.hidden, true);
});

test('a new service worker version refetches immediately instead of keeping the 6h cache', function () {
    const staleSw = boot({
        sw: 'v2690',
        domParser: true,
        html: notes('week-2026-11-20', 'Faster Loads', 'November 20, 2026'),
        store: { bq_pn_latest: freshCache({ sw: 'v2684', at: Date.now() }) }
    });
    assert.strictEqual(staleSw.fetchCalls(), 1);
    assert.strictEqual(staleSw.timers.length, 0);

    const sameSw = boot({
        sw: 'v2690',
        domParser: true,
        html: notes('week-2026-11-20', 'Faster Loads', 'November 20, 2026'),
        store: { bq_pn_latest: freshCache({ sw: 'v2690', at: Date.now() }) }
    });
    assert.strictEqual(sameSw.fetchCalls(), 0);
    assert.ok(sameSw.timers.some(function (t) { return t.kind === 'timeout' && t.ms === 1500; }));
    assert.ok(!sameSw.timers.some(function (t) { return t.kind === 'interval'; }));

    const expired = boot({
        sw: 'v2690',
        domParser: true,
        store: { bq_pn_latest: freshCache({ sw: 'v2690', at: Date.now() - 6 * 3600 * 1000 }) }
    });
    assert.strictEqual(expired.fetchCalls(), 1);

    const noCache = boot({ sw: 'v2690', domParser: true, store: {} });
    assert.strictEqual(noCache.fetchCalls(), 1);
});

test('with no service worker yet, a fresh cache waits, then refetches once the version arrives', function () {
    const ctx = boot({
        domParser: true,
        html: notes('week-2026-11-20', 'Faster Loads', 'November 20, 2026'),
        store: { bq_pn_latest: freshCache({ sw: '', at: Date.now() }) }
    });
    assert.strictEqual(ctx.fetchCalls(), 0);
    assert.strictEqual(ctx.els.pnBannerTitle.textContent, 'Cached note');
    const wait = ctx.timers.filter(function (t) { return t.kind === 'interval' && t.ms === 100; });
    assert.strictEqual(wait.length, 1);

    ctx.sandbox._swVersion = 'v2690';
    wait[0].fn();
    assert.strictEqual(ctx.fetchCalls(), 1);
});

test('parsed titles are capped at 80 characters and a bad fetch leaves the cache up', async function () {
    const long = 'A'.repeat(100);
    const ctx = boot({
        sw: 'v2690',
        domParser: true,
        html: notes('week-2026-11-20', long, 'November 20, 2026'),
        store: {}
    });
    assert.strictEqual(ctx.fetchCalls(), 1);
    for (let i = 0; i < 6; i++) await Promise.resolve();
    assert.strictEqual(ctx.els.pnBannerTitle.textContent, long.slice(0, 80));
    const saved = JSON.parse(ctx.store.bq_pn_latest);
    assert.strictEqual(saved.title.length, 80);
    assert.strictEqual(saved.sw, 'v2690');
    assert.strictEqual(saved.released, new Date(2026, 10, 20).getTime());

    const failedFetch = boot({
        sw: 'v2690',
        domParser: true,
        ok: false,
        store: { bq_pn_latest: freshCache({ title: 'Keep me', sw: 'v2684' }) }
    });
    for (let i = 0; i < 6; i++) await Promise.resolve();
    assert.strictEqual(failedFetch.els.pnBannerTitle.textContent, 'Keep me');
    assert.strictEqual(JSON.parse(failedFetch.store.bq_pn_latest).title, 'Keep me');
});

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    if (failed) process.exit(1);
});
