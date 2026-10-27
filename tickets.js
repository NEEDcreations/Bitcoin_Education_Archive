// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Orange Tickets System
// =============================================
// Earn <svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg> Orange Tickets:
//   +1 per daily login
//   +50 per verified referral (referred user reaches Maxi, 2,140 pts)
// =============================================

const TICKET_CONFIG = {
    dailyLogin: 1,
    referral: 50,
    referralSignupBonus: 50,  // Tickets awarded to both sides when the referred user reaches Maxi
    referralPointsThreshold: 2140,  // Maxi rank threshold
    pointsPerTicket: 5,  // Each ticket earned = 5 points towards reward system
};

// ---- Generate or retrieve referral code ----
function getReferralCode() {
    var user = (typeof currentUser !== 'undefined' && currentUser) ? currentUser : null;
    var authUser = (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) ? auth.currentUser : null;
    if (!user && !authUser) return null;
    // Prefer the code the server stored on the user doc. Fall back to the
    // uid prefix, which is the same code ensureReferralCode writes.
    var stored = user && user.referralCode;
    if (typeof stored === 'string' && /^[A-Za-z0-9]{6,28}$/.test(stored)) return stored;
    var uid = (user && user.uid) || (authUser && authUser.uid) || '';
    if (!uid) return null;
    return String(uid).substring(0, 8);
}

function getReferralLink() {
    const code = getReferralCode();
    if (!code) return '';
    return window.location.origin + window.location.pathname + '?ref=' + code;
}

// ---- Check for referral code in URL on page load ----
function captureReferralCode() {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && ref.length >= 6) {
        // Store it locally — we'll attach it to the user doc when they create an account
        localStorage.setItem('btc_referral_code', ref);
        // Clean URL without reload
        if (window.history && window.history.replaceState) {
            const clean = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', clean);
        }
    }

    // ---- Campaign source tracking (?src=Stacker_News etc.) ----
    // Stored in localStorage and written to Firestore on signup.
    // Query: db.collection('users').where('signupSource', '==', 'Stacker_News')
    const src = params.get('src');
    if (src && src.length >= 2 && src.length <= 64) {
        // Only store if not already set — first touch wins
        if (!localStorage.getItem('btc_signup_source')) {
            localStorage.setItem('btc_signup_source', src.replace(/[^a-zA-Z0-9_\-\.]/g, '_').substring(0, 64));
        }
        // Clean URL without reload
        if (window.history && window.history.replaceState) {
            const clean = window.location.pathname + window.location.hash;
            window.history.replaceState({}, '', clean);
        }
    }
}

// ---- Award daily login ticket ----
async function awardDailyTicket() {
    return;
}

// ---- Attach referral to new user on account creation ----
async function attachReferral(uid) {
    const refCode = localStorage.getItem('btc_referral_code');
    if (!refCode || !uid) return;
    if (String(uid).indexOf(refCode) === 0) return;
    try {
        if (typeof firebase === 'undefined' || !firebase.functions) return;
        var fn = firebase.functions().httpsCallable('registerReferral');
        var result = await fn({ refCode: refCode });
        var data = result && result.data;
        if (data && (data.success || data.reason === 'self' || data.reason === 'late' || data.reason === 'account-age' || data.reason === 'points' || data.reason === 'exists')) {
            localStorage.removeItem('btc_referral_code');
            if (typeof currentUser !== 'undefined' && currentUser && currentUser.uid === uid && data.success) {
                currentUser.referredBy = refCode;
            }
        }
    } catch (e) {
        // Keep btc_referral_code so a later session can retry the callable.
        console.log('Referral attach error:', e);
    }
}

// Referral records and ticket awards are server-side (registerReferral,
// the user-doc trigger, and the hourly scan). The browser must not write them.
async function checkReferralQualifications() {}


async function ensureReferralCode() {}


// ---- Get referral stats for display ----
var _inviteStatsCache = { uid: '', at: 0, stats: null };
var INVITE_STATS_MS = 5 * 60 * 1000;

async function getReferralStats() {
    if (!currentUser || !db) return { total: 0, verified: 0, pending: 0, invited: 0, maxi: 0, failed: true };
    var uid = (typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous)
        ? auth.currentUser.uid : '';
    if (!uid) return { total: 0, verified: 0, pending: 0, invited: 0, maxi: 0, failed: true };

    var now = Date.now();
    if (_inviteStatsCache.uid === uid && _inviteStatsCache.stats && (now - _inviteStatsCache.at) < INVITE_STATS_MS) {
        return _inviteStatsCache.stats;
    }

    try {
        const snapshot = await db.collection('referrals')
            .where('referrerUid', '==', uid)
            .get();

        let total = snapshot.size;
        let verified = 0;
        let pending = 0;

        snapshot.forEach(doc => {
            var data = doc.data() || {};
            var reached = data.verified === true || data.status === 'paid' || data.ticketsAwarded === true;
            if (reached) verified++;
            else pending++;
        });

        var stats = { total: total, verified: verified, pending: pending, invited: total, maxi: verified };
        _inviteStatsCache = { uid: uid, at: now, stats: stats };
        return stats;
    } catch (e) {
        var invited = parseInt(currentUser.referralInvited, 10);
        var maxi = parseInt(currentUser.referralCount, 10) || 0;
        if (!isNaN(invited)) {
            return { total: invited, verified: maxi, pending: Math.max(0, invited - maxi), invited: invited, maxi: maxi };
        }
        return { total: 0, verified: 0, pending: 0, invited: 0, maxi: 0, failed: true };
    }
}

// ---- Render tickets section in the Data tab ----
function renderTicketsSection() {
    const tickets = currentUser ? (currentUser.orangeTickets || 0) : 0;

    let html = '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.1),rgba(234,88,12,0.05));border:2px solid rgba(247,147,26,0.3);border-radius:12px;padding:16px;margin-bottom:16px;">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">' +
        '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;"><svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg> Orange Tickets</div>' +
        '<div style="color:#f7931a;font-weight:800;font-size:1.3rem;">' + tickets + '</div></div>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;margin-bottom:12px;">' +
        'Earn tickets by logging in daily (+1), spinning the daily wheel, and referring friends (+50 per verified referral!). Each ticket earned also awards <strong style="color:#f7931a;">5 bonus points</strong>!<br><br>' +
        '🏆 <strong style="color:#eab308;">The more tickets you have, the higher your chances in future giveaways!</strong>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<div style="flex:1;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;">📅</div>' +
        '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">Daily Login</div>' +
        '<div style="color:var(--accent);font-weight:700;font-size:0.85rem;">+1 ticket</div></div>' +
        '<div style="flex:1;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;">🤝</div>' +
        '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">Referral</div>' +
        '<div style="color:var(--accent);font-weight:700;font-size:0.85rem;">+50 tickets</div></div></div>' +
        '</div>';

    return html;
}

// ---- Render referral section in settings ----
// The link is filled with textContent after this HTML is inserted.
function renderReferralSection() {
    const code = getReferralCode();
    if (!code) return '';

    return '<div id="inviteSettingsBlock" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Invite friends</div>' +
        '<p id="inviteSettingsEarn" style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;margin:0 0 12px;">When a friend you invite reaches Maxi rank, you both get 50 orange tickets.</p>' +
        '<p id="inviteSettingsLink" style="margin:0 0 12px;padding:10px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.8rem;font-family:monospace;word-break:break-all;"></p>' +
        '<button type="button" onclick="openInviteFriends(true)" style="padding:8px 14px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:0.85rem;font-weight:800;cursor:pointer;font-family:inherit;">Invite friends</button>' +
        '<div id="referralStats" style="color:var(--text-muted);font-size:0.8rem;margin-top:10px;"></div>' +
        '</div>';
}

function copyReferralLink() {
    var link = getReferralLink();
    var el = document.getElementById('inviteSettingsLink');
    if (el && el.textContent) link = el.textContent;
    if (!link) return;
    if (_copyTextNow(link) && typeof showToast === 'function') showToast('Referral link copied!');
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(link).catch(function() {});
    }
}

// ---- Load and display referral stats async ----
async function loadReferralStatsUI() {
    var linkEl = document.getElementById('inviteSettingsLink');
    if (linkEl) linkEl.textContent = getReferralLink();
    var el = document.getElementById('referralStats');
    if (!el) return;
    var stats = await getReferralStats();
    el.textContent = _inviteCountLine(stats);
}

// ---- Initialize tickets system ----
// Called after user loads (from loadUser or createUser)
async function onUserLoadedTickets() {
    if (typeof refreshReferFriendCard === 'function') refreshReferFriendCard();
    if (!currentUser || !auth || !auth.currentUser || auth.currentUser.isAnonymous) return;

    await ensureReferralCode();
    await awardDailyTicket();

    // Check referral qualifications in background (don't await, non-blocking)
    checkReferralQualifications().catch(function() {});

    // Start Double XP floating widget if active
    if (typeof window._checkDoubleXPWidget === 'function') window._checkDoubleXPWidget();
    refreshInviteCard();
}

// ---- Award tickets for content uploads ----
window.awardTickets = async function() {
    return { success: false, awarded: 0, tickets: 0 };
};

// ---- Home "Invite friends" corner card ----
// Signed-in users always keep a small pill on the home screen. Dismiss and
// minimize both collapse to that pill. A stored "off" is read as "min" so
// older clients can still save off, and this client never hides the pill.
// The full card opens on its own at most once every 7 days, and only when
// no other session popup or modal is up. Guests always keep a small
// "Invite friends" pill. Their larger sign-up prompt still shows once a session.

var INVITE_STATES = { open: 1, min: 1, off: 1 };
var INVITE_AUTO_MS = 7 * 24 * 60 * 60 * 1000;

function _inviteSignedIn() {
    return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
}

function _inviteUid() {
    if (!_inviteSignedIn()) return '';
    return String(auth.currentUser.uid || '');
}

function _inviteStorageKey(uid) {
    return 'btc_invite_card_' + String(uid || '');
}

function _inviteNormalize(state) {
    if (state === 'off') return 'min';
    // A stored "open" is a past visit. Later visits rest on the pill.
    if (state === 'open') return 'min';
    if (state === 'min') return state;
    return '';
}

function _inviteStoredOpen(uid) {
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.inviteCard === 'open') return true;
    try { return localStorage.getItem(_inviteStorageKey(uid)) === 'open'; } catch (e) { return false; }
}

function _inviteReadStored(uid) {
    var fromUser = '';
    if (typeof currentUser !== 'undefined' && currentUser && currentUser.inviteCard) {
        fromUser = _inviteNormalize(String(currentUser.inviteCard));
    }
    if (fromUser) return fromUser;
    try {
        var local = _inviteNormalize(localStorage.getItem(_inviteStorageKey(uid)));
        if (local) return local;
    } catch (e) {}
    return 'min';
}

function _inviteWriteStored(state) {
    if (state === 'off') state = 'min';
    if (state === 'open') state = 'min';
    var uid = _inviteUid();
    if (!uid || !INVITE_STATES[state]) return;
    try { localStorage.setItem(_inviteStorageKey(uid), state); } catch (e) {}
    if (typeof currentUser !== 'undefined' && currentUser) currentUser.inviteCard = state;
    if (typeof db === 'undefined' || !db) return;
    db.collection('users').doc(uid).update({ inviteCard: state }).catch(function() {});
}

function _inviteAutoKey(uid) {
    return 'btc_invite_auto_' + String(uid || '');
}

function _inviteAutoDue(uid) {
    try {
        var at = parseInt(localStorage.getItem(_inviteAutoKey(uid)), 10);
        if (!at) return true;
        return (Date.now() - at) >= INVITE_AUTO_MS;
    } catch (e) { return false; }
}

function _inviteMarkAuto(uid) {
    if (!uid) return;
    try { localStorage.setItem(_inviteAutoKey(uid), String(Date.now())); } catch (e) {}
}

function _invitePopupElement(el) {
    if (!el || el.nodeType !== 1) return false;
    if (el.id === 'inviteCard' || el.id === 'inviteGuestPill' || el.id === 'todayInviteGuest') return false;
    if (el.closest && (el.closest('#inviteCard') || el.closest('#introVideoSection') || el.closest('#featuredOnSection'))) return false;
    if (el.hasAttribute('hidden')) return false;
    var style;
    try { style = window.getComputedStyle(el); } catch (e) { return false; }
    if (!style || style.display === 'none' || style.visibility === 'hidden' || style.pointerEvents === 'none') return false;
    if (style.position !== 'fixed') return false;
    var box = el.getBoundingClientRect();
    if (box.width < 160 || box.height < 80) return false;
    // A fixed overlay that is only slid off-screen (translateY(100%), opacity 0)
    // still has a large layout box. It is not a popup the invite card should yield to.
    if (box.bottom <= 1 || box.top >= window.innerHeight - 1 || box.right <= 1 || box.left >= window.innerWidth - 1) return false;
    if (parseFloat(style.opacity) === 0) return false;
    var id = String(el.id || '');
    var cls = typeof el.className === 'string' ? el.className : '';
    var role = el.getAttribute('role') || '';
    var named = /modal|overlay|dialog|lightbox|leaderboard/i.test(id + ' ' + cls) || role === 'dialog' || el.getAttribute('aria-modal') === 'true';
    var opened = el.classList.contains('open') || el.hasAttribute('open') || el.getAttribute('data-open') === '1';
    if (!named && !opened) return false;
    return true;
}

function _inviteModalOpen() {
    var nodes = document.querySelectorAll('[role="dialog"], [aria-modal="true"], [id*="Modal"], [id*="modal"], [id*="Overlay"], [id*="overlay"], [class*="modal"], [class*="overlay"], [class*="Modal"], [class*="Overlay"], .open, dialog[open]');
    var i;
    for (i = 0; i < nodes.length; i++) {
        if (_invitePopupElement(nodes[i])) return true;
    }
    return false;
}

function _inviteAutoBlocked() {
    return _inviteModalOpen() || _invitePopupTaken();
}

function _inviteHomeVisible() {
    var home = document.getElementById('home');
    if (!home) return false;
    if (home.classList.contains('hidden')) return false;
    if (home.style.display === 'none') return false;
    return true;
}

function _invitePopupTaken() {
    try {
        var cur = sessionStorage.getItem('btc_session_popup');
        return !!(cur && cur !== 'invite');
    } catch (e) { return false; }
}

function _claimInvitePopup() {
    if (typeof window.btcClaimSessionPopup === 'function') return window.btcClaimSessionPopup('invite');
    if (typeof window.claimSessionPopup === 'function') return window.claimSessionPopup('invite');
    try {
        if (sessionStorage.getItem('btc_session_popup')) return sessionStorage.getItem('btc_session_popup') === 'invite';
        sessionStorage.setItem('btc_session_popup', 'invite');
        return true;
    } catch (e) { return false; }
}

function _guestBannerVisible() {
    var banner = document.getElementById('guestPointsBanner');
    if (!banner) return false;
    if (banner.style.display === 'none') return false;
    return true;
}

function _copyTextNow(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', 'readonly');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    if (ta.focus) ta.focus({ preventScroll: true });
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    ta.remove();
    return ok;
}

function _inviteCountLine(stats) {
    var invited = stats && typeof stats.invited === 'number' ? stats.invited : 0;
    var maxi = stats && typeof stats.maxi === 'number' ? stats.maxi : 0;
    if (!invited && !maxi) return 'No invites yet.';
    var invitedLabel = invited === 1 ? '1 friend invited' : invited + ' friends invited';
    var maxiLabel = maxi === 1 ? '1 reached Maxi' : maxi + ' reached Maxi';
    return invitedLabel + ' · ' + maxiLabel;
}

function _fillInviteCard() {
    var linkEl = document.getElementById('inviteLink');
    if (linkEl) linkEl.textContent = getReferralLink();
    var share = document.getElementById('inviteShare');
    if (share) share.hidden = !navigator.share;
    var copyBtn = document.getElementById('inviteCopy');
    if (copyBtn && copyBtn.textContent !== 'Copied!') copyBtn.textContent = 'Copy';
}

function _paintInviteCounts(stats) {
    var el = document.getElementById('inviteCounts');
    if (el) el.textContent = _inviteCountLine(stats);
}

function _loadInviteCounts() {
    getReferralStats().then(function(stats) {
        if (stats && stats.failed) throw new Error('counts');
        _paintInviteCounts(stats || { invited: 0, maxi: 0 });
    }).catch(function() {
        var maxi = 0;
        if (typeof currentUser !== 'undefined' && currentUser) {
            maxi = parseInt(currentUser.referralCount, 10) || 0;
        }
        var el = document.getElementById('inviteCounts');
        if (!el) return;
        if (maxi) el.textContent = maxi + (maxi === 1 ? ' reached Maxi' : ' reached Maxi');
        else el.textContent = 'Invite counts load when you are online.';
    });
}

function _applyInviteState(state) {
    var card = document.getElementById('inviteCard');
    if (!card) return;
    var show = state === 'off' ? '0' : '1';
    if (card.getAttribute('data-state') !== state) card.setAttribute('data-state', state);
    if (card.getAttribute('data-show') !== show) card.setAttribute('data-show', show);
}

var _inviteHeldOpen = false;

function _paintGuestPill(show) {
    var pill = document.getElementById('inviteGuestPill');
    if (!pill) return;
    if (pill.textContent !== '🎟️ Invite friends') pill.textContent = '🎟️ Invite friends';
    if (pill.getAttribute('aria-label') !== 'Invite friends') pill.setAttribute('aria-label', 'Invite friends');
    if (show) {
        if (pill.hasAttribute('hidden')) pill.removeAttribute('hidden');
    } else if (!pill.hasAttribute('hidden')) {
        pill.setAttribute('hidden', '');
    }
}

function _showSignedInOpen() {
    _paintGuestPill(false);
    _applyInviteState('open');
    _fillInviteCard();
    _loadInviteCounts();
}

function _collapseSignedIn() {
    _inviteHeldOpen = false;
    _inviteMarkAuto(_inviteUid());
    _inviteWriteStored('min');
    _paintGuestPill(false);
    _applyInviteState('min');
    _placeInvitePills();
}

function _obstacleBox(id) {
    var el = document.getElementById(id);
    if (!el) return null;
    var style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return null;
    var box = el.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return null;
    return box;
}

function _inviteClampTop(top, pillH) {
    var floor = window.innerHeight - 16 - pillH;
    var ids = ['chatOverlayBtn', 'nacho-toggle', 'fabExpandBtn', 'bottomNav', 'aiToolsBtn', 'dashboardFloatBtn', 'lbFloatBtn', 'fabMinimizeBtn'];
    var i;
    for (i = 0; i < ids.length; i++) {
        var ob = _obstacleBox(ids[i]);
        if (!ob || ob.top < window.innerHeight * 0.45) continue;
        var limit = ob.top - 12 - pillH;
        if (limit < floor) floor = limit;
    }
    if (top > floor) return Math.max(8, Math.round(floor));
    return top;
}

function _nudgeInvitePill(node) {
    if (!node) return;
    node.style.bottom = '';
    var box = node.getBoundingClientRect();
    if (box.width < 1 || box.height < 1) return;
    var floor = window.innerHeight - 16;
    var ids = ['notifOverlayBtn', 'guestPointsBanner', 'chatOverlayBtn', 'aiToolsBtn', 'dashboardFloatBtn', 'lbFloatBtn', 'fabMinimizeBtn', 'nacho-toggle', 'fabExpandBtn'];
    var top = box.top;
    var changed = false;
    var i;
    for (i = 0; i < ids.length; i++) {
        var ob = _obstacleBox(ids[i]);
        if (!ob) continue;
        var hit = !(box.right < ob.left - 8 || box.left > ob.right + 8 || box.bottom < ob.top - 8 || box.top > ob.bottom + 8);
        if (!hit) continue;
        var below = Math.round(ob.bottom + 12);
        if (below + box.height < floor - 80) {
            if (below > top) { top = below; changed = true; }
        } else {
            var above = Math.round(ob.top - 12 - box.height);
            if (above < top) { top = Math.max(8, above); changed = true; }
        }
        box = { left: box.left, right: box.right, width: box.width, height: box.height, top: top, bottom: top + box.height };
    }
    if (changed) {
        node.style.top = _inviteClampTop(Math.max(8, Math.round(top)), box.height) + 'px';
        node.style.bottom = 'auto';
    }
}

function _placeInvitePills() {
    placeInvitePill();
}

function placeInvitePill() {
    var card = document.getElementById('inviteCard');
    var today = document.getElementById('todayCard');
    var guest = document.getElementById('inviteGuestPill');
    if (!card) {
        if (guest && !guest.hasAttribute('hidden')) {
            guest.style.top = '';
            guest.style.bottom = '';
            _nudgeInvitePill(guest);
        }
        if (typeof window._nachoPlaceBubble === 'function') window._nachoPlaceBubble();
        return;
    }
    var state = card.getAttribute('data-state');
    var shown = card.getAttribute('data-show') === '1' && state !== 'off';
    if (!shown) {
        card.style.top = '';
        if (today) today.style.marginTop = '';
        if (guest && !guest.hasAttribute('hidden')) {
            guest.style.top = '';
            guest.style.bottom = '';
            _nudgeInvitePill(guest);
        }
        if (typeof window._nachoPlaceBubble === 'function') window._nachoPlaceBubble();
        return;
    }
    var anchorBottom = 0;
    ['homeWalletStrip', 'homeGuestActions', 'homeHero'].forEach(function(id) {
        var el = document.getElementById(id);
        if (!el) return;
        var cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        var rect = el.getBoundingClientRect();
        if (rect.height > 1 && rect.bottom > anchorBottom) anchorBottom = rect.bottom;
    });
    var top = 8;
    var bar = document.querySelector('.mobile-bar');
    if (bar && window.innerWidth <= 900 && window.getComputedStyle(bar).display !== 'none') {
        top = Math.round(bar.getBoundingClientRect().bottom + 8);
    }
    if (anchorBottom > 1) top = Math.max(top, Math.round(anchorBottom + 8));
    var pillH = card.getBoundingClientRect().height || 40;
    if (state === 'min' || state === 'guest') {
        top = _inviteClampTop(top, pillH);
        card.style.top = top + 'px';
        if (today) today.style.marginTop = Math.round(pillH + 12) + 'px';
        _nudgeInvitePill(card);
    } else if (today) {
        card.style.top = '';
        today.style.marginTop = '';
    }
    if (guest && !guest.hasAttribute('hidden')) {
        guest.style.top = '';
        guest.style.bottom = '';
        _nudgeInvitePill(guest);
    }
    if (typeof window._nachoPlaceBubble === 'function') window._nachoPlaceBubble();
}
window.placeInvitePill = placeInvitePill;

function _scheduleInvitePlace() {
    if (window._invitePlaceRaf) return;
    window._invitePlaceRaf = requestAnimationFrame(function () {
        window._invitePlaceRaf = 0;
        placeInvitePill();
    });
}

function refreshInviteCard() {
    var card = document.getElementById('inviteCard');
    if (!card) return;
    if (!_inviteHomeVisible() || typeof auth === 'undefined' || !auth) {
        card.setAttribute('data-show', '0');
        _paintGuestPill(false);
        return;
    }
    if (_inviteSignedIn()) {
        var uid = _inviteUid();
        if (_inviteStoredOpen(uid)) {
            _inviteMarkAuto(uid);
            _inviteWriteStored('min');
        }
        // A tap sets _inviteHeldOpen. The session popup budget is only for
        // automatic opens; a later refresh must not collapse the card the
        // user just asked for. A real on-screen modal still wins.
        if (_inviteHeldOpen && !_inviteModalOpen()) {
            _claimInvitePopup();
            _showSignedInOpen();
            return;
        }
        if (_inviteAutoDue(uid) && !_inviteAutoBlocked() && _claimInvitePopup()) {
            _inviteMarkAuto(uid);
            _inviteHeldOpen = true;
            _showSignedInOpen();
            return;
        }
        _paintGuestPill(false);
        _applyInviteState('min');
        _placeInvitePills();
        return;
    }
    var homeGuest = _inviteHomeVisible();
    var dismissed = false;
    try { dismissed = sessionStorage.getItem('btc_invite_guest_dismissed') === '1'; } catch (e) {}
    if (!dismissed && !_guestBannerVisible() && !_inviteAutoBlocked() && _claimInvitePopup()) {
        _paintGuestPill(false);
        _applyInviteState('guest');
        return;
    }
    _paintGuestPill(homeGuest);
    _applyInviteState('off');
    _placeInvitePills();
}

function openInviteFriends(force) {
    if (!_inviteSignedIn()) {
        if (!force && (_invitePopupTaken() || !_claimInvitePopup())) return;
        try { sessionStorage.removeItem('btc_invite_guest_dismissed'); } catch (e) {}
        if (typeof goHome === 'function') goHome();
        _paintGuestPill(false);
        _applyInviteState('guest');
        return;
    }
    var modal = document.getElementById('usernameModal');
    if (modal) modal.classList.remove('open');
    if (typeof goHome === 'function') goHome();
    expandInviteCard();
}

function minimizeInviteCard() {
    if (!_inviteSignedIn()) return;
    _collapseSignedIn();
}

function expandInviteCard() {
    if (!_inviteSignedIn()) return;
    _inviteWriteStored('min');
    _inviteMarkAuto(_inviteUid());
    _inviteHeldOpen = true;
    // A tap is not an automatic popup, so the session budget does not apply.
    if (_inviteModalOpen()) {
        _paintGuestPill(false);
        _applyInviteState('min');
        _placeInvitePills();
        return;
    }
    _claimInvitePopup();
    _showSignedInOpen();
}

function dismissInviteCard() {
    if (!_inviteSignedIn()) {
        try { sessionStorage.setItem('btc_invite_guest_dismissed', '1'); } catch (e) {}
        _applyInviteState('off');
        _paintGuestPill(_inviteHomeVisible() && typeof auth !== 'undefined' && !!auth);
        _placeInvitePills();
        return;
    }
    _collapseSignedIn();
}

function toggleInviteHow() {
    var panel = document.getElementById('inviteHow');
    var btn = document.getElementById('inviteHowBtn');
    if (!panel || !btn) return;
    var open = panel.hasAttribute('hidden');
    if (open) panel.removeAttribute('hidden');
    else panel.setAttribute('hidden', '');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
}

function copyInviteLink() {
    var linkEl = document.getElementById('inviteLink');
    var btn = document.getElementById('inviteCopy');
    var text = (linkEl && linkEl.textContent) || getReferralLink();
    if (!text) return;
    function mark() {
        if (!btn) return;
        btn.textContent = 'Copied!';
        clearTimeout(window._inviteCopiedTimer);
        window._inviteCopiedTimer = setTimeout(function() {
            if (btn) btn.textContent = 'Copy';
        }, 2500);
    }
    var copied = _copyTextNow(text);
    if (copied) mark();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(mark).catch(function() {
            if (!copied && typeof showToast === 'function') showToast('Select the link and copy it');
        });
    } else if (!copied && typeof showToast === 'function') {
        showToast('Select the link and copy it');
    }
}

function shareInviteLink() {
    var linkEl = document.getElementById('inviteLink');
    var link = (linkEl && linkEl.textContent) || getReferralLink();
    if (!link || !navigator.share) return;
    navigator.share({
        title: 'Bitcoin Quest',
        text: 'Learn Bitcoin with me. When you reach Maxi rank, we both get 50 orange tickets.',
        url: link
    }).catch(function() {});
}

function inviteGuestSignup() {
    if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
    else {
        var modal = document.getElementById('usernameModal');
        if (modal) modal.classList.add('open');
    }
}

if (typeof window !== 'undefined') {
    captureReferralCode();
    window.openInviteFriends = openInviteFriends;
    window.minimizeInviteCard = minimizeInviteCard;
    window.expandInviteCard = expandInviteCard;
    window.dismissInviteCard = dismissInviteCard;
    window.toggleInviteHow = toggleInviteHow;
    window.copyInviteLink = copyInviteLink;
    window.shareInviteLink = shareInviteLink;
    window.inviteGuestSignup = inviteGuestSignup;
    window.refreshInviteCard = refreshInviteCard;
    function bindInviteAuth() {
        if (typeof auth === 'undefined' || !auth || typeof auth.onAuthStateChanged !== 'function') return false;
        if (window._inviteAuthBound) return true;
        window._inviteAuthBound = true;
        auth.onAuthStateChanged(function() { refreshInviteCard(); });
        refreshInviteCard();
        return true;
    }
    function watchInviteHome() {
        var home = document.getElementById('home');
        if (!home || home._inviteWatch) return;
        home._inviteWatch = true;
        if (typeof MutationObserver === 'function') {
            new MutationObserver(function() { refreshInviteCard(); }).observe(home, { attributes: true, attributeFilter: ['class', 'style'] });
        }
    }
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', watchInviteHome);
    } else {
        watchInviteHome();
    }
    if (!bindInviteAuth()) {
        var inviteTries = 0;
        var inviteWatch = setInterval(function() {
            inviteTries++;
            if (bindInviteAuth() || inviteTries > 60) clearInterval(inviteWatch);
        }, 1000);
    }
    if (!window._invitePlaceBound) {
        window._invitePlaceBound = true;
        window.addEventListener('resize', _scheduleInvitePlace);
        var inviteMain = document.getElementById('main');
        if (inviteMain) inviteMain.addEventListener('scroll', _scheduleInvitePlace, { passive: true });
    }
    if (!window._invitePopupWatch && typeof MutationObserver === 'function') {
        window._invitePopupWatch = true;
        new MutationObserver(function() {
            if (window._inviteRefreshQueued) return;
            window._inviteRefreshQueued = true;
            setTimeout(function() {
                window._inviteRefreshQueued = false;
                refreshInviteCard();
            }, 50);
        }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'hidden', 'open', 'data-open', 'aria-modal'] });
    }
    refreshInviteCard();
}
