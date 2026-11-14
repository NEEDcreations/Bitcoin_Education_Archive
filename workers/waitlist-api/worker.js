/**
 * waitlist-api: POST /api/waitlist for bitcoineducation.quest/waitlist.
 *
 * Independent of Firebase and of the app kill switch: no Firestore, no app JS,
 * no Cloud Functions. Stores our own copy of the list in D1 and forwards the
 * email to the 603BTC Substack free-subscribe endpoint.
 *
 * Stored per row: email (trimmed, lowercased), created_at, source='waitlist',
 * consent=1, substack_status, substack_at. No IP, no user agent, no referrer.
 *
 * Bindings (wrangler.toml): DB (D1), RL (rate limit, optional),
 *       NOTIFY (send_email, optional; destination info.603btc@gmail.com).
 * Vars: SUBSTACK_PUBLICATION, SUBSTACK_DRY_RUN ("1" = never call Substack),
 *       ALLOWED_ORIGINS (comma list), TURNSTILE_OPTIONAL ("1" = dev only).
 * Secret: TURNSTILE_SECRET_KEY (wrangler secret put; legacy name TURNSTILE_SECRET also read). Never logged.
 * New-signup mail is sent with ctx.waitUntil so a notify failure never changes the HTTP response.
 */

const NOTIFY_TO = 'info.603btc@gmail.com';
const NOTIFY_FROM = 'waitlist@bitcoineducation.quest';
const SUBSTACK_DONE = new Set(['ok', 'dry_run', 'browser']);

const EMAIL_RE = /^[^\s@<>()"',;:\\[\]]{1,64}@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;
const MAX_BODY = 4096;
const memHits = new Map(); // fallback limiter when RL binding is absent (per isolate)

export function normalizeEmail(raw) {
    if (typeof raw !== 'string') return null;
    const e = raw.trim().toLowerCase();
    if (e.length < 6 || e.length > 254 || !EMAIL_RE.test(e)) return null;
    const tld = e.slice(e.lastIndexOf('.') + 1);
    if (tld.length < 2 || /^\d+$/.test(tld)) return null;
    return e;
}

function json(body, status, extra) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...(extra || {}) },
    });
}

function reply(req, status, body) {
    // No-JS form posts get a redirect back to the page; fetch() callers get JSON.
    const wantsJson = (req.headers.get('accept') || '').includes('application/json');
    if (wantsJson) return json(body, status);
    const s = body.ok ? (body.retry ? 'retry' : 'ok') : (status === 429 ? 'slow' : 'err');
    return new Response(null, { status: 303, headers: { location: '/waitlist?s=' + s, 'cache-control': 'no-store' } });
}

async function rateLimited(env, req) {
    const ip = req.headers.get('cf-connecting-ip') || 'unknown'; // used as a key only, never stored
    if (env.RL && typeof env.RL.limit === 'function') {
        const { success } = await env.RL.limit({ key: ip });
        return !success;
    }
    const now = Date.now(), win = 60000, max = 5;
    const arr = (memHits.get(ip) || []).filter(t => now - t < win);
    arr.push(now); memHits.set(ip, arr);
    if (memHits.size > 5000) memHits.clear();
    return arr.length > max;
}

async function readBody(req) {
    const len = Number(req.headers.get('content-length') || 0);
    if (len > MAX_BODY) return null;
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    const ct = req.headers.get('content-type') || '';
    try {
        if (ct.includes('application/json')) return JSON.parse(text) || {};
        if (ct.includes('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
    } catch (_) { return null; }
    return null;
}

async function verifyTurnstile(env, token) {
    const secret = env.TURNSTILE_SECRET_KEY || env.TURNSTILE_SECRET;
    if (!secret) return env.TURNSTILE_OPTIONAL === '1' ? true : null; // null = misconfigured
    if (typeof token !== 'string' || !token || token.length > 2048) return false;
    const form = new URLSearchParams({ secret, response: token });
    try {
        const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
        const d = await r.json();
        return d && d.success === true;
    } catch (_) { return false; }
}

export async function forwardToSubstack(env, email) {
    if (env.SUBSTACK_DRY_RUN !== '0') return 'dry_run';
    const pub = env.SUBSTACK_PUBLICATION || 'https://603btc.substack.com';
    try {
        const r = await fetch(pub + '/api/v1/free', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({
                email,
                first_url: 'https://bitcoineducation.quest/waitlist',
                first_referrer: '',
                current_url: 'https://bitcoineducation.quest/waitlist',
                current_referrer: '',
                source: 'subscribe_page',
                referring_pub_id: '',
                additional_referring_pub_ids: '',
            }),
        });
        return r.ok ? 'ok' : 'error_' + r.status;
    } catch (_) { return 'error_network'; }
}


export function formatEt(d = new Date()) {
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
    }).format(d);
    return formatted + ' ET';
}

export async function notifySignup(env, { email, at, total, substack }) {
    if (!env || !env.NOTIFY || typeof env.NOTIFY.send !== 'function') return;
    const text = [
        'A new signup was added to the Citadel Spark waitlist.',
        '',
        'Email: ' + email,
        'Time: ' + at,
        'Total signups: ' + total,
        'Substack forward: ' + substack,
    ].join('\n');
    try {
        await env.NOTIFY.send({
            to: NOTIFY_TO,
            from: { email: NOTIFY_FROM, name: 'Citadel Spark Waitlist' },
            subject: 'New Citadel Spark waitlist signup',
            text,
        });
    } catch (err) {
        console.log('waitlist notify failed', (err && (err.code || err.message)) || 'error');
    }
}

function scheduleSignupNotify(ctx, env, email, status) {
    const job = (async () => {
        const countRow = await env.DB.prepare('SELECT COUNT(*) AS n FROM waitlist').first();
        const total = countRow && countRow.n != null ? countRow.n : 0;
        await notifySignup(env, { email, at: formatEt(), total, substack: status });
    })();
    if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job);
    // If waitUntil is unavailable, still do not await: a notify failure must not fail the signup.
    job.catch(() => {});
}

export async function handleWaitlist(req, env, ctx) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204 });
    if (req.method !== 'POST') return json({ ok: false, error: 'method' }, 405, { allow: 'POST' });

    const allowed = String(env.ALLOWED_ORIGINS || 'https://bitcoineducation.quest').split(',').map(s => s.trim()).filter(Boolean);
    const origin = req.headers.get('origin');
    if (!origin || !allowed.includes(origin)) return json({ ok: false, error: 'origin' }, 403);

    if (await rateLimited(env, req)) return reply(req, 429, { ok: false, error: 'rate' });

    const body = await readBody(req);
    if (!body) return reply(req, 400, { ok: false, error: 'body' });
    if (body.website) return reply(req, 200, { ok: true }); // honeypot: pretend success, store nothing

    const email = normalizeEmail(body.email);
    if (!email) return reply(req, 400, { ok: false, error: 'email' });
    if (body.consent !== true && body.consent !== 'on' && body.consent !== 'true') {
        return reply(req, 400, { ok: false, error: 'consent' });
    }

    const ts = await verifyTurnstile(env, body['cf-turnstile-response'] || body.turnstile);
    if (ts === null) return reply(req, 503, { ok: false, error: 'unavailable' });
    if (!ts) return reply(req, 403, { ok: false, error: 'challenge' });

    const now = new Date().toISOString();
    const ins = await env.DB.prepare(
        "INSERT INTO waitlist (email, created_at, source, consent, substack_status) VALUES (?1, ?2, 'waitlist', 1, 'pending') ON CONFLICT(email) DO NOTHING"
    ).bind(email, now).run();
    const isNew = !!(ins && ins.meta && ins.meta.changes === 1);

    const row = await env.DB.prepare('SELECT substack_status FROM waitlist WHERE email = ?1').bind(email).first();
    // 'browser' means the page will subscribe the visitor in their own browser (no server forward).
    if (!isNew && row && SUBSTACK_DONE.has(row.substack_status)) {
        return reply(req, 200, { ok: true, ...(row.substack_status === 'dry_run' ? { dryRun: true } : {}) });
    }

    let status = row && row.substack_status;
    if (status === 'browser') {
        // Already marked for a browser subscribe; do not also POST from the Worker.
    } else {
        status = await forwardToSubstack(env, email);
        await env.DB.prepare('UPDATE waitlist SET substack_status = ?1, substack_at = ?2 WHERE email = ?3').bind(status, now, email).run();
    }
    if (isNew) scheduleSignupNotify(ctx, env, email, status);
    if (SUBSTACK_DONE.has(status)) return reply(req, 200, { ok: true, ...(status === 'dry_run' ? { dryRun: true } : {}) });
    return reply(req, 200, { ok: true, retry: true }); // saved on our list; Substack retried later
}

export default {
    async fetch(req, env, ctx) {
        const url = new URL(req.url);
        if (url.pathname === '/api/waitlist') {
            try { return await handleWaitlist(req, env, ctx); }
            catch (_) { return json({ ok: false, error: 'server' }, 500); }
        }
        return json({ ok: false, error: 'not_found' }, 404);
    },
};
