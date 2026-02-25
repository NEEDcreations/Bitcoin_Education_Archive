// =============================================
// Bitcoin Education Archive - Orange Tickets System
// =============================================
// Earn <svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg> Orange Tickets:
//   +1 per daily login
//   +5 per verified referral (referred user must log in & earn 2100+ pts)
// =============================================

const TICKET_CONFIG = {
    dailyLogin: 1,
    referral: 50,
    referralPointsThreshold: 2100,
    pointsPerTicket: 5,  // Each ticket earned = 5 points towards reward system
};

// ---- Generate or retrieve referral code ----
function getReferralCode() {
    if (!currentUser || !currentUser.uid) return null;
    // Use first 8 chars of uid as referral code (unique per user)
    return currentUser.uid.substring(0, 8);
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
}

// ---- Award daily login ticket ----
async function awardDailyTicket() {
    if (!currentUser || !db || !auth || !auth.currentUser) return;
    if (auth.currentUser.isAnonymous) return;

    const today = new Date().toISOString().split('T')[0];
    if (currentUser.lastTicketDate === today) return; // Already awarded today

    const ticketsToAdd = TICKET_CONFIG.dailyLogin;
    const bonusPoints = ticketsToAdd * TICKET_CONFIG.pointsPerTicket;
    const newTickets = (currentUser.orangeTickets || 0) + ticketsToAdd;

    await db.collection('users').doc(currentUser.uid).update({
        orangeTickets: newTickets,
        lastTicketDate: today,
        points: firebase.firestore.FieldValue.increment(bonusPoints),
    });

    currentUser.orangeTickets = newTickets;
    currentUser.lastTicketDate = today;
    currentUser.points = (currentUser.points || 0) + bonusPoints;

    showToast('🎟️ +1 Orange Ticket — Daily login!');
    updateRankUI();

    // Check ticket badges after earning
    if (typeof checkHiddenBadges === 'function') checkHiddenBadges();
}

// ---- Attach referral to new user on account creation ----
async function attachReferral(uid) {
    const refCode = localStorage.getItem('btc_referral_code');
    if (!refCode) return;

    // Don't let users refer themselves
    if (uid.startsWith(refCode)) return;

    try {
        // Find referrer by matching uid prefix
        const snapshot = await db.collection('users')
            .where('referralCode', '==', refCode)
            .limit(1)
            .get();

        let referrerUid = null;

        if (!snapshot.empty) {
            referrerUid = snapshot.docs[0].id;
        } else {
            // Fallback: scan users whose uid starts with the refCode
            // Since referralCode field may not exist yet on old users,
            // we store the raw refCode and resolve it later
            referrerUid = null;
        }

        // Save referral info on the new user
        await db.collection('users').doc(uid).update({
            referredBy: refCode,
            referralVerified: false,
        });

        // Also record in referrals collection for tracking
        await db.collection('referrals').doc(uid).set({
            referredUser: uid,
            referrerCode: refCode,
            referrerUid: referrerUid || '',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            verified: false,
            ticketsAwarded: false,
        });

        localStorage.removeItem('btc_referral_code');
    } catch (e) {
        console.log('Referral attach error:', e);
    }
}

// ---- Check if referred users have qualified (2100+ pts) ----
async function checkReferralQualifications() {
    if (!currentUser || !db || !auth || !auth.currentUser) return;
    if (auth.currentUser.isAnonymous) return;

    // Only check once per session (heavy query)
    if (window._referralChecked) return;
    window._referralChecked = true;

    const refCode = getReferralCode();
    if (!refCode) return;

    try {
        // Find all referrals where this user is the referrer and tickets not yet awarded
        const snapshot = await db.collection('referrals')
            .where('referrerCode', '==', refCode)
            .where('ticketsAwarded', '==', false)
            .get();

        if (snapshot.empty) return;

        let ticketsEarned = 0;

        for (const refDoc of snapshot.docs) {
            const refData = refDoc.data();
            const referredUid = refData.referredUser;

            // Check if referred user has 2100+ points and has logged in
            const userDoc = await db.collection('users').doc(referredUid).get();
            if (!userDoc.exists) continue;

            const userData = userDoc.data();
            if ((userData.points || 0) >= TICKET_CONFIG.referralPointsThreshold && (userData.totalVisits || 0) >= 2) {
                // Qualified! Award tickets
                ticketsEarned += TICKET_CONFIG.referral;

                // Mark referral as verified and tickets awarded
                await db.collection('referrals').doc(refDoc.id).update({
                    verified: true,
                    ticketsAwarded: true,
                    verifiedAt: firebase.firestore.FieldValue.serverTimestamp(),
                });

                // Also mark on the referred user's doc
                await db.collection('users').doc(referredUid).update({
                    referralVerified: true,
                });
            }
        }

        if (ticketsEarned > 0) {
            const bonusPoints = ticketsEarned * TICKET_CONFIG.pointsPerTicket;
            const newTotal = (currentUser.orangeTickets || 0) + ticketsEarned;
            await db.collection('users').doc(currentUser.uid).update({
                orangeTickets: newTotal,
                points: firebase.firestore.FieldValue.increment(bonusPoints),
            });
            currentUser.orangeTickets = newTotal;
            currentUser.points = (currentUser.points || 0) + bonusPoints;
            showToast('<svg viewBox="0 0 24 24" style="width:1em;height:1em;vertical-align:-0.15em;display:inline-block"><path fill="#f7931a" d="M22 10V6c0-1.1-.9-2-2-2H4c-1.1 0-2 .9-2 2v4c1.1 0 2 .9 2 2s-.9 2-2 2v4c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2v-4c-1.1 0-2-.9-2-2s.9-2 2-2z"/></svg> +' + ticketsEarned + ' Orange Tickets — Referral' + (ticketsEarned > 5 ? 's' : '') + ' verified! (+' + bonusPoints + ' pts)');
            updateRankUI();

            // Check ticket badges after earning
            if (typeof checkHiddenBadges === 'function') checkHiddenBadges();
        }
    } catch (e) {
        console.log('Referral check error:', e);
    }
}

// ---- Ensure referralCode field exists on user doc ----
async function ensureReferralCode() {
    if (!currentUser || !db || !auth || !auth.currentUser) return;
    if (auth.currentUser.isAnonymous) return;

    if (!currentUser.referralCode) {
        const code = getReferralCode();
        if (code) {
            await db.collection('users').doc(currentUser.uid).update({
                referralCode: code,
            });
            currentUser.referralCode = code;
        }
    }
}

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
        '🏆 <strong style="color:#eab308;">The more tickets you have, the higher your chance of winning our 25,000 sats giveaways!</strong>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<div style="flex:1;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;">📅</div>' +
        '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">Daily Login</div>' +
        '<div style="color:var(--accent);font-weight:700;font-size:0.85rem;">+1 ticket</div></div>' +
        '<div style="flex:1;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;padding:10px;text-align:center;">' +
        '<div style="font-size:1.2rem;">🤝</div>' +
        '<div style="font-size:0.7rem;color:var(--text-faint);margin-top:2px;">Referral</div>' +
        '<div style="color:var(--accent);font-weight:700;font-size:0.85rem;">+5 tickets</div></div></div>' +
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
        'Share your link with friends. Earn <strong style="color:#f7931a;">5 Orange Tickets</strong> for each referral who logs in and earns 2,100+ points (Maxi rank).' +
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
function initTickets() {
    captureReferralCode();
}

// Called after user loads (from loadUser or createUser)
async function onUserLoadedTickets() {
    if (!currentUser || !auth || !auth.currentUser || auth.currentUser.isAnonymous) return;

    await ensureReferralCode();
    await awardDailyTicket();

    // Check referral qualifications in background (don't await, non-blocking)
    checkReferralQualifications().catch(function() {});
}

// Run on page load
if (typeof window !== 'undefined') {
    // Capture referral code from URL immediately
    captureReferralCode();
}
