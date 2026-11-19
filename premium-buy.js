// In-app Premium buy screen (signed-in, non-guest accounts only).
// Opens from /?premium=buy, /?premium=founders, or window.bqOpenPremium().
// This is the only place the existing-player 5% (15% with bitcoin) and the
// Founders seat can be bought. The server decides every price; this screen
// only shows what getPremiumStatus returns. All text goes in via textContent.
// Charging: everyone is charged at purchase (trials are off server-side). All sales final.
(function () {
    'use strict';
    if (window._bqPremiumBuy) return;
    window._bqPremiumBuy = true;

    var MAX_MONTHS = 12;
    var REASONS = {
        checkout_closed: 'Premium checkout opens soon. Please check back.',
        kill_switch: 'Bitcoin Quest is offline for maintenance, so checkout is paused. Please try again later.',
        terms_required: 'Please tick the box to confirm that all sales are final.',
        founders_sold_out: "Founders' Lifetime is sold out.",
        founders_busy: 'All remaining Founders seats are being checked out right now. Try again in a few minutes.',
        hold_exists: 'You already have a Founders checkout open. Finish it or try again in a few minutes.',
        founders_cooldown: 'Your last Founders checkout timed out. Please wait about 30 minutes before trying again.',
        founders_cooldown_ip: 'A Founders checkout from this network timed out. Please wait about 30 minutes before trying again.',
        hold_exists_ip: 'A Founders checkout is already open from this network. Try again in a few minutes.',
        email_not_verified: 'Verify your email in Settings first, then come back.',
        already_premium: 'You already have Premium.',
        already_founders: "You're already a Founder.",
        subscription_renewing: 'Turn off card renewal in Manage billing before prepaying with bitcoin.',
        lightning_closed: 'Bitcoin checkout is not open yet. Card works now.',
        rate_limited: 'Too many tries. Please wait a few minutes.',
        provider_error: 'Checkout could not start. Try again in a minute.'
    };

    function el(tag, css, text) {
        var n = document.createElement(tag);
        if (css) n.style.cssText = css;
        if (text != null) n.textContent = String(text);
        return n;
    }
    function usd(cents) {
        var c = Number(cents) || 0;
        return '$' + (c % 100 === 0 ? String(c / 100) : (c / 100).toFixed(2));
    }
    function etDate(ms) {
        try {
            return new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(ms));
        } catch (e) { return new Date(ms).toDateString(); }
    }
    function authObj() {
        if (typeof auth !== 'undefined' && auth) return auth;
        try { return firebase.auth(); } catch (e) { return null; }
    }
    function signedIn() {
        var a = authObj();
        return !!(a && a.currentUser && !a.currentUser.isAnonymous);
    }
    function call(name, data) {
        return firebase.functions().httpsCallable(name)(data || {}).then(function (r) { return r && r.data; });
    }
    function reasonOf(e) { return (e && e.details && e.details.reason) || ''; }
    function msgFor(e) {
        var r = reasonOf(e);
        return REASONS[r] || (e && e.message) || 'Something went wrong. Please try again.';
    }
    // Founders' seat hold countdown (Red Team F2-R). The seat is held only
    // until holdExpMs; after that the checkout link is expired server-side.
    function holdMinutesLeft(expMs, nowMs) { return Math.max(0, Math.ceil((expMs - nowMs) / 60000)); }
    function holdText(expMs, nowMs) {
        var left = Math.max(0, expMs - nowMs);
        var m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
        var n = holdMinutesLeft(expMs, nowMs);
        return 'Your Founders seat is held for ' + n + (n === 1 ? ' minute' : ' minutes') + ' (' + m + ':' + (sec < 10 ? '0' : '') + sec + ' left).';
    }
    function showHold(box, buy, url, expMs) {
        while (box.firstChild) box.removeChild(box.firstChild);
        box.style.display = 'block';
        var line = el('p', 'margin:0 0 8px;font-weight:700;color:#f7931a', holdText(expMs, Date.now()));
        line.setAttribute('role', 'timer');
        line.setAttribute('aria-live', 'polite');
        var note = el('p', 'margin:0 0 10px;color:#d1d5db;font-size:.88rem', 'Pay before the timer runs out to keep your seat. After that the checkout closes and the seat goes back to other players.');
        var pay = el('button', 'width:100%;padding:12px;border-radius:10px;border:0;background:#f7931a;color:#111;font-weight:700;cursor:pointer', 'Pay now');
        pay.type = 'button';
        pay.addEventListener('click', function () { if (Date.now() < expMs) location.assign(url); });
        box.appendChild(line);
        box.appendChild(note);
        box.appendChild(pay);
        buy.style.display = 'none';
        var timer = setInterval(function () {
            var now = Date.now();
            if (now >= expMs) {
                clearInterval(timer);
                line.textContent = 'Your Founders seat hold ran out. Start again to hold a new seat.';
                pay.disabled = true;
                pay.style.opacity = '.5';
                buy.style.display = '';
                buy.disabled = false;
                buy.textContent = 'Continue to payment';
                return;
            }
            line.textContent = holdText(expMs, now);
        }, 1000);
    }
    function toast(m) { if (typeof showToast === 'function') showToast(m); }

    // Only Stripe Checkout (card) or the configured BTCPay host (bitcoin) is
    // followed, each pinned to its exact host. btcpayHost comes from
    // getPremiumStatus (premium_config); no host means no bitcoin link.
    var HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
    function safeCheckoutUrl(url, rail, btcpayHost) {
        if (typeof url !== 'string') return null;
        var u;
        try { u = new URL(url); } catch (e) { return null; }
        if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return null;
        if (rail === 'card') return u.hostname === 'checkout.stripe.com' ? u.href : null;
        if (rail === 'lightning') {
            var h = typeof btcpayHost === 'string' ? btcpayHost.toLowerCase() : '';
            if (!h || !HOST_RE.test(h) || h === location.hostname) return null;
            return u.hostname === h ? u.href : null;
        }
        return null;
    }
    function safePortalUrl(url) {
        if (typeof url !== 'string') return null;
        try {
            var u = new URL(url);
            return u.protocol === 'https:' && u.hostname === 'billing.stripe.com' ? u.href : null;
        } catch (e) { return null; }
    }

    function srcTag() {
        try {
            var s = new URLSearchParams(location.search).get('src') || sessionStorage.getItem('bq_premium_src') || '';
            s = s.toLowerCase();
            return /^[a-z0-9_-]{1,40}$/.test(s) ? s : '';
        } catch (e) { return ''; }
    }

    var overlay = null;
    function close() {
        if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
        overlay = null;
    }
    function shell() {
        close();
        overlay = el('div', 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,.72);display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:24px 12px');
        overlay.id = 'bqPremiumBuy';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-label', 'Bitcoin Quest Premium');
        overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
        var box = el('div', 'width:100%;max-width:460px;background:#0f1115;color:#e5e7eb;border:1px solid #2a2f3a;border-radius:16px;padding:20px;font:15px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;position:relative');
        var x = el('button', 'position:absolute;top:10px;right:12px;background:none;border:0;color:#9ca3af;font-size:22px;cursor:pointer', '×');
        x.setAttribute('aria-label', 'Close');
        x.addEventListener('click', close);
        box.appendChild(x);
        box.appendChild(el('h2', 'margin:0 0 6px;font-size:1.3rem;color:#f7931a', 'Bitcoin Quest Premium'));
        overlay.appendChild(box);
        document.body.appendChild(overlay);
        return box;
    }

    function offerFor(st, plan, rail) {
        var list = (st && st.offers) || [];
        for (var i = 0; i < list.length; i++) if (list[i].plan === plan && list[i].rail === rail) return list[i];
        return null;
    }

    function render(box, st, hint) {
        var body = el('div');
        box.appendChild(body);
        if (st.active) {
            body.appendChild(el('p', 'margin:6px 0 12px', st.founders ? "You're a Founder. Premium is yours for life." :
                'Premium is active' + (st.expiresAtMs ? ' until ' + etDate(st.expiresAtMs) : '') + '.'));
            if (!st.founders && st.autoRenew) {
                var mb = el('button', 'width:100%;padding:12px;border-radius:10px;border:1px solid #374151;background:#1f2937;color:#fff;font-weight:600;cursor:pointer', 'Manage billing');
                mb.addEventListener('click', function () {
                    mb.disabled = true;
                    call('createPremiumPortal', {}).then(function (r) {
                        var u = safePortalUrl(r && r.url);
                        if (u) location.assign(u); else { mb.disabled = false; toast('Billing could not open.'); }
                    }).catch(function (e) { mb.disabled = false; toast(msgFor(e)); });
                });
                body.appendChild(mb);
            }
            return;
        }
        if (!st.checkoutOpen) {
            body.appendChild(el('p', 'margin:8px 0', REASONS.checkout_closed));
            return;
        }
        if (st.existingUserOffer) {
            var pct = Number(st.existingUserOffer.pct) || 0;
            body.appendChild(el('p', 'margin:6px 0 10px;padding:10px 12px;border-radius:10px;background:#132a1a;border:1px solid #1f5130;color:#bbf7d0',
                'Thanks for playing early: ' + pct + '% off' + (st.lightningOpen ? ' (' + (pct + 10) + '% with bitcoin)' : '') +
                ' until ' + etDate(st.existingUserOffer.endsAtMs) + '.'));
        }

        var state = { rail: 'card', plan: hint === 'founders' ? 'founders' : 'yearly', months: 1 };
        var railRow = el('div', 'display:flex;gap:8px;margin:8px 0');
        var plansBox = el('div');
        var monthsRow = el('div', 'display:none;margin:8px 0');
        var priceLine = el('p', 'margin:10px 0 4px;font-weight:600');
        function railBtn(rail, label) {
            var b = el('button', '', label);
            b.type = 'button';
            b.addEventListener('click', function () {
                state.rail = rail;
                if (rail === 'card' && state.plan === 'months') state.plan = 'monthly';
                if (rail === 'lightning' && state.plan === 'monthly') state.plan = 'months';
                draw();
            });
            b._rail = rail;
            return b;
        }
        if (st.lightningOpen && st.btcpayHost) {
            railRow.appendChild(railBtn('card', 'Card'));
            railRow.appendChild(railBtn('lightning', 'Bitcoin (10% off)'));
            body.appendChild(railRow);
        }
        body.appendChild(plansBox);
        var sel = el('select', 'padding:6px;border-radius:8px;background:#111827;color:#fff;border:1px solid #374151');
        sel.setAttribute('aria-label', 'Months to prepay');
        for (var m = 1; m <= MAX_MONTHS; m++) {
            var o = el('option', null, m + (m === 1 ? ' month' : ' months'));
            o.value = String(m);
            sel.appendChild(o);
        }
        sel.addEventListener('change', function () { state.months = Math.max(1, Math.min(MAX_MONTHS, parseInt(sel.value, 10) || 1)); draw(); });
        monthsRow.appendChild(el('span', 'margin-right:8px', 'Prepay'));
        monthsRow.appendChild(sel);
        body.appendChild(monthsRow);
        body.appendChild(priceLine);

        var charge = el('p', 'margin:4px 0;color:#d1d5db;font-size:.92rem', "You're charged today.");
        body.appendChild(charge);
        if (st.perksStartAtMs && !st.deferredPerksOpen) {
            body.appendChild(el('p', 'margin:4px 0;color:#d1d5db;font-size:.92rem',
                'Embers and Citadel cosmetics start ' + etDate(st.perksStartAtMs) + ' at 12:00 AM ET. Your other Premium perks start right away.'));
        }
        var terms = el('p', 'margin:10px 0;padding:10px 12px;border-radius:10px;background:#1a1410;border:1px solid #5a3a12;color:#f3d9b5;font-size:.88rem',
            (st.refundPolicy && st.refundPolicy.text) || "All sales are final. No refunds. Monthly and Yearly plans can be canceled any time and keep Premium until the end of the period you paid for. Founders' Lifetime and bitcoin payments are final.");
        body.appendChild(terms);
        var agreeRow = el('label', 'display:flex;gap:8px;align-items:flex-start;cursor:pointer;font-size:.92rem');
        var agree = el('input', 'margin-top:3px;width:18px;height:18px');
        agree.type = 'checkbox';
        agree.id = 'bqPremiumAgree';
        agreeRow.appendChild(agree);
        agreeRow.appendChild(el('span', null, 'I understand that all sales are final and there are no refunds.'));
        body.appendChild(agreeRow);
        var buy = el('button', 'margin-top:12px;width:100%;padding:13px;border-radius:10px;border:0;background:#f7931a;color:#111;font-weight:700;font-size:1rem;cursor:pointer', 'Continue to payment');
        buy.type = 'button';
        var msg = el('p', 'margin:8px 0 0;min-height:1.2em;color:#fca5a5;font-size:.9rem');
        msg.setAttribute('role', 'status');
        body.appendChild(buy);
        body.appendChild(msg);
        var holdBox = el('div', 'display:none;margin-top:10px;padding:12px;border-radius:10px;border:1px solid #f7931a;background:#1f1a10');
        body.appendChild(holdBox);

        function plansForRail() {
            return state.rail === 'lightning' ? [['months', 'Prepaid months'], ['yearly', 'Yearly'], ['founders', "Founders' Lifetime"]]
                : [['monthly', 'Monthly'], ['yearly', 'Yearly'], ['founders', "Founders' Lifetime"]];
        }
        function draw() {
            Array.prototype.forEach.call(railRow.children, function (b) {
                var on = b._rail === state.rail;
                b.style.cssText = 'flex:1;padding:9px;border-radius:10px;cursor:pointer;font-weight:600;border:1px solid ' + (on ? '#f7931a' : '#374151') + ';background:' + (on ? '#2a1a05' : '#111827') + ';color:#fff';
                b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            while (plansBox.firstChild) plansBox.removeChild(plansBox.firstChild);
            plansForRail().forEach(function (p) {
                var off = offerFor(st, p[0], state.rail);
                if (!off) return;
                var soldOut = p[0] === 'founders' && !(st.foundersLeft > 0);
                var row = el('label', 'display:flex;gap:10px;align-items:center;padding:10px;margin:6px 0;border-radius:10px;border:1px solid ' + (state.plan === p[0] ? '#f7931a' : '#2a2f3a') + ';cursor:' + (soldOut ? 'not-allowed' : 'pointer') + ';opacity:' + (soldOut ? '.5' : '1'));
                var r = el('input');
                r.type = 'radio';
                r.name = 'bqPremiumPlan';
                r.value = p[0];
                r.checked = state.plan === p[0];
                r.disabled = soldOut;
                r.addEventListener('change', function () { state.plan = p[0]; draw(); });
                row.appendChild(r);
                var txt = el('span', 'flex:1');
                txt.appendChild(el('strong', null, p[1]));
                var sub = p[0] === 'founders' ? (soldOut ? ' · sold out' : ' · ' + st.foundersLeft + ' of 500 seats left · one payment, never renews')
                    : p[0] === 'months' ? ' · per month, no auto-renew' : p[0] === 'yearly' && state.rail === 'card' ? ' · renews yearly' : p[0] === 'monthly' ? ' · renews monthly' : ' · 12 months, no auto-renew';
                txt.appendChild(el('span', 'color:#9ca3af;font-size:.88rem', sub));
                row.appendChild(txt);
                var price = el('span', 'font-weight:700', usd(off.amountCents));
                if (off.baseCents && off.baseCents !== off.amountCents) {
                    var was = el('s', 'color:#6b7280;font-weight:400;margin-right:6px;font-size:.85rem', usd(off.baseCents));
                    var wrap = el('span');
                    wrap.appendChild(was);
                    wrap.appendChild(price);
                    row.appendChild(wrap);
                } else row.appendChild(price);
                plansBox.appendChild(row);
            });
            if (!offerFor(st, state.plan, state.rail)) state.plan = state.rail === 'lightning' ? 'months' : 'monthly';
            monthsRow.style.display = state.plan === 'months' ? 'block' : 'none';
            var off = offerFor(st, state.plan, state.rail);
            var total = off ? off.amountCents * (state.plan === 'months' ? state.months : 1) : 0;
            priceLine.textContent = off ? 'Total today: ' + usd(total) + (state.plan === 'months' ? ' (' + state.months + ' × ' + usd(off.amountCents) + ')' : '') : '';
        }
        draw();

        buy.addEventListener('click', function () {
            msg.textContent = '';
            if (agree.checked !== true) { msg.textContent = REASONS.terms_required; return; }
            if (state.plan === 'founders' && !(st.foundersLeft > 0)) { msg.textContent = REASONS.founders_sold_out; return; }
            var payload = { plan: state.plan, rail: state.rail, acceptNoRefunds: true };
            if (state.plan === 'months') payload.months = state.months;
            var src = srcTag();
            if (src) payload.src = src;
            buy.disabled = true;
            buy.textContent = 'Opening checkout…';
            call('createPremiumCheckout', payload).then(function (r) {
                var u = safeCheckoutUrl(r && r.url, state.rail, st && st.btcpayHost);
                if (!u) throw { details: { reason: 'provider_error' } };
                if (state.plan === 'founders' && r && Number(r.holdExpMs) > Date.now()) {
                    showHold(holdBox, buy, u, Number(r.holdExpMs));
                    return;
                }
                location.assign(u);
            }).catch(function (e) {
                buy.disabled = false;
                buy.textContent = 'Continue to payment';
                msg.textContent = msgFor(e);
            });
        });
    }

    function open(hint) {
        if (!signedIn()) {
            toast('Sign in to buy Premium.');
            try { sessionStorage.setItem('bq_premium_pending', hint || 'buy'); } catch (e) {}
            if (typeof window.showSignInOnly === 'function') window.showSignInOnly();
            return;
        }
        var box = shell();
        var loading = el('p', 'margin:8px 0;color:#9ca3af', 'Loading…');
        box.appendChild(loading);
        call('getPremiumStatus', {}).then(function (st) {
            if (!overlay) return;
            if (loading.parentNode) loading.parentNode.removeChild(loading);
            render(box, st || {}, hint);
        }).catch(function (e) {
            loading.textContent = msgFor(e);
        });
    }
    window.bqOpenPremium = open;

    // Return banners from Stripe / BTCPay / billing portal, then tidy the URL.
    var RETURN_MSG = {
        success: "Thanks! Your payment is being confirmed. Premium turns on within a minute.",
        cancel: 'Checkout canceled. You were not charged.',
        portal: 'Billing settings updated.'
    };
    function stripParams() {
        try {
            var u = new URL(location.href);
            u.searchParams.delete('premium');
            u.searchParams.delete('order');
            history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash);
        } catch (e) {}
    }
    function boot() {
        var p = '';
        try {
            var qs = new URLSearchParams(location.search);
            p = qs.get('premium') || '';
            var s = (qs.get('src') || '').toLowerCase();
            if (/^[a-z0-9_-]{1,40}$/.test(s)) sessionStorage.setItem('bq_premium_src', s);
        } catch (e) {}
        if (RETURN_MSG[p]) { toast(RETURN_MSG[p]); stripParams(); return; }
        var pending = '';
        try { pending = sessionStorage.getItem('bq_premium_pending') || ''; } catch (e) {}
        var want = (p === 'buy' || p === 'founders') ? p : pending;
        if (!want) return;
        if (p) stripParams();
        var tries = 0;
        var done = false;
        var listening = false;
        var prompted = false;
        function go() {
            if (done) return;
            done = true;
            try { sessionStorage.removeItem('bq_premium_pending'); } catch (e) {}
            open(want);
        }
        (function wait() {
            var a = authObj();
            var ready = a && typeof firebase !== 'undefined' && firebase.functions;
            if (ready && a.currentUser && !a.currentUser.isAnonymous) { go(); return; }
            if (ready && !listening && typeof a.onAuthStateChanged === 'function') {
                listening = true;
                // Resume as soon as a real (non-guest) sign-in happens.
                var off = a.onAuthStateChanged(function (u) {
                    if (u && !u.isAnonymous) { if (typeof off === 'function') off(); go(); }
                });
            }
            // A fresh ?premium= link asks for sign-in once auth has settled.
            if (ready && p && !prompted && tries >= 6) { prompted = true; open(want); }
            if (++tries > 40 || (listening && (prompted || !p))) return;
            setTimeout(wait, 500);
        })();
    }
    window._bqPremiumBuyTest = { safeCheckoutUrl: safeCheckoutUrl, safePortalUrl: safePortalUrl, usd: usd, REASONS: REASONS, holdText: holdText, holdMinutesLeft: holdMinutesLeft };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
    else boot();
})();
