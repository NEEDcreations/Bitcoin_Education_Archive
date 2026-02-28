/**
 * IRL Sync - Bitcoin Events & Meetups
 * Layout inspired by meetup.com, powered by Bitcoin Education Archive
 */

(function() {
    const db = (typeof firebase !== 'undefined') ? firebase.firestore() : null;
    const auth = (typeof firebase !== 'undefined') ? firebase.auth() : null;

    window.renderIRLSync = function(options = {}) {
        const container = document.getElementById('forumContainer'); // Reusing the global special content container
        if (!container) return;

        // --- Header & Search Bar ---
        let html = `
            <div id="irl-sync-view" style="max-width:900px;margin:0 auto;padding:20px;font-family:inherit;color:var(--text);">
        <div class="channel-logos" style="display:flex;justify-content:center;gap:20px;margin-bottom:20px;">
            <img src="images/btc-grad-logo.jpg" alt="Home" class="channel-logo-img" onclick="goHome()" style="width:50px;height:50px;border-radius:50%;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);object-fit:cover;" title="Home">
            <span class="donate-circle" onclick="showDonateModal()" style="width:50px;height:50px;background:#f7931a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 15px rgba(247,147,26,0.3);"><svg viewBox="0 0 64 64" width="32" height="32"><polygon points="36,10 22,38 30,38 28,54 42,26 34,26" fill="#fff"/></svg></span>
        </div>
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:30px;">
                    <div>
                        <h1 style="font-size:1.8rem;color:var(--heading);margin:0;">IRL Sync 🤝</h1>
                        <p style="color:var(--text-muted);margin:5px 0 0;">Find Bitcoin meetups and orange-pill your local community.</p>
                    </div>
                    <button onclick="showHostEventModal()" style="padding:12px 24px;background:#f7931a;color:#000;border:none;border-radius:12px;font-weight:700;cursor:pointer;transition:0.2s;">+ Host an Event</button>
                </div>

                <div style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px;margin-bottom:40px;display:flex;gap:15px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:250px;position:relative;">
                        <span style="position:absolute;left:15px;top:50%;transform:translateY(-50%);opacity:0.5;">🔍</span>
                        <input type="text" id="eventSearch" placeholder="Search events..." style="width:100%;padding:12px 12px 12px 45px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;">
                    </div>
                    <div style="flex:1;min-width:200px;position:relative;">
                        <span style="position:absolute;left:15px;top:50%;transform:translateY(-50%);opacity:0.5;">📍</span>
                        <input type="text" id="eventLocation" placeholder="Location..." style="width:100%;padding:12px 12px 12px 45px;background:var(--bg-side);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;">
                    </div>
                    <button style="padding:0 25px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:600;cursor:pointer;">Find Events</button>
                </div>

                <h2 style="font-size:1.3rem;color:var(--heading);margin-bottom:20px;">Upcoming Events</h2>
                <div id="eventGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:25px;">
                    <!-- Events load here -->
                    <div style="grid-column:1/-1;text-align:center;padding:100px 0;opacity:0.5;">
                        <span style="font-size:3rem;">📡</span><br>Searching the frequency for local signals...
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;
        container.style.display = 'block';
        if (typeof setFloatingElementsVisible === 'function') setFloatingElementsVisible(true);
        
        loadEvents();
    };

    async function loadEvents() {
        const grid = document.getElementById('eventGrid');
        if (!grid || !db) return;

        try {
            const snap = await db.collection('irl_events')
                .where('date', '>=', new Date().toISOString())
                .orderBy('date', 'asc')
                .limit(20)
                .get();

            if (snap.empty) {
                grid.innerHTML = `
                    <div style="grid-column:1/-1;text-align:center;background:var(--card-bg);padding:60px;border-radius:20px;border:1px dashed var(--border);">
                        <div style="font-size:3rem;margin-bottom:15px;">🏜️</div>
                        <h3 style="color:var(--heading);margin-bottom:10px;">No events found in your area</h3>
                        <p style="color:var(--text-muted);margin-bottom:20px;">Be the first to plant a Bitcoin flag in your city!</p>
                        <button onclick="showHostEventModal()" style="padding:10px 20px;background:none;border:2px solid var(--accent);color:var(--accent);border-radius:10px;font-weight:700;cursor:pointer;">Start a Local Group</button>
                    </div>
                `;
                return;
            }

            grid.innerHTML = snap.docs.map(doc => {
                const ev = doc.data();
                const d = new Date(ev.date);
                const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
                const timeStr = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

                return `
                    <div class="event-card" style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;overflow:hidden;cursor:pointer;transition:0.3s;display:flex;flex-direction:column;height:100%;" onmouseover="this.style.transform='translateY(-5px)';this.style.borderColor='var(--accent)'" onmouseout="this.style.transform='none';this.style.borderColor='var(--border)'">
                        <div style="height:140px;background:linear-gradient(45deg, #1a1a2e, #16213e);display:flex;align-items:center;justify-content:center;font-size:3rem;">
                            ${ev.emoji || '🧡'}
                        </div>
                        <div style="padding:15px;flex:1;display:flex;flex-direction:column;">
                            <div style="color:var(--accent);font-size:0.75rem;font-weight:800;text-transform:uppercase;margin-bottom:8px;">${dateStr} @ ${timeStr}</div>
                            <h3 style="font-size:1.1rem;color:var(--heading);margin:0 0 8px;line-height:1.4;">${ev.title}</h3>
                            <div style="color:var(--text-muted);font-size:0.85rem;margin-bottom:15px;display:flex;align-items:center;gap:5px;">
                                📍 ${ev.locationName || 'TBD'}
                            </div>
                            <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;padding-top:15px;border-top:1px solid var(--border);">
                                <div style="font-size:0.8rem;color:var(--text-muted);">${ev.attendeesCount || 0} attending</div>
                                <button style="background:var(--bg-side);color:var(--text);border:1px solid var(--border);padding:6px 12px;border-radius:8px;font-size:0.8rem;font-weight:600;">Join</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');

        } catch (e) {
            console.error("IRL Sync Load Error:", e);
            grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:50px;color:var(--text-muted);">Error frequency interference. Try a hard refresh.</div>`;
        }
    }

    window.showHostEventModal = function() {
        if (!auth.currentUser) {
            if (typeof showSignInPrompt === 'function') showSignInPrompt();
            return;
        }

        const modalHtml = `
            <div id="hostEventModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:100000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);padding:20px;">
                <div style="background:var(--bg-side,#141425);border:1px solid var(--border);width:100%;max-width:500px;border-radius:24px;padding:30px;position:relative;animation:nachoPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
                    <button onclick="document.getElementById('hostEventModal').remove()" style="position:absolute;top:20px;right:20px;background:none;border:none;color:var(--text-muted);font-size:1.5rem;cursor:pointer;">✕</button>
                    
                    <h2 style="margin:0 0 10px;color:var(--heading);">Host an Event 🏙️</h2>
                    <p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:25px;">Gather your local plebs for a meetup.</p>
                    
                    <div style="margin-bottom:15px;">
                        <label style="display:block;font-size:0.75rem;font-weight:700;color:var(--text-faint);margin-bottom:5px;text-transform:uppercase;">Event Title</label>
                        <input type="text" id="evTitle" placeholder="e.g. Satoshi's Coffee Meetup" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;">
                    </div>

                    <div style="display:flex;gap:15px;margin-bottom:15px;">
                        <div style="flex:1;">
                            <label style="display:block;font-size:0.75rem;font-weight:700;color:var(--text-faint);margin-bottom:5px;text-transform:uppercase;">Date & Time</label>
                            <input type="datetime-local" id="evDate" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;">
                        </div>
                    </div>

                    <div style="margin-bottom:20px;">
                        <label style="display:block;font-size:0.75rem;font-weight:700;color:var(--text-faint);margin-bottom:5px;text-transform:uppercase;">Location (City, Venue)</label>
                        <input type="text" id="evLoc" placeholder="e.g. Austin, TX @ The Bitcoin Commons" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;">
                    </div>

                    <button onclick="submitEvent()" id="evSubmitBtn" style="width:100%;padding:15px;background:#f7931a;color:#000;border:none;border-radius:12px;font-weight:800;font-size:1rem;cursor:pointer;transition:0.2s;">📡 Broadcast to Network</button>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    };

    window.submitEvent = async function() {
        const title = document.getElementById('evTitle').value;
        const date = document.getElementById('evDate').value;
        const loc = document.getElementById('evLoc').value;
        const btn = document.getElementById('evSubmitBtn');

        if (!title || !date || !loc) {
            alert("Fill all fields to broadcast!");
            return;
        }

        btn.disabled = true;
        btn.textContent = "Broadcasting...";

        try {
            await db.collection('irl_events').add({
                title: title,
                date: new Date(date).toISOString(),
                locationName: loc,
                hostId: auth.currentUser.uid,
                hostName: auth.currentUser.displayName || 'Anonymous Pleb',
                attendeesCount: 1,
                attendees: [auth.currentUser.uid],
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            document.getElementById('hostEventModal').remove();
            if (typeof showToast === 'function') showToast("✅ Event Synchronized!");
            loadEvents();
        } catch (e) {
            alert("Error broadcasting event: " + e.message);
            btn.disabled = false;
            btn.textContent = "Retry Broadcast";
        }
    };

})();
