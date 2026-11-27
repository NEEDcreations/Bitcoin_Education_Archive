'use strict';

// Shared LNURL-pay lookup for withdrawals, tips, and the one-time address reset.
// The callback host does not have to match the address domain (Wallet of Satoshi,
// Blink, and others use a different host). Every request stays on https, the
// default port, with no userinfo, and each host — including redirect hops —
// has to pass assertPublicHost. Logs name the domain only.
// The returned invoice must also commit to the LNURL metadata (LUD-06
// description hash), be unexpired, and not be payable to our own node.

const PROOF_MSATS = 1000;
const PROOF_MAX_MSATS = 100000;
const TIMEOUT_MS = 8000;
const MAX_BYTES = 65536;
const MAX_REDIRECTS = 3;
const RESOLVE_ERROR = 'Could not resolve Lightning Address. Check the address and try again.';
// An invoice must stay valid at least this long after we receive it.
const MIN_EXPIRY_HEADROOM_SEC = 30;

function sha256Hex(text) {
    return require('crypto').createHash('sha256').update(String(text), 'utf8').digest('hex');
}

function tagValue(decoded, name) {
    const tags = (decoded && Array.isArray(decoded.tags)) ? decoded.tags : [];
    for (let i = 0; i < tags.length; i++) {
        if (tags[i] && tags[i].tagName === name) return tags[i].data;
    }
    return undefined;
}

// Our own node pubkey(s) are public; set BQ_OWN_NODE_PUBKEYS (comma list) so a
// payout can never be routed to an invoice issued by our own wallet.
function ownNodePubkeys(injected) {
    const raw = injected !== undefined ? injected : (process.env.BQ_OWN_NODE_PUBKEYS || '');
    const list = Array.isArray(raw) ? raw : String(raw).split(',');
    return list.map(function (k) { return String(k).trim().toLowerCase(); }).filter(function (k) { return /^0[23][0-9a-f]{64}$/.test(k); });
}

function normalizeLnAddress(raw) {
    let s = String(raw == null ? '' : raw).trim().toLowerCase();
    if (s.indexOf('lightning:') === 0) s = s.slice('lightning:'.length).trim();
    if (s.indexOf('mailto:') === 0) s = s.slice('mailto:'.length).trim();
    return s;
}

function addressDomain(address) {
    const at = String(address || '').lastIndexOf('@');
    if (at < 1) return '';
    return String(address).slice(at + 1).split(':')[0].toLowerCase();
}

function LnurlError(message, code, extra) {
    const err = new Error(message);
    err.name = 'LnurlError';
    err.code = code || 'resolve_failed';
    if (extra && typeof extra.minSendable === 'number') err.minSendable = extra.minSendable;
    if (extra && typeof extra.maxSendable === 'number') err.maxSendable = extra.maxSendable;
    return err;
}

function assertHttpsUrl(raw, label) {
    let url;
    try {
        url = new URL(raw);
    } catch (_) {
        throw LnurlError('Invalid ' + label + ' URL', 'bad_url');
    }
    if (url.protocol !== 'https:') throw LnurlError(label + ' must use HTTPS', 'http_callback');
    if (url.username || url.password) throw LnurlError(label + ' must not include userinfo', 'userinfo');
    if (url.port && url.port !== '443') throw LnurlError(label + ' must use the default HTTPS port', 'bad_port');
    if (!url.hostname) throw LnurlError('Invalid ' + label + ' host', 'bad_url');
    return url;
}

function headerGet(res, name) {
    if (!res || !res.headers) return '';
    if (typeof res.headers.get === 'function') return res.headers.get(name) || '';
    const lower = String(name || '').toLowerCase();
    return res.headers[lower] || res.headers[name] || '';
}

function assertResolvedInvoice(decoded, metadata, opts) {
    const o = opts || {};
    const nowSec = o.nowSec || function () { return Math.floor(Date.now() / 1000); };
    const ownNodes = ownNodePubkeys(o.ownNodePubkeys);
    if (typeof metadata !== 'string' || !metadata) {
        throw LnurlError(RESOLVE_ERROR, 'no_metadata');
    }
    // LUD-06: the invoice's description hash must be sha256(metadata).
    const h = tagValue(decoded, 'purpose_commit_hash');
    if (typeof h !== 'string' || h.toLowerCase() !== sha256Hex(metadata)) {
        throw LnurlError(RESOLVE_ERROR, 'description_hash_mismatch');
    }
    const exp = Number(decoded.timeExpireDate);
    if (!Number.isFinite(exp) || exp < nowSec() + MIN_EXPIRY_HEADROOM_SEC) {
        throw LnurlError('Lightning invoice is expired. Try again.', 'invoice_expired');
    }
    const payee = String(decoded.payeeNodeKey || '').toLowerCase();
    if (!/^0[23][0-9a-f]{64}$/.test(payee)) throw LnurlError(RESOLVE_ERROR, 'no_payee');
    if (ownNodes.indexOf(payee) !== -1) {
        throw LnurlError('That Lightning Address can\'t receive this payment.', 'own_node');
    }
    return decoded;
}

function createLnurlResolver(deps) {
    const options = deps || {};
    const assertHost = options.assertPublicHost || require('./publicHost').assertPublicHost;
    const injectedFetch = options.fetch || null;
    const injectedBolt = options.bolt11 || null;
    const log = options.log || console;
    const ownNodes = ownNodePubkeys(options.ownNodePubkeys);
    const nowSec = options.nowSec || function () { return Math.floor(Date.now() / 1000); };

    function getFetch() {
        return injectedFetch || require('node-fetch');
    }

    function getBolt11() {
        return injectedBolt || require('bolt11');
    }

    async function fetchManual(urlString, hopsLeft) {
        const url = assertHttpsUrl(urlString, 'request');
        await assertHost(url.hostname);
        const res = await getFetch()(url.toString(), {
            timeout: TIMEOUT_MS,
            size: MAX_BYTES,
            redirect: 'manual',
            compress: false,
            headers: { 'Accept-Encoding': 'identity' },
        });
        const status = res && typeof res.status === 'number' ? res.status : 0;
        if (status >= 300 && status < 400) {
            if (hopsLeft <= 0) throw LnurlError('Too many redirects', 'redirect_limit');
            const loc = headerGet(res, 'location');
            if (!loc) throw LnurlError('Redirect missing Location', 'bad_redirect');
            const next = new URL(loc, url).toString();
            return fetchManual(next, hopsLeft - 1);
        }
        return res;
    }

    function readStatusError(body) {
        if (body && String(body.status || '').toUpperCase() === 'ERROR') {
            const reason = String(body.reason || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 180);
            throw LnurlError(reason || 'The wallet refused this request.', 'lnurl_error');
        }
    }

    function assertAmountInRange(meta, msats) {
        const min = Number(meta && meta.minSendable);
        const max = Number(meta && meta.maxSendable);
        if (Number.isFinite(min) && min > 0 && msats < min) {
            throw LnurlError(
                'Amount below wallet minimum (' + Math.ceil(min / 1000) + ' sats)',
                'below_min',
                { minSendable: min }
            );
        }
        if (Number.isFinite(max) && max > 0 && msats > max) {
            throw LnurlError(
                'Amount above wallet maximum (' + Math.floor(max / 1000) + ' sats)',
                'above_max',
                { maxSendable: max }
            );
        }
    }

    function assertInvoice(pr, msats, metadata) {
        if (!pr || typeof pr !== 'string') throw LnurlError(RESOLVE_ERROR, 'no_invoice');
        let decoded;
        try {
            decoded = getBolt11().decode(pr);
        } catch (_) {
            throw LnurlError('Invalid Lightning invoice format.', 'bad_invoice');
        }
        const network = decoded && decoded.network && decoded.network.bech32;
        if (network !== 'bc') throw LnurlError('Invoice must be a mainnet Lightning invoice.', 'wrong_network');
        const got = Number(decoded.millisatoshis);
        if (!Number.isFinite(got) || got !== msats) {
            throw LnurlError('Lightning Address returned an unexpected amount.', 'amount_mismatch');
        }
        assertResolvedInvoice(decoded, metadata, { nowSec: nowSec, ownNodePubkeys: options.ownNodePubkeys });
        return decoded;
    }

    async function resolveLnurlInvoice(opts) {
        const src = opts || {};
        const address = normalizeLnAddress(src.address);
        const msats = Math.floor(Number(src.msats));
        const comment = src.comment ? String(src.comment) : '';
        if (!Number.isFinite(msats) || msats <= 0) throw LnurlError('Invalid amount', 'bad_amount');

        const at = address.lastIndexOf('@');
        const local = at > 0 ? address.slice(0, at) : '';
        const domain = addressDomain(address);
        if (!local || !domain || domain.length < 3 || domain.indexOf('.') === -1) {
            throw LnurlError('Invalid Lightning Address domain.', 'bad_domain');
        }

        await assertHost(domain);
        const metaUrl = 'https://' + domain + '/.well-known/lnurlp/' + encodeURIComponent(local);
        let metaRes;
        try {
            metaRes = await fetchManual(metaUrl, MAX_REDIRECTS);
        } catch (e) {
            log.error('[LNURL] metadata failed domain=' + domain);
            if (e && e.code) throw e;
            throw LnurlError(RESOLVE_ERROR, 'resolve_failed');
        }
        if (!metaRes || metaRes.ok !== true) {
            log.error('[LNURL] metadata status domain=' + domain);
            throw LnurlError(RESOLVE_ERROR, 'resolve_failed');
        }
        let meta;
        try {
            meta = await metaRes.json();
        } catch (_) {
            throw LnurlError(RESOLVE_ERROR, 'resolve_failed');
        }
        readStatusError(meta);
        if (!meta.callback) throw LnurlError('No callback in LNURL-pay metadata', 'no_callback');
        if (typeof meta.metadata !== 'string' || !meta.metadata) throw LnurlError(RESOLVE_ERROR, 'no_metadata');
        const cbUrl = assertHttpsUrl(meta.callback, 'Callback');
        await assertHost(cbUrl.hostname);
        assertAmountInRange(meta, msats);

        const sep = String(meta.callback).indexOf('?') === -1 ? '?' : '&';
        let invoiceUrl = meta.callback + sep + 'amount=' + msats;
        const commentAllowed = Number(meta.commentAllowed);
        if (comment && Number.isFinite(commentAllowed) && commentAllowed > 0) {
            invoiceUrl += '&comment=' + encodeURIComponent(comment.slice(0, commentAllowed));
        }

        let invRes;
        try {
            invRes = await fetchManual(invoiceUrl, MAX_REDIRECTS);
        } catch (e) {
            log.error('[LNURL] invoice failed domain=' + domain);
            if (e && e.code) throw e;
            throw LnurlError(RESOLVE_ERROR, 'resolve_failed');
        }
        if (!invRes || invRes.ok !== true) throw LnurlError(RESOLVE_ERROR, 'resolve_failed');
        let inv;
        try {
            inv = await invRes.json();
        } catch (_) {
            throw LnurlError(RESOLVE_ERROR, 'resolve_failed');
        }
        readStatusError(inv);
        if (!inv.pr) throw LnurlError(RESOLVE_ERROR, 'no_invoice');
        const decoded = assertInvoice(inv.pr, msats, meta.metadata);
        log.log('[LNURL] resolved domain=' + domain + ' msats=' + msats);
        return {
            pr: inv.pr,
            decoded: decoded,
            domain: domain,
            callbackHost: cbUrl.hostname,
        };
    }

    return { resolveLnurlInvoice: resolveLnurlInvoice };
}

const defaultResolver = createLnurlResolver();

function resolveLnurlInvoice(opts) {
    const src = opts || {};
    if (src.fetch || src.bolt11 || src.assertPublicHost || src.log || src.ownNodePubkeys) {
        return createLnurlResolver({
            fetch: src.fetch,
            bolt11: src.bolt11,
            assertPublicHost: src.assertPublicHost,
            log: src.log,
            ownNodePubkeys: src.ownNodePubkeys,
        }).resolveLnurlInvoice(src);
    }
    return defaultResolver.resolveLnurlInvoice(src);
}

module.exports = {
    PROOF_MSATS: PROOF_MSATS,
    PROOF_MAX_MSATS: PROOF_MAX_MSATS,
    TIMEOUT_MS: TIMEOUT_MS,
    MAX_BYTES: MAX_BYTES,
    FETCH_HEADERS: { 'Accept-Encoding': 'identity' },
    MAX_REDIRECTS: MAX_REDIRECTS,
    RESOLVE_ERROR: RESOLVE_ERROR,
    MIN_EXPIRY_HEADROOM_SEC: MIN_EXPIRY_HEADROOM_SEC,
    sha256Hex: sha256Hex,
    ownNodePubkeys: ownNodePubkeys,
    normalizeLnAddress: normalizeLnAddress,
    addressDomain: addressDomain,
    LnurlError: LnurlError,
    createLnurlResolver: createLnurlResolver,
    resolveLnurlInvoice: resolveLnurlInvoice,
    assertResolvedInvoice: assertResolvedInvoice,
    tagValue: tagValue,
};
