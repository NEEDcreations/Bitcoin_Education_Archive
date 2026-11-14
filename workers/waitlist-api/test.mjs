// node workers/waitlist-api/test.mjs  (needs miniflare; set MINIFLARE_PATH or NODE_PATH)
// Runs the Worker in workerd via Miniflare with a local D1 and a mocked outbound fetch.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { notifySignup, formatEt, handleWaitlist } from './worker.js';
const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(process.env.MINIFLARE_PATH || import.meta.url);
const { Miniflare } = require('miniflare');

let pass = 0, fail = 0;
const ok = (c, name) => { if (c) { pass++; console.log('ok   ' + name); } else { fail++; console.log('FAIL ' + name); } };

const calls = [];
let substackMode = 'ok';
async function outbound(req) {
  const u = new URL(req.url);
  calls.push({ host: u.host, path: u.pathname, body: await req.text() });
  if (u.host === 'challenges.cloudflare.com') {
    return new Response(JSON.stringify({ success: calls.at(-1).body.includes('response=good') }), { headers: { 'content-type': 'application/json' } });
  }
  if (u.host === '603btc.substack.com') {
    if (substackMode === 'fail') return new Response('nope', { status: 500 });
    return new Response('{}', { status: 200 });
  }
  return new Response('unexpected host', { status: 599 });
}

async function makeMf(bindings) {
  const mf = new Miniflare({
    workers: [{
      name: 'waitlist-api',
      modules: true,
      scriptPath: join(here, 'worker.js'),
      compatibilityDate: '2026-08-01',
      d1Databases: ['DB'],
      bindings,
      outboundService: outbound,
    }],
  });
  const db = await mf.getD1Database('DB');
  for (const stmt of readFileSync(join(here, 'schema.sql'), 'utf8').split(';').map(s => s.replace(/--.*$/gm, '').trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }
  return { mf, db };
}
const ORIGIN = 'https://bitcoineducation.quest';
const post = (mf, body, { ip = '203.0.113.1', origin = ORIGIN, accept = 'application/json', form = true } = {}) =>
  mf.dispatchFetch('https://bitcoineducation.quest/api/waitlist', {
    method: 'POST', redirect: 'manual',
    headers: { origin, accept, 'cf-connecting-ip': ip, 'content-type': form ? 'application/x-www-form-urlencoded' : 'application/json' },
    body: form ? new URLSearchParams(body).toString() : JSON.stringify(body),
  });

// Live config. The Worker must not call Substack; status is browser.
const live = { SUBSTACK_DRY_RUN: '0', SUBSTACK_PUBLICATION: 'https://603btc.substack.com', ALLOWED_ORIGINS: ORIGIN, TURNSTILE_SECRET_KEY: 'test-secret-not-real' };
let { mf, db } = await makeMf(live);

let r = await post(mf, { email: '  Alice@Example.COM ', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.0.1' });
let d = await r.json();
ok(r.status === 200 && d.ok === true && !d.retry, 'valid email -> 200 ok');
let row = await db.prepare('SELECT * FROM waitlist WHERE email=?').bind('alice@example.com').first();
ok(row && row.source === 'waitlist' && row.consent === 1 && row.substack_status === 'browser' && /^\d{4}-\d\d-\d\dT/.test(row.created_at), 'stored lowercased with createdAt, source, consent, browser status');
ok(Object.keys(row).every(k => ['email','created_at','source','consent','substack_status','substack_at'].includes(k)), 'row has no IP or UA column');
const sub = calls.filter(c => c.host === '603btc.substack.com');
ok(sub.length === 0, 'Worker does not POST to Substack; the browser does');

r = await post(mf, { email: 'alice@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.0.2' });
d = await r.json();
const cnt = await db.prepare('SELECT COUNT(*) n FROM waitlist').first();
ok(r.status === 200 && d.ok && !d.retry && cnt.n === 1 && calls.filter(c => c.host === '603btc.substack.com').length === 0, 'duplicate is idempotent: same answer, one row, no server Substack call');

for (const bad of ['', 'nope', 'a@b', 'a b@example.com', 'x@example.123', '<script>@x.com', 'a'.repeat(250) + '@x.com']) {
  r = await post(mf, { email: bad, consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.1.' + bad.length % 250 });
  ok(r.status === 400, 'invalid rejected: ' + JSON.stringify(bad.slice(0, 20)));
}
r = await post(mf, { email: 'noconsent@example.com', 'cf-turnstile-response': 'good' }, { ip: '10.0.2.1' });
ok(r.status === 400, 'missing consent rejected');
r = await post(mf, { email: 'bot@example.com', consent: 'on', 'cf-turnstile-response': 'bad' }, { ip: '10.0.2.2' });
ok(r.status === 403, 'failed Turnstile rejected');
r = await post(mf, { email: 'evil@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.2.3', origin: 'https://evil.example' });
ok(r.status === 403, 'foreign Origin rejected');
r = await post(mf, { email: 'hp@example.com', consent: 'on', website: 'spam', 'cf-turnstile-response': 'good' }, { ip: '10.0.2.4' });
ok(r.status === 200 && !(await db.prepare('SELECT 1 FROM waitlist WHERE email=?').bind('hp@example.com').first()), 'honeypot: fake success, nothing stored');
r = await mf.dispatchFetch('https://bitcoineducation.quest/api/waitlist');
ok(r.status === 405, 'GET -> 405');

await db.prepare("INSERT INTO waitlist (email, created_at, source, consent, substack_status) VALUES ('bob@example.com', '2026-11-14T18:00:00Z', 'waitlist', 1, 'error_403')").run();
r = await post(mf, { email: 'bob@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.3.1' });
d = await r.json();
row = await db.prepare('SELECT * FROM waitlist WHERE email=?').bind('bob@example.com').first();
ok(r.status === 200 && d.ok && !d.retry && row && row.substack_status === 'browser', 'prior error_403 is marked browser and returned ok so the page can subscribe');
ok(calls.filter(c => c.host === '603btc.substack.com').length === 0, 'resubmit of an old error row still does not POST to Substack from the Worker');

r = await post(mf, { email: 'carol@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.4.1', accept: 'text/html' });
ok(r.status === 303 && r.headers.get('location') === '/waitlist?s=ok', 'no-JS form post -> 303 back to /waitlist?s=ok');

let limited = false;
for (let i = 0; i < 8; i++) {
  r = await post(mf, { email: `rl${i}@example.com`, consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.9.9.9' });
  if (r.status === 429) limited = true;
}
ok(limited, 'rate limit per IP (fallback limiter, 5/min)');
await mf.dispose();

// Dry-run: no Substack call at all, and no Turnstile secret -> 503 unless TURNSTILE_OPTIONAL=1.
calls.length = 0;
({ mf, db } = await makeMf({ SUBSTACK_DRY_RUN: '1', ALLOWED_ORIGINS: ORIGIN }));
r = await post(mf, { email: 'dry@example.com', consent: 'on' }, { ip: '10.5.0.1' });
ok(r.status === 503, 'no Turnstile secret configured -> 503 (fails closed)');
await mf.dispose();
({ mf, db } = await makeMf({ SUBSTACK_DRY_RUN: '1', ALLOWED_ORIGINS: ORIGIN, TURNSTILE_OPTIONAL: '1' }));
r = await post(mf, { email: 'dry@example.com', consent: 'on' }, { ip: '10.5.0.2', form: false });
d = await r.json();
row = await db.prepare('SELECT * FROM waitlist WHERE email=?').bind('dry@example.com').first();
ok(r.status === 200 && d.ok && !d.dryRun && row.substack_status === 'browser' && calls.length === 0, 'stored as browser, JSON body accepted, zero outbound calls (including no Substack)');
await mf.dispose();

// No Firebase anywhere in the page, page script, or Worker.
const repo = join(here, '..', '..');
const files = ['waitlist.html', 'waitlist.js'].map(f => join(repo, f)).concat(readdirSync(here).filter(f => /\.(js|toml|sql)$/.test(f)).map(f => join(here, f)));
const fb = files.filter(f => /firebase|firestore|gstatic\.com\/firebasejs|cloudfunctions|bundle(\.min)?\.js|ranking\.js|\bapp\.js/i.test(readFileSync(f, 'utf8').replace(/no Firebase|independent of Firebase|Firebase-free|No Firestore|no Firestore/gi, '')));
ok(fb.length === 0, 'no Firebase/app JS reference in page or Worker' + (fb.length ? ': ' + fb.join(', ') : ''));
const html = readFileSync(join(repo, 'waitlist.html'), 'utf8');
const visible = html.replace(/<style[\s\S]*?<\/style>/g, '').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ');
ok(!/bitcoin/i.test(visible), 'no "bitcoin" in visible page text (title/meta included)');
ok(!/bitcoin/i.test(html.match(/<title>.*<\/title>/)[0] + html.match(/name="description"[^>]*/)[0]), 'title + description have no "bitcoin"');

// Direct notify tests, including a stored Substack status of 'browser'.
const et = formatEt(new Date('2026-11-14T18:07:00Z'));
ok(/ET$/.test(et) && /2026/.test(et), 'formatEt uses America/New_York and an ET label');
const direct = [];
await notifySignup({ NOTIFY: { send: async (msg) => { direct.push(msg); } } }, { email: 'pat@example.com', at: 'Saturday, November 14, 2026, 1:07:00 PM ET', total: 3, substack: 'browser' });
ok(direct[0] && direct[0].subject === 'New Citadel Spark waitlist signup' && /Substack forward: browser/.test(direct[0].text) && /Total signups: 3/.test(direct[0].text), 'notify body uses whatever Substack status the row stores, including browser');
let threw = false;
try {
    await notifySignup({ NOTIFY: { send: async () => { throw Object.assign(new Error('nope'), { code: 'E_TEST' }); } } }, { email: 'x@example.com', at: et, total: 1, substack: 'ok' });
} catch (_) { threw = true; }
ok(!threw, 'notifySignup swallows send failures');

// handleWaitlist + waitUntil notify, with a mock D1 (Miniflare bindings cannot hold functions).
const store = new Map();
function mockDb() {
    return {
        prepare(sql) {
            const api = (args = []) => ({
                async run() {
                    if (/INSERT/.test(sql)) {
                        const email = args[0];
                        if (store.has(email)) return { meta: { changes: 0 } };
                        store.set(email, { email, created_at: args[1], source: 'waitlist', consent: 1, substack_status: /'browser'/.test(sql) ? 'browser' : 'pending' });
                        return { meta: { changes: 1 } };
                    }
                    if (/UPDATE/.test(sql)) {
                        const [status, at, email] = args;
                        const row = store.get(email);
                        if (row) { row.substack_status = status; row.substack_at = at; }
                        return { meta: { changes: row ? 1 : 0 } };
                    }
                    return { meta: { changes: 0 } };
                },
                async first() {
                    if (/COUNT/.test(sql)) return { n: store.size };
                    const email = args[0];
                    const row = store.get(email);
                    if (!row) return null;
                    if (/substack_status/.test(sql)) return { substack_status: row.substack_status };
                    return row;
                },
            });
            return { bind(...args) { return api(args); }, ...api([]) };
        },
    };
}
const prevFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
    const u = String(url);
    if (u.includes('turnstile')) {
        const body = opts && opts.body ? String(opts.body) : '';
        return new Response(JSON.stringify({ success: body.includes('response=good') }), { headers: { 'content-type': 'application/json' } });
    }
    if (u.includes('substack')) return new Response('{}', { status: 200 });
    return new Response('unexpected', { status: 599 });
};
function postReq(body) {
    return new Request('https://bitcoineducation.quest/api/waitlist', {
        method: 'POST',
        headers: { origin: ORIGIN, accept: 'application/json', 'content-type': 'application/json', 'cf-connecting-ip': '10.7.0.1' },
        body: JSON.stringify(body),
    });
}
const waited = [];
const notices2 = [];
const env2 = {
    SUBSTACK_DRY_RUN: '0',
    SUBSTACK_PUBLICATION: 'https://603btc.substack.com',
    ALLOWED_ORIGINS: ORIGIN,
    TURNSTILE_SECRET_KEY: 'test-secret-not-real',
    DB: mockDb(),
    NOTIFY: {
        async send(msg) { notices2.push(msg); return { messageId: 't' }; },
    },
};
r = await handleWaitlist(postReq({ email: 'erin@example.com', consent: true, 'cf-turnstile-response': 'good' }), env2, { waitUntil(p) { waited.push(p); } });
d = await r.json();
await Promise.all(waited);
ok(r.status === 200 && d.ok && notices2.length === 1 && /Email: erin@example.com/.test(notices2[0].text) && /Substack forward: browser/.test(notices2[0].text) && /Total signups: 1/.test(notices2[0].text) && / ET/.test(notices2[0].text), 'new signup waitUntil-notifies with email, ET time, count, and Substack status');
waited.length = 0;
r = await handleWaitlist(postReq({ email: 'erin@example.com', consent: true, 'cf-turnstile-response': 'good' }), env2, { waitUntil(p) { waited.push(p); } });
await Promise.all(waited);
ok(r.status === 200 && notices2.length === 1, 'duplicate does not send a second notification');
r = await handleWaitlist(postReq({ email: 'nope@example.com', consent: true, 'cf-turnstile-response': 'bad' }), env2, { waitUntil(p) { waited.push(p); } });
ok(r.status === 403 && notices2.length === 1, 'failed Turnstile still returns 403 and does not notify');

// Pre-marked browser status: no server Substack call, notify shows "browser".
store.set('fran@example.com', { email: 'fran@example.com', created_at: new Date().toISOString(), source: 'waitlist', consent: 1, substack_status: 'browser' });
// Force a new insert path: remove and let handleWaitlist insert as pending, then we'll also test a new row already set to browser via conflict-less update.
// Simulate the upcoming page flow: insert happens with status already 'browser' (another worker may change the INSERT). Seed a fresh email after hooking run().
const envBrowser = {
    ...env2,
    DB: {
        prepare(sql) {
            const api = (args = []) => ({
                async run() {
                    if (/INSERT/.test(sql)) {
                        const email = args[0];
                        if (store.has(email)) return { meta: { changes: 0 } };
                        store.set(email, { email, created_at: args[1], source: 'waitlist', consent: 1, substack_status: 'browser' });
                        return { meta: { changes: 1 } };
                    }
                    return { meta: { changes: 0 } };
                },
                async first() {
                    if (/COUNT/.test(sql)) return { n: store.size };
                    const row = store.get(args[0]);
                    return row ? { substack_status: row.substack_status } : null;
                },
            });
            return { bind(...args) { return api(args); }, ...api([]) };
        },
    },
};
const substackCallsBefore = (globalThis.fetch + ''); // reset by counting in a wrapper
let substackPosts = 0;
const innerFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
    if (String(url).includes('substack')) { substackPosts++; return new Response('{}', { status: 200 }); }
    return innerFetch(url, opts);
};
waited.length = 0;
r = await handleWaitlist(postReq({ email: 'glen@example.com', consent: true, 'cf-turnstile-response': 'good' }), envBrowser, { waitUntil(p) { waited.push(p); } });
d = await r.json();
await Promise.all(waited);
ok(r.status === 200 && d.ok && !d.retry && substackPosts === 0 && notices2.some(n => /Email: glen@example.com/.test(n.text) && /Substack forward: browser/.test(n.text)), 'browser-status signup skips server Substack forward and notifies with stored status');

const waitedThrow = [];
const envThrow = {
    ...env2,
    DB: mockDb(),
    NOTIFY: { async send() { throw Object.assign(new Error('nope'), { code: 'E_TEST' }); } },
};
store.clear();
r = await handleWaitlist(postReq({ email: 'dana@example.com', consent: true, 'cf-turnstile-response': 'good' }), envThrow, { waitUntil(p) { waitedThrow.push(p); } });
d = await r.json();
await Promise.all(waitedThrow);
ok(r.status === 200 && d.ok && store.has('dana@example.com'), 'notify failure never breaks the signup response');
globalThis.fetch = prevFetch;

const pageJs = readFileSync(join(repo, 'waitlist.js'), 'utf8');
ok(pageJs.includes('https://603btc.substack.com/api/v1/free?nojs=true') && pageJs.includes('wlSubstackFrame') && pageJs.includes("show('ok')"), 'page posts to Substack nojs endpoint in a hidden iframe and shows the confirm-inbox message');
ok(/Check your inbox to confirm/.test(pageJs), 'success copy tells the visitor to check their inbox to confirm');
const cspSrc = readFileSync(join(repo, 'workers/seo-router/worker.js'), 'utf8');
ok(/function isWaitlistPath/.test(cspSrc) && /allowSubstackSubscribe/.test(cspSrc) && /form-action 'self'" \+ \(allowSubstackSubscribe \? " https:\/\/603btc\.substack\.com"/.test(cspSrc), 'seo-router allows Substack form-action and frame-src only on the waitlist path');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
