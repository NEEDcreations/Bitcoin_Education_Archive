// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// 🎸 Bitcoin Beats — Livestream & Media UI
// =============================================

window.renderBitcoinBeats = function() {
    var container = document.getElementById('forumContainer');
    if (!container) return;

    var html = `
    <div style="max-width:800px;margin:30px auto;padding:20px;text-align:center;animation:fadeSlideIn 0.4s ease-out;">
        <div style="margin-bottom:30px;">
            <div style="font-size:3.5rem;margin-bottom:10px;filter: drop-shadow(0 0 20px rgba(247,147,26,0.3));">🎸</div>
            <h2 style="color:var(--heading);font-weight:800;font-size:2.2rem;margin:0;letter-spacing:-1px;">Bitcoin Beats</h2>
            <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:10px;">
                <span style="padding:4px 10px;background:rgba(239,68,68,0.15);color:#ef4444;border-radius:12px;font-size:0.65rem;font-weight:900;text-transform:uppercase;letter-spacing:1px;border:1px solid rgba(239,68,68,0.2);">
                    <span style="display:inline-block;width:6px;height:6px;background:#ef4444;border-radius:50%;margin-right:5px;animation:beatsBlink 1.5s infinite;"></span>
                    Live Signal
                </span>
                <span style="color:var(--text-muted);font-size:0.9rem;">Broadcasts & Community Streams</span>
            </div>
        </div>

        <!-- The Pulse / Stream Container -->
        <div id="beatsStreamContainer" style="background:#020617;border:3px solid var(--accent);border-radius:28px;overflow:hidden;box-shadow:0 25px 60px rgba(0,0,0,0.6), 0 0 30px rgba(247,147,26,0.15);position:relative;margin-bottom:40px;">
            
            <div id="beatsEmbedArea" style="min-height:500px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center, #0f172a 0%, #020617 100%);">
                <!-- Placeholder / Loading -->
                <div id="beatsLoader" style="color:var(--text-faint);text-align:center;">
                    <div style="font-size:3rem;margin-bottom:16px;animation:beatsPulse 2s infinite;">✨</div>
                    <div style="font-weight:600;letter-spacing:1px;font-size:0.9rem;">CONNECTING TO THE TIMECHAIN...</div>
                </div>
            </div>

            <!-- Dashboard Overlays -->
            <div style="background:var(--accent-bg);padding:15px 24px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(247,147,26,0.2);">
                <div style="color:var(--heading);font-weight:700;font-size:0.85rem;display:flex;align-items:center;gap:6px;">
                    🎧 Now Playing
                </div>
                <div style="display:flex;align-items:center;gap:15px;">
                   <div style="color:var(--text-muted);font-size:0.75rem;font-weight:600;letter-spacing:0.5px;">📡 SYNC: 100%</div>
                   <button onclick="window.open('https://x.com/NEEDcreations','_blank')" style="background:var(--accent);color:#fff;border:none;padding:6px 12px;border-radius:8px;font-size:0.75rem;font-weight:800;cursor:pointer;font-family:inherit;">Follow for Lives</button>
                </div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:20px;text-align:left;">
            <div style="padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:20px;">
                <h4 style="color:var(--accent);margin:0 0 8px;font-size:0.9rem;">🦌 Nacho\'s Vibe</h4>
                <p style="color:var(--text);font-size:0.85rem;line-height:1.5;margin:0;">"Bitcoin is the heartbeat of freedom. Kick back and enjoy the signal."</p>
            </div>
            <div style="padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:20px;">
                <h4 style="color:var(--accent);margin:0 0 8px;font-size:0.9rem;">🛠️ Stream Controls</h4>
                <p style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;margin:0;">Use the X controls inside the window above to chat, like, or toggle volume on the live broadcast.</p>
            </div>
        </div>
    </div>
    
    <style>
        @keyframes beatsPulse { 0% { opacity: 0.3; transform: scale(1); } 50% { opacity: 1; transform: scale(1.1); } 100% { opacity: 0.3; transform: scale(1); } }
        @keyframes beatsBlink { 0% { opacity: 1; } 50% { opacity: 0.3; } 100% { opacity: 1; } }
    </style>
    `;

    container.innerHTML = html;

    // The logic to load the X embed
    setTimeout(function() {
        const embedArea = document.getElementById('beatsEmbedArea');
        if (!embedArea) return;
        
        // --- 🎯 LIVESTREAM LINK CONFIG ---
        // Post the full URL of the X post containing your video stream below:
        const tweetUrl = "https://x.com/NEEDcreations/status/1762143494793793714"; 

        if (tweetUrl.includes("x.com") || tweetUrl.includes("twitter.com")) {
            embedArea.innerHTML = `<blockquote class="twitter-tweet" data-theme="dark" data-align="center" data-width="500"><a href="${tweetUrl}"></a></blockquote>`;
            
            if (!window.twttr) {
                const script = document.createElement('script');
                script.src = "https://platform.twitter.com/widgets.js";
                script.charset = "utf-8";
                script.async = true;
                document.head.appendChild(script);
            } else {
                window.twttr.widgets.load(embedArea);
            }
        } else {
            embedArea.innerHTML = '<div style="color:var(--text-faint);">Invalid Stream URL provided.</div>';
        }
    }, 300);
}
