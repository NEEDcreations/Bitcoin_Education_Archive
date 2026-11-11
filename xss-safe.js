// ============================================================
// Bitcoin Quest — shared XSS-safe helpers (BQSafe)
// Loaded synchronously in <head>, before every other app script,
// so all modules (bundle, ranking, beats, global-chat, quests, TCTV…)
// can rely on window.BQSafe.
//
//   BQSafe.esc(v)        HTML text + attribute escape: & < > " ' `
//   BQSafe.url(v, opts)  http(s) (and same-origin relative) URLs only, else ''
//   BQSafe.img(v)        url() that also allows data:image/(png|jpeg|gif|webp)
//   BQSafe.id(v)         Firestore-style token id ([A-Za-z0-9_-], 1-128) or ''
//   BQSafe.act(fn, args, opts)
//                        returns ' data-bq-click="fn" data-bq-args="[…]"' for
//                        markup built as strings. No user data ever goes into
//                        an inline on*= handler; one delegated listener calls
//                        window[fn](...args). Use BQSafe.EL / BQSafe.EV in
//                        args for the element / the event.
//   BQSafe.jsStr(v)      legacy: value inside a quoted JS string in an on*= attr
//   BQSafe.num(v)        legacy: numeric slot in an on*= attr (NaN -> 0)
//   BQSafe.cleanHtml(h)  allowlist sanitizer for intentional light formatting
//   BQSafe.text(el, v)   el.textContent = v
// ============================================================
(function (root) {
    'use strict';
    if (root.BQSafe && root.BQSafe.__v >= 1) return;

    var MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
    function esc(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/[&<>"'`]/g, function (c) { return MAP[c]; });
    }

    // Browsers drop ASCII tab/CR/LF anywhere in a URL and trim C0 controls +
    // space at the ends, so "java\nscript:" still runs. Normalize the same way
    // before looking at the scheme.
    function normUrl(v) {
        if (v === null || v === undefined) return '';
        return String(v).replace(/[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+$/g, '')
            .replace(/^[\u0000-\u0020\u007f-\u009f\u00a0\u1680\u2000-\u200b\u2028\u2029\u202f\u205f\u3000\ufeff]+/g, '')
            .replace(/[\t\n\r]/g, '');
    }
    // opts.relative (default true): allow "/path", "./x", "#x", "?q" (same origin).
    // opts.schemes: extra allowed schemes, e.g. ['mailto', 'lightning', 'nostr'].
    // Result is also attribute-safe: " ' < > ` and spaces are percent-encoded.
    function pct(u) { return u.replace(/["'<>`\s]/g, function (c) { return encodeURIComponent(c); }); }
    function url(v, opts) { var r = url0(v, opts); return r ? pct(r) : ''; }
    function url0(v, opts) {
        var u = normUrl(v);
        if (!u) return '';
        opts = opts || {};
        var m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(u);
        if (m) {
            var s = m[1].toLowerCase();
            if (s === 'https' || s === 'http') return /^https?:\/\/[^\/\\\s]/i.test(u) ? u : '';
            if (opts.schemes && opts.schemes.indexOf(s) !== -1) return u;
            return '';
        }
        if (opts.relative === false) return '';
        if (/^\/\/|^\/\\|^\\/.test(u)) return ''; // protocol-relative → other host
        return u; // no scheme: same-origin relative path ("images/x.png", "#forum", "/a")
    }
    function img(v) {
        var u = normUrl(v);
        if (/^data:image\/(png|jpe?g|gif|webp|avif);base64,[A-Za-z0-9+\/=\s]+$/i.test(u)) return u;
        return url(u);
    }
    function id(v, max) {
        if (v === null || v === undefined) return '';
        var s = String(v);
        var re = new RegExp('^[A-Za-z0-9_-]{1,' + (max || 128) + '}$');
        return re.test(s) ? s : '';
    }
    // Value placed INSIDE a quoted JS string inside an inline handler attribute
    // (legacy markup only; new code uses act()). Every char that could end the
    // JS string or the HTML attribute becomes a \uXXXX escape.
    function jsStr(v) {
        return String(v).replace(/[\\'"`<>&\r\n\u2028\u2029\u0000-\u001f]/g, function (c) {
            return '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
        });
    }
    // Number for a raw (unquoted) slot in an inline handler. Non-numbers -> 0.
    function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }
    // act() arg for a slot that used to be spliced into handler code unquoted
    // ('...fn(' + x + ')'): "true"/"false"/"null"/numbers become the JS value
    // the old inline code would have seen; anything else stays a plain string.
    function lit(v) {
        if (typeof v !== 'string') return v === undefined ? null : v;
        var t = v.trim();
        if (t === 'true') return true;
        if (t === 'false') return false;
        if (t === 'null' || t === 'undefined' || t === '') return null;
        if (/^-?(\d+\.?\d*|\.\d+)(e-?\d+)?$/i.test(t)) return Number(t);
        return v;
    }
    // Small allowlist sanitizer for places that intentionally accept a bit of
    // formatting (toasts, notices). Parses in an inert <template>, keeps only
    // simple formatting tags plus class/style/title, and in-app #links.
    // Anything else becomes its text. Not a substitute for esc() on user data.
    var CLEAN_TAGS = { B: 1, STRONG: 1, EM: 1, I: 1, U: 1, S: 1, BR: 1, SPAN: 1, SMALL: 1, CODE: 1, DIV: 1, P: 1, A: 1 };
    function cleanHtml(html) {
        var doc = root.document;
        if (!doc || !doc.createElement) return esc(html);
        var tpl = doc.createElement('template');
        tpl.innerHTML = (html === null || html === undefined) ? '' : String(html);
        if (!tpl.content || !tpl.content.childNodes) return esc(html); // no real DOM (tests / workers)
        (function walk(node) {
            var kids = Array.prototype.slice.call(node.childNodes);
            for (var i = 0; i < kids.length; i++) {
                var k = kids[i];
                if (k.nodeType === 3) continue;
                if (k.nodeType !== 1 || !CLEAN_TAGS[k.tagName]) {
                    if (k.nodeType === 1) node.replaceChild(doc.createTextNode(k.tagName === 'SCRIPT' || k.tagName === 'STYLE' ? '' : k.textContent), k);
                    else node.removeChild(k);
                    continue;
                }
                var attrs = Array.prototype.slice.call(k.attributes);
                for (var j = 0; j < attrs.length; j++) {
                    var n = attrs[j].name.toLowerCase(), v = attrs[j].value;
                    var keep = n === 'class' || n === 'title' ||
                        (n === 'style' && !/url\s*\(|expression\s*\(|javascript:|@import/i.test(v)) ||
                        (n === 'href' && k.tagName === 'A' && /^#[\w\/-]*$/.test(v));
                    if (!keep) k.removeAttribute(attrs[j].name);
                }
                walk(k);
            }
        })(tpl.content);
        var box = doc.createElement('div');
        box.appendChild(tpl.content);
        return box.innerHTML;
    }
    function text(el, v) { if (el) el.textContent = (v === null || v === undefined) ? '' : String(v); return el; }

    // ---- delegated actions --------------------------------------------
    var EL = { $bqEl: 1 }, EV = { $bqEv: 1 };
    var EVENTS = ['click', 'change', 'input', 'keydown', 'submit', 'mouseenter', 'mouseleave', 'error'];
    var allowed = Object.create(null); // only names this page's own code passed to act()
    var FN_RE = /^[A-Za-z_$][\w$]*(\.[A-Za-z_$][\w$]*)*$/;

    function act(fn, args, opts) {
        opts = opts || {};
        var ev = opts.on || 'click';
        if (EVENTS.indexOf(ev) === -1 || !FN_RE.test(String(fn))) throw new Error('BQSafe.act: bad handler');
        allowed[fn] = 1;
        var out = ' data-bq-' + ev + '="' + esc(fn) + '"';
        if (args && args.length) out += ' data-bq-' + ev + '-args="' + esc(JSON.stringify(args)) + '"';
        if (opts.stop) out += ' data-bq-' + ev + '-stop="1"';
        if (opts.prevent) out += ' data-bq-' + ev + '-prevent="1"';
        return out;
    }
    function resolve(fn) {
        if (!allowed[fn] || !FN_RE.test(fn)) return null;
        var parts = fn.split('.'), o = root, ctx = root;
        for (var i = 0; i < parts.length; i++) {
            if (parts[i] === '__proto__' || parts[i] === 'prototype' || parts[i] === 'constructor') return null;
            ctx = o; o = o ? o[parts[i]] : undefined;
        }
        return typeof o === 'function' ? { f: o, ctx: ctx } : null;
    }
    function revive(a, el, e) {
        if (Array.isArray(a)) return a.map(function (x) { return revive(x, el, e); });
        if (a && typeof a === 'object') {
            if (a.$bqEl === 1) return el;
            if (a.$bqEv === 1) return e;
        }
        return a;
    }
    function runOn(el, attr, e) {
        var r = resolve(el.getAttribute(attr) || '');
        if (!r) return;
        var args = [];
        var raw = el.getAttribute(attr + '-args');
        if (raw) { try { args = JSON.parse(raw); } catch (_) { return; } }
        if (!Array.isArray(args)) return;
        // window.open only ever gets an http(s)/same-origin URL
        if (r.f === root.open) { args[0] = url(args[0]); if (!args[0]) return; }
        if (el.getAttribute(attr + '-stop') === '1') e.stopPropagation();
        if (el.getAttribute(attr + '-prevent') === '1') e.preventDefault();
        try { r.f.apply(el, revive(args, el, e)); }
        catch (err) { if (root.console) root.console.error(err); }
    }
    // Inline on*= handlers ran on their own element during the bubble phase,
    // so stopPropagation() there still let other listeners on that element run
    // and only stopped ancestors. To keep exactly that behavior, the capture
    // listener below does not run actions itself: it arms a one-shot listener on
    // each element in the event path that has an action, and that listener only
    // fires for this same event object.
    var armed = typeof WeakMap === 'function' ? new WeakMap() : null;
    function arm(el, attr, e) {
        var key = e.type, prev = armed && armed.get(el);
        if (prev && prev[key]) el.removeEventListener(key, prev[key]);
        var h = function (ev) {
            el.removeEventListener(key, h);
            if (prev2 && prev2[key] === h) delete prev2[key];
            if (ev !== e) return;
            runOn(el, attr, ev);
        };
        var prev2 = prev || {};
        prev2[key] = h;
        if (armed) armed.set(el, prev2);
        el.addEventListener(key, h);
    }
    function dispatch(e) {
        var type = e.type, attr = 'data-bq-' + type;
        var t = e.target;
        if (t && t.nodeType !== 1) t = t.parentElement;
        if (!t || !t.getAttribute) return;
        // mouseenter/mouseleave/error do not bubble: only the target itself.
        if (type === 'mouseenter' || type === 'mouseleave' || type === 'error') {
            if (t.hasAttribute(attr)) runOn(t, attr, e);
            return;
        }
        var el = t.closest ? t.closest('[' + attr + ']') : null;
        while (el) {
            arm(el, attr, e);
            el = el.parentElement ? el.parentElement.closest('[' + attr + ']') : null;
        }
    }
    function install(doc) {
        if (!doc || !doc.addEventListener || doc.__bqSafeInstalled) return;
        doc.__bqSafeInstalled = true;
        EVENTS.forEach(function (t) { doc.addEventListener(t, dispatch, true); });
    }
    // Capture phase only finds the elements; actions run on the elements (see arm()).
    install(root.document);

    // Scripts that load before the bundle (ranking.js, auth-display.js, …) used
    // `typeof escapeHtml === 'function' ? escapeHtml(x) : x`, which rendered x RAW
    // until utils.js arrived. Define the shared escaper now; utils.js keeps the
    // same behavior when it redefines it.
    if (typeof root.escapeHtml !== 'function') root.escapeHtml = function (s) { return s ? esc(s) : ''; };

    root.BQSafe = {
        __v: 1, esc: esc, attr: esc, url: url, img: img, id: id, text: text,
        act: act, jsStr: jsStr, num: num, lit: lit, cleanHtml: cleanHtml, EL: EL, EV: EV, _dispatch: dispatch, _install: install,
        _allowed: function (fn) { return !!allowed[fn]; }
    };
})(typeof window !== 'undefined' ? window : this);
