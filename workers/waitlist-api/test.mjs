// node workers/waitlist-api/test.mjs  (needs miniflare; set MINIFLARE_PATH or NODE_PATH)
// Runs the Worker in workerd via Miniflare with a local D1 and a mocked outbound fetch.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
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

// Live-forwarding config with Substack mocked.
const live = { SUBSTACK_DRY_RUN: '0', SUBSTACK_PUBLICATION: 'https://603btc.substack.com', ALLOWED_ORIGINS: ORIGIN, TURNSTILE_SECRET: 'test-secret-not-real' };
let { mf, db } = await makeMf(live);

let r = await post(mf, { email: '  Alice@Example.COM ', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.0.1' });
let d = await r.json();
ok(r.status === 200 && d.ok === true && !d.retry, 'valid email -> 200 ok');
let row = await db.prepare('SELECT * FROM waitlist WHERE email=?').bind('alice@example.com').first();
ok(row && row.source === 'waitlist' && row.consent === 1 && row.substack_status === 'ok' && /^\d{4}-\d\d-\d\dT/.test(row.created_at), 'stored lowercased with createdAt, source, consent');
ok(Object.keys(row).every(k => ['email','created_at','source','consent','substack_status','substack_at'].includes(k)), 'row has no IP or UA column');
const sub = calls.filter(c => c.host === '603btc.substack.com');
ok(sub.length === 1 && sub[0].path === '/api/v1/free' && JSON.parse(sub[0].body).email === 'alice@example.com', 'forwarded once to Substack /api/v1/free');

r = await post(mf, { email: 'alice@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.0.2' });
d = await r.json();
const cnt = await db.prepare('SELECT COUNT(*) n FROM waitlist').first();
ok(r.status === 200 && d.ok && cnt.n === 1 && calls.filter(c => c.host === '603btc.substack.com').length === 1, 'duplicate is idempotent: same answer, one row, no second forward');

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

substackMode = 'fail';
r = await post(mf, { email: 'bob@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.3.1' });
d = await r.json();
row = await db.prepare('SELECT * FROM waitlist WHERE email=?').bind('bob@example.com').first();
ok(r.status === 200 && d.ok && d.retry === true && row && row.substack_status === 'error_500', 'Substack failure: stored, success with retry flag');
substackMode = 'ok';
r = await post(mf, { email: 'bob@example.com', consent: 'on', 'cf-turnstile-response': 'good' }, { ip: '10.0.3.2' });
row = await db.prepare('SELECT * FROM waitlist WHERE email=?').bind('bob@example.com').first();
ok(row.substack_status === 'ok', 'resubmit after Substack failure retries the forward');

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
ok(r.status === 200 && d.dryRun === true && row.substack_status === 'dry_run' && calls.length === 0, 'dry run: stored, JSON body accepted, zero outbound calls');
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
