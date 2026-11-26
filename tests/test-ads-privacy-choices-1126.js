#!/usr/bin/env node
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const increments = [];
const callableCalls = [];

function loadAds(opts) {
    opts = opts || {};
    increments.length = 0;
    const store = opts.store || Object.create(null);
    const docs = opts.docs || {};
    const authState = { currentUser: opts.authUser || null };
    const sandbox = {
        console,
        Date,
        Math,
        Intl,
        Uint8Array,
        Number,
        String,
        Boolean,
        Array,
        Object,
        JSON,
        Promise,
        isFinite,
        module: { exports: {} },
        exports: {},
        BQ_ADS_NO_BOOT: true,
        BQ_ADS_TEST_EXPORTS: true,
        process: { versions: { node: process.versions.node } },
        BQ_ADS_HOLDOUT_PCT: opts.holdoutPct,
        ADS_EEA_ENABLED: opts.eeaEnabled,
        BQ_ADS_EEA_ENABLED: opts.bqEeaEnabled,
        navigator: opts.navigator || {},
        localStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, k) ? store[k] : null; },
            setItem: function (k, v) { store[k] = String(v); },
            removeItem: function (k) { delete store[k]; },
            clear: function () { Object.keys(store).forEach(function (k) { delete store[k]; }); }
        },
        sessionStorage: {
            getItem: function (k) { return Object.prototype.hasOwnProperty.call(store, 'sess:' + k) ? store['sess:' + k] : null; },
            setItem: function (k, v) { store['sess:' + k] = String(v); },
            removeItem: function (k) { delete store['sess:' + k]; }
        },
        firebase: {
            firestore: function () {
                return {
                    collection: function (name) {
                        return {
                            doc: function (id) {
                                return {
                                    get: function () {
                                        const data = docs[name + '/' + id];
                                        return Promise.resolve({
                                            exists: !!data,
                                            metadata: { fromCache: false },
                                            data: function () { return data ? Object.assign({}, data) : undefined; }
                                        });
                                    },
                                    set: function (data, maybe) {
                                        increments.push({ collection: name, id: id, data: data, merge: !!(maybe && maybe.merge) });
                                        return Promise.resolve();
                                    }
                                };
                            }
                        };
                    }
                };
            },
            functions: function () {
                return {
                    httpsCallable: function (name) {
                        return function (payload) {
                            callableCalls.push({ name: name, payload: payload });
                            if (opts.callableReject) return Promise.reject(new Error('not deployed'));
                            return Promise.resolve({ data: { ok: true, optedOut: !!(payload && payload.optedOut) } });
                        };
                    }
                };
            }
        },
        currentUser: opts.user || null,
        currentPage: opts.page || 'home',
        location: { pathname: opts.path || '/', hash: opts.hash || '' },
        fetch: opts.fetch || undefined,
        document: opts.document || undefined,
        window: undefined
    };
    sandbox.firebase.firestore.FieldValue = {
        increment: function (n) { return { _inc: n }; }
    };
    sandbox.firebase.auth = function () {
        return authState;
    };
    sandbox.global = sandbox;
    sandbox.root = sandbox;
    sandbox.window = sandbox;
    sandbox.authState = authState;
    sandbox.docs = docs;
    if (opts.clearStore) Object.keys(store).forEach(function (k) { delete store[k]; });
    const code = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    vm.runInNewContext(code, sandbox, { filename: 'ads.js' });
    sandbox.store = store;
    sandbox.bqAdsPublic = sandbox.bqAds;
    sandbox.api = sandbox.module.exports || sandbox.bqAds;
    return sandbox;
}

function makeDocument() {
    const byId = Object.create(null);
    const all = [];

    function walk(node, acc) {
        acc.push(node);
        const kids = node.childNodes || node.children || [];
        for (let i = 0; i < kids.length; i++) walk(kids[i], acc);
        return acc;
    }

    function attrVal(node, name) {
        if (typeof node.getAttribute === 'function') return node.getAttribute(name);
        return null;
    }

    function matchOne(node, sel) {
        sel = String(sel).trim();
        if (!sel) return false;
        if (sel.charAt(0) === '#') return node.id === sel.slice(1);
        let rest = sel;
        let tag = null;
        const tagM = rest.match(/^([a-zA-Z][\w-]*)/);
        if (tagM) {
            tag = tagM[1].toUpperCase();
            rest = rest.slice(tagM[1].length);
        }
        if (tag && String(node.tagName || '').toUpperCase() !== tag) return false;
        while (rest) {
            if (rest.charAt(0) === '.') {
                const m = rest.match(/^\.([\w-]+)/);
                if (!m) return false;
                const cls = (node.className || '') + '';
                if ((' ' + cls + ' ').indexOf(' ' + m[1] + ' ') < 0) return false;
                rest = rest.slice(m[0].length);
                continue;
            }
            if (rest.charAt(0) === '[') {
                const m = rest.match(/^\[([^\]]+)\]/);
                if (!m) return false;
                const body = m[1];
                rest = rest.slice(m[0].length);
                let neg = false;
                let chk = body;
                // :not(.hidden) is handled after the loop below isn't enough;
                // we parse it as a trailing pseudo if present.
                const contains = body.match(/^([^\*\~\|\$\^=]+)(\*=)="([^"]*)"$/) || body.match(/^([^\*\~\|\$\^=]+)(\*=)='([^']*)'$/);
                const eq = !contains && (body.match(/^([^=]+)="([^"]*)"$/) || body.match(/^([^=]+)='([^']*)'$/));
                const starts = body.match(/^([^\]]+)\^="([^"]*)"$/);
                if (contains) {
                    const val = attrVal(node, contains[1]) || (contains[1] === 'src' ? node.src : '') || '';
                    if (String(val).indexOf(contains[3]) === -1) return false;
                } else if (starts) {
                    const val = attrVal(node, starts[1]) || (starts[1] === 'id' ? node.id : '') || '';
                    if (String(val).indexOf(starts[2]) !== 0) return false;
                } else if (eq) {
                    const val = attrVal(node, eq[1]);
                    if (String(val) !== eq[2]) return false;
                } else if (body.indexOf('^="') !== -1) {
                    const p = body.split('^="');
                    const name = p[0];
                    const prefix = p[1].replace(/"$/, '');
                    const val = attrVal(node, name) || (name === 'id' ? node.id : '') || '';
                    if (String(val).indexOf(prefix) !== 0) return false;
                } else {
                    if (attrVal(node, body) == null && !(body === 'id' && node.id)) return false;
                }
                continue;
            }
            if (rest.indexOf(':not(') === 0) {
                const m = rest.match(/^:not\(([^)]+)\)/);
                if (!m) return false;
                if (matchOne(node, m[1])) return false;
                rest = rest.slice(m[0].length);
                continue;
            }
            return false;
        }
        return true;
    }

    function qAll(root, sel) {
        const parts = String(sel).split(',').map(function (x) { return x.trim(); }).filter(Boolean);
        const acc = [];
        const nodes = walk(root, []);
        for (let i = 0; i < nodes.length; i++) {
            for (let p = 0; p < parts.length; p++) {
                if (matchOne(nodes[i], parts[p])) {
                    acc.push(nodes[i]);
                    break;
                }
            }
        }
        return acc;
    }

    function parseAttrs(el, attrStr) {
        const re = /([:\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
        let m;
        while ((m = re.exec(attrStr || ''))) {
            const name = m[1];
            const val = m[2] != null ? m[2] : (m[3] != null ? m[3] : (m[4] != null ? m[4] : ''));
            el.setAttribute(name, val);
        }
    }

    function createEl(tag) {
        const attrs = Object.create(null);
        const children = [];
        const node = {
            tagName: String(tag).toUpperCase(),
            nodeType: 1,
            id: '',
            className: '',
            hidden: false,
            src: '',
            href: '',
            _html: '',
            textContent: '',
            parentNode: null,
            children: children,
            childNodes: children,
            style: { cssText: '' },
            tabIndex: 0,
            classList: {
                contains: function (c) {
                    return (' ' + node.className + ' ').indexOf(' ' + c + ' ') >= 0;
                },
                add: function (c) {
                    if (!this.contains(c)) node.className = (node.className + ' ' + c).trim();
                },
                remove: function (c) {
                    node.className = node.className.split(/\s+/).filter(function (x) { return x && x !== c; }).join(' ');
                }
            },
            setAttribute: function (k, v) {
                const key = String(k);
                attrs[key.toLowerCase()] = String(v);
                if (key === 'id') {
                    node.id = String(v);
                    byId[node.id] = node;
                }
                if (key === 'src') node.src = String(v);
                if (key === 'class' || key === 'className') node.className = String(v);
                if (key === 'hidden') node.hidden = String(v) !== 'false';
            },
            getAttribute: function (k) {
                const key = String(k).toLowerCase();
                if (key === 'id') return node.id || null;
                if (key === 'src') return node.src || (attrs.src != null ? attrs.src : null);
                if (key === 'class') return node.className || null;
                return attrs[key] != null ? attrs[key] : null;
            },
            appendChild: function (ch) {
                ch.parentNode = node;
                children.push(ch);
                if (ch.id) byId[ch.id] = ch;
                all.push(ch);
                return ch;
            },
            removeChild: function (ch) {
                const i = children.indexOf(ch);
                if (i >= 0) children.splice(i, 1);
                ch.parentNode = null;
                if (ch.id && byId[ch.id] === ch) delete byId[ch.id];
            },
            addEventListener: function () {},
            focus: function () {},
            querySelector: function (sel) { return qAll(node, sel)[0] || null; },
            querySelectorAll: function (sel) { return qAll(node, sel); }
        };
        Object.defineProperty(node, 'innerHTML', {
            get: function () { return node._html; },
            set: function (html) {
                // Drop previously parsed children so a clear resets the tree.
                for (let i = children.length - 1; i >= 0; i--) {
                    const ch = children[i];
                    if (ch.id && byId[ch.id] === ch) delete byId[ch.id];
                }
                children.length = 0;
                node._html = html == null ? '' : String(html);
                const tagRe = /<([a-zA-Z][\w-]*)([^>]*)>/g;
                let m;
                while ((m = tagRe.exec(node._html))) {
                    const child = createEl(m[1]);
                    parseAttrs(child, m[2]);
                    child.parentNode = node;
                    children.push(child);
                    all.push(child);
                    if (child.id) byId[child.id] = child;
                }
            }
        });
        return node;
    }

    const documentElement = createEl('html');
    const head = createEl('head');
    const body = createEl('body');
    documentElement.appendChild(head);
    documentElement.appendChild(body);

    const document = {
        readyState: 'complete',
        documentElement: documentElement,
        head: head,
        body: body,
        getElementById: function (id) { return byId[id] || null; },
        getElementsByTagName: function (tag) {
            tag = String(tag).toUpperCase();
            return qAll(documentElement, tag);
        },
        querySelector: function (sel) { return qAll(documentElement, sel)[0] || null; },
        querySelectorAll: function (sel) { return qAll(documentElement, sel); },
        createElement: function (tag) { return createEl(tag); },
        addEventListener: function () {}
    };
    return document;
}

function loadAdsDom(opts) {
    opts = opts || {};
    const document = opts.document || makeDocument();
    const env = loadAds(Object.assign({}, opts, { document: document }));
    env.document = document;
    if (opts.authReady !== false) {
        env._bqAdsAuthReady = true;
        env._bqAdsUserUnknown = false;
    }
    return env;
}

async function withEligibleDoc(env, prefix) {
    const ads = env.api;
    const user = eligibleUser(ads, prefix);
    env.authState.currentUser = { uid: user.uid, isAnonymous: false };
    env.docs['users/' + user.uid] = { username: 'x', over18: true };
    await ads.fetchFreshUserDoc(user.uid);
    assert.ok(ads.getFreshUserDoc() && ads.getFreshUserDoc().uid === user.uid);
    return user;
}

function adsenseScripts(document) {
    const scripts = document.getElementsByTagName('script');
    const out = [];
    for (let i = 0; i < scripts.length; i++) {
        const src = scripts[i].src || '';
        if (src.indexOf('adsbygoogle.js') !== -1) out.push(scripts[i]);
    }
    return out;
}

function eligibleUid(ads, prefix) {
    for (let i = 0; i < 400; i++) {
        if (!ads.inHoldout((prefix || 'ok') + i)) return (prefix || 'ok') + i;
    }
    return (prefix || 'ok') + '0';
}

function eligibleUser(ads, prefix) {
    return { uid: eligibleUid(ads, prefix), over18: true };
}

let passed = 0, failed = 0;
function test(name, fn) {
    return function () {
        increments.length = 0;
        callableCalls.length = 0;
        return Promise.resolve().then(function () {
            return fn();
        }).then(function () {
            console.log('✅ ' + name);
            passed++;
        }).catch(function (e) {
            console.log('❌ ' + name + ': ' + (e && e.stack ? e.stack : e));
            failed++;
        });
    };
}

const pending = [];
pending.push(test('GPC forces AdSense npa and skips A-ADS for an eligible user', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: true } });
    const ads = env.api;
    const user = eligibleUser(ads, 'gpc');
    const d = ads.decide({ user: user, surface: 'home', path: '/' });
    assert.strictEqual(d.show, true);
    assert.strictEqual(d.npa, true);
    assert.strictEqual(d.skipAads, true);
    assert.strictEqual(d.privacyOptOut, true);
    assert.strictEqual(ads.shouldSkipAads({ user: user }), true);
    assert.ok(ads.adsenseScriptSrc(true).indexOf('npa=1') !== -1);
    assert.ok(ads.adsenseScriptSrc(false).indexOf('npa=1') === -1);
    assert.strictEqual(ads.adsenseScriptSrc(false), ads.ADSENSE_SRC || env.api.ADSENSE_CLIENT && ads.adsenseScriptSrc(false));
    assert.ok(ads.adsenseScriptSrc(false).indexOf('pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7244515226002177') !== -1);
    ads.applyNonPersonalizedAds(true);
    assert.strictEqual(env.adsbygoogle.requestNonPersonalizedAds, 1);
}));

pending.push(test('the Your Privacy Choices toggle forces npa and is stored locally', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const user = eligibleUser(ads, 'tog');
    assert.strictEqual(ads.isPrivacyShareOptedOut({ user: user, gpc: false }), false);
    ads.setShareOptOut(true);
    assert.strictEqual(env.store['bq_privacy_share_opt_out'], '1');
    const d = ads.decide({ user: user, surface: 'learning-quests', gpc: false });
    assert.strictEqual(d.show, true);
    assert.strictEqual(d.npa, true);
    assert.strictEqual(d.skipAads, true);
    ads.setShareOptOut(false);
    const d2 = ads.decide({ user: user, surface: 'learning-quests', gpc: false });
    assert.strictEqual(d2.npa, false);
    assert.strictEqual(d2.skipAads, false);
    assert.strictEqual(d2.show, true);
}));

pending.push(test('an account privacyShareOptOut field forces npa even without local storage', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const user = eligibleUser(ads, 'acct');
    user.privacyShareOptOut = true;
    const d = ads.decide({ user: user, surface: 'home', gpc: false });
    assert.strictEqual(d.npa, true);
    assert.strictEqual(d.skipAads, true);
}));

pending.push(test('EEA, UK, and Switzerland get no ads while ADS_EEA_ENABLED is off', function () {
    const env = loadAds();
    const ads = env.api;
    assert.strictEqual(ads.eeaAdsEnabled(), false);
    const user = eligibleUser(ads, 'eea');
    ['DE', 'FR', 'GB', 'CH', 'IE', 'NL', 'NO', 'IS', 'LI'].forEach(function (cc) {
        const d = ads.decide({ user: user, surface: 'home', country: cc });
        assert.strictEqual(d.show, false, cc);
        assert.strictEqual(d.reason, 'geo', cc);
        assert.strictEqual(d.experimentGroup, null, cc);
        assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: cc }), false, cc);
    });
}));

pending.push(test('unknown country and failed country codes fail closed', function () {
    const env = loadAds();
    const ads = env.api;
    const user = eligibleUser(ads, 'unk');
    const cases = [null, '', 'XX', 'T1'];
    cases.forEach(function (cc) {
        const d = ads.decide({ user: user, surface: 'home', country: cc });
        assert.strictEqual(d.show, false, String(cc));
        assert.strictEqual(d.reason, 'geo', String(cc));
        assert.strictEqual(d.experimentGroup, null, String(cc));
    });
}));

pending.push(test('a US user still sees ads, and existing eligibility rules are unchanged', function () {
    const env = loadAds();
    const ads = env.api;
    const user = eligibleUser(ads, 'us');
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'US' }), true);
    assert.strictEqual(ads.decide({ user: user, surface: 'home', country: 'US' }).reason, null);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'arcade', country: 'US' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: 'p', premium: { active: true }, over18: true }, surface: 'home', country: 'US' }), false);
    assert.strictEqual(ads.decide({ user: { uid: 'p', premium: { active: true }, over18: true }, surface: 'home', country: 'US' }).reason, 'premium');
    assert.strictEqual(ads.shouldShowAds({ user: { uid: 'k', kids: true, over18: true }, surface: 'home', country: 'US' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: 'g', isAnonymous: true, over18: true }, surface: 'home', country: 'US' }), false);
    assert.strictEqual(ads.shouldShowAds({ user: { uid: user.uid, over18: true }, surface: 'timechain-tv', country: 'US' }), false);
    assert.strictEqual(ads.decide({ user: { uid: user.uid, over18: true }, surface: 'timechain-tv', country: 'US' }).reason, 'tctv');
    // Omitting country keeps the previous decide() contract for unit tests.
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'forum' }), false);
}));

pending.push(test('ADS_EEA_ENABLED lets a known EEA country through but still fails closed on unknown', function () {
    const env = loadAds({ eeaEnabled: true });
    const ads = env.api;
    assert.strictEqual(ads.eeaAdsEnabled(), true);
    const user = eligibleUser(ads, 'flag');
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'DE' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'GB' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'CH' }), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: null }), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'home', country: null }).reason, 'geo');
}));

pending.push(test('BQ_ADS_EEA_ENABLED is the same flag under the existing BQ_ prefix', function () {
    const env = loadAds({ bqEeaEnabled: true });
    const ads = env.api;
    const user = eligibleUser(ads, 'bqflag');
    assert.strictEqual(ads.eeaAdsEnabled(), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home', country: 'FR' }), true);
}));

pending.push(test('/cdn-cgi/trace loc= is parsed, and a missing loc is unknown', function () {
    const env = loadAds();
    const ads = env.api;
    assert.strictEqual(ads.TRACE_PATH, '/cdn-cgi/trace');
    assert.strictEqual(ads.parseTraceCountry('fl=1\nh=bitcoineducation.quest\nloc=DE\ncolo=FRA\n'), 'DE');
    assert.strictEqual(ads.parseTraceCountry('loc=us\n'), 'US');
    assert.strictEqual(ads.parseTraceCountry('hello'), null);
    assert.strictEqual(ads.parseTraceCountry(''), null);
}));

pending.push(test('ensureGeo uses /cdn-cgi/trace and fails closed when the fetch fails', async function () {
    const env = loadAds({
        fetch: function (url) {
            assert.strictEqual(url, '/cdn-cgi/trace');
            return Promise.reject(new Error('offline'));
        }
    });
    const ads = env.api;
    const user = eligibleUser(ads, 'fetchfail');
    const country = await ads.ensureGeo();
    assert.strictEqual(country, null);
    assert.strictEqual(ads.isGeoBlocked({}), true);
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home' }), false);
    assert.strictEqual(ads.decide({ user: user, surface: 'home' }).reason, 'geo');
}));

pending.push(test('ensureGeo with loc=US unblocks ads for an eligible user', async function () {
    const env = loadAds({
        fetch: function () {
            return Promise.resolve({ ok: true, text: function () { return Promise.resolve('h=bitcoineducation.quest\nloc=US\n'); } });
        }
    });
    const ads = env.api;
    const user = eligibleUser(ads, 'fetchus');
    await ads.ensureGeo();
    assert.strictEqual(ads.shouldShowAds({ user: user, surface: 'home' }), true);
}));

pending.push(test('A-ADS is skipped on GPC because its policy allows cookies and device identifiers', function () {
    const env = loadAds({ navigator: { globalPrivacyControl: true } });
    const ads = env.api;
    const user = eligibleUser(ads, 'aads');
    assert.strictEqual(ads.shouldSkipAads({ user: user }), true);
    const src = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    assert.ok(src.indexOf("A-ADS's policy allows cookies") !== -1 || src.indexOf('A-ADS') !== -1);
}));

pending.push(test('the official AdSense client tag is unchanged when npa is off, for Funding Choices', function () {
    const env = loadAds();
    const ads = env.api;
    const src = ads.adsenseScriptSrc(false);
    assert.strictEqual(src, 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-7244515226002177');
    assert.ok(src.indexOf('npa=') === -1);
    const worker = fs.readFileSync(path.join(root, 'workers/seo-router/worker.js'), 'utf8');
    assert.ok(worker.indexOf('https://fundingchoicesmessages.google.com') !== -1);
    const firebase = fs.readFileSync(path.join(root, 'firebase.json'), 'utf8');
    assert.ok(firebase.indexOf('https://fundingchoicesmessages.google.com') !== -1);
}));

pending.push(test('index.html and 404.html have the footer link, the hash handoff, and stay identical', function () {
    const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
    const html404 = fs.readFileSync(path.join(root, '404.html'), 'utf8');
    assert.strictEqual(html, html404);
    assert.ok(html.indexOf('Your Privacy Choices') !== -1);
    assert.ok(html.indexOf('href="#privacy-choices"') !== -1);
    assert.ok(html.indexOf("btc_open_privacy_choices") !== -1);
    assert.ok(html.indexOf('id="bqSitePrivacyFooter"') !== -1);
    assert.ok(html.indexOf('src="/ads.js?v=20261126_v2714"') !== -1);
    assert.ok(html.indexOf('src="/ranking.js?v=20261126_v2714"') !== -1);
    const settings = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(settings.indexOf('id="bqPrivacyChoices"') !== -1);
    assert.ok(settings.indexOf('Do not sell or share my personal information') !== -1);
}));

pending.push(test('legal and support pages link to Your Privacy Choices', function () {
    const files = ['privacy.html', 'terms.html', 'deletion.html', 'dmca.html', 'tctv-terms.html', 'raffle-rules.html', 'patch-notes.html', 'resets.html', 'waitlist.html', 'tv.html', 'bea-promo.html', 'needisbored.html', 'needisbored/index.html', 'weekly_signal_draft.html'];
    files.forEach(function (name) {
        const html = fs.readFileSync(path.join(root, name), 'utf8');
        assert.ok(html.indexOf('Your Privacy Choices') !== -1, name);
        assert.ok(html.indexOf('privacy-choices') !== -1, name);
    });
}));

pending.push(test('firestore.rules are unchanged: no new client-writable privacy field', function () {
    const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
    assert.ok(rules.indexOf('privacyShareOptOut') === -1);
    assert.ok(rules.indexOf('match /ads_holdout_stats/{day}') !== -1);
}));

pending.push(test('the callable name is setPrivacyShareOptOut and the default EEA flag is off', function () {
    const env = loadAds();
    const ads = env.api;
    assert.strictEqual(ads.CALLABLE_NAME, 'setPrivacyShareOptOut');
    assert.strictEqual(ads.ACCOUNT_OPTOUT_FIELD, 'privacyShareOptOut');
    assert.strictEqual(ads.eeaAdsEnabled(), false);
    const src = fs.readFileSync(path.join(root, 'functions/index.js'), 'utf8');
    assert.ok(src.indexOf('exports.setPrivacyShareOptOut') !== -1);
    const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
    assert.ok(sw.indexOf("const CACHE_NAME = 'btc-archive-v2716'") !== -1);
}));

pending.push(test('opt-out does not put AdSense on home, including when the claim modal is open', async function () {
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const document = env.document;
    ads.rememberCountry('US');
    const user = await withEligibleDoc(env, 'f1home');
    ads.setShareOptOut(true);
    const home = document.createElement('div');
    home.className = 'bq-ad-slot';
    document.body.appendChild(home);
    const d = ads.decide({ user: user, surface: 'home', country: 'US', gpc: false });
    assert.strictEqual(d.show, true);
    assert.strictEqual(d.skipAads, true);
    ads.fillSlot(home, d, { user: user, surface: 'home', country: 'US', gpc: false }, false);
    assert.ok(home.hidden || !home.innerHTML || home.innerHTML.indexOf('adsbygoogle') === -1);
    assert.strictEqual(adsenseScripts(document).length, 0);

    ads.setShareOptOut(false);
    const claim = document.createElement('div');
    claim.id = 'claimModal';
    claim.hidden = false;
    document.body.appendChild(claim);
    const learn = document.createElement('div');
    learn.className = 'bq-ad-slot';
    document.body.appendChild(learn);
    const d2 = ads.decide({ user: user, surface: 'learning-quests', country: 'US', gpc: false });
    assert.strictEqual(d2.show, true);
    ads.fillSlot(learn, d2, { user: user, surface: 'learning-quests', country: 'US', gpc: false }, true);
    assert.ok(learn.hidden || !learn.innerHTML || learn.innerHTML.indexOf('adsbygoogle') === -1);
    assert.strictEqual(adsenseScripts(document).length, 0);
    assert.strictEqual(ads.adsenseAllowed(d2, { user: user, surface: 'learning-quests', country: 'US' }), false);
}));

pending.push(test('a mid-session opt-out removes the personalized tag so the next fill loads npa=1', async function () {
    const reloads = [];
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    env.BQ_ADS_RELOAD = function () { reloads.push(1); };
    const ads = env.api;
    const document = env.document;
    ads.rememberCountry('US');
    const user = await withEligibleDoc(env, 'f2npa');
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    document.body.appendChild(slot);
    const d = ads.decide({ user: user, surface: 'learning-quests', country: 'US', gpc: false });
    assert.strictEqual(d.npa, false);
    ads.fillSlot(slot, d, { user: user, surface: 'learning-quests', country: 'US', gpc: false }, true);
    const before = adsenseScripts(document);
    assert.strictEqual(before.length, 1);
    assert.ok(before[0].src.indexOf('npa=1') === -1);
    assert.ok(slot.innerHTML.indexOf('adsbygoogle') !== -1);

    ads.setShareOptOut(true);
    assert.ok(slot.hidden || !slot.innerHTML || slot.innerHTML.indexOf('adsbygoogle') === -1);
    assert.strictEqual(document.querySelectorAll('ins.adsbygoogle').length, 0);
    const mid = adsenseScripts(document);
    mid.forEach(function (s) {
        assert.ok(s.src.indexOf('npa=1') !== -1);
    });

    const d2 = ads.decide({ user: user, surface: 'learning-quests', country: 'US', gpc: false });
    assert.strictEqual(d2.npa, true);
    ads.fillSlot(slot, d2, { user: user, surface: 'learning-quests', country: 'US', gpc: false }, true);
    const after = adsenseScripts(document);
    assert.ok(after.length >= 1);
    after.forEach(function (s) {
        assert.ok(s.src.indexOf('npa=1') !== -1, s.src);
    });
    assert.ok(slot.innerHTML.indexOf('adsbygoogle') !== -1);
}));

pending.push(test('a mid-page GPC signal clears personalized slots immediately', async function () {
    const nav = { globalPrivacyControl: false };
    const env = loadAdsDom({ navigator: nav });
    env.BQ_ADS_RELOAD = function () {};
    const ads = env.api;
    const document = env.document;
    ads.rememberCountry('US');
    const user = await withEligibleDoc(env, 'gpcnow');
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    document.body.appendChild(slot);
    const d = ads.decide({ user: user, surface: 'learning-quests', country: 'US' });
    ads.fillSlot(slot, d, { user: user, surface: 'learning-quests', country: 'US' }, true);
    assert.ok(slot.innerHTML.indexOf('adsbygoogle') !== -1);
    nav.globalPrivacyControl = true;
    ads.watchPrivacySignals();
    assert.ok(slot.hidden || !slot.innerHTML || slot.innerHTML.indexOf('adsbygoogle') === -1);
    assert.strictEqual(ads.isPrivacyShareOptedOut({ user: user }), true);
}));

pending.push(test('a fill before boot or geo starts is blocked when document is present', function () {
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const document = env.document;
    const user = eligibleUser(ads, 'pregeo');
    assert.strictEqual(ads.fillsBlocked({ user: user, surface: 'home' }), true);
    assert.strictEqual(ads.isGeoBlocked({ user: user, surface: 'home' }), true);
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    slot.innerHTML = 'pending';
    document.body.appendChild(slot);
    const d = ads.decide({ user: user, surface: 'learning-quests' });
    ads.fillSlot(slot, d, { user: user, surface: 'learning-quests' }, true);
    assert.ok(slot.hidden || slot.innerHTML.indexOf('adsbygoogle') === -1);
    assert.ok(slot.innerHTML.indexOf('acceptable.a-ads.com') === -1);
    assert.strictEqual(adsenseScripts(document).length, 0);
    ads.rememberCountry('US');
    assert.strictEqual(ads.fillsBlocked({ user: user, surface: 'home', country: 'US' }), false);
}));

pending.push(test('ads.js peeks at btc_open_privacy_choices and does not consume it', function () {
    const env = loadAdsDom();
    const ads = env.api;
    env.store['sess:btc_open_privacy_choices'] = '1';
    assert.strictEqual(ads.privacyChoicesOpenRequested(), true);
    assert.strictEqual(env.store['sess:btc_open_privacy_choices'], '1');
    const src = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    assert.ok(src.indexOf("sessionStorage.removeItem('btc_open_privacy_choices')") === -1);
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    assert.ok(ranking.indexOf("sessionStorage.removeItem('btc_open_privacy_choices')") !== -1);
}));

pending.push(test('the settings and modal GPC notes use different ids', function () {
    const ranking = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
    const src = fs.readFileSync(path.join(root, 'ads.js'), 'utf8');
    assert.ok(ranking.indexOf('id="bqPrivacyChoicesGpcNote"') !== -1);
    assert.ok(ranking.indexOf('bqPrivacyChoicesModalGpcNote') === -1);
    assert.ok(src.indexOf('id="bqPrivacyChoicesModalGpcNote"') !== -1);
    const modalIds = src.split('id="bqPrivacyChoicesGpcNote"').length - 1;
    assert.strictEqual(modalIds, 0);
    const env = loadAdsDom({ navigator: { globalPrivacyControl: true } });
    const ads = env.api;
    ads.openPrivacyChoices();
    const modalNote = env.document.getElementById('bqPrivacyChoicesModalGpcNote');
    assert.ok(modalNote);
    assert.strictEqual(modalNote.hidden, false);
    assert.strictEqual(env.document.getElementById('bqPrivacyChoicesGpcNote'), null);
}));

pending.push(test('DEPLOY-LIST.md lists the callable and CSP publishes as needing Phil\'s OK', function () {
    const list = fs.readFileSync(path.join(root, 'DEPLOY-LIST.md'), 'utf8');
    assert.ok(list.indexOf('setPrivacyShareOptOut') !== -1);
    assert.ok(list.indexOf('seo-router') !== -1);
    assert.ok(list.indexOf('firebase.json') !== -1);
    assert.ok(list.indexOf("Phil's OK") !== -1);
    assert.ok(list.indexOf('fundingchoicesmessages.google.com') !== -1);
}));

pending.push(test('browser console cannot fill ads or override country', async function () {
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    const pub = env.bqAdsPublic;
    const ads = env.api;
    const document = env.document;
    assert.ok(pub);
    assert.strictEqual(typeof pub.fillAdsense, 'undefined');
    assert.strictEqual(typeof pub.fillAads, 'undefined');
    assert.strictEqual(typeof pub.fillSlot, 'undefined');
    assert.strictEqual(typeof pub.rememberCountry, 'undefined');
    assert.strictEqual(typeof ads.fillAdsense, 'function');
    assert.strictEqual(typeof ads.rememberCountry, 'function');

    ads.rememberCountry('DE');
    const adult = await withEligibleDoc(env, 'n1geo');
    const d = pub.decide({ user: adult, surface: 'home', country: 'US' });
    assert.strictEqual(d.show, false);
    assert.strictEqual(d.reason, 'geo');
    assert.strictEqual(d.country, 'DE');
    const dSync = pub.sync({ country: 'US', surface: 'home' });
    assert.ok(!dSync || dSync.show !== true);

    ads.rememberCountry('US');
    env.docs['users/' + adult.uid] = { username: 'x', over18: false, ageUnder18: true };
    await ads.fetchFreshUserDoc(adult.uid);
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    document.body.appendChild(slot);
    ads.fillAdsense(slot, { surface: 'learning-quests', country: 'US' });
    assert.ok(slot.hidden || !slot.innerHTML || slot.innerHTML.indexOf('adsbygoogle') === -1);
    ads.fillAads(slot, { surface: 'home', country: 'US' });
    assert.ok(slot.hidden || !slot.innerHTML || slot.innerHTML.indexOf('acceptable.a-ads.com') === -1);
    assert.strictEqual(adsenseScripts(document).length, 0);
}));

pending.push(test('a GPC reload waits until the claim modal closes', async function () {
    const reloads = [];
    const nav = { globalPrivacyControl: false };
    const env = loadAdsDom({ navigator: nav });
    env.BQ_ADS_RELOAD = function () { reloads.push(1); };
    const ads = env.api;
    const document = env.document;
    ads.rememberCountry('US');
    const user = await withEligibleDoc(env, 'n2gpc');
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    document.body.appendChild(slot);
    const d = ads.decide({ user: user, surface: 'learning-quests', country: 'US' });
    ads.fillSlot(slot, d, { user: user, surface: 'learning-quests', country: 'US' }, true);
    assert.ok(slot.innerHTML.indexOf('adsbygoogle') !== -1);
    const scripts = adsenseScripts(document);
    assert.ok(scripts.some(function (el) { return (el.src || '').indexOf('npa=1') === -1; }));

    const claim = document.createElement('div');
    claim.id = 'claimModal';
    claim.hidden = false;
    document.body.appendChild(claim);

    nav.globalPrivacyControl = true;
    const result = ads.applyPrivacyChoiceNow();
    assert.strictEqual(result.deferredReload, true);
    assert.strictEqual(result.reloaded, false);
    assert.ok(slot.hidden || !slot.innerHTML || slot.innerHTML.indexOf('adsbygoogle') === -1);
    assert.strictEqual(reloads.length, 0);

    ads.watchPrivacySignals();
    assert.strictEqual(reloads.length, 0);

    claim.hidden = true;
    ads.watchPrivacySignals();
    assert.strictEqual(reloads.length, 1);
}));

pending.push(test('getFreshUserDoc returns a frozen copy, so mutating it cannot enable ads', async function () {
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const pub = env.bqAdsPublic;
    ads.rememberCountry('US');
    const adult = await withEligibleDoc(env, 'n4age');
    env.docs['users/' + adult.uid] = { username: 'x', over18: false, ageUnder18: true };
    await ads.fetchFreshUserDoc(adult.uid);
    const copy = pub.getFreshUserDoc();
    assert.ok(copy);
    assert.strictEqual(copy.uid, adult.uid);
    assert.strictEqual(copy.over18, false);
    assert.strictEqual(copy.ageUnder18, true);
    assert.ok(Object.isFrozen(copy));
    try {
        copy.over18 = true;
        copy.ageUnder18 = false;
    } catch (e) {}
    assert.strictEqual(copy.over18, false);
    assert.strictEqual(pub.getFreshUserDoc().over18, false);
    const d = pub.sync({ surface: 'home' });
    assert.strictEqual(d.show, false);
    assert.strictEqual(d.reason, 'age');
}));

pending.push(test('fetchFreshUserDoc ignores a caller-supplied db in the browser', async function () {
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    const ads = env.api;
    const pub = env.bqAdsPublic;
    ads.rememberCountry('US');
    const adult = await withEligibleDoc(env, 'n5db');
    env.docs['users/' + adult.uid] = { username: 'x', over18: false, ageUnder18: true };
    await ads.fetchFreshUserDoc(adult.uid);
    assert.strictEqual(pub.getFreshUserDoc().over18, false);

    let fakeReads = 0;
    const fakeDb = {
        collection: function () {
            return {
                doc: function () {
                    return {
                        get: function () {
                            fakeReads++;
                            return Promise.resolve({
                                exists: true,
                                metadata: { fromCache: false },
                                data: function () { return { username: 'x', over18: true, ageUnder18: false }; }
                            });
                        }
                    };
                }
            };
        }
    };
    const out = await pub.fetchFreshUserDoc(adult.uid, fakeDb);
    assert.strictEqual(fakeReads, 0);
    assert.strictEqual(out.over18, false);
    assert.strictEqual(pub.getFreshUserDoc().over18, false);
    const d = pub.sync({ surface: 'home' });
    assert.strictEqual(d.show, false);
    assert.strictEqual(d.reason, 'age');
}));

pending.push(test('sync does not refill while a privacy reload is deferred', async function () {
    const reloads = [];
    const nav = { globalPrivacyControl: false };
    const env = loadAdsDom({ navigator: nav });
    env.BQ_ADS_RELOAD = function () { reloads.push(1); };
    const ads = env.api;
    const document = env.document;
    ads.rememberCountry('US');
    const user = await withEligibleDoc(env, 'n7sync');
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    document.body.appendChild(slot);
    const d = ads.decide({ user: user, surface: 'learning-quests', country: 'US' });
    ads.fillSlot(slot, d, { user: user, surface: 'learning-quests', country: 'US' }, true);
    assert.ok(slot.innerHTML.indexOf('adsbygoogle') !== -1);

    const claim = document.createElement('div');
    claim.id = 'claimModal';
    claim.hidden = false;
    document.body.appendChild(claim);
    nav.globalPrivacyControl = true;
    const result = ads.applyPrivacyChoiceNow();
    assert.strictEqual(result.deferredReload, true);
    assert.strictEqual(reloads.length, 0);

    const blocked = ads.sync({ surface: 'learning-quests' });
    assert.strictEqual(blocked.show, false);
    assert.strictEqual(blocked.reason, 'privacy-reload');
    assert.ok(slot.hidden || !slot.innerHTML || slot.innerHTML.indexOf('adsbygoogle') === -1);
    assert.strictEqual(reloads.length, 0);
}));

pending.push(test('opting back in while the claim modal is open clears the deferred reload', async function () {
    const reloads = [];
    const env = loadAdsDom({ navigator: { globalPrivacyControl: false } });
    env.BQ_ADS_RELOAD = function () { reloads.push(1); };
    const ads = env.api;
    const document = env.document;
    ads.rememberCountry('US');
    const user = await withEligibleDoc(env, 'n8opt');
    const slot = document.createElement('div');
    slot.className = 'bq-ad-slot';
    document.body.appendChild(slot);
    const d = ads.decide({ user: user, surface: 'learning-quests', country: 'US' });
    ads.fillSlot(slot, d, { user: user, surface: 'learning-quests', country: 'US' }, true);
    assert.ok(slot.innerHTML.indexOf('adsbygoogle') !== -1);

    const claim = document.createElement('div');
    claim.id = 'claimModal';
    claim.hidden = false;
    document.body.appendChild(claim);
    ads.setShareOptOut(true);
    assert.strictEqual(reloads.length, 0);

    ads.setShareOptOut(false);
    const after = ads.sync({ surface: 'learning-quests' });
    assert.notStrictEqual(after.reason, 'privacy-reload');
    assert.strictEqual(reloads.length, 0);

    claim.hidden = true;
    ads.watchPrivacySignals();
    ads.sync({ surface: 'learning-quests' });
    assert.strictEqual(reloads.length, 0);
}));

pending.reduce(function (chain, run) {
    return chain.then(run);
}, Promise.resolve()).then(function () {

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
