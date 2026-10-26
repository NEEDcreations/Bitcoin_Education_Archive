// Claim, delete, and gift layers must paint above Settings.
// Chrome is tried first. If it hangs, the same page runs in jsdom.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');

function loadJsdom() {
    const attempts = [];
    function tryReq(id) {
        try { return require(id).JSDOM; }
        catch (e) { attempts.push(id); return null; }
    }
    let found = tryReq('jsdom');
    if (found) return found;
    const bases = [
        path.join(root, 'node_modules', 'jsdom'),
        path.join(root, 'tests', 'node_modules', 'jsdom'),
        path.join(root, 'functions', 'node_modules', 'jsdom')
    ];
    if (process.env.NODE_PATH) {
        process.env.NODE_PATH.split(path.delimiter).forEach(function(dir) {
            if (dir) bases.push(path.join(dir, 'jsdom'));
        });
    }
    for (let i = 0; i < bases.length; i++) {
        found = tryReq(bases[i]);
        if (found) return found;
    }
    throw new Error('jsdom is not installed (' + attempts.join(', ') + ')');
}

if (process.argv[2] === '--jsdom') {
    const JSDOM = loadJsdom();
    const page = fs.readFileSync(process.argv[3], 'utf8');
    const dom = new JSDOM(page, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/archive/' });
    const timer = setInterval(function() {
        const node = dom.window.document.getElementById('overlay-stack-result');
        const text = node ? node.textContent : '';
        if (text && text !== 'pending') {
            clearInterval(timer);
            process.stdout.write(text);
            process.exit(0);
        }
    }, 20);
    setTimeout(function() {
        const node = dom.window.document.getElementById('overlay-stack-result');
        process.stderr.write((node && node.textContent) || 'pending');
        process.exit(1);
    }, 20000);
    return;
}
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const gifting = read('gifting.js');
assert.ok(gifting.includes('function _placeGiftOverlay'), 'gifting.js should open through the shared helper');
assert.ok(gifting.includes('window.bqModal.open'), 'gifting.js should call bqModal.open');
assert.ok(gifting.includes('window.bqModal.layer'), 'gift confetti should use bqModal.layer');
assert.ok(!gifting.includes('window.frontOverlay'), 'gifting.js should not scan through frontOverlay');
assert.ok(!gifting.includes('window.nextOverlayZ'), 'gift confetti should not use nextOverlayZ');
assert.ok(!gifting.includes('function _raiseGiftLayer'), 'do not keep a second gift z-index scan');
assert.ok(!gifting.includes('function _numericZ'), 'do not keep a second gift z-index scan');
assert.strictEqual(read('index.html'), read('404.html'));

const utils = read('utils.js');
assert.ok(utils.includes('window.bqModal ='));
assert.ok(utils.includes('open: open'));
assert.ok(!utils.includes('window.frontOverlay'));
assert.ok(!utils.includes('window.nextOverlayZ'));
assert.ok(!utils.includes('getElementsByTagName'));
assert.ok(!utils.includes('new MutationObserver'));
assert.ok(!utils.includes('Node.prototype.appendChild'));
assert.ok(!utils.includes('Element.prototype.remove'));

const ranking = read('ranking.js');
assert.ok(ranking.includes('Sending your sats…'));
assert.ok(ranking.includes('Still sending… this can take a moment'));
assert.ok(ranking.includes("We couldn't confirm — check your balance before trying again"));
assert.ok(ranking.includes('var SATS_CLAIM_REREAD_MS = 60000;'));
assert.ok(ranking.includes('var SATS_CLAIM_HARD_MS = 120000;'));
assert.ok(ranking.includes('⚡ Sent '));
assert.ok(ranking.includes('_satsClaimFinite'));
assert.ok(ranking.includes("status === 'paid' || status === 'settled'"));
assert.ok(ranking.includes('metadata.fromCache !== false'));
assert.ok(ranking.includes('flight.snapshot.trusted'));
assert.ok(read('index.html').includes('z-index: 2147483000'));
assert.ok(!read('index.html').includes('body:has(#usernameModal.open) .rank-toast'));
assert.ok(!ranking.includes('_satsClaimLandedAmount'));
assert.ok(!ranking.includes('withdrawnDelta'));
assert.ok(!ranking.includes('var SATS_CLAIM_GIVE_UP_MS'));
assert.ok(ranking.includes('window.bqModal.open(overlay'));
assert.ok(ranking.includes("db.collection('users').doc(auth.currentUser.uid)"));

const chrome = ['/usr/local/bin/google-chrome', '/usr/bin/google-chrome', 'google-chrome'].find(function(bin) {
    if (bin === 'google-chrome') return true;
    return fs.existsSync(bin);
}) || 'google-chrome';

const htmlPath = path.join(os.tmpdir(), 'overlay-stack-test.html');
const prelude = `
window.setInterval = function() { return 0; };
window.clearInterval = function() {};
window.__lateTimers = [];
var __realSetTimeout = window.setTimeout.bind(window);
window.setTimeout = function(fn, ms) {
    ms = Number(ms) || 0;
    if (ms >= 20000) {
        window.__lateTimers.push({ ms: ms, fn: fn, ran: false });
        return window.__lateTimers.length;
    }
    if (ms >= 400) return 0;
    return __realSetTimeout(fn, ms);
};
if (typeof window.fetch !== 'function') window.fetch = function() { return Promise.reject(new Error('offline')); };
if (typeof HTMLCanvasElement !== 'undefined') {
    HTMLCanvasElement.prototype.getContext = function() { return { fillText: function() {}, measureText: function() { return { width: 10 }; } }; };
    HTMLCanvasElement.prototype.toDataURL = function() { return 'data:image/png;base64,xx'; };
}
if (typeof window.AudioContext !== 'function') {
    window.AudioContext = function() { return { currentTime: 0, state: 'running', resume: function(){}, createOscillator: function(){ return { connect: function(){}, start: function(){}, stop: function(){}, frequency: { setValueAtTime: function(){}, exponentialRampToValueAtTime: function(){} }, type: 'sine' }; }, createGain: function(){ return { connect: function(){}, gain: { setValueAtTime: function(){}, exponentialRampToValueAtTime: function(){}, value: 0 } }; }, destination: {} }; };
    window.webkitAudioContext = window.AudioContext;
}
window.speechSynthesis = window.speechSynthesis || { getVoices: function(){ return []; }, cancel: function(){}, speak: function(){} };
var __realAdd = document.addEventListener.bind(document);
document.addEventListener = function(type, fn, opt) {
    if (type === 'DOMContentLoaded') return;
    return __realAdd(type, fn, opt);
};
window.firebase = {
    initializeApp: function() {},
    appCheck: function() {
        return { activate: function() {}, getToken: function() { return Promise.resolve('tok'); } };
    },
    functions: function() {
        return { httpsCallable: function() {
            return function(payload) {
                window.__claimCalls = (window.__claimCalls || 0) + 1;
                window.__lastClaimPayload = payload;
                if (window.__claimMode === 'hang') {
                    return new Promise(function(resolve) { window.__hangResolve = resolve; });
                }
                if (window.__claimMode === 'bad-amount') return Promise.resolve({ data: { success: true, amount: '200' } });
                if (window.__claimMode === 'fail') return Promise.resolve({ data: { success: false, error: window.__failMsg } });
                return Promise.resolve({ data: { success: true, amount: 200 } });
            };
        } };
    },
    auth: function() { return { currentUser: null, setPersistence: function() { return Promise.resolve(); }, Persistence: { LOCAL: 'local' } }; },
    firestore: function() { return {}; }
};
`;

const harness = `
function __hit(el) {
    if (!el || typeof document.elementFromPoint !== 'function') return null;
    var r = el.getBoundingClientRect();
    var x = Math.min(window.innerWidth - 2, Math.max(2, r.left + Math.max(r.width, 2) / 2));
    var y = Math.min(window.innerHeight - 2, Math.max(2, r.top + Math.min(Math.max(r.height, 2) / 2, 80)));
    return document.elementFromPoint(x, y);
}
function __hitIs(el) {
    var node = __hit(el);
    if (!node) return true;
    return !!(el && (node === el || (el.contains && el.contains(node))));
}
function __z(el) {
    return parseInt(window.getComputedStyle(el).zIndex, 10) || 0;
}
function __dispatchEsc(target) {
    var ev = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    (target || document).dispatchEvent(ev);
}
async function __runOverlayTests() {
    var errors = [];
    function check(name, cond) { if (!cond) errors.push(name); }
    currentUser = {
        points: 8000,
        pointsClaimed: 0,
        pointsDonated: 0,
        pointsExchanged: 0,
        satsWithdrawn: 200,
        lightning: 'pleb@example.com',
        username: 'pleb',
        visitedChannelsList: [1,2,3,4,5,6,7,8,9,10]
    };
    auth = {
        currentUser: {
            uid: 'u1',
            isAnonymous: false,
            email: 'pleb@example.com',
            emailVerified: true,
            metadata: { creationTime: '2020-01-01T00:00:00.000Z' }
        }
    };
    function __userData() {
        if (window.__userDoc) return window.__userDoc;
        return {
            points: 6000,
            pointsClaimed: 2000,
            pointsDonated: 0,
            pointsExchanged: 0,
            satsWithdrawn: 200,
            pendingOverflow: 0
        };
    }
    db = {
        collection: function() {
            return { doc: function() { return {
                get: function() {
                    window.__userReads = (window.__userReads || 0) + 1;
                    if (window.__userReadMode === 'fail') return Promise.reject(new Error('offline'));
                    var data = __userData();
                    var snap = { data: function() { return data; } };
                    if (window.__holdReads > 0) {
                        window.__holdReads--;
                        return new Promise(function(resolve) { window.__releaseRead = function() { resolve(snap); }; });
                    }
                    return Promise.resolve(snap);
                },
                collection: function() {
                    return { get: function() {
                        if (window.__userReadMode === 'fail') return Promise.reject(new Error('offline'));
                        var rows = window.__withdrawals || [];
                        return Promise.resolve({
                            metadata: { fromCache: window.__wdFromCache === true },
                            forEach: function(fn) {
                                rows.forEach(function(row) {
                                    fn({ id: row.id, data: function() { return row; } });
                                });
                            }
                        });
                    } };
                }
            }; } };
        }
    };
    function __flush() {
        var chain = Promise.resolve();
        for (var i = 0; i < 20; i++) chain = chain.then(function() { return Promise.resolve(); });
        return chain;
    }
    function __fire(ms) {
        var list = window.__lateTimers || [];
        for (var i = list.length - 1; i >= 0; i--) {
            if (list[i].ms === ms && !list[i].ran) {
                list[i].ran = true;
                list[i].fn();
                return true;
            }
        }
        return false;
    }
    function __resetClaimUser() {
        currentUser.points = 8000;
        currentUser.pointsClaimed = 0;
        currentUser.pointsDonated = 0;
        currentUser.pointsExchanged = 0;
        currentUser.satsWithdrawn = 200;
        currentUser._pendingClaim = false;
        currentUser.lightning = 'pleb@example.com';
    }
    function __seedClaim() {
        __resetClaimUser();
        var old = document.getElementById('satsClaimOverlay');
        if (old) old.remove();
        window._satsClaimInProgress = _satsClaimBusy();
        initSatsClaim();
        var ts = document.getElementById('satsClaimTurnstile');
        if (!ts) throw new Error('no-turnstile');
        var token = document.createElement('input');
        token.setAttribute('name', 'cf-turnstile-response');
        token.value = 'tok';
        ts.appendChild(token);
    }
    var badgeHost = document.getElementById('chatOverlayBtn');
    var badge = document.getElementById('chatOverlayBadge');
    showSettingsPage('sats');
    var settings = document.getElementById('usernameModal');
    check('settings-open', settings && settings.classList.contains('open'));
    check('settings-floor', settings && __z(settings) >= 2100008);
    check('settings-not-rewritten', !settings.style.zIndex || parseInt(settings.style.zIndex, 10) >= 2100008);
    showToast('Please enter a valid email');
    var toast = document.querySelector('.rank-toast');
    check('toast-above-settings', toast && __z(toast) > __z(settings));
    if (toast) toast.remove();
    var claimBtn = null;
    var buttons = settings.querySelectorAll('button');
    for (var i = 0; i < buttons.length; i++) {
        if ((buttons[i].textContent || '').indexOf('Claim Up to') !== -1) claimBtn = buttons[i];
    }
    check('claim-button', !!claimBtn);
    if (claimBtn) {
        claimBtn.focus();
        claimBtn.click();
    }
    var claim = document.getElementById('satsClaimOverlay');
    check('claim-exists', !!claim);
    check('claim-top', __hitIs(claim));
    check('claim-z', claim && __z(claim) > __z(settings));
    check('claim-dialog', claim && claim.getAttribute('role') === 'dialog' && claim.getAttribute('aria-modal') === 'true');
    check('settings-stays-high', __z(settings) >= 2100008);
    check('badge-unmoved', badge && badge.parentElement === badgeHost);
    var focusBefore = document.activeElement;
    check('focus-inside-claim', claim && claim.contains(focusBefore));
    __dispatchEsc(focusBefore || claim);
    check('escape-closes-claim', !document.getElementById('satsClaimOverlay'));
    check('escape-keeps-settings', settings.classList.contains('open'));
    check('escape-restores-focus', document.activeElement === settings || settings.contains(document.activeElement));
    var terms = document.getElementById('tosModal');
    terms.classList.add('open');
    __seedClaim();
    var underClaim = document.getElementById('satsClaimOverlay');
    check('claim-under-terms', underClaim && __z(underClaim) < __z(terms));
    check('terms-floor', __z(terms) >= 2100010);
    if (underClaim) underClaim.remove();
    terms.classList.remove('open');

    window.__withdrawals = [];
    window.__claimMode = 'ok';
    window.__claimCalls = 0;
    __seedClaim();
    var first = submitSatsClaim();
    var second = submitSatsClaim();
    await first;
    await second;
    await __flush();
    check('one-claim-call', window.__claimCalls === 1);
    check('payload-untouched', window.__lastClaimPayload && window.__lastClaimPayload.amount === 200 && window.__lastClaimPayload.lightningAddress === 'pleb@example.com');
    var celeb = document.getElementById('satsCelebration');
    check('sent-copy', celeb && celeb.textContent.indexOf('⚡ Sent 200 sats!') !== -1);
    check('celebration-top', __hitIs(celeb));
    check('celebration-z', celeb && __z(celeb) > __z(settings));
    if (celeb) celeb.remove();
    window._satsClaimCelebLock = false;
    window._satsClaimCelebratedAt = 0;
    window._satsClaimFlightList = [];

    window.__claimMode = 'bad-amount';
    window.__claimCalls = 0;
    __seedClaim();
    await submitSatsClaim();
    await __flush();
    check('non-finite-not-sent', !document.getElementById('satsCelebration'));
    var badErr = document.getElementById('satsClaimError');
    check('non-finite-unconfirmed', badErr && badErr.textContent.indexOf("couldn't confirm") !== -1);
    var badBtn = document.getElementById('satsClaimBtn');
    check('non-finite-enabled', badBtn && badBtn.disabled === false);
    window._satsClaimFlightList = [];

    window.__claimMode = 'fail';
    window.__failMsg = 'A claim was already made from this network in the last 24 hours. Email support at info.603btc@gmail.com.';
    window.__claimCalls = 0;
    __seedClaim();
    await submitSatsClaim();
    await __flush();
    var err = document.getElementById('satsClaimError');
    var sendBtn = document.getElementById('satsClaimBtn');
    check('server-error', err && err.textContent === window.__failMsg);
    check('button-reenabled', sendBtn && sendBtn.disabled === false && (sendBtn.textContent || '').indexOf('Send Sats') !== -1);
    window._satsClaimFlightList = [];

    window.__claimMode = 'hang';
    window.__userReadMode = '';
    window.__userDoc = {
        points: 4000,
        pointsClaimed: 4000,
        satsWithdrawn: 350,
        _pendingClaim: true
    };
    window.__withdrawals = [];
    window.__claimCalls = 0;
    __seedClaim();
    var hanging = submitSatsClaim();
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    check('sending-copy', sendBtn && (sendBtn.textContent || '').indexOf('Sending your sats') !== -1);
    check('sending-live', (document.getElementById('satsClaimStatus').textContent || '').indexOf('Sending your sats') !== -1);
    check('sending-disabled', sendBtn && sendBtn.disabled === true);
    check('hang-one-call', window.__claimCalls === 1);
    var sendingOverlay = document.getElementById('satsClaimOverlay');
    if (sendingOverlay) sendingOverlay.remove();
    __seedClaim();
    sendBtn = document.getElementById('satsClaimBtn');
    check('reopen-still-sending', sendBtn && sendBtn.disabled === true && (sendBtn.textContent || '').indexOf('Sending your sats') !== -1);
    check('slow-armed', __fire(20000));
    sendBtn = document.getElementById('satsClaimBtn');
    check('slow-copy', sendBtn && (sendBtn.textContent || '').indexOf('Still sending') !== -1);
    check('slow-stays-disabled', sendBtn && sendBtn.disabled === true);
    check('reservation-armed', __fire(60000));
    await __flush();
    var errBox = document.getElementById('satsClaimError');
    sendBtn = document.getElementById('satsClaimBtn');
    check('reservation-unconfirmed', errBox && errBox.textContent.indexOf("couldn't confirm") !== -1);
    check('reservation-not-sent', !document.getElementById('satsCelebration'));
    check('reservation-stays-disabled', sendBtn && sendBtn.disabled === true);
    check('reservation-no-resend', window.__claimCalls === 1);
    check('hard-armed', __fire(120000));
    sendBtn = document.getElementById('satsClaimBtn');
    check('hard-reenables', sendBtn && sendBtn.disabled === false);
    window.__claimMode = 'fail';
    window.__failMsg = 'A claim was already made from this network in the last 24 hours. Email support at info.603btc@gmail.com.';
    window.__claimCalls = 0;
    var retry = submitSatsClaim();
    await retry;
    await __flush();
    errBox = document.getElementById('satsClaimError');
    check('retry-hides-already', !errBox || errBox.textContent.indexOf('already made') === -1);
    window.__hangResolve({ data: { success: true, amount: 200 } });
    await __flush();
    var lateCeleb = document.getElementById('satsCelebration');
    check('first-success-wins', lateCeleb && lateCeleb.textContent.indexOf('⚡ Sent 200 sats!') !== -1);
    if (lateCeleb) lateCeleb.remove();
    window._satsClaimCelebLock = false;
    window._satsClaimCelebratedAt = 0;
    window._satsClaimFlightList = [];
    void hanging;

    window.__claimMode = 'hang';
    window.__userDoc = null;
    window.__userReadMode = 'fail';
    window.__withdrawals = [];
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    check('failread-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    errBox = document.getElementById('satsClaimError');
    check('failread-message', errBox && errBox.textContent.indexOf("couldn't confirm") !== -1);
    check('failread-reenables', sendBtn && sendBtn.disabled === false && window._satsClaimInProgress === false);
    check('failread-not-sent', !document.getElementById('satsCelebration'));
    window.__hangResolve({ data: { success: false, error: 'network down' } });
    await __flush();
    errBox = document.getElementById('satsClaimError');
    check('late-error', errBox && errBox.textContent.indexOf('network down') !== -1);
    void hanging;
    window._satsClaimFlightList = [];
    window._satsClaimInProgress = false;

    window.__userReadMode = '';
    window.__userDoc = {
        points: 6000,
        pointsClaimed: 2000,
        satsWithdrawn: 350,
        _pendingClaim: false
    };
    window.__withdrawals = [];
    window.__claimMode = 'hang';
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    window.__withdrawals = [{ id: 'paid-new', status: 'paid', amount: 80, timestamp: Date.now() + 60000 }];
    check('paid-armed', __fire(60000));
    await __flush();
    lateCeleb = document.getElementById('satsCelebration');
    check('reread-paid-amount', lateCeleb && lateCeleb.textContent.indexOf('⚡ Sent 80 sats!') !== -1);
    check('reread-ignores-delta', !lateCeleb || lateCeleb.textContent.indexOf('⚡ Sent 150 sats!') === -1);
    if (lateCeleb) lateCeleb.remove();
    window._satsClaimCelebLock = false;
    window._satsClaimCelebratedAt = 0;
    window._satsClaimFlightList = [];
    void hanging;

    window.__withdrawals = [];
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    window.__withdrawals = [{ id: 'paid-string', status: 'settled', amount: '80', timestamp: Date.now() + 60000 }];
    check('string-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    check('string-amount-not-sent', !document.getElementById('satsCelebration'));
    check('string-amount-reenables', sendBtn && sendBtn.disabled === false);
    void hanging;
    window._satsClaimFlightList = [];

    window.__wdFromCache = false;
    window.__withdrawals = [];
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    window.__withdrawals = [{ id: 'paid-old', status: 'paid', amount: 80, timestamp: Date.now() - 86400000 }];
    check('old-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    errBox = document.getElementById('satsClaimError');
    check('old-row-not-sent', !document.getElementById('satsCelebration'));
    check('old-row-unconfirmed', errBox && errBox.textContent.indexOf("couldn't confirm") !== -1);
    check('old-row-reenables', sendBtn && sendBtn.disabled === false);
    void hanging;
    window._satsClaimFlightList = [];

    window.__wdFromCache = true;
    window.__withdrawals = [];
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    window.__withdrawals = [{ id: 'paid-cache', status: 'paid', amount: 80, timestamp: Date.now() + 60000 }];
    check('cache-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    errBox = document.getElementById('satsClaimError');
    check('cache-row-not-sent', !document.getElementById('satsCelebration'));
    check('cache-row-unconfirmed', errBox && errBox.textContent.indexOf("couldn't confirm") !== -1);
    window.__wdFromCache = false;
    void hanging;
    window._satsClaimFlightList = [];

    showDeleteAccountConfirm();
    var del = document.getElementById('deleteAccountOverlay');
    check('delete-top', __hitIs(del));
    check('delete-z', del && __z(del) > __z(settings));
    check('settings-still-floor', __z(settings) >= 2100008);
    if (del) del.remove();

    var addrTask = openWithdrawalAddress({ mode: 'claim', address: 'you@walletofsatoshi.com', start: 'confirm' });
    var addr = document.getElementById('lnAddrModal');
    check('lightning-over-settings', addr && __z(addr) > __z(settings));
    check('lightning-hit', __hitIs(addr));
    __dispatchEsc(addr);
    await addrTask;
    check('lightning-escape-settles', !document.getElementById('lnAddrModal'));
    check('settings-after-lightning', settings.classList.contains('open'));

    var lbTask = toggleLeaderboard();
    var lb = document.getElementById('leaderboard');
    check('leaderboard-open', lb && lb.classList.contains('open'));
    check('leaderboard-top', __hitIs(lb));
    check('leaderboard-z', lb && __z(lb) > __z(settings));
    if (lb) { lb.classList.remove('open'); if (window.bqModal) window.bqModal.release(lb); }
    void lbTask;

    if (typeof showPostSpinGiftModal === 'function') showPostSpinGiftModal([{ id: 'g1' }]);
    var gift = document.getElementById('postSpinGiftOverlay');
    check('gift-top', __hitIs(gift));
    check('gift-z', gift && __z(gift) > __z(settings));
    if (gift) gift.remove();

    var high = document.createElement('div');
    high.id = 'highLayer';
    high.style.cssText = 'position:fixed;inset:0;z-index:4000000;display:block;';
    document.body.appendChild(high);
    window.bqModal.open(high);
    check('never-lowers', __z(high) >= 4000000);
    high.remove();

    showUsernameRepickPrompt();
    var repick = document.getElementById('usernameRepick');
    check('repick-open', !!repick);
    __dispatchEsc(document.getElementById('usernameRepickInput') || repick);
    check('repick-escape-stays', !!document.getElementById('usernameRepick'));
    if (repick) repick.remove();
    settings.classList.add('open');

    var topics = document.createElement('div');
    topics.id = 'topicsBrowser';
    topics.hidden = false;
    topics.setAttribute('tabindex', '-1');
    topics.innerHTML = '<button id="topicsBrowserClose" type="button">Close</button>';
    document.body.appendChild(topics);
    topics.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            window.__topicsEsc = true;
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    }, true);
    __seedClaim();
    var topicsClaim = document.getElementById('satsClaimOverlay');
    __dispatchEsc(document.getElementById('topicsBrowserClose'));
    check('topics-escape-owned', window.__topicsEsc === true);
    check('topics-did-not-close-claim', !!document.getElementById('satsClaimOverlay'));
    if (topicsClaim) topicsClaim.remove();
    topics.remove();

    var bubble = document.createElement('div');
    bubble.id = 'nacho-bubble';
    bubble.className = 'show';
    document.body.appendChild(bubble);
    window.__nachoEsc = false;
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.__nachoEsc = true;
    });
    __seedClaim();
    __dispatchEsc(bubble);
    check('nacho-escape-reached', window.__nachoEsc === true);
    check('nacho-did-not-close-claim', !!document.getElementById('satsClaimOverlay'));
    var nachoClaim = document.getElementById('satsClaimOverlay');
    if (nachoClaim) nachoClaim.remove();
    bubble.remove();

    var ac = document.createElement('div');
    ac.id = 'chatAutocomplete';
    ac.style.display = 'block';
    ac.textContent = '@pleb';
    document.body.appendChild(ac);
    var mentionInput = document.createElement('input');
    mentionInput.id = 'globalChatInput';
    document.body.appendChild(mentionInput);
    window.__mentionEsc = false;
    mentionInput.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') window.__mentionEsc = true;
    });
    __seedClaim();
    __dispatchEsc(mentionInput);
    check('mention-escape-reached', window.__mentionEsc === true);
    check('mention-did-not-close-claim', !!document.getElementById('satsClaimOverlay'));
    check('badge-still-unmoved', badge && badge.parentElement === badgeHost);
    document.getElementById('overlay-stack-result').textContent = JSON.stringify({ ok: errors.length === 0, errors: errors });
}
__runOverlayTests().catch(function(e) {
    document.getElementById('overlay-stack-result').textContent = JSON.stringify({ ok: false, errors: [String(e && e.stack || e)] });
});
`;

const page = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
html,body{margin:0;background:#0b1020;color:#fff;font-family:sans-serif;}
#usernameModal{display:none;position:fixed;inset:0;z-index:2100008;background:rgba(2,6,23,.92);}
#usernameModal.open{display:block;}
#tosModal{display:none;position:fixed;inset:0;z-index:2100010;}
#tosModal.open{display:flex;}
.username-box{background:#111827;color:#e5e7eb;border-radius:24px;padding:20px;max-width:420px;margin:20px auto;}
#leaderboard{display:none;position:fixed;right:20px;bottom:20px;width:340px;height:420px;z-index:300000;background:#111827;}
#leaderboard.open{display:block;}
#bottomNav{position:fixed;left:0;right:0;bottom:0;height:56px;z-index:200000;background:#020617;}
#chatOverlayBtn{position:fixed;right:16px;bottom:70px;width:48px;height:48px;z-index:200000;}
#chatOverlayBadge{position:absolute;top:-2px;right:-2px;}
.rank-toast{position:fixed;top:44px;left:50%;transform:translateX(-50%);background:#f97316;color:#fff;padding:12px 20px;border-radius:10px;z-index:2147483000;}
</style></head><body>
<div id="bottomNav"></div>
<button id="chatOverlayBtn" type="button">Chat<span id="chatOverlayBadge">2</span></button>
<div id="usernameModal"><div class="username-box"></div></div>
<div id="tosModal"></div>
<div id="leaderboard"></div>
<pre id="overlay-stack-result">pending</pre>
<script>
${prelude}
${read('utils.js')}
${read('ranking.js')}
${read('gifting.js')}
${harness}
</script>
</body></html>`;

fs.writeFileSync(htmlPath, page);

function decodeResult(raw) {
    return raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function resultFromDump(dumped) {
    const match = String(dumped || '').match(/<pre id="overlay-stack-result">([\s\S]*?)<\/pre>/);
    if (!match) return null;
    const raw = decodeResult(match[1]).trim();
    if (!raw || raw === 'pending') return null;
    return JSON.parse(raw);
}

let result = null;
let via = '';
try {
    const dumped = execFileSync('timeout', ['12', chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--user-data-dir=/tmp/chrome-overlay-test', '--window-size=1280,900', '--dump-dom', 'file://' + htmlPath], {
        encoding: 'utf8',
        timeout: 15000,
        maxBuffer: 20 * 1024 * 1024
    });
    result = resultFromDump(dumped);
    if (result) via = 'chrome';
} catch (e) {
    result = resultFromDump((e.stdout || '') + '\n' + (e.stderr || ''));
    if (result) via = 'chrome';
}

if (!result) {
    via = 'jsdom';
    let dumped = '';
    try {
        dumped = execFileSync(process.execPath, [__filename, '--jsdom', htmlPath], {
            encoding: 'utf8',
            timeout: 25000,
            maxBuffer: 20 * 1024 * 1024
        });
    } catch (e) {
        dumped = (e.stdout || '') + '\n' + (e.stderr || '');
        if (!dumped.includes('{')) throw new Error('jsdom overlay test did not finish: ' + dumped.slice(0, 1500));
    }
    result = JSON.parse(dumped.slice(dumped.indexOf('{')));
}

assert.deepStrictEqual(result.errors, [], JSON.stringify(result.errors));
assert.strictEqual(result.ok, true);
console.log('overlay stack checks passed via ' + via);
