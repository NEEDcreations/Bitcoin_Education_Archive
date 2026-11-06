/**
 * Weekly Hot Topics builder.
 *
 * X reads use the pay-per-use recent search endpoint. As of October 2026 X
 * bills $0.005 per Post returned (not per HTTP call). This run sends at most
 * 2 search requests, max_results=10, so the ceiling is 20 posts = $0.10.
 * A third HTTP call is reserved for one OAuth 1.0a retry if the app-only
 * bearer token is rejected; that rejected call returns no posts.
 * POST /oauth2/token is not a post read.
 */

const crypto = require('crypto');
const { jsonrepair } = require('jsonrepair');

const CURATED_X_ACCOUNTS = [
    'BigSeanHarris', 'francispouliot_', 'parkeralewis', 'TomerStrolight', 'MartyBent',
    'giacomozucco', 'ck_SNARKs', 'stephanlivera', 'Princey21M', 'real_vijay',
    'Erikcason', 'knutsvanholm', 'CedYoungelman', 'Bquittem', 'NeilJacobs',
    'jimmysong', 'gladstein', 'saifedean', 'JeffBooth', 'nvk',
    'PlebUnderground', 'BitcoinPierre', 'w_s_bitcoin', 'HodlTarantula', 'parman_the',
    'LukeMikic21', 'denverbitcoin', 'Coinicarus', 'timevalueofbtc', 'CryptoCloaks',
    'IIICapital', '_Checkmatey_', 'CitizenBitcoin', 'FractalEncrypt', 'Croesus_BTC',
    'hodlonaut', 'LynAldenContact', 'JoeConsorti', 'notgrubles',
    'JoeCarlasare', 'thetrocro', 'TheGuySwann', 'jackmallers', 'BTCsessions',
];

const X_API_ORIGIN = 'https://api.twitter.com';
const X_TOKEN_URL = X_API_ORIGIN + '/oauth2/token';
const X_SEARCH_URL = X_API_ORIGIN + '/2/tweets/search/recent';
const X_POST_READ_USD = 0.005;
const X_MAX_RESULTS = 10;
const X_SEARCH_CALL_BUDGET = 3;
const X_QUERY_CHAR_LIMIT = 512;

const REDDIT_FEEDS = [
    'https://www.reddit.com/r/Bitcoin/hot.rss',
    'https://www.reddit.com/r/Bitcoin/top.rss?t=week',
];
const STACKER_RSS_URL = 'https://stacker.news/~bitcoin/rss';
const STACKER_GRAPHQL_URL = 'https://stacker.news/api/graphql';
const STACKER_QUERY = 'query HotBitcoin { items(sub: "bitcoin", sort: "hot") { items { id title url text sats ncomments } } }';
const SOURCE_UA = 'BitcoinQuestHotTopics/1.0 (+https://bitcoineducation.quest)';
const WEB_SEARCH_ORIGIN = 'https://jolly-surf-219enacho-search.needcreations.workers.dev/search';
const CF_MODEL = '@cf/meta/llama-4-scout-17b-16e-instruct';
// Three attempts at 45s, plus 400ms and 800ms backoff, is about 136s.
// Source fetches run in parallel (the slowest is the sequential web search,
// about 120s) and the follow-up search is one more 20s call. That stays
// inside the 540s function timeout, so the scheduler timeout is unchanged.
// The gen1 HTTP triggers default to 60s, which cannot finish this budget;
// those two functions set timeoutSeconds to 540.
const CF_CALL_TIMEOUT_MS = 45000;

const SLOP_PHRASES = [
    'the bitcoin community is actively discussing',
    'multiple perspectives are circulating',
    'community members see positive developments',
    'others raise concerns and call for more caution',
    'discussion',
];

const HOT_TOPICS_SCHEMA = {
    type: 'object',
    properties: {
        topics: {
            type: 'array',
            items: {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    summary: { type: 'string' },
                    heatScore: { type: 'integer' },
                    sides: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                stance: { type: 'string' },
                                label: { type: 'string' },
                                summary: { type: 'string' },
                            },
                            required: ['stance', 'label', 'summary'],
                        },
                    },
                    postIndices: {
                        type: 'array',
                        items: { type: 'integer' },
                    },
                },
                required: ['title', 'summary', 'heatScore', 'sides'],
            },
        },
    },
    required: ['topics'],
};

const AI_SYSTEM_PROMPT = 'You are a Bitcoin analyst. Return only valid JSON matching the requested schema, with no markdown fences and no text outside the JSON. Use only facts that appear in the user-supplied source items. Never invent dates, statistics, author names, or BIP attributions. Never output filler such as "the community is discussing X". Every sentence must contain a real fact, name, proposal, claim, or statistic from the provided sources.';

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getFetch(deps) {
    if (deps && deps.fetch) return deps.fetch;
    return require('node-fetch');
}

function nowFrom(deps) {
    if (deps && typeof deps.now === 'function') return deps.now();
    if (deps && deps.now instanceof Date) return deps.now;
    return new Date();
}

function envFrom(deps) {
    if (deps && deps.env) return deps.env;
    return process.env;
}

function fetchInit(extra) {
    return Object.assign({ timeout: 20000 }, extra || {});
}

async function readBody(resp) {
    if (resp && typeof resp.text === 'function') return resp.text();
    if (resp && typeof resp.json === 'function') return JSON.stringify(await resp.json());
    return '';
}

function httpOk(resp) {
    if (!resp) return false;
    if (typeof resp.ok === 'boolean') return resp.ok;
    return resp.status >= 200 && resp.status < 300;
}

function pct(s) {
    return encodeURIComponent(String(s)).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}

function encodeQuery(params) {
    return Object.keys(params).sort().map(k => pct(k) + '=' + pct(params[k])).join('&');
}

function dedupeByUrl(items) {
    const seen = new Set();
    const out = [];
    (items || []).forEach(item => {
        const key = item && item.url;
        if (!key || seen.has(key)) return;
        seen.add(key);
        out.push(item);
    });
    return out;
}

function formatRunDate(now) {
    return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
    }).format(now);
}

function monthYear(now) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'long',
        year: 'numeric',
    }).formatToParts(now);
    const month = (parts.find(p => p.type === 'month') || {}).value || '';
    const year = (parts.find(p => p.type === 'year') || {}).value || '';
    return month + ' ' + year;
}

function qualityGateFailure(topics) {
    if (!topics || !topics.length) return 'no topics';
    for (const t of topics) {
        const summary = (t.summary || '').toLowerCase();
        if (SLOP_PHRASES.slice(0, 4).some(p => summary.includes(p))) {
            console.warn('[HotTopics] Quality gate rejected topic (boilerplate detected):', t.title);
            return 'boilerplate in "' + (t.title || 'untitled') + '"';
        }
        const hasSpecificity = /20\d{2}|BIP-?\d+|[A-Z][a-z]{3,}/.test(t.summary || '');
        if (!hasSpecificity) {
            console.warn('[HotTopics] Quality gate rejected topic (no specificity):', t.title);
            return 'no specificity in "' + (t.title || 'untitled') + '"';
        }
    }
    return '';
}

function isRealTopics(topics) {
    return !qualityGateFailure(topics);
}

function stripCodeFences(text) {
    let s = String(text || '').replace(/^\uFEFF/, '').trim();
    const fenced = s.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
    if (fenced) s = fenced[1].trim();
    else s = s.replace(/^```(?:json|JSON)?\s*/, '').replace(/\s*```$/, '').trim();
    return s;
}

function balancedEnd(s, start) {
    const open = s[start];
    const close = open === '{' ? '}' : ']';
    let depth = 0;
    let quote = '';
    for (let i = start; i < s.length; i++) {
        const c = s[i];
        if (quote) {
            if (c === '\\') { i++; continue; }
            if (c === quote) quote = '';
            continue;
        }
        if (c === '"' || c === "'") { quote = c; continue; }
        if (c === '{' || c === '[') depth++;
        else if (c === '}' || c === ']') {
            depth--;
            if (depth === 0) return i;
            if (c !== close && depth < 0) return -1;
        }
    }
    return -1;
}

function extractTopLevelSlices(text) {
    const s = String(text || '');
    const slices = [];
    let i = 0;
    while (i < s.length) {
        const c = s[i];
        if (c === '{' || c === '[') {
            const end = balancedEnd(s, i);
            if (end > i) {
                slices.push(s.slice(i, end + 1));
                i = end + 1;
                continue;
            }
        }
        i++;
    }
    return slices;
}

function extractBalancedJson(text) {
    const slices = extractTopLevelSlices(stripCodeFences(text));
    return slices.length ? slices[0] : null;
}

function coerceParsed(value) {
    if (Array.isArray(value)) return { topics: value };
    return value;
}

function tryParseCandidate(candidate) {
    try {
        return JSON.parse(candidate);
    } catch (e) { /* repair next */ }
    try {
        return JSON.parse(jsonrepair(candidate));
    } catch (e) {
        return undefined;
    }
}

function parseModelJson(input) {
    if (input && typeof input === 'object') return coerceParsed(input);
    const stripped = stripCodeFences(input);
    const slices = extractTopLevelSlices(stripped);
    const candidates = slices.slice();
    if (stripped && candidates.indexOf(stripped) === -1) candidates.push(stripped);
    let first = undefined;
    for (let i = 0; i < candidates.length; i++) {
        const parsed = tryParseCandidate(candidates[i]);
        if (parsed === undefined) continue;
        const coerced = coerceParsed(parsed);
        if (coerced && typeof coerced === 'object' && Array.isArray(coerced.topics)) return coerced;
        if (first === undefined) first = coerced;
    }
    if (first !== undefined) return first;
    throw new Error('JSON parse failed');
}

function validateTopicsShape(parsed) {
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { ok: false, reason: 'root must be an object' };
    }
    if (!Array.isArray(parsed.topics)) {
        return { ok: false, reason: 'topics must be an array' };
    }
    for (const t of parsed.topics) {
        if (!t || typeof t !== 'object' || Array.isArray(t)) {
            return { ok: false, reason: 'topic must be an object' };
        }
        if (typeof t.title !== 'string' || !t.title.trim()) {
            return { ok: false, reason: 'topic.title required' };
        }
        if (typeof t.summary !== 'string' || !t.summary.trim()) {
            return { ok: false, reason: 'topic.summary required' };
        }
        if (t.heatScore != null && t.heatScore !== '' && Number.isNaN(Number(t.heatScore))) {
            return { ok: false, reason: 'heatScore must be a number' };
        }
        if (t.sides != null && !Array.isArray(t.sides)) {
            return { ok: false, reason: 'sides must be an array' };
        }
        if (Array.isArray(t.sides)) {
            for (const side of t.sides) {
                if (!side || typeof side !== 'object' || Array.isArray(side)) {
                    return { ok: false, reason: 'side must be an object' };
                }
                if (side.summary != null && typeof side.summary !== 'string') {
                    return { ok: false, reason: 'side.summary must be a string' };
                }
            }
        }
        if (t.postIndices != null && !Array.isArray(t.postIndices)) {
            return { ok: false, reason: 'postIndices must be an array' };
        }
    }
    return { ok: true, topics: parsed.topics };
}

function unwrapCloudflare(json) {
    if (!json || typeof json !== 'object') return json;
    if (json.success === false) {
        const msg = (json.errors && json.errors.map(e => e.message).join('; ')) || 'Cloudflare AI error';
        const err = new Error(msg);
        if (/response_format|json_schema|guided_json|json mode/i.test(msg)) err.schemaUnsupported = true;
        throw err;
    }
    const result = json.result;
    if (result && typeof result === 'object') {
        if (result.response && typeof result.response === 'object') return result.response;
        if (typeof result.response === 'string') return result.response;
        const choice = result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
        if (choice) return choice;
        if (Array.isArray(result.topics)) return result;
    }
    if (typeof result === 'string') return result;
    const topChoice = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (topChoice) return topChoice;
    return json;
}

function buildCloudflareBody(prompt, useSchema) {
    const body = {
        messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: prompt },
        ],
        max_tokens: 3000,
    };
    if (useSchema) {
        body.response_format = {
            type: 'json_schema',
            json_schema: HOT_TOPICS_SCHEMA,
        };
        body.guided_json = HOT_TOPICS_SCHEMA;
    }
    return body;
}

function schemaUnsupportedMessage(status, body) {
    if (status !== 400 && status !== 422) return false;
    return /response_format|json_schema|guided_json|json mode|unrecognized|unknown field|additional properties/i.test(body || '');
}

function cfTransportKind(err) {
    if (!err || typeof err !== 'object') return '';
    const name = String(err.name || '');
    const type = String(err.type || '');
    const code = String(err.code || err.errno || '');
    const message = String(err.message || '');
    if (
        type === 'request-timeout' ||
        code === 'ETIMEDOUT' ||
        code === 'ESOCKETTIMEDOUT' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'UND_ERR_HEADERS_TIMEOUT' ||
        code === 'UND_ERR_BODY_TIMEOUT' ||
        /timeout|timed out/i.test(message)
    ) return 'timeout';
    if (name === 'AbortError' || type === 'aborted' || code === 'ABORT_ERR') return 'AbortError';
    return '';
}

function aiErrorText(err) {
    const text = (err && (err.publicMessage || err.message)) || (err && err.name) || 'error';
    return String(text)
        .replace(/https?:\/\/\S+/gi, '[url]')
        .replace(/accounts\/[A-Za-z0-9_-]+/g, 'accounts/[id]');
}

function cfHttpError(status) {
    const err = new Error('CF Workers AI HTTP ' + status);
    err.publicMessage = err.message;
    err.status = status;
    return err;
}

function cfTransportError(err) {
    const kind = cfTransportKind(err);
    if (kind) {
        const wrapped = new Error('CF Workers AI ' + kind);
        wrapped.publicMessage = wrapped.message;
        wrapped.transient = true;
        return wrapped;
    }
    const wrapped = new Error('CF Workers AI network');
    wrapped.publicMessage = wrapped.message;
    return wrapped;
}

async function callCloudflareLlama(prompt, fetchImpl, env, useSchema) {
    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_AI_TOKEN;
    if (!accountId || !apiToken) {
        const err = new Error('Missing CF_ACCOUNT_ID or CF_AI_TOKEN');
        err.permanent = true;
        throw err;
    }
    const url = 'https://api.cloudflare.com/client/v4/accounts/' + accountId + '/ai/run/' + CF_MODEL;
    let resp;
    try {
        resp = await fetchImpl(url, fetchInit({
            method: 'POST',
            headers: {
                Authorization: 'Bearer ' + apiToken,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(buildCloudflareBody(prompt, useSchema)),
            timeout: CF_CALL_TIMEOUT_MS,
        }));
    } catch (e) {
        throw cfTransportError(e);
    }
    const text = await readBody(resp);
    if (!httpOk(resp)) {
        const err = cfHttpError(resp.status);
        if (schemaUnsupportedMessage(resp.status, text)) err.schemaUnsupported = true;
        else if (resp.status === 429 || resp.status >= 500) err.transient = true;
        else err.permanent = true;
        throw err;
    }
    let json;
    try {
        json = JSON.parse(text);
    } catch (e) {
        const err = new Error('CF Workers AI: response was not JSON');
        err.parseFailure = true;
        throw err;
    }
    return unwrapCloudflare(json);
}

async function callClaude(prompt, apiKey, fetchImpl) {
    const resp = await fetchImpl('https://api.anthropic.com/v1/messages', fetchInit({
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json',
        },
        body: JSON.stringify({
            model: 'claude-3-haiku-20240307',
            max_tokens: 1200,
            messages: [{ role: 'user', content: prompt }],
        }),
    }));
    const text = await readBody(resp);
    if (!httpOk(resp)) {
        const err = new Error('Claude HTTP ' + resp.status);
        if (resp.status === 429 || resp.status >= 500) err.transient = true;
        else err.permanent = true;
        throw err;
    }
    const json = JSON.parse(text);
    const content = json.content && json.content[0] && json.content[0].text;
    if (!content) {
        const err = new Error('Claude: empty content');
        err.parseFailure = true;
        throw err;
    }
    return content;
}

async function callOpenAI(prompt, apiKey, fetchImpl) {
    const resp = await fetchImpl('https://api.openai.com/v1/chat/completions', fetchInit({
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'gpt-4o-mini',
            max_tokens: 1200,
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: [{ role: 'user', content: prompt }],
        }),
    }));
    const text = await readBody(resp);
    if (!httpOk(resp)) {
        const err = new Error('OpenAI HTTP ' + resp.status);
        if (resp.status === 429 || resp.status >= 500) err.transient = true;
        else err.permanent = true;
        throw err;
    }
    const json = JSON.parse(text);
    const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
    if (!content) {
        const err = new Error('OpenAI: empty content');
        err.parseFailure = true;
        throw err;
    }
    return content;
}

async function dispatchModel(prompt, env, fetchImpl, useSchema) {
    const aiKey = env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY;
    if (aiKey && String(aiKey).startsWith('sk-ant')) return callClaude(prompt, aiKey, fetchImpl);
    if (aiKey) return callOpenAI(prompt, aiKey, fetchImpl);
    return callCloudflareLlama(prompt, fetchImpl, env, useSchema);
}

async function callAiForTopics(prompt, deps) {
    const env = envFrom(deps);
    const sleep = (deps && deps.sleep) || delay;
    const warn = (deps && deps.warn) || console.warn;
    const fetchImpl = getFetch(deps);
    let useSchema = true;
    let parseAttempts = 0;
    let lastErr = null;
    let schemaDropped = false;
    while (parseAttempts < 3) {
        try {
            const raw = await dispatchModel(prompt, env, fetchImpl, useSchema);
            let parsed;
            try {
                parsed = parseModelJson(raw);
            } catch (e) {
                const err = new Error('parse: ' + e.message);
                err.parseFailure = true;
                throw err;
            }
            const valid = validateTopicsShape(parsed);
            if (!valid.ok) {
                const err = new Error('validation: ' + valid.reason);
                err.parseFailure = true;
                throw err;
            }
            return { topics: valid.topics };
        } catch (err) {
            lastErr = err;
            if (err.permanent) break;
            if (err.schemaUnsupported && useSchema && !schemaDropped) {
                useSchema = false;
                schemaDropped = true;
                warn('[HotTopics] JSON mode unsupported, retrying without response_format:', aiErrorText(err));
                continue;
            }
            parseAttempts++;
            warn('[HotTopics] AI attempt ' + parseAttempts + ' failed:', aiErrorText(err));
            if (parseAttempts < 3 && (err.parseFailure || err.transient || err.schemaUnsupported)) {
                await sleep(400 * Math.pow(2, parseAttempts - 1));
                continue;
            }
            break;
        }
    }
    throw lastErr || new Error('AI failed');
}

function decodeXml(s) {
    let out = String(s || '');
    out = out.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1');
    out = out.replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
        .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
        .replace(/&amp;/g, '&');
    out = out.replace(/<[^>]+>/g, '');
    return out.replace(/\s+/g, ' ').trim();
}

function matchTag(block, tag) {
    const re = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>', 'i');
    const m = block.match(re);
    return m ? m[1] : '';
}

function feedLink(block) {
    const tags = block.match(/<link\b[^>]*\/?>/gi) || [];
    let fallback = '';
    for (const tag of tags) {
        const hrefMatch = tag.match(/href=["']([^"']+)["']/i);
        if (!hrefMatch) continue;
        const rel = ((tag.match(/rel=["']([^"']+)["']/i) || [])[1] || '').toLowerCase();
        if (rel === 'self') continue;
        if (rel === 'alternate' || rel === '') return decodeXml(hrefMatch[1]);
        if (!fallback) fallback = hrefMatch[1];
    }
    const text = matchTag(block, 'link');
    if (text && text.indexOf('<') === -1) return decodeXml(text);
    return decodeXml(fallback);
}

function parseFeedItems(xml) {
    const chunks = String(xml || '').split(/<item\b|<entry\b/i).slice(1);
    const items = [];
    chunks.forEach(chunk => {
        const block = chunk.split(/<\/item>|<\/entry>/i)[0];
        const title = decodeXml(matchTag(block, 'title'));
        const url = feedLink(block);
        const body = decodeXml(matchTag(block, 'description') || matchTag(block, 'content') || matchTag(block, 'summary') || '');
        if (title.length < 8 || !/^https?:\/\//i.test(url)) return;
        items.push({ title: title, url: url, body: body.substring(0, 300) });
    });
    return items;
}

function buildXSearchQueries(accounts) {
    const suffix = ' -is:retweet';
    const queries = [];
    let batch = [];
    function flush() {
        if (!batch.length) return;
        queries.push('(' + batch.join(' OR ') + ')' + suffix);
        batch = [];
    }
    (accounts || []).forEach(name => {
        const clause = 'from:' + name;
        const candidate = '(' + batch.concat([clause]).join(' OR ') + ')' + suffix;
        if (candidate.length > X_QUERY_CHAR_LIMIT && batch.length) flush();
        batch.push(clause);
    });
    flush();
    return queries;
}

function xCostEstimate() {
    const queries = buildXSearchQueries(CURATED_X_ACCOUNTS);
    const posts = queries.length * X_MAX_RESULTS;
    const usd = Number((posts * X_POST_READ_USD).toFixed(2));
    return {
        perPostUsd: X_POST_READ_USD,
        maxResults: X_MAX_RESULTS,
        searchCallBudget: X_SEARCH_CALL_BUDGET,
        queries: queries.length,
        happyPathCalls: queries.length,
        happyPathMaxPosts: posts,
        happyPathMaxUsd: usd,
        budgetMaxUsd: usd,
    };
}

function oauth1Header({ method, url, query, consumerKey, consumerSecret, tokenKey, tokenSecret }) {
    const oauthParams = {
        oauth_consumer_key: consumerKey,
        oauth_nonce: crypto.randomBytes(16).toString('hex'),
        oauth_signature_method: 'HMAC-SHA1',
        oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
        oauth_token: tokenKey,
        oauth_version: '1.0',
    };
    const all = Object.assign({}, query || {}, oauthParams);
    const sorted = Object.keys(all).sort().map(k => pct(k) + '=' + pct(all[k])).join('&');
    const base = [method.toUpperCase(), pct(url), pct(sorted)].join('&');
    const signingKey = pct(consumerSecret) + '&' + pct(tokenSecret);
    oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(base).digest('base64');
    return 'OAuth ' + Object.keys(oauthParams).sort().map(k => pct(k) + '="' + pct(oauthParams[k]) + '"').join(', ');
}

function mapXTweets(json) {
    const users = {};
    (((json || {}).includes || {}).users || []).forEach(u => { users[u.id] = u.username; });
    return ((json || {}).data || []).map(t => {
        const username = users[t.author_id] || 'i';
        const metrics = t.public_metrics || {};
        const text = String(t.text || '').replace(/\s+/g, ' ').trim();
        return {
            source: 'x',
            title: text.substring(0, 180),
            url: 'https://x.com/' + username + '/status/' + t.id,
            score: (metrics.like_count || 0) + (metrics.retweet_count || 0) + (metrics.reply_count || 0),
            comments: metrics.reply_count || 0,
            body: text.substring(0, 300),
        };
    }).filter(t => t.title && t.url);
}

async function fetchAppOnlyBearer(fetchImpl, key, secret) {
    const basic = Buffer.from(key + ':' + secret).toString('base64');
    const resp = await fetchImpl(X_TOKEN_URL, fetchInit({
        method: 'POST',
        headers: {
            Authorization: 'Basic ' + basic,
            'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
        },
        body: 'grant_type=client_credentials',
    }));
    const text = await readBody(resp);
    let json = {};
    try { json = JSON.parse(text); } catch (e) { json = {}; }
    if (!httpOk(resp) || !json.access_token) {
        const err = new Error('X oauth2/token HTTP ' + (resp && resp.status));
        err.status = resp && resp.status;
        throw err;
    }
    return json.access_token;
}

async function xRecentSearch(opts) {
    const params = {
        query: opts.query,
        max_results: String(X_MAX_RESULTS),
        'tweet.fields': 'created_at,public_metrics,author_id',
        expansions: 'author_id',
        'user.fields': 'username',
    };
    const url = X_SEARCH_URL + '?' + encodeQuery(params);
    const headers = { 'User-Agent': SOURCE_UA };
    if (opts.mode === 'bearer') headers.Authorization = 'Bearer ' + opts.bearer;
    else {
        headers.Authorization = oauth1Header({
            method: 'GET',
            url: X_SEARCH_URL,
            query: params,
            consumerKey: opts.key,
            consumerSecret: opts.secret,
            tokenKey: opts.token,
            tokenSecret: opts.tokenSecret,
        });
    }
    let resp;
    try {
        resp = await opts.fetchImpl(url, fetchInit({ method: 'GET', headers: headers }));
    } catch (e) {
        return { ok: false, status: 0, items: [], error: e.message };
    }
    const text = await readBody(resp);
    if (!httpOk(resp)) return { ok: false, status: resp.status || 0, items: [], error: 'HTTP ' + resp.status };
    try {
        return { ok: true, status: resp.status || 200, items: mapXTweets(JSON.parse(text)), error: '' };
    } catch (e) {
        return { ok: false, status: resp.status || 200, items: [], error: 'bad json' };
    }
}

async function fetchCuratedXPosts(deps) {
    const env = envFrom(deps);
    const fetchImpl = getFetch(deps);
    const key = env.X_API_KEY;
    const secret = env.X_API_SECRET;
    const token = env.X_ACCESS_TOKEN;
    const tokenSecret = env.X_ACCESS_SECRET;
    if (!key || !secret) {
        return { items: [], failed: true, error: 'missing X_API_KEY/X_API_SECRET', searchCalls: 0 };
    }
    const queries = buildXSearchQueries(CURATED_X_ACCOUNTS);
    let mode = 'bearer';
    let bearer = '';
    try {
        bearer = await fetchAppOnlyBearer(fetchImpl, key, secret);
    } catch (err) {
        const status = err.status;
        console.warn('[HotTopics] X app-only bearer failed:', err.message);
        if (!token || !tokenSecret || status === 429) {
            return { items: [], failed: true, error: err.message, searchCalls: 0 };
        }
        mode = 'oauth';
    }
    const items = [];
    let calls = 0;
    let hardFailures = 0;
    let stopped = false;
    for (let i = 0; i < queries.length && calls < X_SEARCH_CALL_BUDGET && !stopped; i++) {
        calls++;
        let result = await xRecentSearch({
            fetchImpl: fetchImpl,
            query: queries[i],
            mode: mode,
            bearer: bearer,
            key: key,
            secret: secret,
            token: token,
            tokenSecret: tokenSecret,
        });
        if ((result.status === 401 || result.status === 403) && mode === 'bearer' && token && tokenSecret && calls < X_SEARCH_CALL_BUDGET) {
            console.warn('[HotTopics] X bearer search HTTP ' + result.status + ', switching to OAuth 1.0a');
            mode = 'oauth';
            calls++;
            result = await xRecentSearch({
                fetchImpl: fetchImpl,
                query: queries[i],
                mode: 'oauth',
                key: key,
                secret: secret,
                token: token,
                tokenSecret: tokenSecret,
            });
        }
        if (result.status === 401 || result.status === 403 || result.status === 429) {
            hardFailures++;
            stopped = true;
            console.warn('[HotTopics] X search failed soft HTTP ' + result.status);
            break;
        }
        if (!result.ok) {
            hardFailures++;
            console.warn('[HotTopics] X search HTTP ' + result.status);
            continue;
        }
        items.push.apply(items, result.items);
    }
    const deduped = dedupeByUrl(items);
    const failed = deduped.length === 0 && (stopped || calls === 0 || hardFailures === calls);
    console.log('[HotTopics] X search calls', calls, 'posts', deduped.length);
    return {
        items: deduped,
        failed: failed,
        error: failed ? 'X search failed' : '',
        searchCalls: calls,
    };
}

async function fetchRedditFeed(fetchImpl, url) {
    const headers = {
        'User-Agent': SOURCE_UA,
        Accept: 'application/rss+xml, application/atom+xml, text/xml, */*',
    };
    let resp = await fetchImpl(url, fetchInit({ headers: headers }));
    if (resp && (resp.status === 401 || resp.status === 403)) {
        const oldUrl = String(url).replace('https://www.reddit.com', 'https://old.reddit.com');
        if (oldUrl !== url) resp = await fetchImpl(oldUrl, fetchInit({ headers: headers }));
    }
    if (!httpOk(resp)) {
        const err = new Error('Reddit HTTP ' + (resp && resp.status));
        err.status = resp && resp.status;
        throw err;
    }
    const xml = await readBody(resp);
    return parseFeedItems(xml).slice(0, 15).map(item => ({
        source: 'reddit',
        title: item.title,
        url: item.url,
        score: 0,
        comments: 0,
        body: item.body,
    }));
}

async function fetchRedditHot(deps) {
    const fetchImpl = getFetch(deps);
    const errors = [];
    let items = [];
    for (const url of REDDIT_FEEDS) {
        try {
            items = items.concat(await fetchRedditFeed(fetchImpl, url));
        } catch (e) {
            errors.push(e.message);
            console.warn('[HotTopics] Reddit feed failed:', e.message);
        }
    }
    const deduped = dedupeByUrl(items).slice(0, 15);
    if (!deduped.length && errors.length) {
        return { items: [], failed: true, error: errors.join('; ') };
    }
    return { items: deduped, failed: false, error: '' };
}

async function fetchBitcoinTalkHot(deps) {
    const fetchImpl = getFetch(deps);
    const url = 'https://bitcointalk.org/index.php?board=1.0';
    let resp;
    try {
        resp = await fetchImpl(url, fetchInit({
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; BitcoinEducationArchive/1.0)',
                Accept: 'text/html',
            },
        }));
    } catch (e) {
        return { items: [], failed: true, error: e.message };
    }
    if (!httpOk(resp)) return { items: [], failed: true, error: 'BitcoinTalk HTTP ' + resp.status };
    const html = await readBody(resp);
    const threads = [];
    const re = /<span id="msg_\d+"><a href="(https:\/\/bitcointalk\.org\/index\.php\?topic=[^"]+)"[^>]*>([^<]+)<\/a><\/span>/g;
    let m;
    while ((m = re.exec(html)) !== null && threads.length < 20) {
        const title = m[2].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        if (title.length > 10) {
            threads.push({
                source: 'bitcointalk',
                title: title,
                url: m[1],
                score: 50,
                comments: 0,
                body: '',
            });
        }
    }
    return { items: threads, failed: false, error: '' };
}

async function searchWeb(query, limit, freshness, deps) {
    const count = limit || 5;
    const fresh = freshness || 'pw';
    const fetchImpl = getFetch(deps);
    const workerUrl = WEB_SEARCH_ORIGIN + '?q=' + encodeURIComponent(query) + '&count=' + count + '&freshness=' + fresh;
    const resp = await fetchImpl(workerUrl, fetchInit({ headers: { Accept: 'application/json' } }));
    if (!httpOk(resp)) throw new Error('Brave worker HTTP ' + (resp && resp.status));
    const json = JSON.parse(await readBody(resp));
    return (json.results || []).slice(0, count).map(r => ({
        source: 'web',
        title: r.title || '',
        url: r.url || '',
        score: 30,
        comments: 0,
        body: r.snippet || '',
    }));
}

function webQueries(now) {
    const dateStr = monthYear(now);
    return [
        { q: 'bitcoin viral news controversy ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin debate reddit.com/r/Bitcoin ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin controversial trending reddit ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin community debate controversy ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin news controversy trending ' + dateStr, freshness: 'pw' },
        { q: 'bitcoin discussion bitcointalk.org ' + dateStr, freshness: 'pw' },
    ];
}

async function fetchWebTrending(deps) {
    const queries = webQueries(nowFrom(deps));
    const results = [];
    let failures = 0;
    for (const entry of queries) {
        try {
            const items = await searchWeb(entry.q, 4, entry.freshness, deps);
            results.push.apply(results, items);
        } catch (e) {
            failures++;
            console.warn('[HotTopics] Web search failed for:', entry.q, e.message);
        }
    }
    const failed = failures === queries.length;
    return { items: results, failed: failed, error: failed ? 'web search failed' : '' };
}

async function fetchStackerNews(deps) {
    const fetchImpl = getFetch(deps);
    const headers = {
        'User-Agent': SOURCE_UA,
        Accept: 'application/rss+xml, application/atom+xml, text/xml, application/json, */*',
    };
    try {
        const resp = await fetchImpl(STACKER_RSS_URL, fetchInit({ headers: headers }));
        if (httpOk(resp)) {
            const items = parseFeedItems(await readBody(resp)).slice(0, 15).map(item => ({
                source: 'stackernews',
                title: item.title,
                url: item.url,
                score: 0,
                comments: 0,
                body: item.body,
            }));
            if (items.length) return { items: items, failed: false, error: '' };
        } else {
            console.warn('[HotTopics] Stacker News RSS HTTP ' + (resp && resp.status));
        }
    } catch (e) {
        console.warn('[HotTopics] Stacker News RSS failed:', e.message);
    }
    try {
        const resp = await fetchImpl(STACKER_GRAPHQL_URL, fetchInit({
            method: 'POST',
            headers: {
                'User-Agent': SOURCE_UA,
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
            body: JSON.stringify({ query: STACKER_QUERY }),
        }));
        if (!httpOk(resp)) return { items: [], failed: true, error: 'Stacker News HTTP ' + (resp && resp.status) };
        const json = JSON.parse(await readBody(resp));
        const raw = json && json.data && json.data.items && json.data.items.items;
        if (!Array.isArray(raw)) return { items: [], failed: true, error: 'Stacker News unexpected shape' };
        const items = raw.slice(0, 15).map(item => ({
            source: 'stackernews',
            title: item.title || '',
            url: item.id ? ('https://stacker.news/items/' + item.id) : (item.url || ''),
            score: item.sats || 0,
            comments: item.ncomments || 0,
            body: String(item.text || '').substring(0, 300),
        })).filter(item => item.title && item.url);
        if (!items.length) return { items: [], failed: true, error: 'Stacker News empty' };
        return { items: items, failed: false, error: '' };
    } catch (e) {
        return { items: [], failed: true, error: e.message };
    }
}

async function gatherTrendingSignals(deps) {
    const jobs = [
        ['x', fetchCuratedXPosts],
        ['reddit', fetchRedditHot],
        ['bitcointalk', fetchBitcoinTalkHot],
        ['web', fetchWebTrending],
        ['stackernews', fetchStackerNews],
    ];
    const settled = await Promise.all(jobs.map(async ([name, fn]) => {
        try {
            const outcome = await fn(deps);
            const items = outcome && Array.isArray(outcome.items) ? outcome.items : [];
            const failed = !outcome || outcome.failed === true;
            const error = (outcome && outcome.error) || '';
            if (failed) console.warn('[HotTopics] source ' + name + ' count=' + items.length + ' failed' + (error ? ' ' + error : ''));
            else console.log('[HotTopics] source ' + name + ' count=' + items.length);
            return { name: name, count: items.length, failed: failed, error: error, items: items };
        } catch (err) {
            console.warn('[HotTopics] source ' + name + ' count=0 failed ' + err.message);
            return { name: name, count: 0, failed: true, error: err.message, items: [] };
        }
    }));
    const signals = [];
    const report = settled.map(row => {
        signals.push.apply(signals, row.items);
        return { name: row.name, count: row.count, failed: row.failed, error: row.error };
    });
    const allFailed = report.length > 0 && report.every(row => row.failed);
    console.log('[HotTopics] Gathered', signals.length, 'raw signals');
    return { signals: signals, report: report, allFailed: allFailed };
}

function sourceLabel(source) {
    if (source === 'x') return 'x-curated';
    return source || 'web';
}

function buildPrompt(signals, now) {
    const currentYear = String(now.getUTCFullYear());
    const freshSignals = (signals || []).filter(s => {
        if (!s.url) return true;
        if (s.source === 'x' || s.source === 'reddit' || s.source === 'stackernews') return true;
        const yearMatch = String(s.url).match(/20\d{2}/);
        if (!yearMatch) return true;
        return yearMatch[0] === currentYear;
    });
    const seenTitles = new Set();
    const dedupedSignals = freshSignals.filter(s => {
        const key = String(s.title || '').substring(0, 50).toLowerCase().replace(/[^a-z0-9]/g, '');
        if (seenTitles.has(key)) return false;
        seenTitles.add(key);
        return true;
    });
    const digest = dedupedSignals.slice(0, 60).map((s, i) =>
        (i + 1) + '. [' + sourceLabel(s.source) + '] ' + s.title + (s.body ? ' — ' + String(s.body).substring(0, 250) : '')
    ).join('\n');
    const dateLabel = formatRunDate(now);
    const prompt = `You are an expert Bitcoin analyst reviewing this week's most discussed and debated Bitcoin topics across Reddit, BitcoinTalk, X (Twitter), Stacker News, and the web.

TODAY: ${dateLabel} (America/New_York). This is only the date of this run.
SOURCE RULE: Rely only on the fetched source items below. Never invent dates, statistics, author names, or BIP attributions that are not explicitly present in those items. If an item does not name an author or a date, do not supply one.

IMPORTANT: Posts marked [x-curated] are from a curated list of high-signal Bitcoin thought leaders including @MartyBent, @nvk, @jimmysong, @gladstein, @saifedean, @parkeralewis, @JeffBooth, @giacomozucco, @stephanlivera, @knutsvanholm and others. Weight these HEAVILY when identifying trending topics — if multiple of these accounts are discussing the same topic, it is almost certainly a hot topic this week.

Here are the raw post titles and snippets gathered this week (numbered for reference):

${digest}

STRICT RULES:
- NEVER invent a person's position. Only attribute a stance (FOR or AGAINST) to someone if a source above explicitly shows them arguing that position. If the sources are unclear, use "proponents argue..." or "critics argue..." without naming anyone.
- The FOR side and AGAINST side must cite DIFFERENT people. Never put the same person on both sides.
- If you cannot find clear evidence of who is FOR vs AGAINST from the sources, describe the positions in general terms — do not name names.
- Do not hallucinate quotes, positions, names, dates, or BIP authors that are not present in the source data. This is the most important rule.

Your task: identify the 2-3 hottest, most technically specific, most contested Bitcoin topics from the sources above.

CRITICAL QUALITY RULES:
- Only output a topic if you have REAL signal from the sources above — specific claims, a named proposal, a named person, a concrete event, or a specific number/stat.
- If the sources only hint at a broad theme (e.g. "ETF" or "mining") with no specific debate, DO NOT output that as a topic — omit it entirely. 2 good topics beats 3 generic ones.
- NEVER write a topic summary like "The community is actively discussing X" or "Multiple perspectives are circulating" — those are filler and will be rejected. Every sentence must contain a specific fact, name, proposal, claim, or stat taken from the sources.
- If you genuinely cannot find 2 specific debated topics from the sources, output just 1. If none, output 0 topics with an empty array.

For each qualifying topic:
1. Write a neutral 3-sentence overview: name the specific proposal, actor, event, or claim only when the sources name it. Be concrete using the source items, and do not add dates or authors they do not contain.
2. Write 2-3 sentences for the FOR side: who supports it (only from sources), what specific benefits they cite, and what outcome they want.
3. Write 2-3 sentences for the AGAINST side: who opposes it (different people), what specific risks or objections they raise.
4. Assign a heatScore 1-100 based on controversy and community volume.

Do NOT include sources or URLs — those will be fetched separately. Focus on accuracy and specificity.

Return ONLY valid JSON, no markdown fences, no explanation outside the JSON:
{
  "topics": [
    {
      "title": "Punchy specific topic name (5 words max, include BIP number or protocol name if relevant)",
      "summary": "3-sentence neutral overview with specific names, proposals, or stats from the sources",
      "heatScore": 75,
      "sides": [
        { "stance": "for", "label": "The case FOR", "summary": "2-3 sentences with specific arguments and who makes them" },
        { "stance": "against", "label": "The case AGAINST", "summary": "2-3 sentences with specific objections and who raises them" }
      ],
      "postIndices": []
    }
  ]
}`;
    return { prompt: prompt, dedupedSignals: dedupedSignals };
}

function fallbackCluster(signals) {
    const keywords = ['BIP', 'lightning', 'fee', 'halving', 'ETF', 'mining', 'taproot', 'fork', 'ordinals', 'layer 2'];
    const clusters = {};
    signals.forEach(s => {
        const titleLower = s.title.toLowerCase();
        let matched = false;
        for (const kw of keywords) {
            if (titleLower.includes(kw.toLowerCase())) {
                clusters[kw] = clusters[kw] || [];
                clusters[kw].push(s);
                matched = true;
                break;
            }
        }
        if (!matched) {
            clusters['General'] = clusters['General'] || [];
            clusters['General'].push(s);
        }
    });
    return Object.entries(clusters)
        .sort((a, b) => b[1].length - a[1].length)
        .slice(0, 3)
        .map(([kw, posts]) => ({
            title: kw + ' Discussion',
            summary: 'The Bitcoin community is actively discussing ' + kw + ' this week. Multiple perspectives are circulating across Reddit, BitcoinTalk, and social media.',
            heatScore: Math.min(90, posts.length * 10),
            sides: [
                { stance: 'for', label: 'Supporters say', summary: 'Community members see positive developments and opportunities in recent ' + kw + ' discussions.' },
                { stance: 'against', label: 'Critics say', summary: 'Others raise concerns and call for more caution or analysis before drawing conclusions.' },
            ],
            posts: posts.slice(0, 4).map(p => ({ source: p.source, title: p.title, url: p.url })),
        }));
}

function emptyWeekTopic() {
    return [{
        title: 'Bitcoin Community Updates',
        summary: 'No trending topics detected this week. Check back next Sunday for the latest Bitcoin debates.',
        heatScore: 10,
        sides: [],
        posts: [],
    }];
}

async function clusterAndSummarize(signals, deps) {
    if (!signals || !signals.length) return emptyWeekTopic();
    const now = nowFrom(deps);
    const warn = (deps && deps.warn) || console.warn;
    const built = buildPrompt(signals, now);
    let aiTopics = null;
    try {
        aiTopics = await callAiForTopics(built.prompt, deps);
    } catch (aiErr) {
        warn('[HotTopics] AI call failed, using keyword fallback:', aiErrorText(aiErr));
        aiTopics = null;
    }
    if (!aiTopics || !Array.isArray(aiTopics.topics)) return fallbackCluster(signals);
    if (!aiTopics.topics.length) return [];

    const topicResults = await Promise.all(aiTopics.topics.slice(0, 3).map(async t => {
        const searchQuery = t.title + ' bitcoin ' + now.getUTCFullYear();
        let posts = [];
        try {
            const searchResults = await searchWeb(searchQuery, 6, 'pm', deps);
            const topicWords = String(t.title || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').split(' ').filter(w => w.length > 3);
            const relevant = searchResults.filter(r => {
                const text = (r.title + ' ' + r.body).toLowerCase();
                return topicWords.some(w => text.includes(w));
            });
            posts = relevant.filter(s => s.source !== 'bitcointalk').slice(0, 4).map(s => ({
                source: s.source,
                title: s.title,
                url: s.url,
            }));
        } catch (e) {
            console.warn('[HotTopics] Source search failed for "' + t.title + '":', e.message);
        }
        const sourcedNames = new Set();
        posts.forEach(p => {
            const m = (p.title + ' ' + p.url).match(/@([A-Za-z0-9_]+)/g) || [];
            m.forEach(n => sourcedNames.add(n.toLowerCase()));
        });
        (t.postIndices || []).slice(0, 8).forEach(idx => {
            const s = built.dedupedSignals[idx - 1];
            if (!s) return;
            const m = (s.title + ' ' + (s.body || '')).match(/@([A-Za-z0-9_]+)/g) || [];
            m.forEach(n => sourcedNames.add(n.toLowerCase()));
        });
        const sanitizeSide = text => {
            if (!text) return text;
            return String(text).replace(/@([A-Za-z0-9_]+)/g, match => {
                if (sourcedNames.has(match.toLowerCase())) return match;
                return 'some community members';
            });
        };
        const sides = (t.sides || []).slice(0, 2).map(side => Object.assign({}, side, {
            summary: sanitizeSide(side.summary),
        }));
        return {
            title: t.title || 'Hot Bitcoin Topic',
            summary: t.summary || '',
            heatScore: Math.min(100, Math.max(0, Number(t.heatScore) || 50)),
            sides: sides,
            posts: posts,
        };
    }));
    return topicResults;
}

function buildHotTopicsAlert(input) {
    const info = input || {};
    const reasons = [];
    if (info.allSourcesFailed) reasons.push('every source failed');
    if (info.qualityGateBlocked) {
        reasons.push('quality gate blocked the save' + (info.gateReason ? ' (' + info.gateReason + ')' : ''));
    }
    if (!reasons.length) return null;
    const counts = (info.sourceReport || []).map(s => s.name + '=' + (s.failed ? 'failed' : String(s.count))).join(' ');
    const now = info.now instanceof Date ? info.now : new Date();
    let message = 'Hot Topics: ' + reasons.join('; ') + '.';
    if (counts) message += ' Sources: ' + counts + '.';
    message += ' Existing topics kept.';
    if (message.length > 180) message = message.slice(0, 177) + '...';
    return {
        message: message,
        targetType: 'hot_topics',
        targetId: now.toISOString().slice(0, 10),
    };
}

function buildAdminNotificationDocs(adminUids, alert) {
    return (adminUids || []).map(uid => ({
        id: alert.targetType + '_' + alert.targetId + '_' + uid,
        data: {
            recipientId: uid,
            senderId: 'system',
            senderName: 'Bitcoin Quest',
            type: 'security',
            message: alert.message,
            targetType: alert.targetType,
            targetId: alert.targetId,
            read: false,
        },
    }));
}

async function writeAdminNotifications(opts) {
    const alert = opts && opts.alert;
    if (!alert) return [];
    const uids = await opts.listAdminUids();
    const docs = buildAdminNotificationDocs(uids, alert);
    for (let i = 0; i < docs.length; i++) {
        await opts.db.collection('notifications').doc(docs[i].id).set(Object.assign({}, docs[i].data, {
            createdAt: opts.admin.firestore.FieldValue.serverTimestamp(),
        }), { merge: true });
    }
    return docs.map(doc => doc.id);
}

async function saveHotTopics(deps, topics, extra) {
    if (!deps.db || !deps.admin) return;
    const payload = {
        topics: topics,
        updatedAt: deps.admin.firestore.FieldValue.serverTimestamp(),
        version: 1,
    };
    if (extra && Object.prototype.hasOwnProperty.call(extra, 'qualityGatePassed')) {
        payload.qualityGatePassed = extra.qualityGatePassed;
    }
    await deps.db.collection('hotTopics').doc('latest').set(payload);
}

async function runHotTopicsJob(options) {
    const deps = options || {};
    const mode = deps.mode || 'schedule';
    const gathered = await gatherTrendingSignals(deps);
    const topics = await clusterAndSummarize(gathered.signals, deps);
    const gateReason = qualityGateFailure(topics);
    const passed = !gateReason;
    const blockSave = mode === 'schedule' && (!passed || gathered.signals.length === 0);
    const alert = buildHotTopicsAlert({
        allSourcesFailed: gathered.allFailed,
        qualityGateBlocked: mode === 'schedule' && !passed,
        sourceReport: gathered.report,
        gateReason: gateReason,
        now: nowFrom(deps),
    });
    if (alert && deps.db && deps.admin && deps.listAdminUids) {
        try {
            const ids = await writeAdminNotifications({
                db: deps.db,
                admin: deps.admin,
                listAdminUids: deps.listAdminUids,
                alert: alert,
            });
            console.warn('[HotTopics] Admin notification:', alert.message, 'admins', ids.length);
        } catch (e) {
            console.error('[HotTopics] admin notify failed:', e.message);
        }
    }
    if (blockSave) {
        console.warn('[HotTopics] Save skipped — keeping existing Firestore data');
    } else {
        await saveHotTopics(deps, topics, mode === 'force' ? { qualityGatePassed: passed } : null);
        console.log('[HotTopics] Saved', topics.length, 'topics to Firestore');
    }
    return {
        topics: topics,
        qualityGatePassed: passed,
        saved: !blockSave,
        alert: alert,
        sourceReport: gathered.report,
        allSourcesFailed: gathered.allFailed,
    };
}

module.exports = {
    CURATED_X_ACCOUNTS,
    CF_CALL_TIMEOUT_MS,
    HOT_TOPICS_SCHEMA,
    X_SEARCH_CALL_BUDGET,
    X_MAX_RESULTS,
    X_POST_READ_USD,
    REDDIT_FEEDS,
    STACKER_RSS_URL,
    SOURCE_UA,
    isRealTopics,
    qualityGateFailure,
    stripCodeFences,
    extractBalancedJson,
    parseModelJson,
    validateTopicsShape,
    unwrapCloudflare,
    buildCloudflareBody,
    buildPrompt,
    buildXSearchQueries,
    xCostEstimate,
    parseFeedItems,
    mapXTweets,
    gatherTrendingSignals,
    fetchCuratedXPosts,
    fetchRedditHot,
    fetchStackerNews,
    callAiForTopics,
    buildHotTopicsAlert,
    buildAdminNotificationDocs,
    writeAdminNotifications,
    runHotTopicsJob,
    clusterAndSummarize,
    fallbackCluster,
    emptyWeekTopic,
    oauth1Header,
};
