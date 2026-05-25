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
    // Standard OAuth URL
    const authUrl = `https://www.strava.com/oauth/authorize?client_id=${STRAVA_CLIENT_ID}&response_type=code&redirect_uri=${STRAVA_REDIRECT_URI}&approval_prompt=force&scope=read,activity:read_all&state=${stateUrl}`;
    
    document.getElementById('pow-ui-state').innerHTML = `
        <a href="${authUrl}" class="pow-btn">Connect Strava</a>
        <a href="https://www.strava.com" target="_blank" rel="noopener noreferrer" class="pow-btn" style="background:transparent;border:2px solid #fc4c02;color:#fc4c02;margin-top:12px;display:inline-block;box-shadow:none;">Download Strava</a>
        <div style="font-size:0.7rem;color:#666;margin-top:16px;">We only read your distances to award points. No tracking.</div>
    `;
}

function renderPOWDashboard(stravaData) {
    const uid = auth.currentUser.uid;
    
    let html = `
        <div style="font-size:0.9rem;color:#eee;margin-bottom:16px;font-weight:700;">
            Athlete: <span style="color:#fc4c02;">${stravaData.athlete_name || 'Connected'}</span>
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
    if (ptsJustEarned > 0 && typeof awardBadge === 'function') {
        const uid = auth.currentUser.uid;
        // Check for Marathoner (if today's points >= 2100)
        db.collection('users').doc(uid).collection('proof_of_walk_stats').doc('daily').get().then(doc => {
            if (doc.exists && doc.data().distance >= 42.0) {
                awardBadge('pow_marathoner');
            }
        });
        // Check for first step
        awardBadge('pow_first_step');
    }
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
