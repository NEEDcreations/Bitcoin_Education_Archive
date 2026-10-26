// Claim, delete, and gift layers must paint above Settings.
// Chrome elementFromPoint is the check: the center of the top layer hits that layer.
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

const gifting = read('gifting.js');
assert.ok(gifting.includes('function _placeGiftOverlay'), 'gifting.js should open through the shared helper');
assert.ok(gifting.includes('window.frontOverlay'), 'gifting.js should call frontOverlay');
assert.ok(gifting.includes('window.nextOverlayZ'), 'gift confetti should use nextOverlayZ');
assert.ok(!gifting.includes('function _raiseGiftLayer'), 'do not keep a second gift z-index scan');
assert.ok(!gifting.includes('function _numericZ'), 'do not keep a second gift z-index scan');
assert.ok(!gifting.includes("hub.style.zIndex = '450000'"), 'quest hub must not be buried under Settings');
assert.strictEqual(read('index.html'), read('404.html'));

const utils = read('utils.js');
assert.ok(utils.includes('window.frontOverlay = frontOverlay'));
assert.ok(utils.includes('window.nextOverlayZ = nextOverlayZ'));

const ranking = read('ranking.js');
assert.ok(ranking.includes('Sending your sats…'));
assert.ok(ranking.includes('Still sending… this can take a moment'));
assert.ok(ranking.includes("We couldn't confirm — check your balance before trying again"));
assert.ok(ranking.includes('var SATS_CLAIM_GIVE_UP_MS = 60000;'));
assert.ok(ranking.includes('⚡ Sent '));
assert.ok(ranking.includes('var paidAmount = result.data.amount;'));
assert.ok(!ranking.includes('result.data.amount || 0'));
assert.ok(ranking.includes("db.collection('users').doc(auth.currentUser.uid).get()"));

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
    if (!el) return null;
    var r = el.getBoundingClientRect();
    var x = Math.min(window.innerWidth - 2, Math.max(2, r.left + r.width / 2));
    var y = Math.min(window.innerHeight - 2, Math.max(2, r.top + Math.min(r.height / 2, 80)));
    return document.elementFromPoint(x, y);
}
function __hitIs(el) {
    var node = __hit(el);
    return !!(node && (node === el || (el.contains && el.contains(node))));
}
function __z(el) {
    return parseInt(window.getComputedStyle(el).zIndex, 10) || 0;
}
async function __runOverlayTests() {
    var errors = [];
    function check(name, cond) { if (!cond) errors.push(name); }
    currentUser = {
        points: 8000,
        pointsClaimed: 0,
        pointsDonated: 0,
        pointsExchanged: 0,
        satsWithdrawn: 0,
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
        return window.__userDoc || {
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
            return { doc: function() { return { get: function() {
                window.__userReads = (window.__userReads || 0) + 1;
                if (window.__userReadMode === 'fail') return Promise.reject(new Error('offline'));
                var data = __userData();
                var snap = { data: function() { return data; } };
                if (window.__holdReads > 0) {
                    window.__holdReads--;
                    return new Promise(function(resolve) { window.__releaseRead = function() { resolve(snap); }; });
                }
                return Promise.resolve(snap);
            } }; } };
        }
    };
    function __flush() {
        var chain = Promise.resolve();
        for (var i = 0; i < 12; i++) chain = chain.then(function() { return Promise.resolve(); });
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
    function __seedClaim() {
        initSatsClaim();
        var ts = document.getElementById('satsClaimTurnstile');
        var token = document.createElement('input');
        token.setAttribute('name', 'cf-turnstile-response');
        token.value = 'tok';
        ts.appendChild(token);
    }
    showSettingsPage('sats');
    var settings = document.getElementById('usernameModal');
    check('settings-open', settings && settings.classList.contains('open'));
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
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
    check('escape-closes-claim', !document.getElementById('satsClaimOverlay'));
    check('escape-keeps-settings', settings.classList.contains('open'));
    check('escape-restores-focus', document.activeElement === settings || settings.contains(document.activeElement));

    initSatsClaim();
    claim = document.getElementById('satsClaimOverlay');
    var ts = document.getElementById('satsClaimTurnstile');
    var token = document.createElement('input');
    token.setAttribute('name', 'cf-turnstile-response');
    token.value = 'tok';
    ts.appendChild(token);
    window.__claimMode = 'ok';
    window.__claimCalls = 0;
    var first = submitSatsClaim();
    var second = submitSatsClaim();
    await first;
    await second;
    check('one-claim-call', window.__claimCalls === 1);
    check('payload-untouched', window.__lastClaimPayload && window.__lastClaimPayload.amount === 200 && window.__lastClaimPayload.lightningAddress === 'pleb@example.com');
    var celeb = document.getElementById('satsCelebration');
    check('sent-copy', celeb && celeb.textContent.indexOf('⚡ Sent 200 sats!') !== -1);
    check('server-balance', currentUser.satsWithdrawn === 200 && currentUser.pointsClaimed === 2000);
    check('celebration-top', __hitIs(celeb));
    if (celeb) celeb.remove();

    window.__claimMode = 'fail';
    window.__failMsg = 'A claim was already made from this network in the last 24 hours. Email support at info.603btc@gmail.com.';
    window.__claimCalls = 0;
    initSatsClaim();
    ts = document.getElementById('satsClaimTurnstile');
    token = document.createElement('input');
    token.setAttribute('name', 'cf-turnstile-response');
    token.value = 'tok';
    ts.appendChild(token);
    await submitSatsClaim();
    var err = document.getElementById('satsClaimError');
    var sendBtn = document.getElementById('satsClaimBtn');
    check('server-error', err && err.textContent === window.__failMsg);
    check('button-reenabled', sendBtn && sendBtn.disabled === false && (sendBtn.textContent || '').indexOf('Send Sats') !== -1);

    window.__claimMode = 'hang';
    window.__claimCalls = 0;
    var hanging = submitSatsClaim();
    await Promise.resolve();
    await Promise.resolve();
    sendBtn = document.getElementById('satsClaimBtn');
    check('sending-copy', sendBtn && (sendBtn.textContent || '').indexOf('Sending your sats') !== -1);
    check('sending-live', (document.getElementById('satsClaimStatus').textContent || '').indexOf('Sending your sats') !== -1);
    check('sending-disabled', sendBtn && sendBtn.disabled === true);
    check('hang-one-call', window.__claimCalls === 1);
    check('slow-armed', __fire(20000));
    sendBtn = document.getElementById('satsClaimBtn');
    check('slow-copy', sendBtn && (sendBtn.textContent || '').indexOf('Still sending') !== -1);
    check('slow-stays-disabled', sendBtn && sendBtn.disabled === true);
    check('slow-no-second-call', window.__claimCalls === 1);
    window.__holdReads = 1;
    check('giveup-armed', __fire(60000));
    var errBox = document.getElementById('satsClaimError');
    sendBtn = document.getElementById('satsClaimBtn');
    check('unconfirmed-copy', errBox && errBox.textContent.indexOf("couldn't confirm") !== -1);
    check('held-until-read', sendBtn && sendBtn.disabled === true && window._satsClaimInProgress === true);
    submitSatsClaim();
    check('no-second-while-held', window.__claimCalls === 1);
    window.__hangResolve({ data: { success: true, amount: 200 } });
    await __flush();
    var lateCeleb = document.getElementById('satsCelebration');
    check('late-success-amount', lateCeleb && lateCeleb.textContent.indexOf('⚡ Sent 200 sats!') !== -1);
    check('late-success-one-call', window.__claimCalls === 1);
    if (typeof window.__releaseRead === 'function') window.__releaseRead();
    await __flush();
    check('read-cannot-reenable', window.__claimCalls === 1 && !!document.getElementById('satsCelebration'));
    if (lateCeleb) lateCeleb.remove();
    void hanging;

    window.__userReadMode = '';
    window.__holdReads = 0;
    window.__claimMode = 'hang';
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    check('retry-send-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    errBox = document.getElementById('satsClaimError');
    check('unchanged-message', errBox && errBox.textContent.indexOf('check your balance before trying again') !== -1);
    check('reenabled-after-unchanged-read', sendBtn && sendBtn.disabled === false && window._satsClaimInProgress === false);
    check('unchanged-one-call', window.__claimCalls === 1);
    if (typeof window.__hangResolve === 'function') window.__hangResolve({ data: { success: true, amount: 80 } });
    await __flush();
    lateCeleb = document.getElementById('satsCelebration');
    check('slow-resolve-after-reenable', lateCeleb && lateCeleb.textContent.indexOf('⚡ Sent 80 sats!') !== -1);
    check('slow-resolve-still-one-call', window.__claimCalls === 1);
    if (lateCeleb) lateCeleb.remove();
    void hanging;

    window.__userDoc = {
        points: 6000,
        pointsClaimed: 2000,
        pointsDonated: 0,
        pointsExchanged: 0,
        satsWithdrawn: 350,
        pendingOverflow: 0
    };
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    check('landed-armed', __fire(60000));
    await __flush();
    lateCeleb = document.getElementById('satsCelebration');
    check('timeout-server-amount', lateCeleb && lateCeleb.textContent.indexOf('⚡ Sent 150 sats!') !== -1);
    check('timeout-server-no-resend', window.__claimCalls === 1);
    check('timeout-server-balance', currentUser.satsWithdrawn === 350);
    if (lateCeleb) lateCeleb.remove();
    void hanging;

    window.__userDoc = {
        points: 6000,
        pointsClaimed: 2000,
        pointsDonated: 0,
        pointsExchanged: 0,
        satsWithdrawn: 350,
        pendingOverflow: 0,
        lastSatsClaim: { seconds: Math.floor(Date.now() / 1000) }
    };
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    check('stamp-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    check('stamp-stays-locked', sendBtn && sendBtn.disabled === true && window._satsClaimInProgress === true && !document.getElementById('satsCelebration'));
    submitSatsClaim();
    check('stamp-no-resend', window.__claimCalls === 1);
    var stampOverlay = document.getElementById('satsClaimOverlay');
    if (stampOverlay) stampOverlay.remove();
    window._satsClaimInProgress = false;
    void hanging;

    window.__userDoc = null;
    window.__userReadMode = 'fail';
    window.__claimCalls = 0;
    __seedClaim();
    hanging = submitSatsClaim();
    await __flush();
    check('failread-armed', __fire(60000));
    await __flush();
    sendBtn = document.getElementById('satsClaimBtn');
    errBox = document.getElementById('satsClaimError');
    check('failread-message', errBox && errBox.textContent.indexOf("couldn't confirm") !== -1);
    check('failread-stays-disabled', sendBtn && sendBtn.disabled === true && window._satsClaimInProgress === true);
    submitSatsClaim();
    check('failread-no-resend', window.__claimCalls === 1);
    void hanging;

    var hangOverlay = document.getElementById('satsClaimOverlay');
    if (hangOverlay) hangOverlay.remove();
    showDeleteAccountConfirm();
    var del = document.getElementById('deleteAccountOverlay');
    check('delete-top', __hitIs(del));
    check('delete-z', del && __z(del) > __z(settings));
    if (del) del.remove();

    var lbTask = toggleLeaderboard();
    var lb = document.getElementById('leaderboard');
    check('leaderboard-open', lb && lb.classList.contains('open'));
    check('leaderboard-top', __hitIs(lb));
    check('leaderboard-z', lb && __z(lb) > __z(settings));
    var left = document.elementFromPoint(30, 180);
    check('settings-still-under', left === settings || settings.contains(left));
    if (lb) { lb.classList.remove('open'); if (window.releaseOverlay) window.releaseOverlay(lb); }
    void lbTask;

    var gift = document.createElement('div');
    gift.id = 'postSpinGiftOverlay';
    gift.className = 'gifting-overlay';
    gift.style.cssText = 'position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.88);';
    gift.innerHTML = '<div class="gifting-modal" style="width:220px;height:120px;background:#0f172a;">Gift</div>';
    document.body.appendChild(gift);
    check('gift-top', __hitIs(gift));
    check('gift-z', __z(gift) > __z(settings));
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
.username-box{background:#111827;color:#e5e7eb;border-radius:24px;padding:20px;max-width:420px;margin:20px auto;}
#leaderboard{display:none;position:fixed;right:20px;bottom:20px;width:340px;height:420px;z-index:300000;background:#111827;}
#leaderboard.open{display:block;}
#bottomNav{position:fixed;left:0;right:0;bottom:0;height:56px;z-index:200000;background:#020617;}
.rank-toast{position:fixed;top:44px;left:50%;transform:translateX(-50%);background:#f97316;color:#fff;padding:12px 20px;border-radius:10px;z-index:620000;}
body:has(#usernameModal.open) .rank-toast{display:none !important;}
</style></head><body>
<div id="bottomNav"></div>
<div id="usernameModal"><div class="username-box"></div></div>
<div id="leaderboard"></div>
<pre id="overlay-stack-result">pending</pre>
<script>
${prelude}
${read('utils.js')}
${read('ranking.js')}
${harness}
</script>
</body></html>`;

fs.writeFileSync(htmlPath, page);
fs.rmSync('/tmp/chrome-overlay-test', { recursive: true, force: true });
let dumped = '';
try {
    dumped = execFileSync('timeout', ['20', chrome, '--headless=new', '--disable-gpu', '--no-sandbox', '--user-data-dir=/tmp/chrome-overlay-test', '--window-size=1280,900', '--dump-dom', 'file://' + htmlPath], { encoding: 'utf8', timeout: 25000, maxBuffer: 20 * 1024 * 1024 });
} catch (e) {
    dumped = (e.stdout || '') + '\n' + (e.stderr || '');
    if (!dumped.includes('overlay-stack-result')) throw e;
}
const match = dumped.match(/<pre id="overlay-stack-result">([\s\S]*?)<\/pre>/);
assert.ok(match, 'overlay test did not report a result:\n' + dumped.slice(0, 1500));
const result = JSON.parse(match[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>'));
assert.deepStrictEqual(result.errors, [], JSON.stringify(result.errors));
assert.strictEqual(result.ok, true);
console.log('overlay stack checks passed');
