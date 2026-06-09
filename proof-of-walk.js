// ==========================================
// PROOF OF WALK (Strava Integration)
// ==========================================

const STRAVA_CLIENT_ID = '249945';
const STRAVA_REDIRECT_URI = 'https://us-central1-bitcoin-education-archive.cloudfunctions.net/stravaAuth';

function initProofOfWalk() {
    // Add CSS
    if (!document.getElementById('pow-styles')) {
        const style = document.createElement('style');
        style.id = 'pow-styles';
        style.textContent = `
            .pow-card { background:#1a1a1a; border:1px solid #333; border-radius:16px; padding:24px; margin-bottom:20px; box-shadow:0 4px 20px rgba(0,0,0,0.4); text-align:center; position:relative; overflow:hidden; }
            .pow-card::before { content:''; position:absolute; top:0; left:0; width:100%; height:4px; background:linear-gradient(90deg, #f7931a, #fc6000); }
            .pow-header { font-size:1.8rem; font-weight:900; color:#fff; display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:8px; }
            .pow-desc { font-size:0.9rem; color:#aaa; margin-bottom:24px; max-width:400px; margin-left:auto; margin-right:auto; }
            .pow-stats { display:flex; justify-content:space-around; background:#111; padding:16px; border-radius:12px; margin-bottom:24px; border:1px solid #222; }
            .pow-stat-box { text-align:center; }
            .pow-stat-val { font-size:1.6rem; font-weight:800; color:#f7931a; }
            .pow-stat-label { font-size:0.7rem; color:#888; text-transform:uppercase; letter-spacing:1px; margin-top:4px; }
            .pow-btn { display:inline-block; background:#fc4c02; color:#fff; font-weight:800; padding:12px 24px; border-radius:30px; font-size:1rem; text-decoration:none; cursor:pointer; border:none; transition:all 0.2s; box-shadow:0 4px 15px rgba(252,76,2,0.3); }
            .pow-btn:hover { transform:translateY(-2px); box-shadow:0 6px 20px rgba(252,76,2,0.4); }
            .pow-btn.syncing { opacity:0.7; cursor:not-allowed; transform:none; }
            .pow-list { text-align:left; margin-top:20px; max-height:200px; overflow-y:auto; padding-right:8px; }
            .pow-item { display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #222; font-size:0.85rem; }
            .pow-item:last-child { border-bottom:none; }
            .pow-item-date { color:#888; }
            .pow-item-dist { color:#eee; font-weight:700; }
            .pow-item-pts { color:#f7931a; font-weight:700; }
            .pow-progress-wrap { background:#222; border-radius:10px; height:20px; overflow:hidden; margin-top:8px; position:relative; }
            .pow-progress-bar { background:linear-gradient(90deg, #f7931a, #ffd000); height:100%; width:0%; transition:width 0.5s ease; }
            .pow-progress-text { position:absolute; top:0; left:0; width:100%; text-align:center; line-height:20px; font-size:0.7rem; font-weight:800; color:#fff; text-shadow:0 1px 2px rgba(0,0,0,0.8); }
        `;
        document.head.appendChild(style);
    }
}

window.renderProofOfWalk = function() {
    if (!document.getElementById('explore-apps-grid')) return;
    
    // Inject into the Explore Apps container if not there yet
    let powEl = document.getElementById('pow-app-container');
    if (!powEl) {
        powEl = document.createElement('div');
        powEl.id = 'pow-app-container';
        powEl.style.width = '100%';
        powEl.style.maxWidth = '600px';
        powEl.style.margin = '0 auto';
        
        document.getElementById('explore-apps-grid').appendChild(powEl);
    }
    
    powEl.innerHTML = `
        <div class="pow-card">
            <div class="pow-header"><span style="color:#fc4c02;">⛰️ Proof of Walk</span></div>
            <div class="pow-desc">Connect Strava to earn 50 points for every kilometer you Walk, Run, or Hike. (Max 42km / 2,100 pts per day)</div>
            <div id="pow-ui-state">
                <div class="spinner" style="border-width:2px;width:24px;height:24px;border-top-color:#f7931a;margin:20px auto;"></div>
            </div>
        </div>
    `;
    
    if (typeof auth === 'undefined' || !auth.currentUser) {
        document.getElementById('pow-ui-state').innerHTML = `<p style="color:#aaa;font-size:0.9rem;margin-bottom:12px;">Sign in to connect Strava.</p><a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" class="pow-btn" style="background:transparent;border:2px solid #fc4c02;color:#fc4c02;box-shadow:none;">Download Strava</a>`;
        return;
    }
    
    // Check connection status
    db.collection('users').doc(auth.currentUser.uid).collection('integrations').doc('strava').get()
        .then(doc => {
            if (doc.exists && doc.data().access_token) {
                renderPOWDashboard(doc.data());
            } else {
                renderPOWConnect();
            }
        })
        .catch(err => {
            document.getElementById('pow-ui-state').innerHTML = `<p style="color:red;font-size:0.8rem;">Error loading Strava status.</p>`;
        });
};

function renderPOWConnect() {
    const stateUrl = encodeURIComponent(auth.currentUser.uid);
    // Standard OAuth URL — must link to strava.com/oauth/authorize per Brand Guidelines
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${STRAVA_REDIRECT_URI}&approval_prompt=force&scope=read,activity:read_all&state=${stateUrl}`;
    
    document.getElementById('pow-ui-state').innerHTML = `
        <a href="${authUrl}" style="display:inline-block;margin-bottom:12px;"><img src="images/strava/btn_connect_orange.svg" alt="Connect with Strava" style="height:48px;"></a>
        <br>
        <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" class="pow-btn" style="background:transparent;border:2px solid #fc4c02;color:#fc4c02;margin-top:4px;display:inline-block;box-shadow:none;">Download Strava</a>
        <div style="font-size:0.7rem;color:#666;margin-top:16px;">We only read your activity distances to award points. No GPS, routes, or personal data is stored. <a href="#pow-support" style="color:#fc4c02;">Learn more</a></div>
        <div style="margin-top:12px;"><a href="https://www.strava.com" target="_blank" rel="noopener noreferrer"><img src="images/strava/pwrdBy_strava_white.svg" alt="Powered by Strava" style="height:24px;opacity:0.7;"></a></div>
    `;
}

function renderPOWDashboard(stravaData) {
    const uid = auth.currentUser.uid;
    
    let html = `
        <div style="font-size:0.9rem;color:#eee;margin-bottom:8px;font-weight:700;">
            Athlete: <span style="color:#fc4c02;">${stravaData.athlete_name || 'Connected'}</span>
        </div>
        <div style="margin-bottom:16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;">
            <a href="https://www.strava.com/athlete/${stravaData.athlete_id ? stravaData.athlete_id : ''}" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;font-size:0.8rem;font-weight:700;text-decoration:underline;">View on Strava</a>
            <a href="https://www.strava.com/settings/apps" target="_blank" rel="noopener noreferrer" style="color:#888;font-size:0.75rem;">Manage Strava Apps</a>
        </div>
        
        <div class="pow-stats">
            <div class="pow-stat-box">
                <div class="pow-stat-val" id="pow-dist-val">--</div>
                <div class="pow-stat-label">Km Today</div>
            </div>
            <div class="pow-stat-box">
                <div class="pow-stat-val" id="pow-pts-val">--</div>
                <div class="pow-stat-label">Pts Added Today</div>
            </div>
        </div>
        
        <div style="text-align:left;margin-bottom:20px;">
            <div style="font-size:0.75rem;color:#aaa;font-weight:700;">DAILY CAP PROGRESS</div>
            <div class="pow-progress-wrap">
                <div class="pow-progress-bar" id="pow-prog-bar"></div>
                <div class="pow-progress-text" id="pow-prog-txt">Loading...</div>
            </div>
        </div>
        
        <button id="pow-sync-btn" class="pow-btn" onclick="syncPow()" style="background:#f7931a;box-shadow:0 4px 15px rgba(247,147,26,0.3);padding:10px 30px;">
            ↻ Sync Recent Activities
        </button>
        <div id="pow-sync-msg" style="font-size:0.8rem;margin-top:10px;height:15px;color:#aaa;"></div>
        
        <div class="pow-list" id="pow-log-list">
            <div style="text-align:center;color:#666;font-size:0.8rem;padding:20px;">Loading history...</div>
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;">
            <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer"><img src="images/strava/pwrdBy_strava_white.svg" alt="Powered by Strava" style="height:24px;opacity:0.7;"></a>
            <div style="display:flex;gap:8px;align-items:center;">
                <a href="#pow-support" style="color:#888;font-size:0.75rem;">Support</a>
                <button onclick="disconnectStrava()" style="background:transparent;border:1px solid #666;color:#888;font-size:0.7rem;padding:4px 10px;border-radius:6px;cursor:pointer;">Disconnect &amp; Delete Data</button>
            </div>
        </div>
    `;
    
    document.getElementById('pow-ui-state').innerHTML = html;
    loadPowStats(uid);
    loadPowHistory(uid);
}

function loadPowStats(uid) {
    // Sum all synced activities to get lifetime totals, and today's totals
    var todayStr = new Date().toISOString().split('T')[0];
    db.collection('users').doc(uid).collection('proof_of_walk')
        .orderBy('created_at', 'desc').limit(50).get()
        .then(snap => {
            let todayDist = 0;
            let todayPts = 0;
            let totalDist = 0;
            let totalPts = 0;
            snap.forEach(doc => {
                const d = doc.data();
                totalDist += d.distance || 0;
                totalPts += d.points_awarded || 0;
                if (d.date === todayStr) {
                    todayDist += d.distance || 0;
                    todayPts += d.points_awarded || 0;
                }
            });

            var distEl = document.getElementById('pow-dist-val');
            var ptsEl = document.getElementById('pow-pts-val');
            var barEl = document.getElementById('pow-prog-bar');
            var txtEl = document.getElementById('pow-prog-txt');
            if (!distEl) return;

            // Show today's stats in the main display
            distEl.innerText = todayDist.toFixed(1);
            ptsEl.innerText = '+' + todayPts;

            let pct = Math.min(100, Math.floor((todayDist / 42.0) * 100));
            barEl.style.width = pct + '%';
            txtEl.innerText = todayDist.toFixed(1) + ' km / 42.0 km';

            // Show lifetime totals below the progress bar
            var lifetimeEl = document.getElementById('pow-lifetime');
            if (!lifetimeEl) {
                lifetimeEl = document.createElement('div');
                lifetimeEl.id = 'pow-lifetime';
                lifetimeEl.style.cssText = 'font-size:0.75rem;color:#aaa;text-align:center;margin-top:8px;';
                txtEl.parentNode.parentNode.appendChild(lifetimeEl);
            }
            lifetimeEl.innerText = '\uD83C\uDFC6 Lifetime: ' + totalDist.toFixed(1) + ' km \u2022 ' + totalPts + ' pts earned';
        })
        .catch(console.error);
}

function loadPowHistory(uid) {
    db.collection('users').doc(uid).collection('proof_of_walk')
        .orderBy('created_at', 'desc').limit(10).get()
        .then(snap => {
            let html = '';
            if (snap.empty) {
                html = '<div style="text-align:center;color:#666;font-size:0.8rem;padding:20px;">No synced activities yet. Go for a walk!</div>';
            } else {
                snap.forEach(doc => {
                    const data = doc.data();
                    html += `
                        <div class="pow-item">
                            <span class="pow-item-date">${data.date} (${data.type})</span>
                            <span>
                                <span class="pow-item-dist">${data.distance.toFixed(2)} km</span>
                                <span style="color:#666;margin:0 6px;">→</span>
                                <span class="pow-item-pts">+${data.points_awarded} pts</span>
                            </span>
                        </div>
                    `;
                });
            }
            document.getElementById('pow-log-list').innerHTML = html;
        })
        .catch(console.error);
}

// Disconnect Strava and delete all POW data (API Agreement: must delete on user request)
window.disconnectStrava = function() {
    if (!auth.currentUser) return;
    if (!confirm('This will disconnect Strava and permanently delete all your Proof of Walk data (activity history, points log). Your earned points on the Archive remain. Continue?')) return;
    var uid = auth.currentUser.uid;
    var batch = db.batch();
    // Delete integration doc
    batch.delete(db.collection('users').doc(uid).collection('integrations').doc('strava'));
    // Delete stats doc
    batch.delete(db.collection('users').doc(uid).collection('proof_of_walk_stats').doc('daily'));
    batch.commit().then(function() {
        // Delete activity history (subcollection — batch can't query, so delete in loop)
        return db.collection('users').doc(uid).collection('proof_of_walk').get();
    }).then(function(snap) {
        var delBatch = db.batch();
        snap.forEach(function(doc) { delBatch.delete(doc.ref); });
        return delBatch.commit();
    }).then(function() {
        if (typeof showToast === 'function') showToast('Strava disconnected and data deleted.');
        // Re-render the connect screen
        if (typeof showProofOfWalk === 'function') showProofOfWalk();
    }).catch(function(e) {
        console.error('Disconnect error:', e);
        alert('Error disconnecting. Please try again or contact support.');
    });
};

window.syncPow = function() {
    const btn = document.getElementById('pow-sync-btn');
    const msg = document.getElementById('pow-sync-msg');
    
    if (btn.classList.contains('syncing')) return;
    
    btn.classList.add('syncing');
    btn.innerText = 'Syncing...';
    msg.innerText = '';
    msg.style.color = '#aaa';
    
    const syncStravaWalks = firebase.functions().httpsCallable('syncStravaWalks');
    syncStravaWalks()
        .then(result => {
            btn.classList.remove('syncing');
            btn.innerText = '↻ Sync Recent Activities';
            const data = result.data;
            
            if (data.synced > 0) {
                msg.style.color = '#00ff00';
                msg.innerText = `Synced ${data.synced} new activities! +${data.pointsEarned} pts`;
                // Refresh UI
                loadPowStats(auth.currentUser.uid);
                loadPowHistory(auth.currentUser.uid);
                // Badge hooks
                _checkPowBadges(data.pointsEarned);
                if (typeof launchConfetti === 'function') launchConfetti();
                if (typeof showToast === 'function') showToast('🏃 +' + data.pointsEarned + ' points from Proof of Walk!');
            } else {
                msg.innerText = 'Up to date! No new eligible walks found.';
            }
        })
        .catch(err => {
            btn.classList.remove('syncing');
            btn.innerText = '↻ Sync Recent Activities';
            msg.style.color = '#ff4444';
            msg.innerText = err.message || 'Error syncing. Try again later.';
        });
}

function _checkPowBadges(ptsJustEarned) {
    if (ptsJustEarned <= 0 || typeof awardBadge !== 'function') return;
    const uid = auth.currentUser.uid;

    // Always award first step
    awardBadge('pow_first_step');

    // Marathoner: today's distance >= 42 km
    db.collection('users').doc(uid).collection('proof_of_walk_stats').doc('daily').get().then(doc => {
        if (doc.exists && doc.data().distance >= 42.0) {
            awardBadge('pow_marathoner');
        }
    });

    // Lifetime km + streak: scan all activities
    db.collection('users').doc(uid).collection('proof_of_walk')
        .orderBy('date', 'desc').get().then(snap => {
            if (snap.empty) return;

            let totalDist = 0;
            const dates = new Set();
            snap.forEach(doc => {
                const d = doc.data();
                totalDist += d.distance || 0;
                if (d.date) dates.add(d.date);
            });

            // -- Lifetime km milestones --
            const kmMilestones = [
                { id: 'pow_km_10',   km: 10 },
                { id: 'pow_km_50',   km: 50 },
                { id: 'pow_km_100',  km: 100 },
                { id: 'pow_km_500',  km: 500 },
                { id: 'pow_km_1000', km: 1000 },
                { id: 'pow_km_5000', km: 5000 },
            ];
            kmMilestones.forEach(m => {
                if (totalDist >= m.km) awardBadge(m.id);
            });

            // -- Streak calculation --
            // Build a sorted descending array of unique date strings
            const sortedDates = Array.from(dates).sort().reverse();
            let streak = 0;
            let cursor = new Date();
            // Normalize cursor to UTC midnight
            cursor = new Date(cursor.getUTCFullYear(), cursor.getUTCMonth(), cursor.getUTCDate());
            for (let i = 0; i < sortedDates.length; i++) {
                const d = new Date(sortedDates[i]);
                const expected = cursor.toISOString().split('T')[0];
                if (sortedDates[i] === expected) {
                    streak++;
                    cursor.setDate(cursor.getDate() - 1);
                } else {
                    break;
                }
            }
            if (streak >= 3)  awardBadge('pow_streak_3');
            if (streak >= 7)  awardBadge('pow_streak_7');
            if (streak >= 30) awardBadge('pow_streak_30');
        }).catch(console.error);
}

// Handle auth redirect alerts
document.addEventListener('DOMContentLoaded', () => {
    initProofOfWalk();
    
    // Check URL params for strava auth responses
    const urlParams = new URLSearchParams(window.location.hash.split('?')[1]);
    const stravaStat = urlParams.get('strava');
    
    if (stravaStat === 'success') {
        setTimeout(() => alert('Strava connected successfully! Click "Sync Recent Activities" to load your walks.'), 1000);
        window.location.hash = '#explore'; // Clear param
    } else if (stravaStat && stravaStat.startsWith('error')) {
        setTimeout(() => alert('Error connecting to Strava. Please try again.'), 1000);
        window.location.hash = '#explore';
    }
});

// ==========================================
// PROOF OF WALK — SUPPORT PAGE (#pow-support)
// ==========================================
window.renderPOWSupport = function() {
    var home = document.getElementById('home');
    var msgs = document.getElementById('msgs');
    var hero = document.getElementById('hero');
    if (home) home.classList.add('hidden');
    if (hero) hero.style.display = 'none';
    if (!msgs) return;
    msgs.style.display = '';
    window.location.hash = '#pow-support';

    msgs.innerHTML = '<div style="max-width:680px;margin:0 auto;padding:24px 16px;">' +
        '<div style="text-align:center;margin-bottom:28px;">' +
            '<div style="font-size:2.5rem;margin-bottom:8px;">👟</div>' +
            '<h1 style="font-size:1.5rem;font-weight:800;color:var(--heading);margin:0 0 6px;">Proof of Walk — Support</h1>' +
            '<p style="color:var(--text-muted);font-size:0.9rem;margin:0 0 12px;">Help center for walkers using Strava with Bitcoin Education Archive</p>' +
            '<a href="https://www.strava.com" target="_blank" rel="noopener noreferrer"><img src="images/strava/pwrdBy_strava_white.svg" alt="Powered by Strava" style="height:28px;opacity:0.7;"></a>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">What is Proof of Walk?</h2>' +
            '<p style="color:var(--text);font-size:0.9rem;line-height:1.6;margin:0;">Proof of Walk is a feature of <a href="https://bitcoineducation.quest" style="color:var(--accent);">Bitcoin Education Archive</a> that rewards you with in-app points for physical activity. Connect your <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava</a> account and earn <strong>50 points per kilometer</strong> for every Walk, Run, or Hike you log — up to 42 km (2,100 points) per day. Proof of Walk is not developed or endorsed by Strava.</p>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">How to Connect</h2>' +
            '<ol style="color:var(--text);font-size:0.9rem;line-height:1.8;margin:0;padding-left:20px;">' +
                '<li>Sign in to Bitcoin Education Archive</li>' +
                '<li>Open <strong>Explore Apps</strong> and tap <strong>Proof of Walk</strong></li>' +
                '<li>Tap the official <strong>Connect with Strava</strong> button — you\u2019ll be redirected to Strava to authorize</li>' +
                '<li>Review the permissions and grant access</li>' +
                '<li>You\u2019ll be redirected back automatically</li>' +
                '<li>Tap <strong>Sync Recent Activities</strong> to load your walks and earn points</li>' +
            '</ol>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 12px;">Frequently Asked Questions</h2>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">What data do you access from Strava?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">We request the <code style="background:var(--bg);padding:2px 6px;border-radius:4px;font-size:0.8rem;">read,activity:read_all</code> scope. In practice, we only use your activity type (Walk/Run/Hike) and distance to calculate points. We do not access or store GPS tracks, routes, heart rate, photos, social data, or any other personal information.</p>' +
            '</div>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">Is my Strava data shared with anyone?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">No. Your Strava data is only visible to you within your own Proof of Walk dashboard. It is never displayed to other users, shared with third parties, sold, or used for advertising. We comply with the <a href="https://www.strava.com/legal/api" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava API Agreement</a> which requires that each user\u2019s data is only shown to that user.</p>' +
            '</div>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">Is my data used for AI or machine learning?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">No. Strava data is never used for AI, machine learning, model training, analytics, or any purpose beyond calculating your personal walking points.</p>' +
            '</div>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">Why is there a daily limit?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">The 42 km/day cap (2,100 points) prevents abuse and keeps the system fair for everyone. That\u2019s a full marathon\u2019s worth — plenty for even the most active users!</p>' +
            '</div>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">How do I disconnect and delete my data?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">Two options:<br><strong>In-app:</strong> Open Proof of Walk and tap <strong>Disconnect &amp; Delete Data</strong>. This removes your Strava tokens and all activity history from our system immediately.<br><strong>On Strava:</strong> Go to <a href="https://www.strava.com/settings/apps" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">strava.com/settings/apps</a>, find Bitcoin Education Archive, and click Revoke Access.<br>You can also email us to request full data deletion.</p>' +
            '</div>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">What happens if I delete an activity on Strava?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">Deleted activities will no longer appear when you sync. We do not retain Strava data that has been removed from your account.</p>' +
            '</div>' +

            '<div style="margin-bottom:14px;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">How do I access my data?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">Your synced activity history and points are visible in your Proof of Walk dashboard. If you need a full export of your data, email us and we\u2019ll provide it.</p>' +
            '</div>' +

            '<div style="margin-bottom:0;">' +
                '<p style="font-weight:700;color:var(--heading);font-size:0.9rem;margin:0 0 4px;">I\u2019m getting an error connecting. What do I do?</p>' +
                '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin:0;">Make sure you\u2019re signed in to both the Archive and Strava. If you see a 403 error, the app may be at capacity — email us and we\u2019ll get it sorted.</p>' +
            '</div>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">Data &amp; Privacy Policy</h2>' +
            '<p style="color:var(--text);font-size:0.9rem;line-height:1.6;margin:0 0 12px;">Proof of Walk is powered by the <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava</a> API. Our use of the Strava API complies with the <a href="https://www.strava.com/legal/api" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava API Agreement</a>.</p>' +
            '<ul style="color:var(--text);font-size:0.85rem;line-height:1.8;margin:0;padding-left:20px;">' +
                '<li><strong>Data collected:</strong> Activity type, distance, and date for Walk, Run, and Hike activities only</li>' +
                '<li><strong>Data storage:</strong> Encrypted tokens stored server-side in Firebase (HTTPS only). Activity summaries stored per-user for points calculation.</li>' +
                '<li><strong>Data not collected:</strong> GPS tracks, routes, maps, heart rate, photos, social connections, or profile details beyond display name</li>' +
                '<li><strong>Data sharing:</strong> Your Strava data is only displayed to you. It is never shared with other users, third parties, advertisers, or data brokers</li>' +
                '<li><strong>No AI/ML use:</strong> Strava data is never used for artificial intelligence, machine learning, model training, analytics, or aggregation</li>' +
                '<li><strong>No advertising use:</strong> Strava data is never used in advertisements or for targeted advertising</li>' +
                '<li><strong>Data deletion:</strong> You may disconnect and delete all your Strava data at any time via the in-app button or by emailing us. Data is also deleted if you revoke access on Strava</li>' +
                '<li><strong>Data access:</strong> You can view all your synced data in the Proof of Walk dashboard, or request a full export by email</li>' +
                '<li><strong>Security:</strong> All data is transmitted over HTTPS. Strava tokens are stored securely in Firebase and are never exposed to the client</li>' +
                '<li><strong>Strava monitoring:</strong> Strava may collect and use data related to our API access for their business purposes, as described in the <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava Privacy Policy</a></li>' +
            '</ul>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">Your Strava Account</h2>' +
            '<ul style="color:var(--text);font-size:0.9rem;line-height:1.8;margin:0;padding-left:20px;">' +
                '<li><a href="https://www.strava.com/athlete" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;font-weight:700;text-decoration:underline;">View on Strava</a> — Go to your Strava profile</li>' +
                '<li><a href="https://www.strava.com/settings/apps" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;font-weight:700;text-decoration:underline;">Manage Connected Apps</a> — Revoke or review app permissions</li>' +
                '<li><a href="https://www.strava.com/settings/privacy" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;font-weight:700;text-decoration:underline;">Strava Privacy Settings</a> — Control your Strava privacy</li>' +
            '</ul>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">Badges &amp; Achievements</h2>' +
            '<ul style="color:var(--text);font-size:0.9rem;line-height:1.8;margin:0;padding-left:20px;">' +
                '<li>👟 <strong>First Step</strong> (50 pts) — Sync your first walk</li>' +
                '<li>🏃‍♂️ <strong>Marathoner</strong> (200 pts) — Hit the 42 km daily cap</li>' +
                '<li>🔥 <strong>3-Day Streak</strong> (100 pts) — Sync walks 3 days in a row</li>' +
                '<li>🔥 <strong>7-Day Streak</strong> (300 pts) — Sync walks 7 days in a row</li>' +
                '<li>💎 <strong>30-Day Streak</strong> (1,000 pts) — Sync walks 30 days in a row</li>' +
                '<li>🥾 <strong>10 km Club</strong> (50 pts) — Walk 10 km lifetime</li>' +
                '<li>🚶 <strong>50 km Club</strong> (100 pts) — Walk 50 km lifetime</li>' +
                '<li>🏅 <strong>Century Walker</strong> (200 pts) — Walk 100 km lifetime</li>' +
                '<li>🏔️ <strong>500 km Legend</strong> (500 pts) — Walk 500 km lifetime</li>' +
                '<li>🌍 <strong>1,000 km Titan</strong> (1,000 pts) — Walk 1,000 km lifetime</li>' +
                '<li>🌕 <strong>To the Moon</strong> (2,500 pts) — Walk 5,000 km lifetime</li>' +
            '</ul>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">Legal</h2>' +
            '<ul style="color:var(--text-muted);font-size:0.85rem;line-height:1.8;margin:0;padding-left:20px;">' +
                '<li>Proof of Walk is a feature of Bitcoin Education Archive. It is not developed, endorsed, or sponsored by Strava.</li>' +
                '<li>"Strava" and the Strava logo are trademarks of Strava, Inc.</li>' +
                '<li>Our use of the Strava API is subject to the <a href="https://www.strava.com/legal/api" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava API Agreement</a>, <a href="https://www.strava.com/legal/terms" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava Terms of Service</a>, and <a href="https://www.strava.com/legal/privacy" target="_blank" rel="noopener noreferrer" style="color:#fc4c02;">Strava Privacy Policy</a>.</li>' +
            '</ul>' +
        '</div>' +

        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:20px;margin-bottom:24px;text-align:center;">' +
            '<h2 style="font-size:1.1rem;font-weight:700;color:var(--heading);margin:0 0 10px;">Need Help?</h2>' +
            '<p style="color:var(--text-muted);font-size:0.9rem;line-height:1.5;margin:0 0 14px;">If you\u2019re having trouble connecting, syncing, or want to request data deletion, reach out and we\u2019ll help.</p>' +
            '<a href="mailto:info.603btc@gmail.com?subject=Proof%20of%20Walk%20Support" style="display:inline-block;padding:10px 24px;background:var(--accent);color:#fff;border-radius:10px;font-size:0.9rem;font-weight:700;text-decoration:none;">Email Support</a>' +
            '<div style="color:var(--text-faint);font-size:0.8rem;margin-top:8px;">info.603btc@gmail.com</div>' +
        '</div>' +

        '<div style="text-align:center;padding-bottom:20px;">' +
            '<button onclick="goHome()" style="padding:10px 20px;background:transparent;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;">← Back to Archive</button>' +
        '</div>' +
    '</div>';
};
