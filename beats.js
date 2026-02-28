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
            <img src="images/bitcoin-beats-logo.jpg" alt="Bitcoin Beats" style="width:120px;height:120px;border-radius:24px;object-fit:cover;box-shadow:0 10px 30px rgba(0,0,0,0.5);margin-bottom:15px;border:2px solid var(--accent);">
            <h2 style="color:var(--heading);font-weight:800;font-size:2.4rem;margin:0;letter-spacing:-1.5px;text-transform:uppercase;">Bitcoin Beats</h2>
            <div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-top:12px;">
                <span style="padding:4px 12px;background:rgba(239,68,68,0.2);color:#ff4444;border-radius:20px;font-size:0.7rem;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;border:1px solid rgba(239,68,68,0.3);box-shadow:0 0 15px rgba(239,68,68,0.2);">
                    <span style="display:inline-block;width:8px;height:8px;background:#ff4444;border-radius:50%;margin-right:6px;animation:beatsBlink 1s infinite;box-shadow:0 0 8px #ff4444;"></span>
                    LIVE SIGNAL
                </span>
                <span style="color:var(--text-muted);font-size:0.95rem;font-weight:500;">Broadcasts & Community Streams</span>
            </div>
        </div>

        <!-- The Pulse / Stream Container -->
        <div id="beatsStreamContainer" style="background:#020617;border:4px solid transparent;background-image:linear-gradient(#020617, #020617), linear-gradient(135deg, var(--accent) 0%, #ea580c 100%);background-origin:border-box;background-clip:padding-box, border-box;border-radius:32px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,0.8), 0 0 40px rgba(247,147,26,0.2);position:relative;margin-bottom:40px;">
            
            <div style="position:absolute;top:15px;right:20px;display:flex;gap:6px;z-index:10;">
                <div style="width:10px;height:10px;border-radius:50%;background:#ff5f57;"></div>
                <div style="width:10px;height:10px;border-radius:50%;background:#ffbd2e;"></div>
                <div style="width:10px;height:10px;border-radius:50%;background:#27c93f;"></div>
            </div>

            <div id="beatsEmbedArea" style="min-height:500px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center, #0f172a 0%, #020617 100%);padding:20px 0;">
                <!-- Placeholder / Loading -->
                <div id="beatsLoader" style="color:var(--text-faint);text-align:center;">
                    <div style="font-size:4rem;margin-bottom:20px;animation:beatsPulse 2s infinite;filter:drop-shadow(0 0 15px var(--accent));">🎸</div>
                    <div style="font-weight:800;letter-spacing:2px;font-size:1rem;color:var(--text);">CONNECTING TO THE TIMECHAIN...</div>
                    <div style="font-size:0.75rem;margin-top:8px;opacity:0.6;">Est. Sync in 21 blocks</div>
                </div>
            </div>

            <!-- Dashboard Overlays -->
            <div style="background:rgba(15,23,42,0.9);backdrop-filter:blur(10px);padding:18px 28px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(247,147,26,0.2);">
                <div style="color:var(--heading);font-weight:800;font-size:0.9rem;display:flex;align-items:center;gap:10px;">
                    <span style="font-size:1.2rem;">🎧</span> NOW PLAYING
                </div>
                <div style="display:flex;align-items:center;gap:20px;">
                   <div style="color:var(--accent);font-size:0.8rem;font-weight:800;letter-spacing:1px;display:flex;align-items:center;gap:6px;">
                        <span style="display:flex;gap:2px;align-items:flex-end;height:12px;">
                            <div style="width:2px;height:60%;background:currentColor;animation:beatsEqualizer 0.8s infinite alternate;"></div>
                            <div style="width:2px;height:100%;background:currentColor;animation:beatsEqualizer 1.1s infinite alternate;"></div>
                            <div style="width:2px;height:40%;background:currentColor;animation:beatsEqualizer 0.9s infinite alternate;"></div>
                        </span>
                        SYNC: 100%
                   </div>
                   <button onclick="window.open('https://x.com/Bitcoin_Beats_','_blank')" style="background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;padding:8px 20px;border-radius:12px;font-size:0.8rem;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(247,147,26,0.3);transition:0.2s;" onmouseover="this.style.transform='scale(1.05)';" onmouseout="this.style.transform='scale(1)';">Follow for Lives</button>
                </div>
            </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:20px;text-align:left;">
            <div style="padding:24px;background:var(--card-bg);border:1px solid var(--border);border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <h4 style="color:var(--accent);margin:0 0 10px;font-size:0.95rem;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">🦌 Nacho\'s Vibe</h4>
                <p style="color:var(--text);font-size:0.9rem;line-height:1.6;margin:0;font-weight:500;">"Bitcoin is the heartbeat of freedom. Kick back, stay humble, and enjoy the signal."</p>
            </div>
            <div style="padding:24px;background:var(--card-bg);border:1px solid var(--border);border-radius:24px;box-shadow:0 10px 30px rgba(0,0,0,0.2);">
                <h4 style="color:var(--accent);margin:0 0 10px;font-size:0.95rem;font-weight:800;letter-spacing:0.5px;text-transform:uppercase;">🛠️ Stream Controls</h4>
                <p style="color:var(--text-muted);font-size:0.85rem;line-height:1.6;margin:0;">Use the X controls inside the window above to chat, like, or toggle volume on the live broadcast.</p>
            </div>
        </div>
    </div>
    
    <style>
        @keyframes beatsPulse { 0% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.3; transform: scale(0.95); } }
        @keyframes beatsBlink { 0% { opacity: 1; filter: brightness(1.2); } 50% { opacity: 0.4; filter: brightness(0.8); } 100% { opacity: 1; filter: brightness(1.2); } }
        @keyframes beatsEqualizer { 0% { height: 20%; } 100% { height: 100%; } }
    </style>
    `;

    container.innerHTML = html;

    // The logic to load the X embed
    setTimeout(function() {
        const embedArea = document.getElementById('beatsEmbedArea');
        if (!embedArea) return;
        
        // --- 🎯 LIVESTREAM LINK CONFIG ---
        const tweetUrl = "https://x.com/Bitcoin_Beats_/status/2009432279760711788?s=20"; 

        if (tweetUrl.includes("x.com") || tweetUrl.includes("twitter.com")) {
            embedArea.innerHTML = `<blockquote class="twitter-tweet" data-theme="dark" data-align="center" data-width="500"><a href="${tweetUrl}"></a></blockquote>`;
            
            if (!window.twttr) {
                const script = document.createElement('script');
                script.id = "twitter-wjs";
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
}
