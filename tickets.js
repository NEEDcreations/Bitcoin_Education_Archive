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
    try {
        if (!currentUser || !db || !auth || !auth.currentUser) return;
        if (auth.currentUser.isAnonymous) return;

        const today = new Date().toISOString().split('T')[0];
        if (currentUser.lastTicketDate === today) return; // Already awarded today

        const ticketsToAdd = TICKET_CONFIG.dailyLogin;
        const bonusPoints = ticketsToAdd * TICKET_CONFIG.pointsPerTicket;
        const newTickets = (currentUser.orangeTickets || 0) + ticketsToAdd;

        // Award tickets + points through server-side Cloud Function (Fix permission error)
        // Cloud Function now handles 'lastTicketDate' update server-side for security
        if (typeof awardPoints === 'function') {
            const result = await awardPoints(bonusPoints, '🎫 Daily tickets', null, ticketsToAdd);
            if (!result || !result.success) return; // Silent return if already claimed or error
        }
        
        currentUser.lastTicketDate = today;
        currentUser.orangeTickets = (currentUser.orangeTickets || 0) + ticketsToAdd;

        // Delay toast so page is settled and user can see it
        setTimeout(function() {
            if (typeof showToast === 'function') showToast('🎫 +1 Orange Ticket — Welcome back! (Total: ' + newTickets + ')');
        }, 2500);

        if (typeof updateRankUI === 'function') updateRankUI();

        // Check ticket badges after earning
        if (typeof checkHiddenBadges === 'function') checkHiddenBadges();
    } catch(e) {
        console.warn('Daily ticket error:', e);
    }
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
        if (data && (data.success || data.reason === 'self')) {
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
async function getReferralStats() {
    if (!currentUser || !db) return { total: 0, verified: 0, pending: 0 };

    const refCode = getReferralCode();
    if (!refCode) return { total: 0, verified: 0, pending: 0 };

    try {
        const snapshot = await db.collection('referrals')
            .where('referrerCode', '==', refCode)
            .get();

        let total = snapshot.size;
        let verified = 0;
        let pending = 0;

        snapshot.forEach(doc => {
            if (doc.data().verified) verified++;
            else pending++;
        });

        return { total, verified, pending };
    } catch (e) {
        return { total: 0, verified: 0, pending: 0 };
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
function renderReferralSection() {
    const link = getReferralLink();
    const code = getReferralCode();

    if (!code) return '';

    let html = '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
        '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">🔗 Referral Program</div>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;margin-bottom:12px;">' +
        'Share your link with friends. You and your friend each earn <strong style="color:#f7931a;">50 Orange Tickets</strong> when they reach Maxi (2,140 points).' +
        '</div>' +
        '<div style="position:relative;margin-bottom:12px;">' +
        '<input type="text" id="referralLinkInput" readonly value="' + link + '" style="width:100%;padding:10px 80px 10px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.8rem;font-family:monospace;outline:none;box-sizing:border-box;" onclick="this.select()">' +
        '<button onclick="copyReferralLink()" style="position:absolute;right:4px;top:50%;transform:translateY(-50%);padding:6px 14px;background:var(--accent);color:#fff;border:none;border-radius:6px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">Copy</button>' +
        '</div>' +
        '<div id="referralStats" style="color:var(--text-muted);font-size:0.8rem;">Loading referral stats...</div>' +
        '</div>';

    return html;
}

function copyReferralLink() {
    const input = document.getElementById('referralLinkInput');
    if (!input) return;

    if (navigator.clipboard) {
        navigator.clipboard.writeText(input.value).then(function() {
            showToast('🔗 Referral link copied!');
        });
    } else {
        input.select();
        document.execCommand('copy');
        showToast('🔗 Referral link copied!');
    }
}

// ---- Load and display referral stats async ----
async function loadReferralStatsUI() {
    const el = document.getElementById('referralStats');
    if (!el) return;

    const stats = await getReferralStats();
    if (stats.total === 0) {
        el.innerHTML = '<span style="color:var(--text-faint);">No referrals yet. Share your link to start earning!</span>';
    } else {
        el.innerHTML = '<div style="display:flex;gap:16px;">' +
            '<span>👥 Total: <strong>' + stats.total + '</strong></span>' +
            '<span style="color:#22c55e;">✅ Verified: <strong>' + stats.verified + '</strong></span>' +
            '<span style="color:#eab308;">⏳ Pending: <strong>' + stats.pending + '</strong></span>' +
            '</div>';
    }
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
    var panel = document.getElementById('referFriendPanel');
    if (panel && panel.getAttribute('data-open') === '1') {
        var input = document.getElementById('referFriendLink');
        if (input) input.value = getReferralLink();
        _renderReferFriendStats();
    }
}

// ---- Award tickets for content uploads ----
window.awardTickets = async function(amount, reason) {
    if (!amount || amount < 1) return;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) return;
    if (typeof currentUser === 'undefined' || !currentUser) return;

    var newTotal = (currentUser.orangeTickets || 0) + amount;
    var bonusPoints = amount * TICKET_CONFIG.pointsPerTicket;

    try {
        // Award tickets + points through server-side Cloud Function
        if (typeof awardPoints === 'function') await awardPoints(bonusPoints, '🎫 ' + (reason || 'Orange Tickets'), null, amount);
        currentUser.orangeTickets = (currentUser.orangeTickets || 0) + amount;
        if (typeof updateRankUI === 'function') updateRankUI();
    } catch(e) { console.warn('[tickets] Award error:', e); }

    if (typeof showToast === 'function') showToast('🎫 +' + amount + ' Orange Tickets! ' + (reason || ''));
};

// ---- Home "Refer a friend" card ----
// The card is in the first HTML paint. This only swaps the hint and fills
// the fixed overlay. Stats come from fields already on the signed-in user.

function _referFriendSignedIn() {
    return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
}

function _renderReferFriendStats() {
    var el = document.getElementById('referFriendStats');
    if (!el) return;
    var friends = 0;
    var tickets = 0;
    if (typeof currentUser !== 'undefined' && currentUser) {
        friends = parseInt(currentUser.referralCount, 10) || 0;
        tickets = parseInt(currentUser.referralTicketsEarned, 10) || 0;
    }
    if (!friends && !tickets) {
        el.textContent = 'No rewards yet — they count when a friend reaches Maxi.';
        return;
    }
    el.textContent = friends + (friends === 1 ? ' friend at Maxi' : ' friends at Maxi') + ' · ' + tickets + ' orange tickets earned';
}

function refreshReferFriendCard() {
    var hint = document.getElementById('referFriendHint');
    if (hint) hint.textContent = _referFriendSignedIn() ? 'Tap for your personal link' : 'Sign in to get your link';
    var panel = document.getElementById('referFriendPanel');
    if (panel && panel.getAttribute('data-open') === '1' && !_referFriendSignedIn()) closeReferFriend();
}

function openReferFriend() {
    if (!_referFriendSignedIn()) {
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        else {
            var modal = document.getElementById('usernameModal');
            if (modal) modal.classList.add('open');
        }
        return;
    }
    var panel = document.getElementById('referFriendPanel');
    if (!panel) return;
    var input = document.getElementById('referFriendLink');
    if (input) input.value = getReferralLink();
    var share = document.getElementById('referFriendShare');
    if (share) {
        if (navigator.share) share.hidden = false;
        else share.hidden = true;
    }
    var copyBtn = document.getElementById('referFriendCopy');
    if (copyBtn) copyBtn.textContent = 'Copy';
    _renderReferFriendStats();
    panel.setAttribute('data-open', '1');
    if (copyBtn && copyBtn.focus) copyBtn.focus({ preventScroll: true });
}

function closeReferFriend() {
    var panel = document.getElementById('referFriendPanel');
    if (panel) panel.removeAttribute('data-open');
}

function copyReferFriendLink() {
    var input = document.getElementById('referFriendLink');
    var btn = document.getElementById('referFriendCopy');
    var text = (input && input.value) || getReferralLink();
    if (!text) return;
    function mark() {
        if (!btn) return;
        btn.textContent = 'Copied!';
        clearTimeout(window._referFriendCopiedTimer);
        window._referFriendCopiedTimer = setTimeout(function() {
            if (btn) btn.textContent = 'Copy';
        }, 2500);
    }
    // execCommand has to run inside the click. The clipboard promise often
    // resolves after that gesture is over, so a later fallback cannot copy.
    var copied = false;
    if (input) {
        if (input.focus) input.focus({ preventScroll: true });
        input.select();
        try { copied = document.execCommand('copy'); } catch (e) { copied = false; }
    }
    if (copied) mark();
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(mark).catch(function() {
            if (!copied && typeof showToast === 'function') showToast('Select the link and copy it');
        });
    } else if (!copied && typeof showToast === 'function') {
        showToast('Select the link and copy it');
    }
}

function shareReferFriendLink() {
    var link = (document.getElementById('referFriendLink') || {}).value || getReferralLink();
    if (!link || !navigator.share) return;
    navigator.share({
        title: 'Bitcoin Quest',
        text: 'Learn Bitcoin with me. When you reach Maxi rank, we both get 50 orange tickets.',
        url: link
    }).catch(function() {});
}

// Run on page load
if (typeof window !== 'undefined') {
    // Capture referral code from URL immediately
    captureReferralCode();
    window.openReferFriend = openReferFriend;
    window.closeReferFriend = closeReferFriend;
    window.copyReferFriendLink = copyReferFriendLink;
    window.shareReferFriendLink = shareReferFriendLink;
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') closeReferFriend();
    });
    function bindReferFriendAuth() {
        if (typeof auth === 'undefined' || !auth || typeof auth.onAuthStateChanged !== 'function') return false;
        if (window._referFriendAuthBound) return true;
        window._referFriendAuthBound = true;
        auth.onAuthStateChanged(function() { refreshReferFriendCard(); });
        refreshReferFriendCard();
        return true;
    }
    if (!bindReferFriendAuth()) {
        var referFriendTries = 0;
        var referFriendWatch = setInterval(function() {
            referFriendTries++;
            if (bindReferFriendAuth() || referFriendTries > 60) clearInterval(referFriendWatch);
        }, 1000);
    }
}
