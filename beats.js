// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// 🎸 Bitcoin Beats — Community Music Player
// =============================================

window.renderBitcoinBeats = function() {
    var container = document.getElementById('forumContainer');
    if (!container) return;

    var html = `
    <div id="beatsApp" style="max-width:900px;margin:20px auto;padding:0 16px;animation:fadeSlideIn 0.4s ease-out;">
        <!-- Header -->
        <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
            <div class="channel-logos" style="display:flex;gap:12px;align-items:center;">
                <img src="images/btc-grad-logo-sm.jpg" alt="Home" class="channel-logo-img" onclick="goHome()" style="width:44px;height:44px;border-radius:50%;cursor:pointer;box-shadow:0 0 12px rgba(247,147,26,0.3);object-fit:cover;" title="Home">
                <span class="donate-circle" onclick="showDonateModal()" style="width:44px;height:44px;background:#f7931a;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 0 12px rgba(247,147,26,0.3);flex-shrink:0;" title="Donate"><svg viewBox="0 0 64 64" width="24" height="24"><polygon points="36,10 22,38 30,38 28,54 42,26 34,26" fill="#fff"/></svg></span>

            </div>
            <div style="flex:1;">
                <h2 style="color:var(--heading);font-weight:900;font-size:1.6rem;margin:0;letter-spacing:-0.5px;">🎸 Bitcoin Beats</h2>
                <div style="color:var(--text-muted);font-size:0.75rem;">Community Music · Powered by Lightning</div>
            </div>
        </div>

        <!-- Tab Bar -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">
            <button onclick="beatsTab('discover')" id="beatsTabDiscover" class="beats-tab active" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid var(--accent);margin-bottom:-2px;color:var(--accent);font-weight:700;font-size:0.82rem;cursor:pointer;font-family:inherit;">🔥 Discover</button>
            <button onclick="beatsTab('library')" id="beatsTabLibrary" class="beats-tab" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.82rem;cursor:pointer;font-family:inherit;">📚 Library</button>
            <button onclick="beatsTab('artists')" id="beatsTabArtists" class="beats-tab" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.82rem;cursor:pointer;font-family:inherit;">🎤 Artists</button>
            <button onclick="beatsTab('upload')" id="beatsTabUpload" class="beats-tab" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.82rem;cursor:pointer;font-family:inherit;">🎸 Upload</button>
            <button onclick="beatsTab('livestream')" id="beatsTabLivestream" class="beats-tab" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.82rem;cursor:pointer;font-family:inherit;">📡 Live</button>
            <button onclick="beatsTab('pumpit')" id="beatsTabPumpit" class="beats-tab" style="padding:10px 16px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.82rem;cursor:pointer;font-family:inherit;">🚀 Pump It!</button>
        </div>

        <!-- Search Bar -->
        <div style="margin-bottom:16px;">
            <div style="display:flex;gap:8px;align-items:center;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:8px 12px;">
                <span style="font-size:1rem;color:var(--text-faint);">🔍</span>
                <input type="text" id="beatsSearchInput" placeholder="Search songs, artists, or albums..." style="flex:1;background:none;border:none;color:var(--text);font-size:0.85rem;font-family:inherit;outline:none;" onkeydown="if(event.key==='Enter')beatsPerformSearch()">
                <button onclick="beatsPerformSearch()" style="padding:6px 14px;background:var(--accent);border:none;border-radius:8px;color:#fff;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;">Search</button>
            </div>
        </div>

        <!-- Track List -->
        <div id="beatsTrackList" style="min-height:200px;">
            <div style="text-align:center;padding:40px;color:var(--text-faint);">Loading tracks...</div>
        </div>

    </div>`;

    container.innerHTML = html;

    // Wire autocomplete on the search input
    if (typeof beatsWireSearchInput === 'function') beatsWireSearchInput();

    // Check for deep link params stashed by app.js router
    window._beatsRouted = false; // Reset routing guard for future navigations
    if (window._beatsDeepLink) {
        var dl = window._beatsDeepLink;
        window._beatsDeepLink = null;
        if (dl.type === 'playlist' && typeof beatsOpenSharedPlaylist === 'function') {
            beatsOpenSharedPlaylist(dl.ownerUid, dl.playlistId);
            return;
        } else if (dl.type === 'track') {
            db.collection('beats_tracks').doc(dl.trackId).get().then(function(doc) {
                if (doc.exists) {
                    var t = { id: doc.id, ...doc.data() };
                    window._beatsQueue = [t];
                    window._beatsQueueIdx = 0;
                    // On mobile, autoplay is blocked without a user gesture.
                    // Load the track into the player UI so one tap on ▶ starts it.
                    var isMob = window.innerWidth <= 900;
                    if (isMob) {
                        // Create audio element (paused) so play button works instantly
                        if (window._beatsAudio) { window._beatsAudio.pause(); window._beatsAudio = null; }
                        window._beatsAudio = new Audio(t.audioUrl || t.audioData);
                        window._beatsAudio.volume = (document.getElementById('beatsVolume') ? document.getElementById('beatsVolume').value : 80) / 100;
                        window._beatsAudio.preload = 'auto';
                        // Update player UI to show loaded track
                        window._beatsNowPlaying = { title: t.title || 'Untitled', artist: t.artist || t.authorName || 'Unknown', genre: t.genre || '', coverArt: t.coverArt || t.coverUrl || '', authorId: t.authorId || '', trackId: t.id || '' };
                        window._beatsCurrentAuthorId = t.authorId || t.authorUid || '';
                        if (typeof beatsShowGlobalPlayer === 'function') beatsShowGlobalPlayer();
                        if (typeof beatsUpdatePlayerUI === 'function') beatsUpdatePlayerUI();
                        // Wire up ended/next handlers + progress bar
                        window._beatsAudio.onended = function() { if (typeof beatsNextTrack === 'function') beatsNextTrack(); };
                        // Start progress bar updates (works whether autoplay succeeds or user taps play)
                        clearInterval(window._beatsUpdateInterval);
                        window._beatsUpdateInterval = setInterval(function() {
                            if (!window._beatsAudio) return;
                            var pct = window._beatsAudio.duration ? (window._beatsAudio.currentTime / window._beatsAudio.duration) * 100 : 0;
                            var bar = document.getElementById('beatsProgressBar');
                            if (bar) bar.style.width = pct + '%';
                            var timeEl = document.getElementById('beatsTime');
                            if (timeEl) timeEl.textContent = beatsFormatTime(window._beatsAudio.currentTime) + ' / ' + beatsFormatTime(window._beatsAudio.duration || 0);
                        }, 500);
                        // Try autoplay anyway (works on some mobile browsers)
                        window._beatsAudio.play().then(function() {
                            // Autoplay succeeded — update button to pause icon
                            var pb = document.getElementById('beatsPlayBtn');
                            if (pb) pb.textContent = '⏸';
                            var mpb = document.getElementById('beatsMiniPlayBtn');
                            if (mpb) mpb.textContent = '⏸';
                            if (typeof beatsSetMediaSession === 'function') beatsSetMediaSession(t);
                        }).catch(function() {
                            // Autoplay blocked — show toast so user knows to tap play
                            if (typeof showToast === 'function') showToast('🎵 Tap ▶ to play');
                        });
                    } else {
                        beatsPlayTrack(0);
                    }
                }
            });
            return;
        }
    }

    // Load tracks
    beatsLoadTracks('discover');
};

// ---- State ----
window._beatsAudio = null;
window._beatsQueue = [];
window._beatsQueueIdx = -1;
window._beatsCurrentTab = 'discover';
window._beatsUpdateInterval = null;
window._beatsNowPlaying = null; // { title, artist, genre, coverArt }

// ---- Format play count ----
function _formatPlays(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
    return String(n);
}

// ---- Global Persistent Player (lives in document.body, survives navigation) ----
window.beatsEnsureGlobalPlayer = function() {
    if (document.getElementById('beatsGlobalPlayer')) return;
    var gp = document.createElement('div');
    gp.id = 'beatsGlobalPlayer';
    gp.style.cssText = 'display:none;position:fixed;bottom:56px;left:0;right:0;z-index:200;background:rgba(10,10,15,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid rgba(247,147,26,0.2);padding:0;';
    // On desktop, bottom nav is hidden so player sits at bottom:0
    if (!document.getElementById('beatsPlayerCSS')) {
        var css = document.createElement('style');
        css.id = 'beatsPlayerCSS';
        css.textContent = '@media(min-width:901px){#beatsGlobalPlayer{bottom:0!important;}}@media(max-width:900px){#beatsGlobalPlayer{bottom:56px!important;}}' +
            '.beats-track-row{-webkit-tap-highlight-color:transparent!important;}' +
            '.beats-action-btn{-webkit-tap-highlight-color:transparent;position:relative;overflow:hidden;transition:transform 0.1s ease,background 0.15s ease!important;}' +
            '.beats-action-btn:active{transform:scale(0.85)!important;background:rgba(255,255,255,0.1)!important;}' +
            '@media(hover:hover){.beats-action-btn:hover{background:rgba(255,255,255,0.08)!important;}}';
        document.head.appendChild(css);
    }
    gp.innerHTML =
        '<div id="beatsProgressWrap" onclick="beatsSeek(event)" style="height:4px;background:rgba(255,255,255,0.1);cursor:pointer;position:relative;">' +
            '<div id="beatsProgressBar" style="height:100%;background:linear-gradient(90deg,var(--accent),#ea580c);width:0%;transition:width 0.3s linear;border-radius:0 2px 2px 0;"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 16px;">' +
            '<div id="beatsNowArt" onclick="if(window._beatsCurrentAuthorId&&typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(window._beatsCurrentAuthorId)" style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1a1a2e,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;overflow:hidden;cursor:pointer;">🎵</div>' +
            '<div onclick="if(window._beatsQueueIdx>=0){beatsShowTrackDetail(window._beatsQueueIdx)}else if(typeof go===\'function\'){go(\'bitcoin-beats\')}" style="min-width:0;max-width:140px;cursor:pointer;flex-shrink:1;">' +
                '<div id="beatsNowTitle" style="color:#fff;font-size:0.85rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Not Playing</div>' +
                '<div id="beatsNowArtist" onclick="event.stopPropagation();if(window._beatsCurrentAuthorId&&typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(window._beatsCurrentAuthorId)" style="color:rgba(255,255,255,0.4);font-size:0.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;">Bitcoin Beats</div>' +
            '</div>' +
            '<div id="beatsTime" style="color:rgba(255,255,255,0.4);font-size:0.65rem;white-space:nowrap;">0:00 / 0:00</div>' +
            '<button onclick="beatsPrevTrack()" style="background:none;border:none;color:#fff;font-size:1rem;cursor:pointer;padding:4px;">⏮</button>' +
            '<button id="beatsPlayBtn" onclick="beatsTogglePlay()" style="background:var(--accent);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">▶</button>' +
            '<button onclick="beatsNextTrack()" style="background:none;border:none;color:#fff;font-size:1rem;cursor:pointer;padding:4px;">⏭</button>' +
            '<input type="range" id="beatsVolume" min="0" max="100" value="80" oninput="beatsSetVolume(this.value)" style="width:50px;accent-color:var(--accent);cursor:pointer;" title="Volume">' +
            '<button onclick="beatsShowComments()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.9rem;cursor:pointer;padding:4px;" title="Comments">💬</button>' +
            '<button onclick="if(typeof go===\'function\')go(\'bitcoin-beats\')" style="background:none;border:none;color:var(--accent);font-size:0.85rem;cursor:pointer;padding:4px;" title="Open Bitcoin Beats">🎵</button>' +
            '<button onclick="beatsCollapsePlayer()" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:0.9rem;cursor:pointer;padding:4px;" title="Minimize">▼</button>' +
            '<button onclick="beatsClosePlayer()" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:0.9rem;cursor:pointer;padding:4px;" title="Close">✕</button>' +
        '</div>';
    document.body.appendChild(gp);

    // Create collapsed mini-player pill
    var mini = document.createElement('div');
    mini.id = 'beatsMiniPlayer';
    mini.style.cssText = 'display:none;position:fixed;bottom:240px;right:12px;z-index:201;background:rgba(10,10,15,0.95);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border:1px solid rgba(247,147,26,0.3);border-radius:28px;padding:6px 12px 6px 6px;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,0.5);display:none;align-items:center;gap:8px;transition:transform 0.2s;';
    mini.onclick = function() { beatsExpandPlayer(); };
    mini.innerHTML =
        '<div id="beatsMiniArt" style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#1a1a2e,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1rem;overflow:hidden;flex-shrink:0;">🎵</div>' +
        '<div style="max-width:120px;min-width:0;">' +
            '<div id="beatsMiniTitle" style="color:#fff;font-size:0.75rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">—</div>' +
        '</div>' +
        '<button onclick="event.stopPropagation();beatsTogglePlay()" id="beatsMiniPlayBtn" style="background:var(--accent);border:none;color:#fff;width:30px;height:30px;border-radius:50%;font-size:0.85rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;">⏸</button>';
    if (!document.getElementById('beatsMiniPlayerCSS')) {
        var mcss = document.createElement('style');
        mcss.id = 'beatsMiniPlayerCSS';
        mcss.textContent = '@media(min-width:901px){#beatsMiniPlayer{bottom:70px!important;right:12px!important;}}@media(max-width:900px){#beatsMiniPlayer{bottom:calc(140px + env(safe-area-inset-bottom,0px))!important;right:12px!important;}}#beatsMiniPlayer:hover{transform:scale(1.05);}';
        document.head.appendChild(mcss);
    }
    document.body.appendChild(mini);
};

window.beatsShowGlobalPlayer = function() {
    beatsEnsureGlobalPlayer();
    var gp = document.getElementById('beatsGlobalPlayer');
    if (gp) gp.style.display = 'block';
    // Push floating buttons up on mobile when player visible
    if (window.innerWidth <= 900) {
        var playerH = 80; // approx player height
        var navH = 56;
        var baseBottom = navH + playerH;
        ['chatOverlayBtn', 'aiToolsBtn', 'lbFloatBtn', 'dashboardFloatBtn'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.bottom = (baseBottom + 10) + 'px';
        });
    }
};

window.beatsCollapsePlayer = function() {
    var gp = document.getElementById('beatsGlobalPlayer');
    var mini = document.getElementById('beatsMiniPlayer');
    if (gp) gp.style.display = 'none';
    if (mini) {
        // Sync mini-player state
        var art = document.getElementById('beatsNowArt');
        var miniArt = document.getElementById('beatsMiniArt');
        if (art && miniArt) {
            var img = art.querySelector('img');
            miniArt.innerHTML = img ? '<img src="' + img.src + '" style="width:100%;height:100%;object-fit:cover;">' : '🎵';
        }
        var title = document.getElementById('beatsNowTitle');
        var miniTitle = document.getElementById('beatsMiniTitle');
        if (title && miniTitle) miniTitle.textContent = title.textContent;
        var miniBtn = document.getElementById('beatsMiniPlayBtn');
        if (miniBtn) miniBtn.textContent = (window._beatsAudio && !window._beatsAudio.paused) ? '⏸' : '▶';
        mini.style.display = 'flex';
    }
    // Close comments panel if open
    var cp = document.getElementById('beatsCommentsPanel');
    if (cp) cp.remove();
};

window.beatsExpandPlayer = function() {
    var gp = document.getElementById('beatsGlobalPlayer');
    var mini = document.getElementById('beatsMiniPlayer');
    if (gp) gp.style.display = 'block';
    if (mini) mini.style.display = 'none';
};

window.beatsClosePlayer = function() {
    if (window._beatsAudio) { window._beatsAudio.pause(); window._beatsAudio = null; }
    clearInterval(window._beatsUpdateInterval);
    var gp = document.getElementById('beatsGlobalPlayer');
    if (gp) gp.style.display = 'none';
    var mini = document.getElementById('beatsMiniPlayer');
    if (mini) mini.style.display = 'none';
    var cp = document.getElementById('beatsCommentsPanel');
    if (cp) cp.remove();
    window._beatsNowPlaying = null;
    window._beatsQueueIdx = -1;
    // Reset floating button positions on mobile
    if (window.innerWidth <= 900) {
        ['chatOverlayBtn', 'aiToolsBtn', 'lbFloatBtn', 'dashboardFloatBtn'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.style.bottom = '';
        });
    }
    // Clear MediaSession
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
    }
};

window.beatsUpdatePlayerUI = function() {
    var np = window._beatsNowPlaying;
    if (!np) return;
    var titleEl = document.getElementById('beatsNowTitle');
    var artistEl = document.getElementById('beatsNowArtist');
    var artEl = document.getElementById('beatsNowArt');
    if (titleEl) titleEl.textContent = np.title || 'Untitled';
    if (artistEl) artistEl.textContent = np.artist || 'Unknown';
    if (artEl) artEl.innerHTML = np.coverArt ? '<img src="' + _safeCover(np.coverArt) + '" style="width:100%;height:100%;object-fit:cover;">' : '🎵';
};

// ---- MediaSession API for lock screen / background controls ----
window.beatsSetMediaSession = function(track) {
    if (!('mediaSession' in navigator)) return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title || 'Untitled',
            artist: track.artist || track.authorName || 'Bitcoin Beats',
            album: 'Bitcoin Beats',
            artwork: [
                { src: track.coverUrl || track.coverArt || 'images/bitcoin-beats-logo.jpg', sizes: '120x120', type: 'image/jpeg' }
            ]
        });
        navigator.mediaSession.playbackState = 'playing';
        navigator.mediaSession.setActionHandler('play', function() { beatsTogglePlay(); });
        navigator.mediaSession.setActionHandler('pause', function() { beatsTogglePlay(); });
        navigator.mediaSession.setActionHandler('previoustrack', function() { beatsPrevTrack(); });
        navigator.mediaSession.setActionHandler('nexttrack', function() { beatsNextTrack(); });
        navigator.mediaSession.setActionHandler('seekto', function(details) {
            if (window._beatsAudio && details.seekTime != null) {
                window._beatsAudio.currentTime = details.seekTime;
            }
        });
    } catch(e) { console.log('MediaSession error:', e); }
};

// ---- Tab switching ----
window.beatsTab = function(tab) {
    window._beatsCurrentTab = tab;
    // Remove old sort bar when leaving discover
    if (tab !== 'discover') { var sb = document.getElementById('beatsSortBar'); if (sb) sb.remove(); }
    if (tab !== 'search') { var sr = document.getElementById('beatsSearchResults'); if (sr) sr.remove(); }
    ['discover','library','artists','upload','livestream','pumpit'].forEach(function(t) {
        var btn = document.getElementById('beatsTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            btn.style.borderBottomColor = (t === tab) ? 'var(--accent)' : 'transparent';
            btn.style.color = (t === tab) ? 'var(--accent)' : 'var(--text-muted)';
        }
    });
    if (tab === 'upload') {
        beatsRenderUpload();
    } else if (tab === 'livestream') {
        beatsRenderLivestream();
    } else if (tab === 'library') {
        beatsRenderLibrary();
    } else if (tab === 'artists') {
        beatsRenderArtists();
    } else if (tab === 'pumpit') {
        beatsRenderPumpIt();
    } else if (tab === 'search') {
        // handled by beatsPerformSearch
    } else {
        beatsLoadTracks(tab);
    }
};

// ---- Load tracks from Firestore ----
window.beatsLoadTracks = function(tab) {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Loading...</div>';

    if (typeof db === 'undefined') {
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Firebase not ready. Please wait...</div>';
        return;
    }

    var query;
    if (tab === 'mymusic') {
        if (!auth || !auth.currentUser) {
            listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Sign in to see your uploads</div>';
            return;
        }
        query = db.collection('beats_tracks').where('authorId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').limit(20);
    } else if (tab === 'likes') {
        var liked = safeJSON('btc_beats_liked', []);
        if (liked.length === 0) {
            listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">No liked tracks yet. Hit the ❤️ on tracks you love!</div>';
            return;
        }
        // Firestore 'in' max 30
        var batch = liked.slice(0, 30);
        query = db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', batch);
    } else {
        query = db.collection('beats_tracks').orderBy('createdAt', 'desc').limit(20);
    }

    query.get().then(function(snap) {
        if (snap.empty) {
            listEl.innerHTML = '<div style="text-align:center;padding:40px;">' +
                '<div style="font-size:2.5rem;margin-bottom:12px;">🎸</div>' +
                '<div style="color:var(--text-muted);font-weight:600;">No tracks yet</div>' +
                '<div style="color:var(--text-faint);font-size:0.8rem;margin-top:6px;">Be the first to upload!</div></div>';
            return;
        }

        var tracks = [];
        snap.forEach(function(doc) { tracks.push({ id: doc.id, ...doc.data() }); });
        window._beatsQueue = tracks;

        var liked = safeJSON('btc_beats_liked', []);
        var html = '';
        tracks.forEach(function(t, idx) {
            var isLiked = liked.indexOf(t.id) !== -1;
            var isPlaying = window._beatsQueueIdx === idx;
            var duration = t.duration ? beatsFormatTime(t.duration) : '--:--';
            html += '<div class="beats-track-row" onclick="beatsPlayTrack(' + idx + ')" style="padding:10px 12px;border-radius:12px;cursor:pointer;transition:0.15s;' + (isPlaying ? 'background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);' : 'background:var(--card-bg);border:1px solid var(--border);') + 'margin-bottom:8px;">' +
                /* Row 1: number + art + title/artist + duration */
                '<div style="display:flex;align-items:center;gap:10px;">' +
                    '<div style="width:28px;text-align:center;color:' + (isPlaying ? 'var(--accent)' : 'var(--text-faint)') + ';font-size:0.75rem;font-weight:700;flex-shrink:0;">' + (isPlaying ? '<span style="display:flex;gap:1px;justify-content:center;align-items:flex-end;height:14px;"><div style="width:2px;height:60%;background:var(--accent);animation:beatsEqualizer 0.8s infinite alternate;"></div><div style="width:2px;height:100%;background:var(--accent);animation:beatsEqualizer 1.1s infinite alternate;"></div><div style="width:2px;height:40%;background:var(--accent);animation:beatsEqualizer 0.9s infinite alternate;"></div></span>' : (idx + 1)) + '</div>' +
                    '<div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;overflow:hidden;">' + ((t.coverArt || t.coverUrl) ? '<img src="' + _safeCover(t.coverUrl || t.coverArt) + '" style="width:100%;height:100%;object-fit:cover;">' : (t.genre === 'podcast' ? '🎙️' : '🎵')) + '</div>' +
                    '<div onclick="event.stopPropagation();beatsShowTrackDetail(' + idx + ')" style="flex:1;min-width:0;cursor:pointer;">' +
                        '<div style="color:' + (isPlaying ? 'var(--accent)' : 'var(--heading)') + ';font-weight:700;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (t.authorId ? '<span onclick="event.stopPropagation();if(typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(\'' + t.authorId + '\')" style="cursor:pointer;color:var(--text-muted);transition:0.2s;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' + escapeHtml(t.artist || t.authorName || 'Unknown') + '</span>' : escapeHtml(t.artist || t.authorName || 'Unknown')) + (t.genre ? ' · ' + t.genre : '') + '</div>' +
                    '</div>' +
                    '<div style="flex-shrink:0;text-align:right;">' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;">' + duration + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.6rem;display:flex;align-items:center;gap:4px;justify-content:flex-end;">' +
                            '<span title="' + (t.plays || 0) + ' plays">▶ ' + _formatPlays(t.plays || 0) + '</span>' +
                            (isPlaying ? '<button class="beats-action-btn" onclick="event.stopPropagation();djBroadcast()" style="padding:2px 6px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:6px;color:#6366f1;font-size:0.55rem;font-weight:700;cursor:pointer;font-family:inherit;" title="Broadcast to Global Chat">📡 DJ</button>' : '') +
                        '</div>' +
                    '</div>' +
                '</div>' +
                /* Row 2: action buttons — compact */
                '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;padding-left:38px;">' +
                    '<button class="beats-action-btn" onclick="event.stopPropagation();beatsShowComments(\'' + t.id + '\')" style="background:none;border:none;font-size:0.75rem;cursor:pointer;padding:3px 6px;color:var(--text-faint);display:flex;align-items:center;gap:2px;border-radius:6px;transition:0.15s;" title="Comments">💬' + (t.commentCount ? '<span style="font-size:0.6rem;">' + t.commentCount + '</span>' : '') + '</button>' +
                    '<button class="beats-action-btn" onclick="event.stopPropagation();beatsToggleLike(\'' + t.id + '\',this)" style="background:none;border:none;font-size:0.85rem;cursor:pointer;padding:3px 6px;color:' + (isLiked ? '#ef4444' : 'var(--text-faint)') + ';border-radius:6px;transition:0.15s;" title="Like">' + (isLiked ? '❤️' : '🤍') + '</button>' +
                    '<button class="beats-action-btn" onclick="event.stopPropagation();beatsAddToPlaylistPicker(\'' + t.id + '\')" style="background:none;border:none;font-size:0.85rem;cursor:pointer;padding:3px 6px;color:var(--accent);border-radius:6px;transition:0.15s;" title="Add to playlist">➕</button>' +
                    '<button class="beats-action-btn" onclick="event.stopPropagation();beatsTrackMenu(\'' + t.id + '\',' + idx + ')" style="background:none;border:none;font-size:0.8rem;cursor:pointer;padding:3px 6px;color:var(--text-faint);border-radius:6px;margin-left:auto;" title="More">⋮</button>' +
                '</div>' +
            '</div>';
        });
        listEl.innerHTML = html;
    }).catch(function(e) {
        console.error('Beats load error:', e); if (e && e.message) { console.log('Firestore Error Details:', e.message); }
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Error loading tracks. Try again.</div>';
    });
};

// ---- Play track ----
window.beatsPlayTrack = function(idx) {
    var track = window._beatsQueue[idx];
    if (!track || (!track.audioData && !track.audioUrl)) { if (typeof showToast === 'function') showToast('Track not available'); return; }

    // If this track is already playing, toggle play/pause instead of restarting
    if (idx === window._beatsQueueIdx && window._beatsAudio) {
        beatsTogglePlay();
        return;
    }

    window._beatsQueueIdx = idx;
    // Daily challenge: track that user played a beat
    try { var _t = new Date().toISOString().split('T')[0]; localStorage.setItem('btc_beats_played_' + _t, 'true'); } catch(e) {}
    // Lifetime play count for badges
    try { var _pc = parseInt(localStorage.getItem('btc_beats_play_count') || '0'); localStorage.setItem('btc_beats_play_count', String(_pc + 1)); } catch(e) {}

    // Pause DJ tune-in if active (mutual exclusion with global chat stream)
    if (window._djListening && window._djAudio) {
        window._djAudio.pause();
        window._djAudio = null;
        window._djListening = false;
        var tuneBtn = document.getElementById('djTuneBtn');
        if (tuneBtn) { tuneBtn.textContent = '🔊 Tune In'; if (typeof djTuneIn === 'function') tuneBtn.onclick = djTuneIn; }
        if (typeof showToast === 'function') showToast('⏸ DJ stream paused — playing your track');
    }

    // Stop existing beats audio
    if (window._beatsAudio) { window._beatsAudio.pause(); window._beatsAudio = null; }
    clearInterval(window._beatsUpdateInterval);
    if (window._beatsPlayCountTimer) { clearTimeout(window._beatsPlayCountTimer); window._beatsPlayCountTimer = null; }

    // Create audio element
    window._beatsAudio = new Audio(track.audioUrl || track.audioData);
    window._beatsAudio.volume = (document.getElementById('beatsVolume') ? document.getElementById('beatsVolume').value : 80) / 100;
    window._beatsAudio.play().catch(function(e) { console.log('Play error:', e); });

    // Auto-fix incorrect Firestore durations when audio metadata loads
    window._beatsAudio.addEventListener('loadedmetadata', function() {
        if (window._beatsAudio && window._beatsAudio.duration && isFinite(window._beatsAudio.duration)) {
            var storedDur = track.duration || 0;
            var realDur = Math.round(window._beatsAudio.duration);
            if (realDur > 0 && Math.abs(realDur - storedDur) > 5 && typeof db !== 'undefined') {
                db.collection('beats_tracks').doc(track.id).update({ duration: realDur }).catch(function() {});
                track.duration = realDur; // fix local cache too
            }
        }
    });

    // Store now-playing info (survives navigation)
    window._beatsNowPlaying = {
        title: track.title || 'Untitled',
        artist: track.artist || track.authorName || 'Unknown',
        genre: track.genre || '',
        coverArt: track.coverArt || track.coverUrl || '',
        authorId: track.authorId || '',
        trackId: track.id || ''
    };
    window._beatsCurrentAuthorId = track.authorId || track.authorUid || '';

    // Play count: increment after 30s of continuous listening.
    // 45-second cooldown prevents a double-count if the user restarts the track
    // immediately (e.g. seeking back to 0), but every genuine replay counts.
    if (window._beatsPlayCountTimer) { clearTimeout(window._beatsPlayCountTimer); window._beatsPlayCountTimer = null; }
    if (!window._beatsPlayCooldowns) window._beatsPlayCooldowns = {};
    var _countTrackId = track.id;
    window._beatsPlayCountTimer = setTimeout(function() {
        if (!window._beatsAudio || window._beatsAudio.paused) return;
        if (!_countTrackId) return;
        var now = Date.now();
        var lastCount = window._beatsPlayCooldowns[_countTrackId] || 0;
        // 45s cooldown — just enough to prevent double-count on an immediate restart,
        // but lets genuine replays each register (play 5x = 5 plays)
        if (now - lastCount < 45000) return;
        window._beatsPlayCooldowns[_countTrackId] = now;
        if (typeof db !== 'undefined') {
            db.collection('beats_tracks').doc(_countTrackId).update({
                plays: firebase.firestore.FieldValue.increment(1)
            }).catch(function() {});
        }
    }, 30000);

    // Show & update global player
    beatsShowGlobalPlayer();
    beatsUpdatePlayerUI();
    var playBtn = document.getElementById('beatsPlayBtn');
    if (playBtn) playBtn.textContent = '⏸';

    // MediaSession for lock screen / background / minimized controls
    beatsSetMediaSession(track);
    sessionStorage.setItem('_ch_beats_listen', '1');

    // Progress updates
    window._beatsUpdateInterval = setInterval(function() {
        if (!window._beatsAudio) return;
        var pct = window._beatsAudio.duration ? (window._beatsAudio.currentTime / window._beatsAudio.duration) * 100 : 0;
        var bar = document.getElementById('beatsProgressBar');
        if (bar) bar.style.width = pct + '%';
        var timeEl = document.getElementById('beatsTime');
        if (timeEl) timeEl.textContent = beatsFormatTime(window._beatsAudio.currentTime) + ' / ' + beatsFormatTime(window._beatsAudio.duration || 0);
        // Update MediaSession position
        if ('mediaSession' in navigator && window._beatsAudio.duration) {
            try {
                navigator.mediaSession.setPositionState({
                    duration: window._beatsAudio.duration,
                    position: window._beatsAudio.currentTime,
                    playbackRate: 1
                });
            } catch(e) {}
        }
    }, 500);

    // Auto-next + award points for full listen
    window._beatsAudio.onended = function() {
        // Award +10 points for listening to a full track
        var trackId = window._beatsQueue[window._beatsQueueIdx] ? window._beatsQueue[window._beatsQueueIdx].id : null;
        if (trackId && typeof awardPoints === 'function' && auth && auth.currentUser) {
            // Prevent farming: track which songs were rewarded this session
            if (!window._beatsListenedIds) window._beatsListenedIds = {};
            var _listenCapKey = 'btc_beats_listen_' + new Date().toISOString().split('T')[0];
            var _listenCount = parseInt(localStorage.getItem(_listenCapKey) || '0');
            if (!window._beatsListenedIds[trackId] && _listenCount < 5) {
                window._beatsListenedIds[trackId] = true;
                localStorage.setItem(_listenCapKey, (_listenCount + 1).toString());
                awardPoints(10, 'Listened to a full track on Bitcoin Beats 🎵');
            }
        }
        beatsNextTrack();
    };

    // Play count is handled by the 30-second timer above (lines 271-280)
    // Do NOT increment here — this fires on every play/restart

    // Refresh list to show playing indicator
    beatsLoadTracks(window._beatsCurrentTab);
};

// ---- Controls ----
window.beatsTogglePlay = function() {
    if (!window._beatsAudio) return;
    var btn = document.getElementById('beatsPlayBtn');
    var miniBtn = document.getElementById('beatsMiniPlayBtn');
    if (window._beatsAudio.paused) {
        window._beatsAudio.play();
        if (btn) btn.textContent = '⏸';
        if (miniBtn) miniBtn.textContent = '⏸';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } else {
        window._beatsAudio.pause();
        if (btn) btn.textContent = '▶';
        if (miniBtn) miniBtn.textContent = '▶';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
    }
};

window.beatsNextTrack = function() {
    if (window._beatsQueue.length === 0) return;
    var next = (window._beatsQueueIdx + 1) % window._beatsQueue.length;
    beatsPlayTrack(next);
};

window.beatsPrevTrack = function() {
    if (window._beatsQueue.length === 0) return;
    // If more than 3 seconds in, restart current track
    if (window._beatsAudio && window._beatsAudio.currentTime > 3) {
        window._beatsAudio.currentTime = 0;
        return;
    }
    var prev = (window._beatsQueueIdx - 1 + window._beatsQueue.length) % window._beatsQueue.length;
    beatsPlayTrack(prev);
};

window.beatsSeek = function(event) {
    if (!window._beatsAudio || !window._beatsAudio.duration) return;
    var wrap = document.getElementById('beatsProgressWrap');
    if (!wrap) return;
    var rect = wrap.getBoundingClientRect();
    var pct = (event.clientX - rect.left) / rect.width;
    window._beatsAudio.currentTime = pct * window._beatsAudio.duration;
};

window.beatsSetVolume = function(val) {
    if (window._beatsAudio) window._beatsAudio.volume = val / 100;
};

// ---- Like ----
window.beatsToggleLike = function(trackId, btn) {
    // Require sign-in so the like actually syncs cross-device
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to save your liked tracks across devices');
        if (typeof showUsernamePrompt === 'function') setTimeout(showUsernamePrompt, 300);
        return;
    }
    var liked = safeJSON('btc_beats_liked', []);
    var idx = liked.indexOf(trackId);
    if (idx === -1) {
        liked.push(trackId);
        if (btn) { btn.textContent = '❤️'; btn.style.color = '#ef4444'; }
        if (typeof db !== 'undefined') {
            db.collection('beats_tracks').doc(trackId).update({ likes: firebase.firestore.FieldValue.increment(1), likedBy: firebase.firestore.FieldValue.arrayUnion(auth.currentUser.uid) }).catch(function() {});
            // Notify the artist
            db.collection('beats_tracks').doc(trackId).get().then(function(doc) {
                if (doc.exists && doc.data().authorId && typeof sendNotification === 'function') {
                    var t = doc.data();
                    var _un = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
                    sendNotification(t.authorId, 'like', _un + ' liked your track "' + (t.title || '').substring(0, 40) + '" ❤️', 'beats_track', trackId);
                }
            }).catch(function() {});
        }
    } else {
        liked.splice(idx, 1);
        if (btn) { btn.textContent = '🤍'; btn.style.color = 'var(--text-faint)'; }
        if (typeof db !== 'undefined') {
            db.collection('beats_tracks').doc(trackId).update({ likes: firebase.firestore.FieldValue.increment(-1), likedBy: firebase.firestore.FieldValue.arrayRemove(auth.currentUser.uid) }).catch(function() {});
        }
    }
    localStorage.setItem('btc_beats_liked', JSON.stringify(liked));
};

// ---- Upload ----
window.beatsShowUpload = function() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('Sign in to upload tracks');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }
    // Navigate to Beats upload tab
    if (typeof renderBitcoinBeats === 'function') renderBitcoinBeats();
    setTimeout(function() { beatsTab('upload'); }, 200);
};

// ---- Bulk upload helpers ----
window._beatsBulkType = 'single'; // 'single', 'ep', 'album'
window._beatsBulkFiles = [];

window.beatsBulkFileChange = function(input) {
    var files = Array.from(input.files || []);
    if (files.length > 20) {
        showToast('Maximum 20 files at once');
        files = files.slice(0, 20);
    }
    window._beatsBulkFiles = files;

    var countEl = document.getElementById('beatsBulkCount');
    var groupEl = document.getElementById('beatsBulkGroup');
    var trackListEl = document.getElementById('beatsBulkTrackList');
    var tracksEl = document.getElementById('beatsBulkTracks');
    var btn = document.getElementById('beatsUpBtn');

    if (files.length === 0) {
        if (countEl) countEl.textContent = '';
        if (groupEl) groupEl.style.display = 'none';
        if (trackListEl) trackListEl.style.display = 'none';
        if (btn) btn.textContent = 'Upload Track';
        return;
    }

    if (countEl) countEl.textContent = files.length + ' file' + (files.length > 1 ? 's' : '') + ' selected (' + files.reduce(function(s, f) { return s + f.size; }, 0).toLocaleString() + ' bytes total)';
    if (btn) btn.textContent = files.length === 1 ? 'Upload Track' : 'Upload ' + files.length + ' Tracks';

    // Show grouping options for 2+ files
    if (files.length > 1) {
        if (groupEl) groupEl.style.display = 'block';
        beatsBulkSetType('single'); // default
    } else {
        if (groupEl) groupEl.style.display = 'none';
        window._beatsBulkType = 'single';
    }

    // Build editable track list
    if (trackListEl) trackListEl.style.display = files.length > 0 ? 'block' : 'none';
    if (tracksEl) {
        var html = '';
        for (var i = 0; i < files.length; i++) {
            var name = files[i].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/^\d+\s*/, '');
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;padding:8px 10px;" draggable="true" data-idx="' + i + '" ondragstart="event.dataTransfer.setData(\'text/plain\',\'' + i + '\')" ondragover="event.preventDefault();this.style.borderColor=\'var(--accent)\'" ondragleave="this.style.borderColor=\'var(--border)\'" ondrop="beatsBulkReorder(event,\'' + i + '\')">' +
                '<span style="color:var(--text-faint);font-size:0.75rem;font-weight:700;width:24px;text-align:center;flex-shrink:0;">' + (i + 1) + '</span>' +
                '<input type="text" value="' + (typeof escapeHtml === 'function' ? escapeHtml(name) : name).replace(/"/g, '&quot;') + '" maxlength="100" class="beats-bulk-title" data-idx="' + i + '" style="flex:1;padding:6px 10px;background:transparent;border:1px solid transparent;border-radius:8px;color:var(--text);font-size:0.82rem;font-family:inherit;" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'transparent\'">' +
                '<span style="color:var(--text-faint);font-size:0.6rem;">' + (files[i].size / (1024 * 1024)).toFixed(1) + 'MB</span>' +
                '<button onclick="beatsBulkRemove(' + i + ')" style="background:none;border:none;color:var(--text-faint);font-size:0.9rem;cursor:pointer;padding:2px 6px;">✕</button>' +
            '</div>';
        }
        tracksEl.innerHTML = html;
    }
};

window.beatsBulkSetType = function(type) {
    window._beatsBulkType = type;
    var types = ['single', 'ep', 'album'];
    types.forEach(function(t) {
        var btn = document.getElementById('beatsBulkType' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            if (t === type) {
                btn.style.background = 'var(--accent)';
                btn.style.color = '#fff';
                btn.style.borderColor = 'var(--accent)';
            } else {
                btn.style.background = 'var(--card-bg)';
                btn.style.color = 'var(--text-muted)';
                btn.style.borderColor = 'var(--border)';
            }
        }
    });
    var albumFields = document.getElementById('beatsBulkAlbumFields');
    if (albumFields) albumFields.style.display = (type === 'ep' || type === 'album') ? 'block' : 'none';
};

window.beatsBulkRemove = function(idx) {
    window._beatsBulkFiles.splice(idx, 1);
    // Rebuild the file list display
    var input = document.getElementById('beatsUpFile');
    beatsBulkFileChange({ files: window._beatsBulkFiles });
};

window.beatsBulkReorder = function(event, targetIdx) {
    event.preventDefault();
    var fromIdx = parseInt(event.dataTransfer.getData('text/plain'));
    targetIdx = parseInt(targetIdx);
    if (fromIdx === targetIdx) return;
    var files = window._beatsBulkFiles;
    var moved = files.splice(fromIdx, 1)[0];
    files.splice(targetIdx, 0, moved);
    beatsBulkFileChange({ files: files });
};

window.beatsDoUpload = function() {
    var files = window._beatsBulkFiles && window._beatsBulkFiles.length > 0 ? window._beatsBulkFiles : null;
    var fileInput = document.getElementById('beatsUpFile');
    if (!files && fileInput && fileInput.files && fileInput.files.length > 0) {
        files = Array.from(fileInput.files);
    }
    if (!files || files.length === 0) { showToast('Please select audio file(s)'); return; }

    // Get track titles from editable list or from single-file mode
    var titles = [];
    var titleInputs = document.querySelectorAll('.beats-bulk-title');
    if (titleInputs.length > 0) {
        for (var i = 0; i < titleInputs.length; i++) {
            titles.push((titleInputs[i].value || '').trim());
        }
    }
    // Fill in missing titles from filenames
    for (var j = 0; j < files.length; j++) {
        if (!titles[j]) {
            titles[j] = files[j].name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').replace(/^\d+\s*/, '');
        }
        if (!titles[j]) { showToast('Please enter a title for track ' + (j + 1)); return; }
    }

    var artist = (document.getElementById('beatsUpArtist').value || '').trim();
    var genre = document.getElementById('beatsUpGenre').value;
    var coverInput = document.getElementById('beatsUpCover');
    var copyrightCheck = document.getElementById('beatsUpCopyright');

    if (!copyrightCheck.checked) { showToast('You must confirm copyright ownership'); return; }

    // Validate all files
    for (var k = 0; k < files.length; k++) {
        if (files[k].size > 50 * 1024 * 1024) { showToast('File "' + files[k].name + '" too large. Max 50MB.'); return; }
    }

    var coverFile = coverInput && coverInput.files && coverInput.files[0] ? coverInput.files[0] : null;
    if (coverFile) {
        if (coverFile.size > 2 * 1024 * 1024) { showToast('Cover art too large. Max 2MB.'); return; }
        if (!coverFile.type.match(/image\/(jpeg|jpg|png|webp|gif)/)) { showToast('Cover art must be JPG, PNG, WebP, or GIF.'); return; }
    }

    // Album/EP metadata
    var bulkType = window._beatsBulkType || 'single';
    var albumTitle = '';
    var albumYear = '';
    if ((bulkType === 'ep' || bulkType === 'album') && files.length > 1) {
        albumTitle = (document.getElementById('beatsBulkAlbumTitle').value || '').trim();
        albumYear = (document.getElementById('beatsBulkAlbumYear').value || '').trim();
        if (!albumTitle) { showToast('Please enter an ' + bulkType.toUpperCase() + ' title'); return; }
    }

    var btn = document.getElementById('beatsUpBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    document.getElementById('beatsUpProgress').style.display = 'block';
    document.getElementById('beatsUpBar').style.width = '5%';
    document.getElementById('beatsUpStatus').textContent = 'Preparing ' + files.length + ' track' + (files.length > 1 ? 's' : '') + '...';

    var storage = null;
    try { storage = firebase.storage(); } catch(e) {}

    if (files.length === 1 && !storage && files[0].size > 700 * 1024) {
        showToast('⚠️ File too large for current storage. Use MP3 under 700KB, or contact admin to enable cloud storage.');
        btn.disabled = false;
        btn.textContent = 'Upload Track';
        document.getElementById('beatsUpProgress').style.display = 'none';
        return;
    }

    // Generate album ID for grouped uploads
    var albumId = (bulkType === 'ep' || bulkType === 'album') ? 'album_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8) : '';

    // DURATION CHECK — reject any clip shorter than 15 seconds BEFORE touching Storage/Firestore.
    // Runs client-side via HTMLAudioElement metadata; Firestore rules enforce the same
    // threshold server-side so this can't be bypassed.
    document.getElementById('beatsUpStatus').textContent = 'Checking audio duration(s)...';
    _checkAllDurations(files, function(err, tooShortNames) {
        if (err) {
            // If we couldn't decode metadata for one or more files, reject —
            // we don't want to let an un-decodable file past the duration gate.
            showToast('⚠️ Could not read audio duration for: ' + err.join(', ') + '. Is it a valid audio file?', 6000);
            btn.disabled = false;
            btn.textContent = 'Upload Track' + (files.length > 1 ? 's' : '');
            document.getElementById('beatsUpProgress').style.display = 'none';
            return;
        }
        if (tooShortNames.length > 0) {
            var msg = tooShortNames.length === 1
                ? '⏱️ "' + tooShortNames[0] + '" is under 15 seconds. Songs must be at least 15 seconds long.'
                : '⏱️ ' + tooShortNames.length + ' tracks are under 15 seconds. Songs must be at least 15 seconds long.';
            showToast(msg, 7000);
            btn.disabled = false;
            btn.textContent = 'Upload Track' + (files.length > 1 ? 's' : '');
            document.getElementById('beatsUpProgress').style.display = 'none';
            return;
        }
        // All files pass duration check — proceed with upload
        _uploadCoverThenTracks(storage, files, titles, artist, genre, coverFile, bulkType, albumTitle, albumYear, albumId, btn);
    });
};

// Check that every file in the list is at least 15 seconds long.
// Callback(errFileNames, tooShortNames) — errFileNames=null when all decoded fine.
function _checkAllDurations(files, callback) {
    var MIN_SECONDS = 15;
    var results = new Array(files.length);
    var errored = [];
    var tooShort = [];
    var done = 0;
    function oneDone() {
        done++;
        if (done === files.length) {
            if (errored.length > 0) { callback(errored, tooShort); return; }
            callback(null, tooShort);
        }
    }
    files.forEach(function(file, i) {
        var url = URL.createObjectURL(file);
        var audio = new Audio();
        var settled = false;
        audio.preload = 'metadata';
        function settle(duration) {
            if (settled) return;
            settled = true;
            try { URL.revokeObjectURL(url); } catch(e) {}
            if (duration === null || !isFinite(duration) || isNaN(duration) || duration <= 0) {
                errored.push(file.name);
            } else if (duration < MIN_SECONDS) {
                tooShort.push(file.name);
            }
            oneDone();
        }
        audio.onloadedmetadata = function() { settle(audio.duration); };
        audio.onerror = function() { settle(null); };
        // Safety timeout — some browsers are slow to emit loadedmetadata for certain formats
        setTimeout(function() { settle(audio.duration || null); }, 8000);
        audio.src = url;
    });
}

function _uploadCoverThenTracks(storage, files, titles, artist, genre, coverFile, bulkType, albumTitle, albumYear, albumId, btn) {
    var coverUrl = '';

    function startTrackUploads() {
        _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, 0, files.length);
    }

    if (coverFile && storage) {
        var uid = auth.currentUser.uid;
        var coverRef = storage.ref('beats-covers/' + uid + '/' + Date.now() + '_cover.' + coverFile.name.split('.').pop());
        document.getElementById('beatsUpStatus').textContent = 'Uploading cover art...';
        coverRef.put(coverFile).then(function(snap) {
            return snap.ref.getDownloadURL();
        }).then(function(url) {
            coverUrl = url;
            startTrackUploads();
        }).catch(function() {
            startTrackUploads(); // continue without cover
        });
    } else {
        startTrackUploads();
    }
}

function _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx, total) {
    if (idx >= total) {
        // All done
        document.getElementById('beatsUpBar').style.width = '100%';
        document.getElementById('beatsUpStatus').textContent = '✅ All ' + total + ' track' + (total > 1 ? 's' : '') + ' uploaded!';
        showToast('🎵 ' + total + ' track' + (total > 1 ? 's' : '') + ' uploaded!');var _bu2=parseInt(localStorage.getItem('btc_beats_uploads')||'0')+total;localStorage.setItem('btc_beats_uploads',_bu2.toString());
        sessionStorage.setItem('_ch_beats_upload', '1');
        if (typeof awardPoints === 'function') awardPoints(25 * total, 'Uploaded ' + total + ' track' + (total > 1 ? 's' : '') + ' to Bitcoin Beats!');
        if (typeof awardTickets === 'function') awardTickets(10 * total, '🎵 ' + total + ' beat' + (total > 1 ? 's' : '') + ' uploaded');
        setTimeout(function() {
            var overlay = document.getElementById('beatsUploadOverlay');
            if (overlay) overlay.remove();
            beatsLoadTracks(window._beatsCurrentTab);
            beatsTab('mymusic');
        }, 1500);
        return;
    }

    var file = files[idx];
    var title = titles[idx];
    var pctBase = Math.round((idx / total) * 100);
    var pctSlice = Math.round(100 / total);
    document.getElementById('beatsUpBar').style.width = pctBase + '%';
    document.getElementById('beatsUpStatus').textContent = 'Uploading track ' + (idx + 1) + '/' + total + ': ' + title;

    var uid = auth.currentUser.uid;
    var timestamp = Date.now() + idx;

    if (storage) {
        var audioRef = storage.ref('beats/' + uid + '/' + timestamp + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_'));
        var uploadTask = audioRef.put(file);
        uploadTask.on('state_changed',
            function(snapshot) {
                var filePct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * pctSlice);
                document.getElementById('beatsUpBar').style.width = (pctBase + filePct) + '%';
            },
            function(err) {
                document.getElementById('beatsUpStatus').textContent = '❌ Failed: ' + title + ' — ' + (err.message || 'error');
                // Continue with next track
                setTimeout(function() { _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx + 1, total); }, 500);
            },
            function() {
                uploadTask.snapshot.ref.getDownloadURL().then(function(audioUrl) {
                    _saveBulkTrackDoc(title, artist, genre, audioUrl, coverUrl, bulkType, albumTitle, albumYear, albumId, idx, total, function() {
                        _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx + 1, total);
                    });
                });
            }
        );
    } else {
        // Firestore-only fallback for small files
        if (file.size > 700 * 1024) {
            document.getElementById('beatsUpStatus').textContent = '⚠️ Skipping ' + title + ' (too large for current storage)';
            setTimeout(function() { _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx + 1, total); }, 500);
            return;
        }
        var reader = new FileReader();
        reader.onload = function(e) {
            var audioData = e.target.result;
            var trackData = {
                title: title.substring(0, 100),
                artist: artist.substring(0, 60) || (typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous'),
                genre: genre,
                audioData: audioData,
                duration: 0,
                authorId: auth.currentUser.uid,
                authorName: typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous',
                plays: 0, likes: 0,
                copyrightConfirmed: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            if (albumId) { trackData.albumId = albumId; trackData.albumTitle = albumTitle; trackData.albumType = bulkType; trackData.trackNumber = idx + 1; if (albumYear) trackData.albumYear = parseInt(albumYear); }
            db.collection('beats_tracks').add(trackData).then(function() {
                _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx + 1, total);
            }).catch(function() {
                _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx + 1, total);
            });
        };
        reader.onerror = function() {
            _uploadTracksSequential(storage, files, titles, artist, genre, coverUrl, bulkType, albumTitle, albumYear, albumId, btn, idx + 1, total);
        };
        reader.readAsDataURL(file);
    }
}

function _saveBulkTrackDoc(title, artist, genre, audioUrl, coverUrl, bulkType, albumTitle, albumYear, albumId, trackIdx, totalTracks, callback) {
    var tempAudio = new Audio(audioUrl);
    var gotMeta = false;
    function save(duration) {
        // Upfront check already verified >=15s. If re-read failed (0), clamp.
        var safeDuration = (duration && duration >= 15) ? Math.round(duration) : 15;
        var trackData = {
            title: title.substring(0, 100),
            artist: artist.substring(0, 60) || (typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous'),
            genre: genre,
            audioUrl: audioUrl,
            duration: safeDuration,
            authorId: auth.currentUser.uid,
            authorName: typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous',
            plays: 0, likes: 0,
            copyrightConfirmed: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (coverUrl) trackData.coverUrl = coverUrl;
        if (albumId) {
            trackData.albumId = albumId;
            trackData.albumTitle = albumTitle;
            trackData.albumType = bulkType;
            trackData.trackNumber = trackIdx + 1;
            trackData.albumTotalTracks = totalTracks;
            if (albumYear) trackData.albumYear = parseInt(albumYear);
        }
        db.collection('beats_tracks').add(trackData).then(callback).catch(callback);
    }
    tempAudio.onloadedmetadata = function() { if (!gotMeta) { gotMeta = true; save(Math.round(tempAudio.duration || 0)); } };
    tempAudio.onerror = function() { if (!gotMeta) { gotMeta = true; save(0); } };
    setTimeout(function() { if (!gotMeta) { gotMeta = true; save(0); } }, 3000);
}

// Upload via Firebase Storage (supports large files + cover art)
function _uploadViaStorage(storage, file, coverFile, title, artist, genre, btn) {
    var uid = auth.currentUser.uid;
    var timestamp = Date.now();
    var audioRef = storage.ref('beats/' + uid + '/' + timestamp + '_' + file.name.replace(/[^a-zA-Z0-9._-]/g, '_'));

    document.getElementById('beatsUpBar').style.width = '20%';
    document.getElementById('beatsUpStatus').textContent = 'Uploading audio...';

    var uploadTask = audioRef.put(file);
    uploadTask.on('state_changed',
        function(snapshot) {
            var pct = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 60) + 20;
            document.getElementById('beatsUpBar').style.width = pct + '%';
            document.getElementById('beatsUpStatus').textContent = 'Uploading audio... ' + Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) + '%';
        },
        function(err) {
            console.error('Storage upload error:', err);
            showToast('Upload failed: ' + (err.message || 'Unknown error'));
            btn.disabled = false;
            btn.textContent = 'Upload Track';
        },
        function() {
            // Audio uploaded — get URL
            uploadTask.snapshot.ref.getDownloadURL().then(function(audioUrl) {
                document.getElementById('beatsUpBar').style.width = '80%';

                // Upload cover art if provided
                if (coverFile) {
                    document.getElementById('beatsUpStatus').textContent = 'Uploading cover art...';
                    var coverRef = storage.ref('beats-covers/' + uid + '/' + timestamp + '_cover.' + coverFile.name.split('.').pop());
                    coverRef.put(coverFile).then(function(snap) {
                        return snap.ref.getDownloadURL();
                    }).then(function(coverUrl) {
                        _saveTrackToFirestore(title, artist, genre, audioUrl, coverUrl, btn);
                    }).catch(function() {
                        // Cover failed but audio is fine — save without cover
                        _saveTrackToFirestore(title, artist, genre, audioUrl, '', btn);
                    });
                } else {
                    _saveTrackToFirestore(title, artist, genre, audioUrl, '', btn);
                }
            });
        }
    );
}

// Firestore-only fallback for small files
function _uploadViaFirestore(file, coverFile, title, artist, genre, btn) {
    var reader = new FileReader();
    reader.onload = function(e) {
        var audioData = e.target.result;
        document.getElementById('beatsUpBar').style.width = '50%';
        document.getElementById('beatsUpStatus').textContent = 'Getting audio duration...';

        // Read cover art if provided
        var coverData = '';
        function finishUpload() {
            var tempAudio = new Audio(audioData);
            var gotMeta = false;
            tempAudio.onloadedmetadata = function() {
                if (gotMeta) return;
                gotMeta = true;
                _saveTrackDoc(title, artist, genre, audioData, coverData, Math.round(tempAudio.duration || 0), btn);
            };
            tempAudio.onerror = function() {
                if (gotMeta) return;
                gotMeta = true;
                _saveTrackDoc(title, artist, genre, audioData, coverData, 0, btn);
            };
            setTimeout(function() { if (!gotMeta) { gotMeta = true; _saveTrackDoc(title, artist, genre, audioData, coverData, 0, btn); } }, 5000);
        }

        if (coverFile && coverFile.size < 200 * 1024) {
            var coverReader = new FileReader();
            coverReader.onload = function(ce) { coverData = ce.target.result; finishUpload(); };
            coverReader.onerror = function() { finishUpload(); };
            coverReader.readAsDataURL(coverFile);
        } else {
            finishUpload();
        }
    };
    reader.onerror = function() { showToast('Error reading file'); btn.disabled = false; btn.textContent = 'Upload Track'; };
    reader.readAsDataURL(file);
}

// Save track doc (Firestore-only path, with base64 data)
function _saveTrackDoc(title, artist, genre, audioData, coverData, duration, btn) {
    document.getElementById('beatsUpBar').style.width = '80%';
    document.getElementById('beatsUpStatus').textContent = 'Saving to archive...';

    // Upfront check already verified >=15s. If re-read here failed (returned 0),
    // clamp to 15 so Firestore rules don't reject. int + >= 15 required.
    var safeDuration = (duration && duration >= 15) ? Math.round(duration) : 15;

    var trackData = {
        title: title.substring(0, 100),
        artist: artist.substring(0, 60) || (typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous'),
        genre: genre,
        audioData: audioData,
        duration: safeDuration,
        authorId: auth.currentUser.uid,
        authorName: typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous',
        plays: 0,
        likes: 0,
        copyrightConfirmed: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    if (coverData) trackData.coverArt = coverData;

    db.collection('beats_tracks').add(trackData).then(function() {
        _onUploadSuccess(btn);
    }).catch(function(err) {
        console.error('Upload error:', err);
        if (err.message && err.message.indexOf('too large') !== -1) {
            showToast('⚠️ File too large for storage. Try a smaller MP3.');
        } else {
            showToast('Upload failed: ' + (err.message || 'Unknown error'));
        }
        btn.disabled = false;
        btn.textContent = 'Upload Track';
    });
}

// Save track doc (Storage path, with URLs)
function _saveTrackToFirestore(title, artist, genre, audioUrl, coverUrl, btn) {
    document.getElementById('beatsUpBar').style.width = '90%';
    document.getElementById('beatsUpStatus').textContent = 'Saving to archive...';

    // Get duration from the URL
    var tempAudio = new Audio(audioUrl);
    var gotMeta = false;
    function saveDoc(duration) {
        var trackData = {
            title: title.substring(0, 100),
            artist: artist.substring(0, 60) || (typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous'),
            genre: genre,
            audioUrl: audioUrl,
            duration: duration,
            authorId: auth.currentUser.uid,
            authorName: typeof currentUser !== 'undefined' && currentUser ? currentUser.username : 'Anonymous',
            plays: 0,
            likes: 0,
            copyrightConfirmed: true,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (coverUrl) trackData.coverUrl = coverUrl;

        db.collection('beats_tracks').add(trackData).then(function() {
            _onUploadSuccess(btn);
        }).catch(function(err) {
            console.error('Upload error:', err);
            showToast('Upload failed: ' + (err.message || 'Unknown error'));
            btn.disabled = false;
            btn.textContent = 'Upload Track';
        });
    }
    tempAudio.onloadedmetadata = function() { if (!gotMeta) { gotMeta = true; saveDoc(Math.round(tempAudio.duration || 0)); } };
    tempAudio.onerror = function() { if (!gotMeta) { gotMeta = true; saveDoc(0); } };
    setTimeout(function() { if (!gotMeta) { gotMeta = true; saveDoc(0); } }, 5000);
}

function _onUploadSuccess(btn) {
    document.getElementById('beatsUpBar').style.width = '100%';
    document.getElementById('beatsUpStatus').textContent = '✅ Upload complete!';
    showToast('🎵 Track uploaded!');var _bu=parseInt(localStorage.getItem('btc_beats_uploads')||'0')+1;localStorage.setItem('btc_beats_uploads',_bu.toString());
    sessionStorage.setItem('_ch_beats_upload', '1');
    if (typeof awardPoints === 'function') awardPoints(50, 'Uploaded a track to Bitcoin Beats! 🎵');if(typeof awardTickets==='function')awardTickets(10,'🎵 Beat uploaded');
    setTimeout(function() {
        var overlay = document.getElementById('beatsUploadOverlay');
        if (overlay) overlay.remove();
        beatsLoadTracks(window._beatsCurrentTab);
    }, 1000);
}

// ---- Track detail modal (full song info) ----
window.beatsShowTrackDetail = function(idx) {
    var track = window._beatsQueue[idx];
    if (!track) return;
    var isPlaying = window._beatsQueueIdx === idx;
    var isLiked = (JSON.parse(localStorage.getItem('beats_liked') || '[]')).indexOf(track.id) !== -1;
    var duration = track.duration ? beatsFormatTime(track.duration) : '--:--';
    var overlay = document.createElement('div');
    overlay.id = 'beatsDetailOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.8);display:flex;align-items:flex-end;justify-content:center;padding:16px;animation:beatsFadeIn 0.2s ease;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var coverHtml = (track.coverArt || track.coverUrl)
        ? '<img src="' + _safeCover(track.coverUrl || track.coverArt) + '" style="width:120px;height:120px;border-radius:16px;object-fit:cover;box-shadow:0 4px 20px rgba(0,0,0,0.4);">'
        : '<div style="width:120px;height:120px;border-radius:16px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:3rem;">' + (track.genre === 'podcast' ? '🎙️' : '🎵') + '</div>';

    var html = '<style>@keyframes beatsSlideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}@keyframes beatsFadeIn{from{opacity:0}to{opacity:1}}</style>' +
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--border);border-radius:20px 20px 0 0;padding:24px;max-width:400px;width:100%;animation:beatsSlideUp 0.25s ease;">' +
        '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 20px;"></div>' +
        '<div style="text-align:center;margin-bottom:20px;">' + coverHtml + '</div>' +
        '<div style="text-align:center;margin-bottom:6px;color:var(--heading);font-weight:800;font-size:1.1rem;word-break:break-word;">' + escapeHtml(track.title || 'Untitled') + '</div>' +
        '<div style="text-align:center;font-size:0.85rem;margin-bottom:4px;">' +
            (track.authorId ? '<span onclick="event.stopPropagation();document.getElementById(\'beatsDetailOverlay\').remove();if(typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(\'' + track.authorId + '\')" style="color:var(--text-muted);cursor:pointer;transition:0.2s;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">' + escapeHtml(track.artist || track.authorName || 'Unknown') + '</span>' : '<span style="color:var(--text-faint);">' + escapeHtml(track.artist || track.authorName || 'Unknown') + '</span>') +
            (track.authorId ? ' <span onclick="event.stopPropagation();document.getElementById(\'beatsDetailOverlay\').remove();if(typeof showTipOverlay===\'function\')showTipOverlay({recipientName:\'' + escapeHtml(track.artist || track.authorName || 'Artist').replace(/[\\'"]/g,"") + '\',recipientUid:\'' + track.authorId + '\',context:\'Bitcoin Beats tip\',label:\'Tip Artist\'})" style="color:var(--accent);font-weight:700;font-size:0.8rem;cursor:pointer;">⚡ Tip</span>' : '') +
        '</div>' +
        (track.genre ? '<div style="text-align:center;margin-bottom:10px;"><span style="background:rgba(247,147,26,0.15);color:var(--accent);font-size:0.7rem;font-weight:600;padding:3px 10px;border-radius:20px;">' + escapeHtml(track.genre) + '</span></div>' : '<div style="margin-bottom:10px;"></div>') +
        // Upload date — small, subtle, tooltip shows full timestamp
        (track.createdAt ? (function() {
            var _d = track.createdAt.toDate ? track.createdAt.toDate() : new Date(track.createdAt);
            var _full = _d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
            var _ago = (typeof timeAgo === 'function') ? timeAgo(track.createdAt) : '';
            return '<div style="text-align:center;margin-bottom:14px;color:var(--text-faint);font-size:0.7rem;" title="' + escapeHtml(_full) + '">📅 Uploaded ' + escapeHtml(_ago) + ' · <span style="opacity:0.8;">' + escapeHtml(_d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })) + '</span></div>';
        })() : '') +
        '<div style="display:flex;justify-content:center;gap:24px;margin-bottom:20px;color:var(--text-faint);font-size:0.75rem;">' +
            '<div style="text-align:center;"><div style="font-weight:700;font-size:0.9rem;color:var(--heading);">' + duration + '</div>Duration</div>' +
            '<div style="text-align:center;"><div style="font-weight:700;font-size:0.9rem;color:var(--heading);">' + _formatPlays(track.plays || 0) + '</div>Plays</div>' +
            (track.likes !== undefined ? '<div style="text-align:center;"><div style="font-weight:700;font-size:0.9rem;color:var(--heading);">' + (track.likes || 0) + '</div>Likes</div>' : '') +
            (track.commentCount ? '<div style="text-align:center;"><div style="font-weight:700;font-size:0.9rem;color:var(--heading);">' + track.commentCount + '</div>Comments</div>' : '') +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
            '<button id="beatsDetailPlayBtn" onclick="' + (isPlaying ? 'beatsTogglePlay();var b=this;if(window._beatsAudio&&window._beatsAudio.paused){b.textContent=\'▶ Paused\';b.style.background=\'rgba(247,147,26,0.3)\'}else{b.textContent=\'⏸ Now Playing\';b.style.background=\'var(--accent)\'}' : 'document.getElementById(\'beatsDetailOverlay\').remove();beatsPlayTrack(' + idx + ')') + '" style="flex:1;padding:14px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">' + (isPlaying ? '⏸ Now Playing' : '▶ Play') + '</button>' +
            (isPlaying ? '<button class="beats-action-btn" onclick="event.stopPropagation();djBroadcast();document.getElementById(\'beatsDetailOverlay\').remove()" style="padding:14px 18px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:12px;color:#6366f1;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;" title="Broadcast to Global Chat">📡 DJ</button>' : '') +
            '<button class="beats-action-btn" onclick="event.stopPropagation();beatsToggleLike(\'' + track.id + '\',this);setTimeout(function(){var o=document.getElementById(\'beatsDetailOverlay\');if(o)o.remove();beatsLoadTracks(window._beatsCurrentTab);},300)" style="padding:14px 18px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;color:' + (isLiked ? '#ef4444' : 'var(--text-faint)') + ';">' + (isLiked ? '❤️' : '🤍') + '</button>' +
            '<button class="beats-action-btn" onclick="event.stopPropagation();beatsShowComments(\'' + track.id + '\');document.getElementById(\'beatsDetailOverlay\').remove()" style="padding:14px 18px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;color:var(--text-faint);">💬</button>' +
        '</div>' +
        '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
};

// ---- Track menu (report/delete) ----
window.beatsTrackMenu = function(trackId, idx) {
    var track = window._beatsQueue[idx];
    if (!track) return;

    var isOwner = auth && auth.currentUser && track.authorId === auth.currentUser.uid;
    var userEmail = auth && auth.currentUser ? auth.currentUser.email || auth.currentUser.providerData[0].email : '';
    var isAdmin = userEmail && (userEmail.toLowerCase() === 'needcreations@gmail.com' || userEmail.toLowerCase() === 'info.603btc@gmail.com');
    console.log('[Beats Menu] isOwner:', isOwner, 'isAdmin:', isAdmin, 'userEmail:', userEmail);
    var overlay = document.createElement('div');
    overlay.id = 'beatsMenuOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var html = '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--border);border-radius:20px 20px 0 0;padding:20px;max-width:400px;width:100%;">' +
        '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div>' +
        '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;margin-bottom:4px;">' + escapeHtml(track.title || 'Untitled') + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:16px;">' + escapeHtml(track.artist || 'Unknown') + '</div>';

    // Add to playlist (for signed-in users)
    if (auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        html += '<button onclick="document.getElementById(\'beatsMenuOverlay\').remove();beatsAddToPlaylistPicker(\'' + trackId + '\')" style="width:100%;padding:14px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:12px;color:var(--accent);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px;">➕ Add to Playlist</button>';
    }
    if (isOwner || isAdmin) {
        html += '<button onclick="beatsDeleteTrack(\'' + trackId + '\')" style="width:100%;padding:14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;color:#ef4444;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px;">' + (isAdmin ? '🗑️🛡️ Admin Delete Track' : '🗑️ Delete My Track') + '</button>';
    }
    html += '<button onclick="beatsReportTrack(\'' + trackId + '\')" style="width:100%;padding:14px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:12px;color:#eab308;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px;">🚩 Report Copyright / Abuse</button>' +
        '<button onclick="document.getElementById(\'beatsMenuOverlay\').remove()" style="width:100%;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.9rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
        '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
};

window.beatsDeleteTrack = function(trackId) {
    if (!confirm('Delete this track permanently?')) return;
    db.collection('beats_tracks').doc(trackId).delete().then(function() {
        showToast('Track deleted');
        var overlay = document.getElementById('beatsMenuOverlay');
        if (overlay) overlay.remove();
        beatsLoadTracks(window._beatsCurrentTab);
    }).catch(function() { showToast('Error deleting track'); });
};

window.beatsReportTrack = function(trackId) {
    if (!auth || !auth.currentUser) { showToast('Sign in to report'); return; }
    var reason = prompt('Report reason (copyright violation, abuse, etc.):');
    if (!reason) return;
    db.collection('beats_reports').add({
        trackId: trackId,
        reporterId: auth.currentUser.uid,
        reason: reason.substring(0, 500),
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        showToast('🚩 Report submitted. We will review it.');
        var overlay = document.getElementById('beatsMenuOverlay');
        if (overlay) overlay.remove();
    }).catch(function() { showToast('Error submitting report'); });
};

// ---- Edit Track (title, cover, release date) ----
window.beatsEditTrack = function(trackId, artistUid) {
    if (!auth || !auth.currentUser || auth.currentUser.uid !== artistUid) { showToast('Not authorized'); return; }
    db.collection('beats_tracks').doc(trackId).get().then(function(doc) {
        if (!doc.exists) { showToast('Track not found'); return; }
        var t = doc.data();
        var overlay = document.createElement('div');
        overlay.id = 'beatsEditOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
        overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:24px;max-width:400px;width:100%;">' +
            '<div style="font-weight:800;color:var(--heading);font-size:1rem;margin-bottom:16px;">✏️ Edit Track</div>' +
            '<label style="display:block;margin-bottom:12px;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Title</span>' +
                '<input type="text" id="beatsEditTitle" value="' + escapeHtml(t.title || '') + '" maxlength="100" style="display:block;width:100%;padding:10px 12px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-top:4px;box-sizing:border-box;"></label>' +
            '<label style="display:block;margin-bottom:12px;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Genre</span>' +
                '<input type="text" id="beatsEditGenre" value="' + escapeHtml(t.genre || '') + '" maxlength="30" style="display:block;width:100%;padding:10px 12px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-top:4px;box-sizing:border-box;"></label>' +
            '<label style="display:block;margin-bottom:12px;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Release Date</span>' +
                '<input type="date" id="beatsEditDate" value="' + (t.releaseDate || '') + '" style="display:block;width:100%;padding:10px 12px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-top:4px;box-sizing:border-box;"></label>' +
            '<label style="display:block;margin-bottom:16px;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Cover Art (optional new image)</span>' +
                '<input type="file" id="beatsEditCover" accept="image/*" style="display:block;margin-top:4px;font-size:0.8rem;color:var(--text-muted);"></label>' +
            '<div style="display:flex;gap:8px;">' +
                '<button onclick="document.getElementById(\'beatsEditOverlay\').remove()" style="flex:1;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;font-size:0.85rem;">Cancel</button>' +
                '<button onclick="beatsSaveTrackEdit(\'' + trackId + '\',\'' + artistUid + '\')" style="flex:1;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">💾 Save</button>' +
            '</div>' +
        '</div>';
        document.body.appendChild(overlay);
    });
};

window.beatsSaveTrackEdit = function(trackId, artistUid) {
    var title = (document.getElementById('beatsEditTitle').value || '').trim();
    var genre = (document.getElementById('beatsEditGenre').value || '').trim();
    var releaseDate = document.getElementById('beatsEditDate').value || '';
    var coverFile = document.getElementById('beatsEditCover').files[0];
    if (!title) { showToast('Title is required'); return; }

    var updates = { title: title.substring(0, 100) };
    if (genre) updates.genre = genre.substring(0, 30);
    if (releaseDate) updates.releaseDate = releaseDate;

    function doUpdate(coverUrl) {
        if (coverUrl) updates.coverUrl = coverUrl;
        db.collection('beats_tracks').doc(trackId).update(updates).then(function() {
            showToast('✅ Track updated!');
            document.getElementById('beatsEditOverlay').remove();
            // Refresh artist page
            var artOv = document.getElementById('beatsArtistOverlay');
            if (artOv) artOv.remove();
            beatsShowArtistPage(artistUid);
        }).catch(function(e) { showToast('Error saving: ' + e.message); });
    }

    if (coverFile) {
        // Upload new cover
        var storage = firebase.storage();
        var path = 'beats_covers/' + auth.currentUser.uid + '/' + Date.now() + '_' + coverFile.name;
        storage.ref(path).put(coverFile).then(function(snap) {
            return snap.ref.getDownloadURL();
        }).then(function(url) { doUpdate(url); }).catch(function(e) { showToast('Cover upload failed: ' + e.message); });
    } else {
        doUpdate(null);
    }
};

// ---- Upload custom artist profile image ----
window.beatsUploadArtistImage = function() {
    if (!auth || !auth.currentUser) { showToast('Sign in first'); return; }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = function() {
        var file = input.files[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) { showToast('Image too large (max 2MB)'); return; }
        showToast('Uploading artist image...');
        var storage = firebase.storage();
        var path = 'artist_images/' + auth.currentUser.uid + '/' + Date.now() + '_' + file.name;
        storage.ref(path).put(file).then(function(snap) {
            return snap.ref.getDownloadURL();
        }).then(function(url) {
            // Save to user's artistProfile.artistImage
            return db.collection('users').doc(auth.currentUser.uid).update({
                'artistProfile.artistImage': url
            });
        }).then(function() {
            showToast('✅ Artist image updated!');
            // Refresh the artist page
            var artOv = document.getElementById('beatsArtistOverlay');
            if (artOv) artOv.remove();
            beatsShowArtistPage(auth.currentUser.uid);
        }).catch(function(e) { showToast('Upload failed: ' + e.message); });
    };
    input.click();
};

// ---- Create Album from existing singles ----
window.beatsCreateAlbumFromSingles = function() {
    if (!auth || !auth.currentUser) { showToast('Sign in first'); return; }
    var uid = auth.currentUser.uid;
    // Fetch user's singles (tracks without albumId)
    db.collection('beats_tracks').where('authorId', '==', uid).orderBy('createdAt', 'asc').limit(50).get().then(function(snap) {
        var singles = [];
        snap.forEach(function(doc) {
            var d = doc.data();
            if (!d.albumId) singles.push({ id: doc.id, ...d });
        });
        if (singles.length < 2) { showToast('You need at least 2 singles to create an album'); return; }

        var overlay = document.createElement('div');
        overlay.id = 'beatsAlbumGroupOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);display:flex;align-items:center;justify-content:center;padding:20px;overflow-y:auto;';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

        var html = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:24px;max-width:440px;width:100%;max-height:80vh;overflow-y:auto;">' +
            '<div style="font-weight:800;color:var(--heading);font-size:1rem;margin-bottom:4px;">💿 Create Album / EP</div>' +
            '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:16px;">Select tracks to group together. Drag to reorder.</div>' +
            '<label style="display:block;margin-bottom:10px;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Album Title</span>' +
                '<input type="text" id="beatsGroupAlbumTitle" maxlength="80" placeholder="My Album" style="display:block;width:100%;padding:10px 12px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-top:4px;box-sizing:border-box;"></label>' +
            '<div style="display:flex;gap:8px;margin-bottom:12px;">' +
                '<label style="flex:1;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Type</span>' +
                    '<select id="beatsGroupAlbumType" style="display:block;width:100%;padding:10px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;margin-top:4px;"><option value="album">Album</option><option value="ep">EP</option></select></label>' +
                '<label style="flex:1;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Release Date</span>' +
                    '<input type="date" id="beatsGroupAlbumDate" style="display:block;width:100%;padding:10px;background:var(--input-bg);border:2px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;margin-top:4px;box-sizing:border-box;"></label>' +
            '</div>' +
            '<label style="display:block;margin-bottom:14px;"><span style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;">Cover Art (optional)</span>' +
                '<input type="file" id="beatsGroupAlbumCover" accept="image/*" style="display:block;margin-top:4px;font-size:0.8rem;color:var(--text-muted);"></label>' +
            '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Select Tracks (check to include, order = track number)</div>';

        singles.forEach(function(t, i) {
            html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:8px;margin-bottom:4px;background:var(--card-bg);border:1px solid var(--border);cursor:pointer;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                '<input type="checkbox" value="' + t.id + '" class="beatsGroupCheck" style="width:18px;height:18px;accent-color:var(--accent);flex-shrink:0;">' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="color:var(--heading);font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                    '<div style="color:var(--text-faint);font-size:0.6rem;">' + (t.genre || '') + (t.duration ? ' · ' + beatsFormatTime(t.duration) : '') + '</div>' +
                '</div>' +
            '</label>';
        });

        html += '<div style="display:flex;gap:8px;margin-top:16px;">' +
            '<button onclick="document.getElementById(\'beatsAlbumGroupOverlay\').remove()" style="flex:1;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;font-size:0.85rem;">Cancel</button>' +
            '<button onclick="beatsSaveAlbumGroup()" style="flex:1;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">💿 Save Album</button>' +
        '</div></div>';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
    });
};

window.beatsSaveAlbumGroup = function() {
    var title = (document.getElementById('beatsGroupAlbumTitle').value || '').trim();
    var type = document.getElementById('beatsGroupAlbumType').value;
    var releaseDate = document.getElementById('beatsGroupAlbumDate').value || '';
    var coverFile = document.getElementById('beatsGroupAlbumCover').files[0];
    if (!title) { showToast('Please enter an album title'); return; }

    var checks = document.querySelectorAll('.beatsGroupCheck:checked');
    if (checks.length < 2) { showToast('Select at least 2 tracks'); return; }

    var trackIds = [];
    checks.forEach(function(c) { trackIds.push(c.value); });

    var albumId = 'album_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
    var albumYear = releaseDate ? releaseDate.substring(0, 4) : '';

    function doGroup(coverUrl) {
        // Update each track with album metadata
        var batch = db.batch();
        trackIds.forEach(function(tid, i) {
            var ref = db.collection('beats_tracks').doc(tid);
            var update = {
                albumId: albumId,
                albumTitle: title,
                albumType: type,
                trackNumber: i + 1
            };
            if (albumYear) update.albumYear = parseInt(albumYear);
            if (releaseDate) update.releaseDate = releaseDate;
            if (coverUrl) update.coverUrl = coverUrl;
            batch.update(ref, update);
        });
        batch.commit().then(function() {
            showToast('✅ Album "' + title + '" created with ' + trackIds.length + ' tracks!');
            document.getElementById('beatsAlbumGroupOverlay').remove();
            var artOv = document.getElementById('beatsArtistOverlay');
            if (artOv) artOv.remove();
            beatsShowArtistPage(auth.currentUser.uid);
        }).catch(function(e) { showToast('Error: ' + e.message); });
    }

    if (coverFile) {
        var storage = firebase.storage();
        var path = 'beats_covers/' + auth.currentUser.uid + '/' + Date.now() + '_' + coverFile.name;
        storage.ref(path).put(coverFile).then(function(snap) {
            return snap.ref.getDownloadURL();
        }).then(function(url) { doGroup(url); }).catch(function(e) { showToast('Cover upload failed: ' + e.message); });
    } else {
        doGroup(null);
    }
};

// ---- DMCA modal ----
window.beatsShowDMCA = function() {
    var overlay = document.createElement('div');
    overlay.id = 'beatsDMCAOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--accent);border-radius:20px;padding:28px;max-width:520px;width:100%;max-height:85vh;overflow-y:auto;">' +
            '<h3 style="color:var(--heading);font-weight:800;margin-bottom:16px;">📜 Copyright & Takedown Policy</h3>' +
            '<div style="color:var(--text-muted);font-size:0.85rem;line-height:1.6;">' +
                '<p><strong style="color:var(--heading);">User Responsibility</strong><br>Users who upload music to Bitcoin Beats represent and warrant that they own the copyright or have obtained all necessary permissions. Bitcoin Education Archive acts as a hosting platform and does not pre-screen uploads.</p>' +
                '<p><strong style="color:var(--heading);">Copyright Infringement</strong><br>We respect intellectual property rights. If you believe content on Bitcoin Beats infringes your copyright, you may submit a takedown request.</p>' +
                '<p><strong style="color:var(--heading);">How to Submit a Takedown</strong><br>Email <a href="mailto:info.603btc@gmail.com" style="color:var(--accent);">info.603btc@gmail.com</a> with:<br>' +
                '• A description of the copyrighted work<br>' +
                '• The track title and/or URL on our platform<br>' +
                '• Your contact information<br>' +
                '• A statement that you are the copyright owner or authorized agent<br>' +
                '• A statement under penalty of perjury that the information is accurate</p>' +
                '<p><strong style="color:var(--heading);">Response</strong><br>We will review and remove infringing content within 48 hours of receiving a valid takedown notice. Repeat infringers will have their accounts suspended.</p>' +
                '<p><strong style="color:var(--heading);">Counter-Notice</strong><br>If you believe your content was removed in error, you may submit a counter-notice to the same email address with evidence of your rights.</p>' +
            '</div>' +
            '<button onclick="document.getElementById(\'beatsDMCAOverlay\').remove()" style="width:100%;margin-top:16px;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;">Got It</button>' +
        '</div>';
    document.body.appendChild(overlay);
};

// ---- Upload Tab ----
window.beatsRenderUpload = function() {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;

    listEl.innerHTML =
        '<div style="text-align:center;animation:fadeSlideIn 0.4s ease-out;padding:40px 20px;">' +
            '<div style="margin-bottom:20px;">' +
                '<div style="font-size:3.5rem;margin-bottom:16px;animation:beatsPulse 2s infinite;filter:drop-shadow(0 0 12px var(--accent));">🎸</div>' +
                '<div style="color:var(--heading);font-weight:800;font-size:1.5rem;margin-bottom:8px;">Upload Music</div>' +
                '<div style="color:var(--text-faint);font-size:0.9rem;margin-bottom:24px;">Upload a single track or an entire album/EP (up to 20 songs at once).</div>' +
            '</div>' +

            // Upload form
            '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:20px;padding:28px;max-width:520px;margin:0 auto;">' +

                // Audio files — multiple
                '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:4px;">Audio Files * (up to 20 — MP3, WAV, FLAC, OGG, AAC — max 50MB each)</label>' +
                '<input type="file" id="beatsUpFile" multiple accept="audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/flac,audio/ogg,audio/aac,audio/mp4,audio/x-m4a" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;margin-bottom:8px;box-sizing:border-box;" onchange="beatsBulkFileChange(this)">' +
                '<div id="beatsBulkCount" style="font-size:0.7rem;color:var(--text-faint);margin-bottom:12px;"></div>' +

                // Album/EP grouping (appears when 2+ files selected)
                '<div id="beatsBulkGroup" style="display:none;background:linear-gradient(135deg,rgba(99,102,241,0.06),rgba(247,147,26,0.04));border:1px solid rgba(99,102,241,0.2);border-radius:14px;padding:16px;margin-bottom:16px;">' +
                    '<div style="color:var(--heading);font-weight:700;font-size:0.85rem;margin-bottom:10px;">📀 Group these tracks</div>' +
                    '<div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">' +
                        '<button onclick="beatsBulkSetType(\'single\')" id="beatsBulkTypeSingle" class="beats-bulk-type-btn" style="padding:8px 16px;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--border);background:var(--card-bg);color:var(--text-muted);">🎵 Singles</button>' +
                        '<button onclick="beatsBulkSetType(\'ep\')" id="beatsBulkTypeEp" class="beats-bulk-type-btn" style="padding:8px 16px;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--border);background:var(--card-bg);color:var(--text-muted);">💿 EP</button>' +
                        '<button onclick="beatsBulkSetType(\'album\')" id="beatsBulkTypeAlbum" class="beats-bulk-type-btn" style="padding:8px 16px;border-radius:10px;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;border:1px solid var(--border);background:var(--card-bg);color:var(--text-muted);">📀 Album</button>' +
                    '</div>' +
                    '<div id="beatsBulkAlbumFields" style="display:none;">' +
                        '<label style="display:block;font-size:0.72rem;color:var(--text-faint);margin-bottom:4px;">Album / EP Title *</label>' +
                        '<input type="text" id="beatsBulkAlbumTitle" maxlength="100" placeholder="My Debut Album" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:10px;box-sizing:border-box;">' +
                        '<label style="display:block;font-size:0.72rem;color:var(--text-faint);margin-bottom:4px;">Year (optional)</label>' +
                        '<input type="number" id="beatsBulkAlbumYear" placeholder="2026" min="1900" max="2099" style="width:100px;padding:8px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;margin-bottom:10px;box-sizing:border-box;">' +
                    '</div>' +
                '</div>' +

                // Track list (editable titles, appears when files selected)
                '<div id="beatsBulkTrackList" style="display:none;margin-bottom:16px;">' +
                    '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">' +
                        '<label style="font-size:0.75rem;color:var(--text-faint);">Track Titles</label>' +
                        '<span style="font-size:0.65rem;color:var(--text-faint);">Drag to reorder</span>' +
                    '</div>' +
                    '<div id="beatsBulkTracks"></div>' +
                '</div>' +

                // Shared fields
                '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:4px;">Artist Name</label>' +
                '<input type="text" id="beatsUpArtist" maxlength="60" placeholder="Your name or alias" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +
                '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:4px;">Genre</label>' +
                '<select id="beatsUpGenre" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +
                    '<option value="bitcoin">Bitcoin / Orange-Pilled</option>' +
                    '<option value="hip-hop">Hip Hop</option>' +
                    '<option value="rock">Rock</option>' +
                    '<option value="electronic">Electronic</option>' +
                    '<option value="folk">Folk / Acoustic</option>' +
                    '<option value="podcast">Podcast / Talk</option>' +
                    '<option value="ambient">Ambient / Lo-fi</option>' +
                    '<option value="other">Other</option>' +
                '</select>' +

                // Cover art
                '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:4px;">Cover Art (JPG, PNG, WebP — max 2MB)</label>' +
                '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
                    '<div id="beatsCoverPreview" style="width:64px;height:64px;border-radius:10px;border:2px dashed var(--border);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;background:var(--card-bg);cursor:pointer;" onclick="document.getElementById(\'beatsUpCover\').click()">' +
                        '<span style="font-size:1.5rem;color:var(--text-faint);">🎨</span>' +
                    '</div>' +
                    '<div style="flex:1;">' +
                        '<input type="file" id="beatsUpCover" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" style="width:100%;padding:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.8rem;box-sizing:border-box;" onchange="var f=this.files[0];if(f){var r=new FileReader();r.onload=function(e){var p=document.getElementById(\'beatsCoverPreview\');if(p)p.innerHTML=\'<img src=\\\'\'+e.target.result+\'\\\' style=\\\'width:100%;height:100%;object-fit:cover;\\\'>\';};r.readAsDataURL(f);}">' +
                        '<div style="font-size:0.65rem;color:var(--text-faint);margin-top:2px;">Optional — shared across all tracks in this upload</div>' +
                    '</div>' +
                '</div>' +

                // Progress
                '<div id="beatsUpProgress" style="display:none;margin-bottom:12px;">' +
                    '<div style="background:var(--border);border-radius:8px;height:6px;overflow:hidden;"><div id="beatsUpBar" style="height:100%;background:var(--accent);width:0%;transition:width 0.3s;"></div></div>' +
                    '<div id="beatsUpStatus" style="font-size:0.75rem;color:var(--text-faint);margin-top:4px;">Processing...</div>' +
                '</div>' +

                // Copyright
                '<div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:10px;padding:12px;margin-bottom:16px;">' +
                    '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">' +
                        '<input type="checkbox" id="beatsUpCopyright" style="width:18px;height:18px;accent-color:var(--accent);margin-top:2px;flex-shrink:0;">' +
                        '<span style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;">I confirm that I own the rights to this music or have explicit permission from the copyright holder to upload it. I understand that copyrighted material uploaded without authorization will be removed and my account may be suspended.</span>' +
                    '</label>' +
                '</div>' +
                '<button onclick="beatsDoUpload()" id="beatsUpBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Upload Track</button>' +
            '</div>' +

            // Copyright notice + Info
            '<div style="margin-top:20px;max-width:520px;margin-left:auto;margin-right:auto;">' +
                '<button onclick="var d=document.getElementById(\'beatsCopyrightDetails\');d.style.display=d.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=d.style.display===\'none\'?\'▸\':\'▾\'" style="display:flex;align-items:center;gap:6px;padding:8px 14px;background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;color:#eab308;font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;width:100%;text-align:left;">' +
                    '⚠️ Copyright Notice <span style="margin-left:auto;">▸</span>' +
                '</button>' +
                '<div id="beatsCopyrightDetails" style="display:none;padding:10px 14px;margin-top:4px;background:rgba(234,179,8,0.05);border:1px solid rgba(234,179,8,0.15);border-radius:0 0 10px 10px;font-size:0.73rem;color:#eab308;line-height:1.5;">' +
                    'By uploading music, you confirm you own the rights or have permission to share it. Copyrighted material uploaded without authorization will be removed. Bitcoin Education Archive is not responsible for user-uploaded content.' +
                    '<div style="margin-top:6px;">' +
                        '<a href="/terms.html#bitcoin-beats" target="_blank" rel="noopener" style="color:#eab308;text-decoration:underline;">Full Terms</a> · ' +
                        '<a href="#" onclick="event.preventDefault();beatsShowDMCA()" style="color:#eab308;text-decoration:underline;">DMCA Policy</a>' +
                    '</div>' +
                '</div>' +
            '</div>' +
            '<div style="margin-top:16px;padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;text-align:center;">' +
                '<h3 style="color:var(--heading);font-weight:800;font-size:0.95rem;margin-bottom:12px;">Tips for Uploading</h3>' +
                '<div style="color:var(--text-faint);font-size:0.75rem;line-height:1.5;">' +
                    '<p><strong>✅ Supported formats:</strong> MP3, WAV, FLAC, OGG, AAC (max 50MB each)</p>' +
                    '<p><strong>✅ Batch upload:</strong> Select up to 20 files and group as Album or EP</p>' +
                    '<p><strong>✅ Rewards:</strong> +25 XP + 🎟️ 10 Orange Tickets per track</p>' +
                    '<p><strong>✅ Visibility:</strong> Your tracks will be publicly available to all users</p>' +
                    '<p><strong>⚠️ Copyright:</strong> Only upload music you own or have permission to share</p>' +
                '</div>' +
            '</div>' +
        '</div>' +

        // Animations
        '<style>' +
            '@keyframes beatsPulse { 0% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.3; transform: scale(0.95); } }' +
            '@keyframes fadeSlideIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }' +
        '</style>';

    // Clear upload form fields
    var title = document.getElementById('beatsUpTitle');
    var artist = document.getElementById('beatsUpArtist');
    var genre = document.getElementById('beatsUpGenre');
    var file = document.getElementById('beatsUpFile');
    var copyright = document.getElementById('beatsUpCopyright');
    if (title) title.value = '';
    if (artist) artist.value = '';
    if (genre) genre.value = 'bitcoin';
    if (file) file.value = '';
    if (copyright) copyright.checked = false;

    var btn = document.getElementById('beatsUpBtn');
    if (btn) {
        btn.disabled = false;
        btn.textContent = 'Upload Track';
    }
    var progress = document.getElementById('beatsUpProgress');
    if (progress) progress.style.display = 'none';
    var bar = document.getElementById('beatsUpBar');
    if (bar) bar.style.width = '0%';
    var status = document.getElementById('beatsUpStatus');
    if (status) status.textContent = 'Processing...';
};

// ---- Livestream / DJ Tab ----
window.beatsRenderLivestream = function() {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;

    var isPlaying = window._beatsAudio && !window._beatsAudio.paused;
    var hasTrack = window._beatsNowPlaying;

    // Check current DJ status
    if (typeof db !== 'undefined') {
        db.collection('global_chat_meta').doc('live_dj').get().then(function(doc) {
            var data = doc.exists ? doc.data() : null;
            var activeDJ = data && data.active;
            var myUid = (typeof auth !== 'undefined' && auth && auth.currentUser) ? auth.currentUser.uid : null;
            var amDJ = activeDJ && data.djUid === myUid;

            var html = '<div style="animation:fadeSlideIn 0.4s ease-out;">';

            // Header
            html += '<div style="text-align:center;margin-bottom:24px;">' +
                '<div style="font-size:3rem;margin-bottom:8px;">🎧</div>' +
                '<div style="color:var(--heading);font-size:1.3rem;font-weight:800;margin-bottom:4px;">DJ Mode</div>' +
                '<div style="color:var(--text-muted);font-size:0.85rem;">Play a song and broadcast it live to Global Chat</div>' +
            '</div>';

            // Current DJ status
            if (activeDJ) {
                html += '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.15),rgba(247,147,26,0.1));border:1px solid rgba(99,102,241,0.3);border-radius:16px;padding:16px;margin-bottom:20px;">' +
                    '<div style="display:flex;align-items:center;gap:12px;">' +
                        '<div style="font-size:2rem;">🎧</div>' +
                        '<div style="flex:1;">' +
                            '<div style="font-size:0.75rem;color:#6366f1;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW LIVE</div>' +
                            '<div style="color:var(--heading);font-weight:700;font-size:1rem;">@' + (typeof escapeHtml === 'function' ? escapeHtml(data.djName) : data.djName) + '</div>' +
                            '<div style="color:var(--text-muted);font-size:0.85rem;">♫ ' + (typeof escapeHtml === 'function' ? escapeHtml(data.trackTitle) : data.trackTitle) + ' — ' + (typeof escapeHtml === 'function' ? escapeHtml(data.trackArtist) : data.trackArtist) + '</div>' +
                            (data.songCount ? '<div style="color:var(--text-faint);font-size:0.7rem;margin-top:2px;">Song ' + data.songCount + (data.songCount >= 5 ? '/5' : '') + '</div>' : '') +
                        '</div>' +
                        (amDJ ? '<button onclick="djStopBroadcast();beatsRenderLivestream()" style="padding:10px 16px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;color:#ef4444;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">⏹ Stop DJ</button>' : '') +
                    '</div>' +
                '</div>';
            }

            // Go Live button
            if (!activeDJ || amDJ) {
                html += '<div style="text-align:center;margin-bottom:20px;">';
                if (isPlaying && hasTrack) {
                    html += '<button onclick="djBroadcast()" style="padding:16px 40px;background:linear-gradient(135deg,#6366f1,#4f46e5);border:none;border-radius:14px;color:#fff;font-size:1.1rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 20px rgba(99,102,241,0.4);touch-action:manipulation;">📡 Go Live — Broadcast to Chat</button>' +
                        '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:8px;">Now playing: ' + (typeof escapeHtml === 'function' ? escapeHtml(window._beatsNowPlaying.title) : window._beatsNowPlaying.title) + '</div>';
                } else {
                    html += '<div style="padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;">' +
                        '<div style="font-size:1.5rem;margin-bottom:8px;">▶</div>' +
                        '<div style="color:var(--text-muted);font-size:0.85rem;">Play a song from the Discover tab first, then come back here to go live!</div>' +
                    '</div>';
                }
                html += '</div>';
            } else {
                // Someone else is DJing — show join queue button
                html += '<div style="text-align:center;margin-bottom:20px;">' +
                    '<button onclick="djBroadcast()" style="padding:14px 32px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:14px;color:#6366f1;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">🎤 Join DJ Queue</button>' +
                    '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:8px;">You\'ll be notified when the booth opens up</div>' +
                '</div>';
            }

            // DJ Controls (only when actively DJing)
            if (amDJ && isPlaying) {
                html += '<div style="background:linear-gradient(135deg,rgba(99,102,241,0.08),rgba(247,147,26,0.05));border:1px solid rgba(99,102,241,0.2);border-radius:16px;padding:16px;margin-bottom:16px;">' +
                    '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;margin-bottom:12px;">🎛️ DJ Controls</div>' +
                    // LEAVE DJ BOOTH BUTTON - Prominent
                    '<div style="margin-bottom:16px;padding-bottom:16px;border-bottom:1px solid rgba(99,102,241,0.2);">' +
                        '<button onclick="djStopBroadcast();beatsRenderLivestream()" style="width:100%;padding:14px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);border-radius:12px;color:#ef4444;font-weight:800;cursor:pointer;font-family:inherit;font-size:1rem;box-shadow:0 4px 15px rgba(239,68,68,0.2);">🚪 Leave DJ Booth</button>' +
                        '<div style="text-align:center;color:var(--text-faint);font-size:0.7rem;margin-top:6px;">Stops broadcasting to Global Chat immediately</div>' +
                    '</div>' +

                    // Crossfader
                    '<div style="margin-bottom:14px;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                            '<span style="color:var(--text-faint);font-size:0.7rem;">Crossfade</span>' +
                            '<span id="djFadeLabel" style="color:var(--text-muted);font-size:0.65rem;">Off</span>' +
                        '</div>' +
                        '<input type="range" id="djCrossfade" min="0" max="10" value="0" style="width:100%;accent-color:#6366f1;" oninput="window._djCrossfadeSec=parseInt(this.value);document.getElementById(\'djFadeLabel\').textContent=this.value==0?\'Off\':this.value+\'s\'">' +
                        '<div style="display:flex;justify-content:space-between;font-size:0.6rem;color:var(--text-faint);"><span>Off</span><span>10s fade</span></div>' +
                    '</div>' +

                    // Volume
                    '<div style="margin-bottom:14px;">' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:6px;">Volume</div>' +
                        '<input type="range" id="djVolume" min="0" max="100" value="' + Math.round((window._beatsAudio ? window._beatsAudio.volume : 0.8) * 100) + '" style="width:100%;accent-color:var(--accent);" oninput="if(window._beatsAudio)window._beatsAudio.volume=this.value/100">' +
                    '</div>' +

                    // Sound Effects
                    '<div style="margin-bottom:14px;">' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:8px;">🔊 Sound Effects</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                            '<button onclick="djPlaySFX(\'horn\')" style="padding:8px 14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;color:#ef4444;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">📯 Horn</button>' +
                            '<button onclick="djPlaySFX(\'airhorn\')" style="padding:8px 14px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:10px;color:#eab308;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">📢 Airhorn</button>' +
                            '<button onclick="djPlaySFX(\'scratch\')" style="padding:8px 14px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.3);border-radius:10px;color:#6366f1;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">💿 Scratch</button>' +
                            '<button onclick="djPlaySFX(\'rewind\')" style="padding:8px 14px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.3);border-radius:10px;color:#22c55e;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">⏪ Rewind</button>' +
                            '<button onclick="djPlaySFX(\'boom\')" style="padding:8px 14px;background:rgba(168,85,247,0.1);border:1px solid rgba(168,85,247,0.3);border-radius:10px;color:#a855f7;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">💥 Boom</button>' +
                            '<button onclick="djPlaySFX(\'applause\')" style="padding:8px 14px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:10px;color:var(--accent);font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;">👏 Applause</button>' +
                        '</div>' +
                    '</div>' +

                    // Bitcoin Quotes
                    '<div>' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;margin-bottom:8px;">₿ Bitcoin Quotes (plays over stream)</div>' +
                        '<div style="display:flex;flex-wrap:wrap;gap:6px;">' +
                            '<button onclick="djPlayQuote(0)" style="padding:6px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">₿ "Buy Bitcoin"</button>' +
                            '<button onclick="djPlayQuote(1)" style="padding:6px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">💎 "HODL"</button>' +
                            '<button onclick="djPlayQuote(2)" style="padding:6px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">🔑 "Not your keys"</button>' +
                            '<button onclick="djPlayQuote(3)" style="padding:6px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">⚡ "Stack sats"</button>' +
                            '<button onclick="djPlayQuote(4)" style="padding:6px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">🚀 "To the moon"</button>' +
                            '<button onclick="djPlayQuote(5)" style="padding:6px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">🏦 "Fix the money"</button>' +
                        '</div>' +
                    '</div>' +

                    // Open Chat button for DJ
                    '<div style="margin-top:14px;text-align:center;">' +
                        '<button onclick="if(typeof renderChatHub===\'function\')renderChatHub(\'global\');else if(typeof toggleChatOverlay===\'function\')toggleChatOverlay()" style="padding:10px 20px;background:rgba(99,102,241,0.15);border:1px solid rgba(99,102,241,0.3);border-radius:10px;color:#6366f1;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">💬 Open Global Chat</button>' +
                    '</div>' +
                '</div>';
            }

            // How it works
            html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;margin-bottom:16px;">' +
                '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;margin-bottom:10px;">How DJ Mode Works</div>' +
                '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.8;">' +
                    '1. Play any song from Bitcoin Beats<br>' +
                    '2. Tap <strong style="color:#6366f1;">📡 Go Live</strong> to broadcast<br>' +
                    '3. Users in Global Chat see a "Now Playing" bar<br>' +
                    '4. They can tune in to hear your music live<br>' +
                    '5. Listeners can ⚡ tip you and the artist<br>' +
                    '6. 5-song max when others are in the queue' +
                '</div>' +
            '</div>';

            // Livestream embed section
            var tweetUrl = 'https://x.com/Bitcoin_Beats_/status/2009432279760711788?s=20';
            html += '<div style="margin-top:24px;border-top:1px solid var(--border);padding-top:20px;">' +
                '<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;">' +
                    '<span style="padding:4px 12px;background:rgba(239,68,68,0.2);color:#ff4444;border-radius:20px;font-size:0.65rem;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;border:1px solid rgba(239,68,68,0.3);">' +
                        '<span style="display:inline-block;width:6px;height:6px;background:#ff4444;border-radius:50%;margin-right:5px;animation:beatsBlink 1s infinite;"></span>LIVE SIGNAL</span>' +
                    '<span style="color:var(--text-muted);font-size:0.8rem;">Community Streams</span>' +
                '</div>' +
                '<div id="beatsStreamBox" style="background:#020617;border:3px solid transparent;background-image:linear-gradient(#020617, #020617), linear-gradient(135deg, var(--accent) 0%, #ea580c 100%);background-origin:border-box;background-clip:padding-box, border-box;border-radius:20px;overflow:hidden;box-shadow:0 12px 40px rgba(0,0,0,0.5);position:relative;margin-bottom:20px;">' +
                    '<div style="position:absolute;top:10px;right:14px;display:flex;gap:4px;z-index:10;">' +
                        '<div style="width:8px;height:8px;border-radius:50%;background:#ff5f57;"></div>' +
                        '<div style="width:8px;height:8px;border-radius:50%;background:#ffbd2e;"></div>' +
                        '<div style="width:8px;height:8px;border-radius:50%;background:#27c93f;"></div>' +
                    '</div>' +
                    '<div id="beatsLiveEmbed" style="min-height:350px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center, #0f172a 0%, #020617 100%);padding:16px 0;">' +
                        '<div style="color:var(--text-faint);text-align:center;">' +
                            '<div style="font-size:3rem;margin-bottom:12px;animation:beatsPulse 2s infinite;filter:drop-shadow(0 0 10px var(--accent));">🎸</div>' +
                            '<div style="font-weight:800;letter-spacing:2px;font-size:0.85rem;color:var(--text);">CONNECTING TO THE TIMECHAIN...</div>' +
                            '<div style="font-size:0.65rem;margin-top:5px;opacity:0.5;">Est. Sync in 21 blocks</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="background:rgba(15,23,42,0.9);backdrop-filter:blur(10px);padding:12px 20px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(247,147,26,0.2);">' +
                        '<div style="color:var(--heading);font-weight:800;font-size:0.8rem;display:flex;align-items:center;gap:6px;"><span style="font-size:1rem;">🎧</span> NOW PLAYING</div>' +
                        '<button onclick="window.open(\'https://x.com/Bitcoin_Beats_\',\'_blank\')" style="background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;padding:6px 14px;border-radius:8px;font-size:0.7rem;font-weight:800;cursor:pointer;font-family:inherit;">Follow for Lives</button>' +
                    '</div>' +
                '</div>' +
            '</div>';

            // Music platforms — very bottom
            html += '<div style="margin-top:20px;padding:16px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;text-align:center;">' +
                '<h3 style="color:var(--heading);font-weight:800;font-size:0.85rem;margin-bottom:10px;">Support our friends with great Bitcoin Lightning music platforms!</h3>' +
                '<div style="display:flex;flex-wrap:wrap;gap:10px;justify-content:center;">' +
                    '<a href="https://www.twitch.tv/noderunnersradio" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.25);border-radius:10px;color:var(--accent);font-weight:700;font-size:0.8rem;text-decoration:none;">📻 Noderunners Radio</a>' +
                    '<a href="https://wavlake.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.25);border-radius:10px;color:#8b5cf6;font-weight:700;font-size:0.8rem;text-decoration:none;">🎵 Wavlake</a>' +
                    '<a href="https://lnbeats.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:6px;padding:10px 16px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.25);border-radius:10px;color:#eab308;font-weight:700;font-size:0.8rem;text-decoration:none;">⚡ LN Beats</a>' +
                '</div>' +
            '</div>';

            html += '</div>';
            listEl.innerHTML = html;

            // Load the X/Twitter embed
            setTimeout(function() {
                var embedArea = document.getElementById('beatsLiveEmbed');
                if (!embedArea) return;
                embedArea.innerHTML = '<blockquote class="twitter-tweet" data-theme="dark" data-align="center" data-width="500"><a href="' + tweetUrl + '"></a></blockquote>';
                if (!window.twttr) {
                    var script = document.createElement('script');
                    script.src = 'https://platform.twitter.com/widgets.js';
                    script.charset = 'utf-8';
                    script.async = true;
                    document.head.appendChild(script);
                } else {
                    window.twttr.widgets.load(embedArea);
                }
                setTimeout(function() {
                    var e = document.getElementById('beatsLiveEmbed');
                    if (e && e.querySelector('.twitter-tweet') && !e.querySelector('iframe')) {
                        e.innerHTML = '<div style="padding:30px;text-align:center;"><div style="font-size:1.5rem;margin-bottom:8px;">📡</div><a href="' + tweetUrl + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;">Open on 𝕏 →</a></div>';
                    }
                }, 10000);
            }, 500);

        }).catch(function() {
            listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Unable to load DJ status</div>';
        });
    } else {
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">DJ Mode requires sign-in</div>';
    }
};

// ---- DJ Sound Effects & Quotes ----
window._djCrossfadeSec = 0;

// DJ SFX file map — real audio clips in /sfx/
var DJ_SFX_FILES = {
    horn: 'sfx/horn.mp3',
    airhorn: 'sfx/airhorn.mp3',
    scratch: 'sfx/scratch.mp3',
    rewind: 'sfx/rewind.wav',
    boom: 'sfx/boom.mp3',
    applause: 'sfx/applause.mp3'
};
var _djSfxCache = {}; // Cache Audio objects for instant replay

window.djPlaySFX = function(type) {
    try {
        var file = DJ_SFX_FILES[type];
        if (file) {
            // Use real audio file
            if (!_djSfxCache[type]) _djSfxCache[type] = new Audio(file);
            var audio = _djSfxCache[type];
            audio.currentTime = 0;
            // Respect app volume
            var vol = parseFloat(localStorage.getItem('btc_volume') || '1');
            audio.volume = Math.min(1, vol * 0.7);
            audio.play().catch(function() {});
        }

        // Broadcast SFX event to listeners
        if (typeof db !== 'undefined') {
            db.collection('global_chat_meta').doc('live_dj').update({
                sfx: type,
                sfxAt: firebase.firestore.FieldValue.serverTimestamp()
            }).catch(function() {});
        }
    } catch(e) { console.log('[DJ] SFX error:', e); }
};

var DJ_QUOTES = [
    'Buy Bitcoin.',
    'HODL! Diamond hands forever!',
    'Not your keys, not your coins!',
    'Stack sats every day!',
    'To the moon! Number go up!',
    'Fix the money, fix the world.'
];

window.djPlayQuote = function(idx) {
    var quote = DJ_QUOTES[idx] || DJ_QUOTES[0];
    // Use speech synthesis for quotes
    if ('speechSynthesis' in window) {
        var utter = new SpeechSynthesisUtterance(quote);
        utter.rate = 0.9;
        utter.pitch = 0.8;
        utter.volume = 0.7;
        // Try to find a deep voice
        var voices = speechSynthesis.getVoices();
        for (var i = 0; i < voices.length; i++) {
            if (/male|daniel|james|david|alex/i.test(voices[i].name) && voices[i].lang.startsWith('en')) {
                utter.voice = voices[i];
                break;
            }
        }
        speechSynthesis.speak(utter);
    }
    // Post quote to chat
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth.currentUser) {
        var username = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'DJ';
        db.collection('global_chat').add({
            uid: 'system',
            name: '🎧 DJ ' + username,
            text: '🎙️ "' + quote + '"',
            ts: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(function() {});
    }
    if (typeof showToast === 'function') showToast('🎙️ ' + quote);
};

// Handle crossfade when DJ switches tracks
var _origBeatsPlayTrack = window.beatsPlayTrack;
if (_origBeatsPlayTrack) {
    window.beatsPlayTrack = function(idx) {
        var fadeSec = window._djCrossfadeSec || 0;
        if (fadeSec > 0 && window._beatsAudio && !window._beatsAudio.paused) {
            // Fade out current track
            var oldAudio = window._beatsAudio;
            var fadeSteps = 20;
            var stepMs = (fadeSec * 1000) / fadeSteps;
            var origVol = oldAudio.volume;
            var step = 0;
            var fadeOut = setInterval(function() {
                step++;
                oldAudio.volume = Math.max(0, origVol * (1 - step / fadeSteps));
                if (step >= fadeSteps) {
                    clearInterval(fadeOut);
                    oldAudio.pause();
                }
            }, stepMs);
            // Small delay then start new track with fade in
            setTimeout(function() {
                _origBeatsPlayTrack(idx);
                if (window._beatsAudio) {
                    var newAudio = window._beatsAudio;
                    newAudio.volume = 0;
                    var step2 = 0;
                    var fadeIn = setInterval(function() {
                        step2++;
                        newAudio.volume = Math.min(origVol, origVol * (step2 / fadeSteps));
                        if (step2 >= fadeSteps) clearInterval(fadeIn);
                    }, stepMs);
                }
            }, fadeSec * 300); // Start new track 30% into the fade for overlap
        } else {
            _origBeatsPlayTrack(idx);
        }
        // Update comments panel if open to track the new song
        setTimeout(function() {
            var panel = document.getElementById('beatsCommentsPanel');
            if (panel && window._beatsQueue && window._beatsQueue[idx]) {
                var newTrack = window._beatsQueue[idx];
                window._beatsCommentTrackId = newTrack.id;
                // Update the header title using stable ID
                var headerEl = document.getElementById('beatsCommentsPanelTitle');
                if (headerEl) {
                    headerEl.innerHTML = '💬 Comments — <span style="color:var(--accent);font-weight:600;">' + escapeHtml((newTrack.title || 'Untitled').substring(0, 30)) + '</span>';
                }
                // Reload comments for the new track
                beatsLoadComments(newTrack.id);
            }
        }, 200);
    };
}

// (legacy embed code removed — now inline in DJ tab above)

// ---- Comments System ----
window.beatsShowComments = function(trackId) {
    if (!trackId) {
        // Use currently playing track
        var current = window._beatsQueue[window._beatsQueueIdx];
        if (!current) { showToast('No track selected'); return; }
        trackId = current.id;
    }

    // Store active comment trackId on window so post/load always use the current one
    window._beatsCommentTrackId = trackId;

    // Remove existing comments panel
    var existing = document.getElementById('beatsCommentsPanel');
    if (existing) { existing.remove(); return; } // Toggle off

    var track = null;
    for (var i = 0; i < window._beatsQueue.length; i++) {
        if (window._beatsQueue[i].id === trackId) { track = window._beatsQueue[i]; break; }
    }

    var panel = document.createElement('div');
    panel.id = 'beatsCommentsPanel';
    panel.style.cssText = 'position:fixed;bottom:112px;left:0;right:0;z-index:199;max-height:50vh;background:rgba(10,10,15,0.97);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);border-top:1px solid rgba(247,147,26,0.15);display:flex;flex-direction:column;animation:beatsSlideUp 0.25s ease-out;';

    panel.innerHTML =
        '<style>@keyframes beatsSlideUp{from{transform:translateY(100%);opacity:0;}to{transform:translateY(0);opacity:1;}}</style>' +
        '<div style="display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid rgba(255,255,255,0.06);flex-shrink:0;">' +
            '<div id="beatsCommentsPanelTitle" style="font-weight:700;font-size:0.85rem;color:var(--heading);">💬 Comments' + (track ? ' — ' + '<span style="color:var(--accent);font-weight:600;">' + escapeHtml((track.title || 'Untitled').substring(0, 30)) + '</span>' : '') + '</div>' +
            '<button onclick="document.getElementById(\'beatsCommentsPanel\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:4px;">✕</button>' +
        '</div>' +
        '<div id="beatsCommentsList" style="flex:1;overflow-y:auto;padding:12px 16px;min-height:80px;">' +
            '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Loading comments...</div>' +
        '</div>' +
        '<div style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;flex-shrink:0;">' +
            '<input type="text" id="beatsCommentInput" maxlength="280" placeholder="Leave a comment..." style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')beatsPostComment(window._beatsCommentTrackId)" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.1)\'">' +
            '<button onclick="beatsPostComment(window._beatsCommentTrackId)" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;white-space:nowrap;">Send</button>' +
        '</div>';

    document.body.appendChild(panel);

    // Adjust position based on screen — on desktop no bottom nav
    var mq = window.matchMedia('(min-width:901px)');
    if (mq.matches) panel.style.bottom = '56px'; // just above player

    // Load comments
    beatsLoadComments(trackId);
};

if (!window._beatsCommentGen) window._beatsCommentGen = 0;
window.beatsLoadComments = function(trackId) {
    var listEl = document.getElementById('beatsCommentsList');
    if (!listEl || typeof db === 'undefined') return;

    // Generation counter — stale async responses from a previous track are discarded
    var gen = ++window._beatsCommentGen;

    listEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Loading comments...</div>';

    // Determine if current user is admin
    var _cu = (typeof auth !== 'undefined' && auth) ? auth.currentUser : null;
    var _isAdmin = _cu && ['needcreations@gmail.com', 'info.603btc@gmail.com'].indexOf(_cu.email || '') !== -1;
    var _myUid = _cu ? _cu.uid : null;

    db.collection('beats_tracks').doc(trackId).collection('comments')
        .orderBy('createdAt', 'desc').limit(50).get()
        .then(function(snap) {
            // Discard if a newer load was triggered (track changed while query was in-flight)
            if (gen !== window._beatsCommentGen) return;
            var listEl2 = document.getElementById('beatsCommentsList');
            if (!listEl2) return;
            if (snap.empty) {
                listEl2.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">No comments yet. Be the first! 🎵</div>';
                return;
            }
            var html = '';
            snap.forEach(function(doc) {
                var c = doc.data();
                var commentId = doc.id;
                var timeStr = c.createdAt ? timeAgo(c.createdAt) : '';
                var canDelete = _isAdmin || (_myUid && c.authorId === _myUid);
                html += '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">' +
                    '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1e293b,#334155);display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;color:var(--accent);font-weight:700;">' + (c.authorName ? c.authorName.charAt(0).toUpperCase() : '?') + '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px;">' +
                            '<span style="color:var(--heading);font-weight:700;font-size:0.8rem;">' + escapeHtml(c.authorName || 'Anonymous') + '</span>' +
                            '<span style="color:var(--text-faint);font-size:0.65rem;">' + timeStr + '</span>' +
                            (canDelete ? '<button onclick="beatsDeleteComment(\'' + trackId + '\',\'' + commentId + '\')" style="background:none;border:none;color:var(--text-faint);font-size:0.65rem;cursor:pointer;padding:0 4px;opacity:0.6;transition:0.2s;" onmouseover="this.style.opacity=1;this.style.color=\'#ef4444\'" onmouseout="this.style.opacity=0.6;this.style.color=\'var(--text-faint)\'">🗑️</button>' : '') +
                        '</div>' +
                        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.4;word-break:break-word;">' + escapeHtml(c.text || '') + '</div>' +
                    '</div>' +
                '</div>';
            });
            listEl2.innerHTML = html;
        })
        .catch(function(e) {
            if (gen !== window._beatsCommentGen) return;
            console.error('Load comments error:', e);
            var listEl3 = document.getElementById('beatsCommentsList');
            if (listEl3) listEl3.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Error loading comments</div>';
        });
};

window.beatsPostComment = function(trackId) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        showToast('Sign in to comment');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    var input = document.getElementById('beatsCommentInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) { showToast('Type a comment first'); return; }
    if (text.length > 280) { showToast('Comment too long (280 char max)'); return; }

    // Moderation: profanity filter
    if (typeof containsProfanity === 'function' && containsProfanity(text)) {
        showToast('⚠️ Comment contains inappropriate language');
        return;
    }

    // Rate limit: max 10 comments per minute
    if (!window._beatsCommentTimes) window._beatsCommentTimes = [];
    var now = Date.now();
    window._beatsCommentTimes = window._beatsCommentTimes.filter(function(t) { return now - t < 60000; });
    if (window._beatsCommentTimes.length >= 10) {
        showToast('Slow down — max 10 comments per minute');
        return;
    }
    window._beatsCommentTimes.push(now);

    input.disabled = true;
    var authorName = currentUser ? currentUser.username : 'Anonymous';

    db.collection('beats_tracks').doc(trackId).collection('comments').add({
        text: text.substring(0, 280),
        authorId: auth.currentUser.uid,
        authorName: authorName,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        input.value = '';
        input.disabled = false;
        beatsLoadComments(trackId);
        // Award points for commenting
        if (typeof awardPoints === 'function') {
            if (!window._beatsCommentPointsCount) window._beatsCommentPointsCount = 0;
            // Cap at 5 comment rewards per session to prevent farming
            if (window._beatsCommentPointsCount < 5) {
                window._beatsCommentPointsCount++;
                awardPoints(10, 'Left a comment on Bitcoin Beats 💬');
                sessionStorage.setItem('_ch_beats_comment', '1');
            }
        }
        // Increment comment count on track + notify artist
        db.collection('beats_tracks').doc(trackId).update({
            commentCount: firebase.firestore.FieldValue.increment(1)
        }).catch(function() {});
        // Notify track author
        db.collection('beats_tracks').doc(trackId).get().then(function(doc) {
            if (doc.exists && doc.data().authorId && typeof sendNotification === 'function') {
                var t = doc.data();
                sendNotification(t.authorId, 'comment', authorName + ' commented on your track "' + (t.title || '').substring(0, 40) + '" 💬', 'beats_track', trackId);
            }
        }).catch(function() {});
    }).catch(function(e) {
        console.error('Post comment error:', e);
        showToast('Error posting comment');
        input.disabled = false;
    });
};

// ---- Delete Comment ----
window.beatsDeleteComment = function(trackId, commentId) {
    if (!auth || !auth.currentUser) { showToast('Sign in to delete comments'); return; }
    if (!confirm('Delete this comment?')) return;

    var _cu = auth.currentUser;
    var _isAdmin = ['needcreations@gmail.com', 'info.603btc@gmail.com'].indexOf(_cu.email || '') !== -1;

    // Check permission: own comment or admin
    db.collection('beats_tracks').doc(trackId).collection('comments').doc(commentId).get()
        .then(function(doc) {
            if (!doc.exists) { showToast('Comment not found'); return; }
            var c = doc.data();
            if (c.authorId !== _cu.uid && !_isAdmin) {
                showToast('You can only delete your own comments');
                return;
            }
            return db.collection('beats_tracks').doc(trackId).collection('comments').doc(commentId).delete();
        })
        .then(function() {
            showToast('🗑️ Comment deleted');
            // Decrement comment count
            db.collection('beats_tracks').doc(trackId).update({
                commentCount: firebase.firestore.FieldValue.increment(-1)
            }).catch(function() {});
            // Reload comments
            beatsLoadComments(trackId);
        })
        .catch(function(e) {
            console.error('Delete comment error:', e);
            showToast('Error deleting comment');
        });
};

// ---- Helpers ----
window.beatsFormatTime = function(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    var m = Math.floor(secs / 60);
    var s = Math.floor(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
};

// ================================================================
// FEATURE 1: ⚡ Tip Artist button on global mini-player
// ================================================================
window.beatsTipCurrentArtist = function() {
    var track = window._beatsQueue && window._beatsQueue[window._beatsQueueIdx];
    if (!track || !track.authorId) {
        if (typeof showToast === 'function') showToast('No artist info for this track');
        return;
    }
    if (typeof showTipOverlay === 'function') {
        showTipOverlay({
            recipientName: track.artist || track.authorName || 'Artist',
            recipientUid: track.authorId,
            context: 'Now playing: ' + (track.title || 'Unknown'),
            label: 'Tip Artist'
        });
    } else if (typeof beatsShowArtistPage === 'function') {
        beatsShowArtistPage(track.authorId);
    }
};

// Inject tip button into global player after it's created
(function() {
    var _origShow = window.beatsShowGlobalPlayer;
    window.beatsShowGlobalPlayer = function() {
        _origShow && _origShow();
        var gp = document.getElementById('beatsGlobalPlayer');
        if (gp && !gp.querySelector('#beatsTipBtn')) {
            var tipBtn = document.createElement('button');
            tipBtn.id = 'beatsTipBtn';
            tipBtn.innerHTML = '⚡';
            tipBtn.title = 'Tip Artist';
            tipBtn.style.cssText = 'background:none;border:none;color:#eab308;font-size:1rem;cursor:pointer;padding:4px;transition:0.2s;';
            tipBtn.onclick = function() { beatsTipCurrentArtist(); };
            var controlRow = gp.querySelector('div:last-child');
            if (controlRow) {
                var commentBtn = controlRow.querySelector('[title="Comments"]');
                if (commentBtn) controlRow.insertBefore(tipBtn, commentBtn);
                else controlRow.appendChild(tipBtn);
            }
        }
    };
})();

// ================================================================
// FEATURE 2: Smart Discovery Sorts + Genre Filters
// ================================================================
window._beatsDiscoverSort = 'newest';
window._beatsGenreFilter = '';

window.beatsSetSort = function(sort) {
    window._beatsDiscoverSort = sort;
    document.querySelectorAll('.beats-sort-btn').forEach(function(b) {
        b.style.borderColor = b.getAttribute('data-sort') === sort ? 'var(--accent)' : 'var(--border)';
        b.style.color = b.getAttribute('data-sort') === sort ? 'var(--accent)' : 'var(--text-muted)';
    });
    beatsLoadTracks('discover');
};

window.beatsSetGenre = function(genre) {
    window._beatsGenreFilter = genre;
    document.querySelectorAll('.beats-genre-btn').forEach(function(b) {
        var active = b.getAttribute('data-genre') === genre;
        b.style.borderColor = active ? 'var(--accent)' : 'var(--border)';
        b.style.background = active ? 'var(--accent)' : 'var(--card-bg)';
        b.style.color = active ? '#fff' : 'var(--text-muted)';
    });
    beatsLoadTracks('discover');
};

// Override beatsLoadTracks to support sorting and genre filtering
(function() {
    var _origLoad = window.beatsLoadTracks;
    window.beatsLoadTracks = function(tab) {
        if (tab !== 'discover') return _origLoad(tab);

        var listEl = document.getElementById('beatsTrackList');
        if (!listEl) return;

        // Inject sort/genre bar if not present
        if (!document.getElementById('beatsSortBar')) {
            var sortBar = document.createElement('div');
            sortBar.id = 'beatsSortBar';
            sortBar.style.cssText = 'margin-bottom:16px;';
            var sortBtnStyle = 'padding:6px 12px;border-radius:16px;border:1px solid var(--border);background:none;font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;transition:0.2s;';
            sortBar.innerHTML =
                '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:8px;">' +
                    '<button class="beats-sort-btn" data-sort="newest" onclick="beatsSetSort(\'newest\')" style="' + sortBtnStyle + 'border-color:var(--accent);color:var(--accent);">🆕 Newest</button>' +
                    '<button class="beats-sort-btn" data-sort="trending" onclick="beatsSetSort(\'trending\')" style="' + sortBtnStyle + 'color:var(--text-muted);">🔥 Trending</button>' +
                    '<button class="beats-sort-btn" data-sort="most-played" onclick="beatsSetSort(\'most-played\')" style="' + sortBtnStyle + 'color:var(--text-muted);">▶ Most Played</button>' +
                    '<button class="beats-sort-btn" data-sort="most-liked" onclick="beatsSetSort(\'most-liked\')" style="' + sortBtnStyle + 'color:var(--text-muted);">❤️ Most Liked</button>' +
                    '<button class="beats-sort-btn" data-sort="shuffle" onclick="beatsSetSort(\'shuffle\')" style="' + sortBtnStyle + 'color:var(--text-muted);">🎲 Shuffle</button>' +
                '</div>' +
                '<div id="beatsGenreChips" style="display:flex;gap:6px;flex-wrap:wrap;"></div>';
            listEl.parentNode.insertBefore(sortBar, listEl);
        }

        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Loading...</div>';
        if (typeof db === 'undefined') {
            listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Firebase not ready.</div>';
            return;
        }

        // Paginated fetch — load 40 tracks immediately, more on scroll
        var PAGE_SIZE = 40;
        window._beatsCursor = null;
        window._beatsExhausted = false;
        window._beatsCachedAllTracks = window._beatsCachedAllTracks || null;

        function beatsRenderTrackList(tracks, append) {
            var liked = safeJSON('btc_beats_liked', []);
            var html = '';
            tracks.forEach(function(t, rawIdx) {
                var idx = append ? (window._beatsQueue.length - tracks.length + rawIdx) : rawIdx;
                var isLiked = liked.indexOf(t.id) !== -1;
                var isPlaying = window._beatsQueueIdx === idx;
                var duration = t.duration ? beatsFormatTime(t.duration) : '--:--';
                html += '<div class="beats-track-row" onclick="beatsPlayTrack(' + idx + ')" style="padding:10px 12px;border-radius:12px;cursor:pointer;transition:0.15s;' + (isPlaying ? 'background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);' : 'background:var(--card-bg);border:1px solid var(--border);') + 'margin-bottom:8px;">' +
                    '<div style="display:flex;align-items:center;gap:10px;">' +
                        '<div style="width:28px;text-align:center;color:' + (isPlaying ? 'var(--accent)' : 'var(--text-faint)') + ';font-size:0.75rem;font-weight:700;flex-shrink:0;">' + (isPlaying ? '<span style="display:flex;gap:1px;justify-content:center;align-items:flex-end;height:14px;"><div style="width:2px;height:60%;background:var(--accent);animation:beatsEqualizer 0.8s infinite alternate;"></div><div style="width:2px;height:100%;background:var(--accent);animation:beatsEqualizer 1.1s infinite alternate;"></div><div style="width:2px;height:40%;background:var(--accent);animation:beatsEqualizer 0.9s infinite alternate;"></div></span>' : (idx + 1)) + '</div>' +
                        '<div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;overflow:hidden;">' + ((t.coverArt || t.coverUrl) ? '<img src="' + _safeCover(t.coverUrl || t.coverArt) + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;">' : (t.genre === 'podcast' ? '🎙️' : '🎵')) + '</div>' +
                        '<div onclick="event.stopPropagation();beatsShowTrackDetail(' + idx + ')" style="flex:1;min-width:0;cursor:pointer;">' +
                            '<div style="color:' + (isPlaying ? 'var(--accent)' : 'var(--heading)') + ';font-weight:700;font-size:0.88rem;overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.3;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                            '<div style="color:var(--text-faint);font-size:0.72rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (t.authorId ? '<span onclick="event.stopPropagation();if(typeof beatsShowArtistPage===\'function\')beatsShowArtistPage(\'' + t.authorId + '\')" style="cursor:pointer;color:var(--text-muted);transition:0.2s;" onmouseover="this.style.color=\'var(--accent)\'" onmouseout="this.style.color=\'var(--text-muted)\'">'+escapeHtml(t.artist || t.authorName || 'Unknown')+'</span>' : escapeHtml(t.artist||t.authorName||'Unknown')) + (t.genre ? ' · ' + t.genre : '') + '</div>' +
                        '</div>' +
                        '<div style="flex-shrink:0;text-align:right;">' +
                            '<div style="color:var(--text-faint);font-size:0.7rem;">' + duration + '</div>' +
                            '<div style="color:var(--text-faint);font-size:0.6rem;display:flex;align-items:center;gap:4px;justify-content:flex-end;">' +
                                '<span title="' + (t.plays || 0) + ' plays">▶ ' + _formatPlays(t.plays || 0) + '</span>' +
                                (t.likes ? '<span style="color:#ef4444;" title="' + t.likes + ' likes">❤ ' + t.likes + '</span>' : '') +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:4px;margin-top:6px;padding-left:38px;">' +
                        '<button class="beats-action-btn" onclick="event.stopPropagation();beatsShowComments(\'' + t.id + '\')" style="background:none;border:none;font-size:0.75rem;cursor:pointer;padding:3px 6px;color:var(--text-faint);display:flex;align-items:center;gap:2px;border-radius:6px;transition:0.15s;" title="Comments">💬' + (t.commentCount ? '<span style="font-size:0.6rem;">' + t.commentCount + '</span>' : '') + '</button>' +
                        '<button class="beats-action-btn" onclick="event.stopPropagation();beatsToggleLike(\'' + t.id + '\',this)" style="background:none;border:none;font-size:0.85rem;cursor:pointer;padding:3px 6px;color:' + (isLiked ? '#ef4444' : 'var(--text-faint)') + ';border-radius:6px;transition:0.15s;" title="Like">' + (isLiked ? '❤️' : '🤍') + '</button>' +
                        '<button class="beats-action-btn" onclick="event.stopPropagation();beatsAddToPlaylistPicker(\'' + t.id + '\')" style="background:none;border:none;font-size:0.85rem;cursor:pointer;padding:3px 6px;color:var(--accent);border-radius:6px;transition:0.15s;" title="Add to playlist">➕</button>' +
                        (t.authorId ? '<button class="beats-action-btn" onclick="event.stopPropagation();beatsTipCurrentArtistById(\'' + t.authorId + '\',\'' + escapeHtml(t.artist || t.authorName || 'Artist').replace(/[\x27]/g, '') + '\',\'' + escapeHtml(t.title || '').replace(/[\x27]/g, '') + '\')" style="background:none;border:none;font-size:0.75rem;cursor:pointer;padding:3px 6px;color:#eab308;border-radius:6px;" title="Tip Artist">⚡ Tip</button>' : '') +
                        '<button class="beats-action-btn" onclick="event.stopPropagation();beatsShareTrack(\'' + t.id + '\',\'' + escapeHtml(t.title || 'Track').replace(/[\x27]/g, '') + '\')" style="background:none;border:none;font-size:0.75rem;cursor:pointer;padding:3px 6px;color:var(--text-faint);border-radius:6px;margin-left:auto;" title="Share">🔗</button>' +
                        '<button class="beats-action-btn" onclick="event.stopPropagation();beatsTrackMenu(\'' + t.id + '\',' + idx + ')" style="background:none;border:none;font-size:0.8rem;cursor:pointer;padding:3px 6px;color:var(--text-faint);border-radius:6px;" title="More">⋮</button>' +
                    '</div>' +
                '</div>';
            });
            return html;
        }

        function beatsApplySort(tracks, sort) {
            var weekAgo = Date.now() - 7 * 86400000;
            if (sort === 'trending') {
                tracks.sort(function(a, b) {
                    var aR = a.createdAt && a.createdAt.toDate ? a.createdAt.toDate().getTime() > weekAgo : false;
                    var bR = b.createdAt && b.createdAt.toDate ? b.createdAt.toDate().getTime() > weekAgo : false;
                    return ((b.plays||0)*2+(b.likes||0)*5+(bR?100:0)) - ((a.plays||0)*2+(a.likes||0)*5+(aR?100:0));
                });
            } else if (sort === 'most-played') {
                tracks.sort(function(a, b) { return (b.plays||0) - (a.plays||0); });
            } else if (sort === 'most-liked') {
                tracks.sort(function(a, b) { return (b.likes||0) - (a.likes||0); });
            } else if (sort === 'shuffle') {
                for (var i = tracks.length - 1; i > 0; i--) { var j = Math.floor(Math.random()*(i+1)); var tmp=tracks[i]; tracks[i]=tracks[j]; tracks[j]=tmp; }
            }
            return tracks;
        }

        function beatsLoadPage(append) {
            if (window._beatsExhausted) return;
            var sentinel = document.getElementById('beatsLoadSentinel');
            if (sentinel) sentinel.style.display = 'block';

            var genre = window._beatsGenreFilter || null;
            var sort  = window._beatsDiscoverSort || 'newest';
            var needsClientSort = sort !== 'newest';

            if (needsClientSort) {
                // For non-chronological sorts, fetch all tracks of genre once, sort client-side, paginate locally
                if (!append) {
                    var csQ = db.collection('beats_tracks');
                    if (genre) csQ = csQ.where('genre', '==', genre);
                    csQ.orderBy('createdAt', 'desc').limit(500).get().then(function(snap) {
                        if (sentinel) sentinel.style.display = 'none';
                        var all = [];
                        snap.forEach(function(doc) { all.push({ id: doc.id, ...doc.data() }); });
                        all = beatsApplySort(all, sort);
                        window._beatsQueue = all;
                        window._beatsExhausted = true; // all loaded
                        var html = beatsRenderTrackList(all, false);
                        if (!html) html = '<div style="text-align:center;padding:20px;color:var(--text-faint);">No tracks' + (genre ? ' in this genre' : '') + '</div>';
                        listEl.innerHTML = html;
                    }).catch(function(e) { console.error('[Beats] sort load error:', e); if (sentinel) sentinel.style.display='none'; });
                }
                return;
            }

            // Newest: cursor pagination
            var q = db.collection('beats_tracks');
            if (genre) q = q.where('genre', '==', genre);
            q = q.orderBy('createdAt', 'desc');
            if (append && window._beatsCursor) q = q.startAfter(window._beatsCursor);
            q = q.limit(PAGE_SIZE);

            q.get().then(function(snap) {
                if (sentinel) sentinel.style.display = 'none';
                if (snap.empty || snap.docs.length < PAGE_SIZE) window._beatsExhausted = true;
                if (snap.empty) {
                    if (!append) listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">No tracks' + (genre ? ' in this genre' : '') + '</div>';
                    return;
                }
                window._beatsCursor = snap.docs[snap.docs.length - 1];
                var newTracks = [];
                snap.forEach(function(doc) { newTracks.push({ id: doc.id, ...doc.data() }); });
                if (!append) { window._beatsQueue = newTracks; } else { window._beatsQueue = (window._beatsQueue||[]).concat(newTracks); }
                var html = beatsRenderTrackList(newTracks, append);
                if (!append) {
                    listEl.innerHTML = html + '<div id="beatsLoadSentinel" style="text-align:center;padding:16px;color:var(--text-faint);font-size:0.75rem;display:none;">Loading more…</div>';
                    if (window._beatsScrollObs) window._beatsScrollObs.disconnect();
                    var s2 = document.getElementById('beatsLoadSentinel');
                    if (s2 && 'IntersectionObserver' in window) {
                        window._beatsScrollObs = new IntersectionObserver(function(entries) {
                            if (entries[0].isIntersecting && !window._beatsExhausted) beatsLoadPage(true);
                        }, { rootMargin: '300px' });
                        window._beatsScrollObs.observe(s2);
                    }
                } else {
                    var s2 = document.getElementById('beatsLoadSentinel');
                    if (s2) s2.insertAdjacentHTML('beforebegin', html);
                }
            }).catch(function(e) { console.error('[Beats] load page error:', e); if (sentinel) sentinel.style.display='none'; });
        }

        // Load genre chips from cached stats doc (fast — 1 doc read instead of 420)
        db.collection('beats_meta').doc('stats').get().then(function(statsDoc) {
            var genreData = statsDoc.exists ? (statsDoc.data().genreCounts || {}) : {};
            var GENRE_META = {
              bitcoin:    '⚡ Bitcoin / Freedom',
              indie:      '🎸 Indie',
              folk:       '🪕 Folk',
              rock:       '🤘 Rock',
              electronic: '🎛 Electronic',
              'hip-hop':  '🎤 Hip-Hop',
              classical:  '🎹 Classical',
              jazz:       '🎷 Jazz',
              podcast:    '🎙️ Podcast',
            };
            var GENRE_ORDER = ['bitcoin','indie','folk','rock','electronic','hip-hop','classical','jazz','podcast'];
            var genreChips = document.getElementById('beatsGenreChips');
            if (genreChips) {
                var chipStyle = 'padding:5px 12px;border-radius:16px;border:1px solid var(--border);background:var(--card-bg);font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;transition:0.2s;color:var(--text-muted);white-space:nowrap;';
                var chipHtml = '<button class="beats-genre-btn" data-genre="" onclick="beatsSetGenre(\'\')" style="' + chipStyle + (window._beatsGenreFilter === '' ? 'border-color:var(--accent);background:var(--accent);color:#fff;' : '') + '">🎵 All</button>';
                var orderedGenres = GENRE_ORDER.filter(function(g) { return genreData[g]; });
                Object.keys(genreData).filter(function(g) { return GENRE_ORDER.indexOf(g) === -1; }).sort().forEach(function(g) { orderedGenres.push(g); });
                orderedGenres.forEach(function(g) {
                    if (!genreData[g]) return;
                    var active = window._beatsGenreFilter === g;
                    var label = GENRE_META[g] || g;
                    chipHtml += '<button class="beats-genre-btn" data-genre="' + g + '" onclick="beatsSetGenre(\'' + g + '\')" style="' + chipStyle + (active ? 'border-color:var(--accent);background:var(--accent);color:#fff;' : '') + '">' + label + ' <span style="font-size:0.6rem;opacity:0.65;">(' + genreData[g] + ')</span></button>';
                });
                genreChips.innerHTML = chipHtml;
            }
        });

        // Reset cursor and load first page
        window._beatsCursor = null;
        window._beatsExhausted = false;
        beatsLoadPage(false);
    };
})();

// Helper for inline tip buttons
window.beatsTipCurrentArtistById = function(uid, name, trackTitle) {
    if (typeof showTipOverlay === 'function') {
        showTipOverlay({ recipientName: name, recipientUid: uid, context: 'Tip for: ' + trackTitle, label: 'Tip Artist' });
    } else if (typeof beatsShowArtistPage === 'function') {
        beatsShowArtistPage(uid);
    }
};

// ================================================================
// FEATURE 3: Artist Pages
// ================================================================
window.beatsShowArtistPage = function(uid) {
    if (!uid || typeof db === 'undefined') return;

    // Close any existing beats overlays first
    var existingOverlays = ['beatsEditOverlay', 'beatsAlbumGroupOverlay', 'beatsPlaylistPicker', 'beatsDetailOverlay', 'beatsMenuOverlay', 'beatsDMCAOverlay'];
    existingOverlays.forEach(function(id) {
        var el = document.getElementById(id);
        if (el) el.remove();
    });

    // Create overlay
    var overlay = document.createElement('div');
    overlay.id = 'beatsArtistOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100000;background:rgba(0,0,0,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);overflow-y:auto;-webkit-overflow-scrolling:touch;padding:20px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = '<div style="max-width:500px;margin:40px auto;text-align:center;"><div style="color:var(--text-muted);">Loading artist...</div></div>';
    document.body.appendChild(overlay);

    // Fetch user (may be Firebase user or V4V artist), artist doc, and their tracks in parallel
    Promise.all([
        db.collection('users').doc(uid).get(),
        db.collection('beats_artists').doc(uid).get(),
        db.collection('beats_tracks').where('authorId', '==', uid).orderBy('createdAt', 'desc').limit(50).get()
    ]).then(function(results) {
        var userDoc    = results[0];
        var artistDoc  = results[1];
        var trackSnap  = results[2];
        // Merge: user doc wins for registered users, artist doc fills in for V4V imports
        var u = userDoc.exists ? userDoc.data() : (artistDoc.exists ? artistDoc.data() : {});
        var tracks = [];
        trackSnap.forEach(function(doc) { tracks.push({ id: doc.id, ...doc.data() }); });

        var totalPlays = 0, totalLikes = 0;
        tracks.forEach(function(t) { totalPlays += (t.plays || 0); totalLikes += (t.likes || 0); });

        var lvl = typeof getLevel === 'function' ? getLevel(u.points || 0) : { emoji: '🎵', name: '' };
        var ap = u.artistProfile || {};
        var isV4V = artistDoc.exists && !userDoc.exists; // V4V import, no real user account
        var ad = artistDoc.exists ? artistDoc.data() : {};
        var artistName = ap.stageName || ad.name || u.username || (tracks[0] && (tracks[0].artist || tracks[0].authorName)) || 'Unknown Artist';
        var artistBio = ap.bio || u.bio || ad.bio || '';
        var artistGenres = ap.genres ? ap.genres.split(',').map(function(g) { return g.trim(); }).filter(Boolean) : [];
        var artistImage = ap.artistImage || ad.avatarUrl || ''; // custom artist profile image
        var isOwner = !isV4V && auth && auth.currentUser && auth.currentUser.uid === uid;

        // Collect music links
        var musicLinks = [];
        if (ap.website) musicLinks.push({ emoji: '🌐', label: 'Website', url: ap.website });
        if (ap.x) { var xHandle = ap.x.replace('@', ''); musicLinks.push({ emoji: '𝕏', label: '@' + xHandle, url: 'https://x.com/' + xHandle }); }
        else if (u.twitter) musicLinks.push({ emoji: '𝕏', label: '@' + u.twitter.replace('@', ''), url: 'https://x.com/' + u.twitter.replace('@', '') });
        if (ap.instagram) { var igHandle = ap.instagram.replace('@', ''); musicLinks.push({ emoji: '📸', label: '@' + igHandle, url: 'https://instagram.com/' + igHandle }); }

        // Profile mode toggle (only show if user has a real app account)
        var hasAppProfile = !isV4V && userDoc.exists;
        var toggleHtml = hasAppProfile ? (
            '<div style="display:flex;gap:0;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:18px;">' +
                '<button id="beatsProfileTab_artist" onclick="document.getElementById(\'beatsProfileTab_artist\').style.background=\'var(--accent)\';document.getElementById(\'beatsProfileTab_artist\').style.color=\'#fff\';document.getElementById(\'beatsProfileTab_app\').style.background=\'\';document.getElementById(\'beatsProfileTab_app\').style.color=\'var(--text-muted)\';document.getElementById(\'beatsArtistBody\').style.display=\'block\';document.getElementById(\'beatsAppBody\').style.display=\'none\'" style="flex:1;padding:9px;border:none;background:var(--accent);color:#fff;font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit;">🎤 Artist Profile</button>' +
                '<button id="beatsProfileTab_app" onclick="document.getElementById(\'beatsProfileTab_app\').style.background=\'var(--accent)\';document.getElementById(\'beatsProfileTab_app\').style.color=\'#fff\';document.getElementById(\'beatsProfileTab_artist\').style.background=\'\';document.getElementById(\'beatsProfileTab_artist\').style.color=\'var(--text-muted)\';document.getElementById(\'beatsArtistBody\').style.display=\'none\';document.getElementById(\'beatsAppBody\').style.display=\'block\'" style="flex:1;padding:9px;border:none;background:;color:var(--text-muted);font-weight:700;font-size:0.8rem;cursor:pointer;font-family:inherit;">👤 App Profile</button>' +
            '</div>'
        ) : '';

        var html = '<div style="max-width:500px;margin:40px auto;background:var(--bg-side);border:1px solid var(--border);border-radius:24px;padding:28px;animation:fadeSlideIn 0.3s ease-out;">' +
            '<button onclick="document.getElementById(\'beatsArtistOverlay\').remove()" style="float:right;background:none;border:1px solid var(--border);color:var(--text-muted);width:32px;height:32px;border-radius:8px;cursor:pointer;font-size:1rem;display:flex;align-items:center;justify-content:center;">✕</button>' +
            toggleHtml +
            '<div id="beatsArtistBody">'+
            '<div style="text-align:center;margin-bottom:20px;">' +
                // Artist image (custom or fallback to level emoji)
                (artistImage
                    ? '<div style="width:88px;height:88px;border-radius:50%;margin:0 auto 12px;overflow:hidden;border:3px solid var(--accent);box-shadow:0 0 24px rgba(247,147,26,0.35);' + (isOwner ? 'cursor:pointer;' : '') + '" ' + (isOwner ? 'onclick="beatsUploadArtistImage()" title="Change artist image"' : '') + '><img src="' + escapeHtml(sanitizeUrl(artistImage)) + '" style="width:100%;height:100%;object-fit:cover;"></div>'
                    : '<div style="width:88px;height:88px;border-radius:50%;margin:0 auto 12px;background:linear-gradient(135deg,var(--accent),#1e293b);display:flex;align-items:center;justify-content:center;font-size:2.2rem;border:3px solid var(--border);' + (isOwner ? 'cursor:pointer;' : '') + '" ' + (isOwner ? 'onclick="beatsUploadArtistImage()" title="Upload artist image"' : '') + '>🎤' + (isOwner ? '<div style="font-size:0.55rem;color:var(--text-faint);position:absolute;margin-top:56px;">📷</div>' : '') + '</div>') +
                '<div style="color:var(--heading);font-weight:800;font-size:1.3rem;">' + escapeHtml(artistName) + '</div>' +
                (isV4V
                    ? '<div style="display:inline-block;margin-top:6px;padding:2px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:12px;font-size:0.68rem;color:var(--accent);font-weight:700;">⚡ V4V Artist · Unclaimed</div>'
                    : '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:4px;">' + lvl.name + ' · ' + (u.points || 0).toLocaleString() + ' XP</div>') +
                // Genre tags
                (artistGenres.length > 0 ? '<div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center;margin-top:8px;">' +
                    artistGenres.map(function(g) { return '<span style="padding:2px 10px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);border-radius:12px;font-size:0.7rem;color:var(--accent);font-weight:600;">' + escapeHtml(g) + '</span>'; }).join('') +
                '</div>' : '') +
            '</div>' +
            // Stats
            '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">' +
                '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);font-size:1rem;">' + tracks.length + '</div><div style="color:var(--text-faint);font-size:0.65rem;">Tracks</div></div>' +
                '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);font-size:1rem;">' + _formatPlays(totalPlays) + '</div><div style="color:var(--text-faint);font-size:0.65rem;">Plays</div></div>' +
                '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);font-size:1rem;">' + totalLikes + '</div><div style="color:var(--text-faint);font-size:0.65rem;">Likes</div></div>' +
                '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);font-size:1rem;">' + (u.streak || 0) + '</div><div style="color:var(--text-faint);font-size:0.65rem;">Streak</div></div>' +
            '</div>' +
            // Artist Bio
            (artistBio ? '<div style="padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:16px;"><div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">About the Artist</div><div style="color:var(--text);font-size:0.85rem;line-height:1.5;">' + escapeHtml(artistBio) + '</div></div>' : '') +
            // Music links
            (musicLinks.length > 0 ? '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px;justify-content:center;">' +
                musicLinks.map(function(l) { return '<a href="' + escapeHtml(sanitizeUrl(l.url)) + '" target="_blank" rel="noopener" style="padding:6px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.75rem;text-decoration:none;font-weight:600;transition:0.2s;display:flex;align-items:center;gap:4px;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + l.emoji + ' ' + escapeHtml(l.label) + '</a>'; }).join('') +
            '</div>' : '') +
            // Action buttons
            '<div style="display:flex;gap:8px;margin-bottom:20px;">' +
                ((u.lightningAddress || u.lightning) ? '<button onclick="document.getElementById(\'beatsArtistOverlay\').remove();showTipOverlay({recipientName:\'' + escapeHtml(artistName).replace(/[\\'"]/g, "") + '\',recipientUid:\'' + uid + '\',label:\'Tip ' + escapeHtml(artistName).replace(/[\\'"]/g, "") + '\',context:\'Artist page\'})" style="flex:1;padding:12px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);color:#eab308;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;">⚡ Tip Artist</button>' : '') +
                (isV4V && (ad.wavlakeUrl || ad.sourceUrl) ? '<a href="' + escapeHtml(sanitizeUrl(ad.wavlakeUrl || ad.sourceUrl || '')) + '" target="_blank" rel="noopener" style="flex:1;padding:12px;background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;text-decoration:none;display:flex;align-items:center;justify-content:center;gap:6px;">🌐 Artist Page</a>' : '') +
            '</div>' +
            // Discography — grouped by album, then singles
            '';

        // Group tracks: albums/EPs vs singles
        var albums = {}; // albumId -> { title, type, year, cover, tracks[] }
        var singles = [];
        tracks.forEach(function(t) {
            if (t.albumId) {
                if (!albums[t.albumId]) {
                    albums[t.albumId] = {
                        title: t.albumTitle || 'Untitled Album',
                        type: t.albumType || 'album',
                        year: t.albumYear || '',
                        cover: t.coverUrl || t.coverArt || '',
                        tracks: [],
                        createdAt: t.createdAt
                    };
                }
                albums[t.albumId].tracks.push(t);
            } else {
                singles.push(t);
            }
        });

        // Sort album tracks by trackNumber ascending (Track 1 first)
        Object.keys(albums).forEach(function(aid) {
            albums[aid].tracks.sort(function(a, b) { return (a.trackNumber || 0) - (b.trackNumber || 0); });
        });

        // Sort albums by creation date (oldest first)
        var albumList = Object.keys(albums).map(function(aid) { return { id: aid, ...albums[aid] }; });
        albumList.sort(function(a, b) {
            var aT = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
            var bT = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
            return aT - bT;
        });

        // Sort singles by creation date ascending (oldest first)
        singles.sort(function(a, b) {
            var aT = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
            var bT = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
            return aT - bT;
        });

        // Discography header (after grouping so we know singles count)
        html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">' +
            '<div style="font-weight:800;color:var(--heading);font-size:0.9rem;">🎵 Discography (' + tracks.length + ' tracks)</div>' +
            (isOwner && singles.length > 1 ? '<button onclick="beatsCreateAlbumFromSingles()" style="padding:6px 12px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:8px;color:var(--accent);font-size:0.72rem;font-weight:700;cursor:pointer;font-family:inherit;">💿 Create Album</button>' : '') +
        '</div>';

        // Render albums
        if (albumList.length > 0) {
            html += '<div style="margin-bottom:16px;">';
            albumList.forEach(function(alb) {
                var albumUid = 'album_' + alb.id.replace(/[^a-zA-Z0-9]/g, '');
                var typeLabel = (alb.type === 'ep' ? 'EP' : 'Album');
                html += '<div style="margin-bottom:10px;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--card-bg);">' +
                    '<div onclick="var el=document.getElementById(\'' + albumUid + '\');el.style.display=el.style.display===\'none\'?\'block\':\'none\';this.querySelector(\'span\').textContent=el.style.display===\'none\'?\'▸\':\'▾\'" style="display:flex;align-items:center;gap:12px;padding:12px;cursor:pointer;transition:0.15s;" onmouseover="this.style.background=\'rgba(247,147,26,0.05)\'" onmouseout="this.style.background=\'none\'">' +
                        '<div style="width:52px;height:52px;border-radius:8px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;overflow:hidden;">' + (alb.cover ? '<img src="' + _safeCover(alb.cover) + '" style="width:100%;height:100%;object-fit:cover;">' : '💿') + '</div>' +
                        '<div style="flex:1;min-width:0;">' +
                            '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(alb.title) + '</div>' +
                            '<div style="color:var(--text-faint);font-size:0.7rem;">' + typeLabel + ' · ' + alb.tracks.length + ' tracks' + (alb.year ? ' · ' + alb.year : '') + '</div>' +
                        '</div>' +
                        '<span style="color:var(--text-faint);font-size:1.1rem;flex-shrink:0;">▸</span>' +
                    '</div>' +
                    '<div id="' + albumUid + '" style="display:none;padding:0 12px 12px;">';
                alb.tracks.forEach(function(t) {
                    // Find the track's index in the original tracks array for playback
                    var origIdx = tracks.indexOf(t);
                    html += '<div style="display:flex;align-items:center;gap:10px;padding:7px 8px;border-radius:8px;cursor:pointer;transition:0.15s;margin-bottom:3px;" onmouseover="this.style.background=\'rgba(247,147,26,0.05)\'" onmouseout="this.style.background=\'none\'">' +
                        '<div onclick="document.getElementById(\'beatsArtistOverlay\').remove();beatsArtistPlayTrack(\'' + uid + '\',' + origIdx + ')" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">' +
                            '<div style="width:22px;color:var(--text-faint);font-size:0.7rem;text-align:center;flex-shrink:0;">' + (t.trackNumber || '') + '</div>' +
                            '<div style="flex:1;min-width:0;">' +
                                '<div style="color:var(--heading);font-weight:600;font-size:0.8rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                                '<div style="color:var(--text-faint);font-size:0.6rem;">▶ ' + _formatPlays(t.plays || 0) + (t.likes ? ' · ❤ ' + t.likes : '') + (t.releaseDate ? ' · ' + t.releaseDate : '') + '</div>' +
                            '</div>' +
                            '<div style="flex-shrink:0;color:var(--text-faint);font-size:0.68rem;">' + (t.duration ? beatsFormatTime(t.duration) : '') + '</div>' +
                        '</div>' +
                        (isOwner ? '<button onclick="event.stopPropagation();beatsEditTrack(\'' + t.id + '\',\'' + uid + '\')" style="flex-shrink:0;width:26px;height:26px;border-radius:6px;background:none;border:1px solid var(--border);color:var(--text-faint);font-size:0.7rem;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Edit">✏️</button>' : '') +
                    '</div>';
                });
                html += '</div></div>';
            });
            html += '</div>';
        }

        // Render singles
        if (singles.length > 0) {
            if (albumList.length > 0) html += '<div style="font-weight:700;color:var(--heading);font-size:0.8rem;margin-bottom:8px;">Singles</div>';
            singles.forEach(function(t) {
                var origIdx = tracks.indexOf(t);
                html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;cursor:pointer;transition:0.15s;margin-bottom:4px;background:var(--card-bg);border:1px solid var(--border);" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                    '<div onclick="document.getElementById(\'beatsArtistOverlay\').remove();beatsArtistPlayTrack(\'' + uid + '\',' + origIdx + ')" style="display:flex;align-items:center;gap:10px;flex:1;min-width:0;">' +
                        '<div style="width:36px;height:36px;border-radius:6px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;overflow:hidden;">' + ((t.coverArt || t.coverUrl) ? '<img src="' + _safeCover(t.coverUrl || t.coverArt) + '" style="width:100%;height:100%;object-fit:cover;">' : '🎵') + '</div>' +
                        '<div style="flex:1;min-width:0;">' +
                            '<div style="color:var(--heading);font-weight:600;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                            '<div style="color:var(--text-faint);font-size:0.65rem;">▶ ' + _formatPlays(t.plays || 0) + (t.likes ? ' · ❤ ' + t.likes : '') + (t.genre ? ' · ' + t.genre : '') + (t.releaseDate ? ' · ' + t.releaseDate : '') + '</div>' +
                        '</div>' +
                        '<div style="flex-shrink:0;color:var(--text-faint);font-size:0.7rem;">' + (t.duration ? beatsFormatTime(t.duration) : '') + '</div>' +
                    '</div>' +
                    (isOwner ? '<button onclick="event.stopPropagation();beatsEditTrack(\'' + t.id + '\',\'' + uid + '\')" style="flex-shrink:0;width:30px;height:30px;border-radius:8px;background:none;border:1px solid var(--border);color:var(--text-faint);font-size:0.75rem;cursor:pointer;display:flex;align-items:center;justify-content:center;" title="Edit track">✏️</button>' : '') +
                '</div>';
            });
        }

        if (tracks.length === 0) html += '<div style="text-align:center;padding:20px;color:var(--text-faint);">No tracks uploaded yet</div>';
        html += '</div>'; // close discography container
        html += '</div>'; // close beatsArtistBody
        // App profile body — only injected when the user has a real app account
        if (hasAppProfile) {
            html += '<div id="beatsAppBody" style="display:none;padding:8px 0;"><div style="text-align:center;padding:20px;color:var(--text-faint);font-size:0.85rem;">Loading app profile...</div></div>';
        }
        overlay.innerHTML = html;
        // After rendering, load the app profile content into beatsAppBody if applicable
        if (hasAppProfile) {
            var appBody = document.getElementById('beatsAppBody');
            if (appBody && typeof showUserProfile === 'function') {
                // Render the app profile inline — hook into the existing profile card builder
                // We replicate a compact version: avatar, name, XP, badges, bio, tip/message buttons
                db.collection('users').doc(uid).get().then(function(udoc) {
                    if (!udoc.exists) { appBody.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">No app profile found</div>'; return; }
                    var ud = udoc.data();
                    var lvlApp = typeof getLevel === 'function' ? getLevel(ud.points || 0) : { emoji: '🎵', name: 'Learner' };
                    var avatarHtml = ud.photoURL
                        ? '<img src="' + escapeHtml(sanitizeUrl(ud.photoURL)) + '" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid var(--accent);">'
                        : '<div style="width:72px;height:72px;border-radius:50%;background:linear-gradient(135deg,var(--accent),#1e293b);display:flex;align-items:center;justify-content:center;font-size:1.8rem;">' + lvlApp.emoji + '</div>';
                    appBody.innerHTML =
                        '<div style="text-align:center;margin-bottom:16px;">' +
                            '<div style="margin:0 auto 10px;width:72px;height:72px;">' + avatarHtml + '</div>' +
                            '<div style="font-weight:800;font-size:1.1rem;color:var(--heading);">' + escapeHtml(ud.username || ud.displayName || 'User') + '</div>' +
                            '<div style="color:var(--text-muted);font-size:0.8rem;">' + lvlApp.name + ' · ' + (ud.points || 0).toLocaleString() + ' XP</div>' +
                            (ud.bio ? '<div style="color:var(--text-muted);font-size:0.8rem;margin-top:8px;line-height:1.4;">' + escapeHtml(ud.bio) + '</div>' : '') +
                        '</div>' +
                        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px;">' +
                            '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);">' + (ud.badges ? Object.keys(ud.badges).length : 0) + '</div><div style="color:var(--text-faint);font-size:0.65rem;">Badges</div></div>' +
                            '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);">' + (ud.channelsVisited || 0) + '</div><div style="color:var(--text-faint);font-size:0.65rem;">Channels</div></div>' +
                            '<div style="text-align:center;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;"><div style="font-weight:900;color:var(--heading);">' + (ud.points || 0).toLocaleString() + '</div><div style="color:var(--text-faint);font-size:0.65rem;">XP</div></div>' +
                        '</div>' +
                        '<button onclick="document.getElementById(\'beatsArtistOverlay\').remove();if(typeof showUserProfile===\'function\')showUserProfile(\'' + uid + '\')" style="width:100%;padding:12px;background:var(--card-bg);border:1px solid var(--border);color:var(--text);border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.85rem;margin-bottom:8px;">👤 Open Full App Profile</button>';
                }).catch(function() { appBody.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Could not load app profile</div>'; });
            }
        }
    }).catch(function(e) {
        console.error('Artist page error:', e);
        overlay.innerHTML = '<div style="max-width:500px;margin:40px auto;text-align:center;color:var(--text-faint);">Error loading artist</div>';
    });
};

// Play track from artist page (loads their catalog in same order as artist page display)
window.beatsArtistPlayTrack = function(uid, idx) {
    if (typeof db === 'undefined') return;
    db.collection('beats_tracks').where('authorId', '==', uid).orderBy('createdAt', 'desc').limit(50).get().then(function(snap) {
        var tracks = [];
        snap.forEach(function(doc) { tracks.push({ id: doc.id, ...doc.data() }); });
        window._beatsQueue = tracks;
        if (tracks[idx]) beatsPlayTrack(idx);
    });
};

// ================================================================
// FEATURE 4: Direct Track & Playlist Links (#beats/trackId, #beats/playlist/uid/id)
// Deep link params are stashed on window._beatsDeepLink by app.js router and consumed
// by renderBitcoinBeats(). The hashchange listener below handles in-app navigation
// (e.g. clicking a beats link while already on another page).
// ================================================================
(function() {
    window.addEventListener('hashchange', function() {
        var hash = window.location.hash;
        if (!hash || hash.indexOf('#beats/') !== 0) return;
        var path = hash.replace('#beats/', '');
        if (!path) return;

        // Stash deep link params, then navigate to beats (renderBitcoinBeats will pick them up)
        var plMatch = path.match(/^playlist\/([^/]+)\/([^/]+)$/);
        if (plMatch) {
            window._beatsDeepLink = { type: 'playlist', ownerUid: plMatch[1], playlistId: plMatch[2] };
        } else if (path.indexOf('/') === -1) {
            window._beatsDeepLink = { type: 'track', trackId: path };
        }
        if (window._beatsDeepLink && typeof go === 'function') go('bitcoin-beats');
    });
})();

// Share a track link
window.beatsShareTrack = function(trackId, title) {
    var url = 'https://bitcoineducation.quest/#beats/' + trackId;
    var text = '🎸 Listen to "' + title + '" on Bitcoin Beats!\n' + url;
    if (navigator.share) {
        navigator.share({ title: title + ' — Bitcoin Beats', text: text, url: url }).catch(function() {});
    } else {
        navigator.clipboard.writeText(url).then(function() {
            if (typeof showToast === 'function') showToast('🔗 Track link copied!');
        }).catch(function() {});
    }
};

// ================================================================
// FEATURE 5: Artist Earnings Dashboard (shown in Library tab)
// ================================================================

window.beatsInjectArtistDashboard = function() {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl || document.getElementById('beatsArtistDash')) return;
    if (!auth || !auth.currentUser) return;

    // Wait for tracks to load then compute stats
    var checkInterval = setInterval(function() {
        if (!listEl.querySelector('[style*="Loading"]')) {
            clearInterval(checkInterval);
            var tracks = (window._beatsQueue || []).filter(function(t) {
                return t.authorId === auth.currentUser.uid;
            });
            if (tracks.length === 0) return;

            var totalPlays = 0, totalLikes = 0, totalComments = 0;
            var topTrack = tracks[0];
            tracks.forEach(function(t) {
                totalPlays += (t.plays || 0);
                totalLikes += (t.likes || 0);
                totalComments += (t.commentCount || 0);
                if ((t.plays || 0) > (topTrack.plays || 0)) topTrack = t;
            });

            var dash = document.createElement('div');
            dash.id = 'beatsArtistDash';
            dash.style.cssText = 'background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:16px;padding:20px;margin-bottom:20px;';
            dash.innerHTML =
                '<div style="font-weight:800;color:var(--heading);font-size:1rem;margin-bottom:12px;">📊 Your Artist Dashboard</div>' +
                '<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:16px;">' +
                    '<div style="text-align:center;padding:10px;background:var(--card-bg);border-radius:10px;"><div style="font-weight:900;color:var(--accent);font-size:1.1rem;">' + tracks.length + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Tracks</div></div>' +
                    '<div style="text-align:center;padding:10px;background:var(--card-bg);border-radius:10px;"><div style="font-weight:900;color:var(--accent);font-size:1.1rem;">' + _formatPlays(totalPlays) + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Total Plays</div></div>' +
                    '<div style="text-align:center;padding:10px;background:var(--card-bg);border-radius:10px;"><div style="font-weight:900;color:#ef4444;font-size:1.1rem;">' + totalLikes + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Total Likes</div></div>' +
                    '<div style="text-align:center;padding:10px;background:var(--card-bg);border-radius:10px;"><div style="font-weight:900;color:var(--heading);font-size:1.1rem;">' + totalComments + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Comments</div></div>' +
                '</div>' +
                (topTrack ? '<div style="padding:10px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;display:flex;align-items:center;gap:10px;margin-bottom:12px;">' +
                    '<div style="font-size:1.2rem;">🏆</div>' +
                    '<div style="flex:1;min-width:0;"><div style="color:var(--text-faint);font-size:0.65rem;">Top Track</div><div style="color:var(--heading);font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(topTrack.title || 'Untitled') + '</div></div>' +
                    '<div style="text-align:right;"><div style="color:var(--accent);font-weight:700;font-size:0.8rem;">▶ ' + _formatPlays(topTrack.plays || 0) + '</div><div style="color:var(--text-faint);font-size:0.65rem;">' + (topTrack.likes || 0) + ' likes</div></div>' +
                '</div>' : '') +
                '<div style="font-size:0.75rem;color:var(--text-muted);text-align:center;">💡 Set up a Lightning Address in Settings to receive tips from listeners!</div>';
            listEl.parentNode.insertBefore(dash, listEl);
        }
    }, 300);
    // Safety timeout
    setTimeout(function() { clearInterval(checkInterval); }, 5000);
};

// ================================================================
// LIBRARY TAB — Liked, Playlists, My Uploads, Recently Played
// ================================================================
window._beatsLibrarySection = 'liked';

window.beatsRenderLibrary = function() {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;

    var section = window._beatsLibrarySection || 'liked';
    var hasUploads = auth && auth.currentUser;
    var btnStyle = 'padding:8px 14px;border-radius:20px;border:1px solid var(--border);background:var(--card-bg);font-size:0.78rem;font-weight:600;cursor:pointer;font-family:inherit;transition:0.2s;color:var(--text-muted);';

    var html = '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px;">';
    [
        { id: 'liked', label: '❤️ Liked', show: true },
        { id: 'playlists', label: '📋 Playlists', show: true },
        { id: 'uploads', label: '🎸 My Uploads', show: !!hasUploads },
        { id: 'recent', label: '🕐 Recent', show: true }
    ].forEach(function(s) {
        if (!s.show) return;
        var active = section === s.id;
        html += '<button onclick="window._beatsLibrarySection=\'' + s.id + '\';beatsRenderLibrary()" style="' + btnStyle + (active ? 'border-color:var(--accent);background:var(--accent);color:#fff;' : '') + '">' + s.label + '</button>';
    });
    html += '</div>';

    if (section === 'liked') {
        html += '<div id="beatsLibContent"></div>';
        listEl.innerHTML = html;
        beatsLoadLikedTracks();
    } else if (section === 'playlists') {
        html += '<div id="beatsLibContent"></div>';
        listEl.innerHTML = html;
        beatsLoadPlaylists();
    } else if (section === 'uploads') {
        html += '<div id="beatsLibContent"></div>';
        listEl.innerHTML = html;
        beatsLoadMyUploads();
    } else if (section === 'recent') {
        html += '<div id="beatsLibContent"></div>';
        listEl.innerHTML = html;
        beatsLoadRecentlyPlayed();
    }
};

// --- Liked Songs ---
// Reads from BOTH Firestore (likedBy array on each track doc) and localStorage,
// merging so likes follow the user across devices even if localStorage was cleared.
window.beatsLoadLikedTracks = function() {
    var el = document.getElementById('beatsLibContent');
    if (!el) return;
    var localLiked = safeJSON('btc_beats_liked', []);
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Loading liked tracks...</div>';

    var uid = (auth && auth.currentUser) ? auth.currentUser.uid : null;
    var serverPromise = uid
        ? db.collection('beats_tracks').where('likedBy', 'array-contains', uid).limit(100).get()
        : Promise.resolve({ forEach: function() {}, empty: true });

    serverPromise.then(function(serverSnap) {
        var trackMap = {};
        var serverIds = [];
        serverSnap.forEach(function(doc) {
            trackMap[doc.id] = Object.assign({ id: doc.id }, doc.data());
            serverIds.push(doc.id);
        });

        // Sync server → local so the heart icon matches across the UI
        if (serverIds.length > 0) {
            try {
                var merged = localLiked.slice();
                serverIds.forEach(function(id) { if (merged.indexOf(id) === -1) merged.push(id); });
                if (merged.length !== localLiked.length) {
                    localStorage.setItem('btc_beats_liked', JSON.stringify(merged));
                    localLiked = merged;
                }
            } catch(e) {}
        }

        // Any localStorage-only likes (legacy / different-device) need to be fetched too
        var missing = localLiked.filter(function(id) { return !trackMap[id]; }).slice(0, 30 - serverIds.length);
        if (missing.length === 0) {
            _renderLikedTracks(el, trackMap, serverIds, localLiked);
            return;
        }
        db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', missing).get().then(function(snap) {
            snap.forEach(function(doc) {
                if (!trackMap[doc.id]) trackMap[doc.id] = Object.assign({ id: doc.id }, doc.data());
            });
            _renderLikedTracks(el, trackMap, serverIds, localLiked);
        }).catch(function() {
            _renderLikedTracks(el, trackMap, serverIds, localLiked);
        });
    }).catch(function(err) {
        console.warn('[beats] liked-tracks server query failed:', err && err.message);
        // Fall back to localStorage-only path
        if (localLiked.length === 0) {
            el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">❤️</div><div style="color:var(--text-muted);font-weight:600;">No liked tracks yet</div><div style="color:var(--text-faint);font-size:0.8rem;margin-top:4px;">Hit the ❤️ on tracks you love!</div></div>';
            return;
        }
        db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', localLiked.slice(0, 30)).get().then(function(snap) {
            var tracks = [];
            snap.forEach(function(doc) { tracks.push(Object.assign({ id: doc.id }, doc.data())); });
            window._beatsQueue = tracks;
            if (tracks.length === 0) {
                el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">❤️</div><div style="color:var(--text-muted);font-weight:600;">No liked tracks yet</div><div style="color:var(--text-faint);font-size:0.8rem;margin-top:4px;">Hit the ❤️ on tracks you love!</div></div>';
            } else {
                beatsRenderTrackList(el, tracks, true);
            }
        }).catch(function() { el.innerHTML = '<div style="padding:20px;color:var(--text-faint);">Error loading liked tracks</div>'; });
    });
};

function _renderLikedTracks(el, trackMap, serverIds, localLiked) {
    // Build ordered list: server-liked first (most authoritative), then local-only
    var ordered = [];
    var seen = {};
    serverIds.forEach(function(id) { if (trackMap[id] && !seen[id]) { ordered.push(trackMap[id]); seen[id] = true; } });
    localLiked.forEach(function(id) { if (trackMap[id] && !seen[id]) { ordered.push(trackMap[id]); seen[id] = true; } });

    if (ordered.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">❤️</div><div style="color:var(--text-muted);font-weight:600;">No liked tracks yet</div><div style="color:var(--text-faint);font-size:0.8rem;margin-top:4px;">Hit the ❤️ on tracks you love!</div></div>';
        return;
    }
    window._beatsQueue = ordered;
    beatsRenderTrackList(el, ordered, true);
}

// --- My Uploads ---
window.beatsLoadMyUploads = function() {
    var el = document.getElementById('beatsLibContent');
    if (!el || !auth || !auth.currentUser) { if (el) el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);">Sign in to see uploads</div>'; return; }
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Loading...</div>';
    db.collection('beats_tracks').where('authorId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').limit(50).get().then(function(snap) {
        var tracks = [];
        snap.forEach(function(doc) { tracks.push({ id: doc.id, ...doc.data() }); });
        window._beatsQueue = tracks;
        // Artist dashboard
        if (tracks.length > 0) {
            var totalPlays = 0, totalLikes = 0, topTrack = tracks[0];
            tracks.forEach(function(t) { totalPlays += (t.plays || 0); totalLikes += (t.likes || 0); if ((t.plays || 0) > (topTrack.plays || 0)) topTrack = t; });
            var dashHtml = '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:2px solid rgba(247,147,26,0.2);border-radius:14px;padding:16px;margin-bottom:16px;">' +
                '<div style="font-weight:800;color:var(--heading);font-size:0.9rem;margin-bottom:10px;">📊 Your Stats</div>' +
                '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:10px;">' +
                    '<div style="text-align:center;padding:8px;background:var(--card-bg);border-radius:8px;"><div style="font-weight:900;color:var(--accent);font-size:1rem;">' + tracks.length + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Tracks</div></div>' +
                    '<div style="text-align:center;padding:8px;background:var(--card-bg);border-radius:8px;"><div style="font-weight:900;color:var(--accent);font-size:1rem;">' + _formatPlays(totalPlays) + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Plays</div></div>' +
                    '<div style="text-align:center;padding:8px;background:var(--card-bg);border-radius:8px;"><div style="font-weight:900;color:#ef4444;font-size:1rem;">' + totalLikes + '</div><div style="color:var(--text-faint);font-size:0.6rem;">Likes</div></div>' +
                '</div>' +
                '<div style="font-size:0.75rem;color:var(--text-muted);">🏆 Top: <strong>' + escapeHtml(topTrack.title || '') + '</strong> — ' + _formatPlays(topTrack.plays || 0) + ' plays</div>' +
            '</div>';
            el.innerHTML = dashHtml;
            var trackDiv = document.createElement('div');
            el.appendChild(trackDiv);
            beatsRenderTrackList(trackDiv, tracks, true);
        } else {
            el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">🎸</div><div style="color:var(--text-muted);font-weight:600;">No uploads yet</div><div style="color:var(--text-faint);font-size:0.8rem;margin-top:4px;">Go to the Upload tab to share your music!</div></div>';
        }
    }).catch(function() { el.innerHTML = '<div style="padding:20px;color:var(--text-faint);">Error loading uploads</div>'; });
};

// --- Recently Played ---
window.beatsLoadRecentlyPlayed = function() {
    var el = document.getElementById('beatsLibContent');
    if (!el) return;
    var recent = safeJSON('btc_beats_recent', []);
    if (recent.length === 0) {
        el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">🕐</div><div style="color:var(--text-muted);font-weight:600;">No recently played tracks</div><div style="color:var(--text-faint);font-size:0.8rem;margin-top:4px;">Start listening to build your history!</div></div>';
        return;
    }
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Loading...</div>';
    var ids = recent.slice(0, 30);
    db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', ids).get().then(function(snap) {
        var trackMap = {};
        snap.forEach(function(doc) { trackMap[doc.id] = { id: doc.id, ...doc.data() }; });
        // Preserve order (most recent first)
        var tracks = [];
        ids.forEach(function(id) { if (trackMap[id]) tracks.push(trackMap[id]); });
        window._beatsQueue = tracks;
        beatsRenderTrackList(el, tracks, false);
    }).catch(function() { el.innerHTML = '<div style="padding:20px;color:var(--text-faint);">Error loading recent tracks</div>'; });
};

// Track recently played (called when a track starts playing)
(function() {
    var _origPlay = window.beatsPlayTrack;
    window.beatsPlayTrack = function(idx) {
        _origPlay(idx);
        var track = window._beatsQueue && window._beatsQueue[idx];
        if (track && track.id) {
            try {
                var recent = safeJSON('btc_beats_recent', []);
                recent = recent.filter(function(id) { return id !== track.id; });
                recent.unshift(track.id);
                if (recent.length > 50) recent = recent.slice(0, 50);
                localStorage.setItem('btc_beats_recent', JSON.stringify(recent));
            } catch(e) {}
        }
    };
})();

// --- Shared track list renderer ---
window.beatsRenderTrackList = function(el, tracks, showTip) {
    if (tracks.length === 0) { el.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text-faint);">No tracks</div>'; return; }
    var liked = safeJSON('btc_beats_liked', []);
    var html = '';
    tracks.forEach(function(t, idx) {
        var isLiked = liked.indexOf(t.id) !== -1;
        var isPlaying = window._beatsQueueIdx === idx;
        html += '<div class="beats-track-row" onclick="beatsPlayTrack(' + idx + ')" style="padding:8px 10px;border-radius:10px;cursor:pointer;transition:0.15s;' + (isPlaying ? 'background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);' : 'background:var(--card-bg);border:1px solid var(--border);') + 'margin-bottom:6px;display:flex;align-items:center;gap:10px;">' +
            '<div style="width:36px;height:36px;border-radius:6px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:0.9rem;flex-shrink:0;overflow:hidden;">' + ((t.coverArt || t.coverUrl) ? '<img src="' + _safeCover(t.coverUrl || t.coverArt) + '" style="width:100%;height:100%;object-fit:cover;">' : '🎵') + '</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="color:' + (isPlaying ? 'var(--accent)' : 'var(--heading)') + ';font-weight:700;font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                '<div style="color:var(--text-faint);font-size:0.68rem;">' + escapeHtml(t.artist || t.authorName || 'Unknown') + (t.genre ? ' · ' + t.genre : '') + '</div>' +
            '</div>' +
            '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;">' +
                '<span style="color:var(--text-faint);font-size:0.65rem;">▶ ' + _formatPlays(t.plays || 0) + '</span>' +
                '<button class="beats-action-btn" onclick="event.stopPropagation();beatsToggleLike(\'' + t.id + '\',this)" style="background:none;border:none;font-size:0.8rem;cursor:pointer;padding:2px;color:' + (isLiked ? '#ef4444' : 'var(--text-faint)') + ';">' + (isLiked ? '❤️' : '🤍') + '</button>' +
                '<button class="beats-action-btn" onclick="event.stopPropagation();beatsAddToPlaylistPicker(\'' + t.id + '\')" style="background:none;border:none;font-size:0.7rem;cursor:pointer;padding:2px;color:var(--text-faint);" title="Add to playlist">➕</button>' +
            '</div>' +
        '</div>';
    });
    el.innerHTML = html;
};

// ================================================================
// PLAYLIST SYSTEM
// ================================================================
window.beatsLoadPlaylists = function() {
    var el = document.getElementById('beatsLibContent');
    if (!el) return;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        el.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">📋</div><div style="color:var(--text-muted);font-weight:600;margin-bottom:12px;">Sign in to create playlists</div><button onclick="if(typeof showUsernamePrompt===\'function\')showUsernamePrompt()" style="padding:12px 28px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">🔐 Sign In</button></div>';
        return;
    }
    el.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Loading playlists...</div>';

    db.collection('users').doc(auth.currentUser.uid).collection('playlists').orderBy('createdAt', 'desc').limit(20).get().then(function(snap) {
        var playlists = [];
        snap.forEach(function(doc) { playlists.push({ id: doc.id, ...doc.data() }); });

        var html = '<button onclick="beatsCreatePlaylist()" style="width:100%;padding:14px;background:var(--accent-bg);border:2px dashed var(--accent);border-radius:12px;color:var(--accent);font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:16px;transition:0.2s;" onmouseover="this.style.background=\'var(--accent)\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'var(--accent-bg)\';this.style.color=\'var(--accent)\'">➕ Create New Playlist</button>';

        if (playlists.length === 0) {
            html += '<div style="text-align:center;padding:20px;color:var(--text-faint);">No playlists yet. Create one!</div>';
        } else {
            playlists.forEach(function(p) {
                var count = p.trackIds ? p.trackIds.length : 0;
                html += '<div onclick="beatsOpenPlaylist(\'' + p.id + '\')" style="display:flex;align-items:center;gap:12px;padding:12px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;cursor:pointer;margin-bottom:8px;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                    '<div style="width:48px;height:48px;border-radius:10px;background:linear-gradient(135deg,#1e293b,#2d1f4e);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;">📋</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(p.name || 'Untitled Playlist') + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.72rem;">' + count + ' track' + (count !== 1 ? 's' : '') + '</div>' +
                    '</div>' +
                    '<button onclick="event.stopPropagation();beatsDeletePlaylist(\'' + p.id + '\',\'' + escapeHtml(p.name || '').replace(/[\\'"]/g, "") + '\')" style="background:none;border:none;color:var(--text-faint);font-size:0.8rem;cursor:pointer;padding:4px;" title="Delete">🗑️</button>' +
                '</div>';
            });
        }
        el.innerHTML = html;
    }).catch(function(e) { console.error('Playlist load error:', e); el.innerHTML = '<div style="padding:20px;color:var(--text-faint);">Error loading playlists</div>'; });
};

window.beatsCreatePlaylist = function() {
    var name = prompt('Playlist name:');
    if (!name || !name.trim()) return;
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).collection('playlists').add({
        name: name.trim().substring(0, 60),
        trackIds: [],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        if (typeof showToast === 'function') showToast('📋 Playlist "' + name.trim() + '" created!');
        beatsLoadPlaylists();
    }).catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); });
};

window.beatsDeletePlaylist = function(id, name) {
    if (!confirm('Delete playlist "' + name + '"?')) return;
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).collection('playlists').doc(id).delete().then(function() {
        if (typeof showToast === 'function') showToast('🗑️ Playlist deleted');
        beatsLoadPlaylists();
    });
};

window.beatsOpenPlaylist = function(playlistId) {
    if (!auth || !auth.currentUser) return;
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Loading playlist...</div>';

    db.collection('users').doc(auth.currentUser.uid).collection('playlists').doc(playlistId).get().then(function(doc) {
        if (!doc.exists) { beatsLoadPlaylists(); return; }
        var pl = doc.data();
        var ids = pl.trackIds || [];

        var header = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
            '<button onclick="beatsRenderLibrary()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;padding:4px;">←</button>' +
            '<div style="flex:1;"><div style="color:var(--heading);font-weight:800;font-size:1.1rem;">' + escapeHtml(pl.name || 'Playlist') + '</div><div style="color:var(--text-faint);font-size:0.75rem;">' + ids.length + ' tracks</div></div>' +
            '<button onclick="beatsPlayPlaylist(\'' + playlistId + '\')" style="padding:8px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">▶ Play All</button>' +
            '<button onclick="beatsShufflePlaylist(\'' + playlistId + '\')" style="padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;font-size:0.82rem;cursor:pointer;font-family:inherit;color:var(--text-muted);">🎲</button>' +
            '<button onclick="beatsSharePlaylistLink(\'' + playlistId + '\',\'' + escapeHtml(pl.name || 'Playlist').replace(/[\\'"]/g, "") + '\')" style="background:none;border:none;color:var(--text-faint);font-size:0.9rem;cursor:pointer;" title="Share">🔗</button>' +
        '</div>';

        if (ids.length === 0) {
            listEl.innerHTML = header + '<div style="text-align:center;padding:30px;color:var(--text-faint);">Empty playlist. Use ➕ on any track to add it here!</div>';
            return;
        }

        // Fetch tracks
        var batches = [];
        for (var i = 0; i < ids.length; i += 30) batches.push(ids.slice(i, i + 30));
        Promise.all(batches.map(function(b) {
            return db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', b).get();
        })).then(function(results) {
            var trackMap = {};
            results.forEach(function(snap) { snap.forEach(function(doc) { trackMap[doc.id] = { id: doc.id, ...doc.data() }; }); });
            var tracks = [];
            ids.forEach(function(id) { if (trackMap[id]) tracks.push(trackMap[id]); });
            window._beatsQueue = tracks;
            var trackEl = document.createElement('div');
            listEl.innerHTML = header;
            listEl.appendChild(trackEl);
            beatsRenderTrackList(trackEl, tracks, true);
        });
    });
};

// Open a shared playlist from a deep link (#beats/playlist/{ownerUid}/{playlistId})
// Reads from the OWNER's playlists subcollection, not the current user's
window.beatsOpenSharedPlaylist = function(ownerUid, playlistId) {
    // Navigate to Library > Playlists tab first
    if (typeof beatsTab === 'function') beatsTab('library');
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) {
        // Beats UI not ready yet — retry
        setTimeout(function() { beatsOpenSharedPlaylist(ownerUid, playlistId); }, 500);
        return;
    }
    listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-faint);">Loading shared playlist...</div>';

    db.collection('users').doc(ownerUid).collection('playlists').doc(playlistId).get().then(function(doc) {
        if (!doc.exists) {
            listEl.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">🔍</div><div style="color:var(--text-muted);font-weight:600;">Playlist not found</div><div style="color:var(--text-faint);font-size:0.8rem;margin-top:8px;">It may have been deleted or made private.</div></div>';
            return;
        }
        var pl = doc.data();
        var ids = pl.trackIds || [];

        var header = '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
            '<button onclick="if(typeof beatsRenderLibrary===\'function\')beatsRenderLibrary();else if(typeof renderBitcoinBeats===\'function\')renderBitcoinBeats();" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;padding:4px;">←</button>' +
            '<div style="flex:1;"><div style="color:var(--heading);font-weight:800;font-size:1.1rem;">🔗 ' + escapeHtml(pl.name || 'Playlist') + '</div><div style="color:var(--text-faint);font-size:0.75rem;">' + ids.length + ' tracks · Shared playlist</div></div>' +
        '</div>';

        if (ids.length === 0) {
            listEl.innerHTML = header + '<div style="text-align:center;padding:30px;color:var(--text-faint);">This playlist is empty.</div>';
            return;
        }

        // Fetch tracks
        var batches = [];
        for (var i = 0; i < ids.length; i += 30) batches.push(ids.slice(i, i + 30));
        Promise.all(batches.map(function(b) {
            return db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', b).get();
        })).then(function(results) {
            var trackMap = {};
            results.forEach(function(snap) { snap.forEach(function(d) { trackMap[d.id] = { id: d.id, ...d.data() }; }); });
            var tracks = [];
            ids.forEach(function(id) { if (trackMap[id]) tracks.push(trackMap[id]); });
            window._beatsQueue = tracks;
            var trackEl = document.createElement('div');
            listEl.innerHTML = header;
            listEl.appendChild(trackEl);
            beatsRenderTrackList(trackEl, tracks, true);
        });
    }).catch(function(e) {
        console.error('Shared playlist load error:', e);
        if (listEl) listEl.innerHTML = '<div style="text-align:center;padding:30px;"><div style="font-size:2rem;margin-bottom:8px;">⚠️</div><div style="color:var(--text-muted);font-weight:600;">Could not load playlist</div></div>';
    });
};

window.beatsPlayPlaylist = function(playlistId) {
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).collection('playlists').doc(playlistId).get().then(function(doc) {
        if (!doc.exists) return;
        var ids = doc.data().trackIds || [];
        if (ids.length === 0) return;
        var batches = [];
        for (var i = 0; i < ids.length; i += 30) batches.push(ids.slice(i, i + 30));
        Promise.all(batches.map(function(b) {
            return db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', b).get();
        })).then(function(results) {
            var trackMap = {};
            results.forEach(function(snap) { snap.forEach(function(doc) { trackMap[doc.id] = { id: doc.id, ...doc.data() }; }); });
            var tracks = [];
            ids.forEach(function(id) { if (trackMap[id]) tracks.push(trackMap[id]); });
            window._beatsQueue = tracks;
            beatsPlayTrack(0);
        });
    });
};

window.beatsShufflePlaylist = function(playlistId) {
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).collection('playlists').doc(playlistId).get().then(function(doc) {
        if (!doc.exists) return;
        var ids = doc.data().trackIds || [];
        if (ids.length === 0) return;
        // Shuffle
        for (var i = ids.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = ids[i]; ids[i] = ids[j]; ids[j] = t; }
        var batches = [];
        for (var k = 0; k < ids.length; k += 30) batches.push(ids.slice(k, k + 30));
        Promise.all(batches.map(function(b) {
            return db.collection('beats_tracks').where(firebase.firestore.FieldPath.documentId(), 'in', b).get();
        })).then(function(results) {
            var trackMap = {};
            results.forEach(function(snap) { snap.forEach(function(doc) { trackMap[doc.id] = { id: doc.id, ...doc.data() }; }); });
            var tracks = [];
            ids.forEach(function(id) { if (trackMap[id]) tracks.push(trackMap[id]); });
            window._beatsQueue = tracks;
            beatsPlayTrack(0);
        });
    });
};

window.beatsSharePlaylistLink = function(playlistId, name) {
    if (!auth || !auth.currentUser) return;
    var url = 'https://bitcoineducation.quest/#beats/playlist/' + auth.currentUser.uid + '/' + playlistId;
    if (navigator.share) {
        navigator.share({ title: name + ' — Bitcoin Beats Playlist', url: url }).catch(function() {});
    } else {
        navigator.clipboard.writeText(url).then(function() { if (typeof showToast === 'function') showToast('🔗 Playlist link copied!'); });
    }
};

// Add to playlist picker
window.beatsAddToPlaylistPicker = function(trackId) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to create playlists');
        return;
    }
    var existing = document.getElementById('beatsPlaylistPicker');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'beatsPlaylistPicker';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:10001;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = '<div style="background:var(--bg-side);border:2px solid var(--border);border-radius:20px 20px 0 0;padding:20px;max-width:400px;width:100%;"><div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div><div style="color:var(--heading);font-weight:700;font-size:0.95rem;margin-bottom:12px;">Add to Playlist</div><div id="playlistPickerList" style="max-height:300px;overflow-y:auto;"><div style="text-align:center;color:var(--text-faint);padding:12px;">Loading...</div></div><button onclick="beatsQuickCreateAndAdd(\'' + trackId + '\')" style="width:100%;margin-top:12px;padding:12px;background:var(--accent-bg);border:2px dashed var(--accent);border-radius:10px;color:var(--accent);font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;">➕ New Playlist</button><button onclick="document.getElementById(\'beatsPlaylistPicker\').remove()" style="width:100%;margin-top:8px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;font-family:inherit;">Cancel</button></div>';
    document.body.appendChild(overlay);

    db.collection('users').doc(auth.currentUser.uid).collection('playlists').orderBy('createdAt', 'desc').limit(20).get().then(function(snap) {
        var list = document.getElementById('playlistPickerList');
        if (!list) return;
        if (snap.empty) { list.innerHTML = '<div style="text-align:center;color:var(--text-faint);padding:12px;">No playlists yet</div>'; return; }
        var html = '';
        snap.forEach(function(doc) {
            var p = doc.data();
            var count = p.trackIds ? p.trackIds.length : 0;
            var already = p.trackIds && p.trackIds.indexOf(trackId) !== -1;
            html += '<button onclick="beatsAddTrackToPlaylist(\'' + doc.id + '\',\'' + trackId + '\')" style="display:flex;align-items:center;gap:10px;width:100%;padding:10px;background:' + (already ? 'rgba(34,197,94,0.1)' : 'var(--card-bg)') + ';border:1px solid ' + (already ? '#22c55e' : 'var(--border)') + ';border-radius:10px;cursor:pointer;font-family:inherit;margin-bottom:6px;text-align:left;transition:0.2s;">' +
                '<span style="font-size:1.2rem;">📋</span>' +
                '<div style="flex:1;min-width:0;"><div style="color:var(--heading);font-weight:600;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(p.name || 'Untitled') + '</div><div style="color:var(--text-faint);font-size:0.68rem;">' + count + ' tracks' + (already ? ' · ✅ Added' : '') + '</div></div>' +
            '</button>';
        });
        list.innerHTML = html;
    });
};

window.beatsAddTrackToPlaylist = function(playlistId, trackId) {
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).collection('playlists').doc(playlistId).update({
        trackIds: firebase.firestore.FieldValue.arrayUnion(trackId)
    }).then(function() {
        if (typeof showToast === 'function') showToast('✅ Added to playlist!');
        var picker = document.getElementById('beatsPlaylistPicker');
        if (picker) picker.remove();
        // Notify the artist
        db.collection('beats_tracks').doc(trackId).get().then(function(doc) {
            if (doc.exists && doc.data().authorId && typeof sendNotification === 'function') {
                var t = doc.data();
                var _un = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Someone';
                sendNotification(t.authorId, 'like', _un + ' added your track "' + (t.title || '').substring(0, 40) + '" to a playlist 📋', 'beats_track', trackId);
            }
        }).catch(function() {});
    }).catch(function(e) { if (typeof showToast === 'function') showToast('Error: ' + e.message); });
};

window.beatsQuickCreateAndAdd = function(trackId) {
    var name = prompt('New playlist name:');
    if (!name || !name.trim()) return;
    if (!auth || !auth.currentUser) return;
    db.collection('users').doc(auth.currentUser.uid).collection('playlists').add({
        name: name.trim().substring(0, 60),
        trackIds: [trackId],
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(function() {
        if (typeof showToast === 'function') showToast('📋 Created "' + name.trim() + '" with track!');
        var picker = document.getElementById('beatsPlaylistPicker');
        if (picker) picker.remove();
    });
};

// ================================================================
// FEATURE 6: Nacho DJ tips go to track artist (not generic donate)
// ================================================================
// This patches the DJ bar "Donate" button to tip the current artist
(function() {
    var _origShowDJBar = window.showDJBar;
    if (!_origShowDJBar) return;
    window.showDJBar = function(d) {
        _origShowDJBar(d);
        // After DJ bar renders, patch the donate button
        setTimeout(function() {
            var bar = document.getElementById('djNowPlaying');
            if (!bar) return;
            var donateBtn = bar.querySelector('[onclick*="showDonateModal"]');
            if (donateBtn && d && d.trackAuthorId) {
                donateBtn.onclick = function(e) {
                    e.stopPropagation();
                    if (typeof showTipOverlay === 'function') {
                        showTipOverlay({
                            recipientName: d.trackArtist || d.djName || 'Artist',
                            recipientUid: d.trackAuthorId,
                            context: 'DJ tip for: ' + (d.trackTitle || 'Unknown'),
                            label: 'Tip Artist'
                        });
                    } else {
                        showDonateModal();
                    }
                };
                donateBtn.textContent = '⚡ Tip Artist';
                donateBtn.title = 'Tip the artist of this track';
            }
        }, 100);
    };
})();

// ================================================================
// FEATURE 7: Track sharing (already implemented above as beatsShareTrack)
// Also add share to track detail modal
// ================================================================
(function() {
    var _origDetail = window.beatsShowTrackDetail;
    if (!_origDetail) return;
    window.beatsShowTrackDetail = function(idx) {
        _origDetail(idx);
        // Inject share button into detail modal
        setTimeout(function() {
            var overlay = document.getElementById('beatsDetailOverlay');
            if (!overlay) return;
            var track = window._beatsQueue && window._beatsQueue[idx];
            if (!track) return;
            var btnRow = overlay.querySelector('div[style*="display:flex;gap:8px"]');
            if (btnRow && !btnRow.querySelector('.beats-share-btn')) {
                var shareBtn = document.createElement('button');
                shareBtn.className = 'beats-share-btn';
                shareBtn.innerHTML = '🔗';
                shareBtn.style.cssText = 'padding:14px 18px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;color:var(--text-faint);';
                shareBtn.title = 'Share track link';
                shareBtn.onclick = function(e) {
                    e.stopPropagation();
                    beatsShareTrack(track.id, track.title || 'Track');
                };
                btnRow.appendChild(shareBtn);
            }
        }, 100);
    };
})();

// ================================================================
// SEARCH FEATURE
// ================================================================
window.beatsPerformSearch = function() {
    var input = document.getElementById('beatsSearchInput');
    if (!input) return;
    var query = input.value.trim().toLowerCase();
    if (!query) { if(typeof showToast==='function') showToast('Type something to search'); return; }
    // Track beats search use for Search Sleuth badge
    try { var _ss = typeof safeJSON === 'function' ? safeJSON('btc_searches_used', []) : JSON.parse(localStorage.getItem('btc_searches_used') || '[]'); if (_ss.indexOf('beats') === -1) { _ss.push('beats'); localStorage.setItem('btc_searches_used', JSON.stringify(_ss)); } } catch(e) {}

    window._beatsCurrentTab = 'search';
    ['discover','library','artists','upload','livestream','pumpit'].forEach(function(t) {
        var btn = document.getElementById('beatsTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) { btn.style.borderBottomColor='transparent'; btn.style.color='var(--text-muted)'; }
    });

    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Searching...</div>';
    
    var sb = document.getElementById('beatsSortBar');
    if (sb) sb.remove();

    if (typeof db === 'undefined') {
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Firebase not ready...</div>';
        return;
    }

    db.collection('beats_tracks').orderBy('createdAt','desc').limit(100).get().then(function(snap) {
        if (snap.empty) { listEl.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:2.5rem;">🔍</div><div style="color:var(--text-muted);">No results</div></div>'; return; }
        
        var allTracks=[];
        snap.forEach(function(doc){ allTracks.push({id:doc.id,...doc.data()}); });
        
        var results=allTracks.filter(function(t){
            var title=(t.title||'').toLowerCase().indexOf(query)!==-1;
            var artist=(t.artist||t.authorName||'').toLowerCase().indexOf(query)!==-1;
            var genre=(t.genre||'').toLowerCase().indexOf(query)!==-1;
            return title||artist||genre;
        });

        if (results.length===0) { listEl.innerHTML = '<div style="text-align:center;padding:40px;"><div style="font-size:2.5rem;">🔍</div><div style="color:var(--text-muted);">No results for "'+escapeHtml(query)+'"</div></div>'; return; }

        window._beatsQueue=results;
        var liked=typeof safeJSON==='function'?safeJSON('btc_beats_liked',[]):[];
        
        var html='<div style="margin-bottom:12px;display:flex;align-items:center;gap:8px;"><span style="color:var(--text-faint);font-size:0.75rem;">🔍 Found '+results.length+' result'+(results.length!==1?'s':'')+' for "'+escapeHtml(query)+'"</span><button onclick="beatsClearSearch()" style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.7rem;cursor:pointer;">Clear</button></div>';
        
        results.forEach(function(t,idx){ var isLiked=liked.indexOf(t.id)!==-1;var isPlaying=window._beatsQueueIdx===idx;var duration=t.duration?beatsFormatTime(t.duration):'--:--'; html+='<div class="beats-track-row" onclick="beatsPlayTrack('+idx+')" style="padding:10px 12px;border-radius:12px;cursor:pointer;transition:0.15s;'+ (isPlaying?'background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);':'background:var(--card-bg);border:1px solid var(--border);') + 'margin-bottom:8px;"><div style="display:flex;align-items:center;gap:10px;"><div style="width:28px;text-align:center;color:' + (isPlaying?'var(--accent)':'var(--text-faint)') + ';font-size:0.75rem;font-weight:700;">'+(isPlaying?'▶':(idx+1))+'</div><div style="width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;overflow:hidden;">' + ((t.coverArt||t.coverUrl)?'<img src="'+_safeCover(t.coverUrl||t.coverArt)+'" style="width:100%;height:100%;object-fit:cover;">':(t.genre==='podcast'?'🎙️':'🎵')) + '</div><div style="flex:1;min-width:0;"><div style="color:' + (isPlaying?'var(--accent)':'var(--heading)') + ';font-weight:700;font-size:0.88rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.title||'Untitled') + '</div><div style="color:var(--text-faint);font-size:0.72rem;">' + escapeHtml(t.artist||t.authorName||'Unknown') + (t.genre?' · '+t.genre:'') + '</div></div><div style="flex-shrink:0;text-align:right;"><div style="color:var(--text-faint);font-size:0.7rem;">'+duration+'</div><div style="color:var(--text-faint);font-size:0.6rem;">▶ '+_formatPlays(t.plays||0)+'</div></div></div></div>';});
        
        listEl.innerHTML=html;
    }).catch(function(e){console.error('[Beats Search]',e);listEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-faint);">Error searching</div>';});
};

window.beatsClearSearch=function(){var input=document.getElementById('beatsSearchInput');if(input)input.value='';_beatsHideSuggestions();beatsTab('discover');};

// ================================================================
// AUTOCOMPLETE / SUGGESTIONS
// ================================================================
var _beatsSuggestCache = null; // { artists:[], tracks:[], albums:[] }

function _beatsBuildSuggestCache(cb) {
    if (_beatsSuggestCache) { cb(_beatsSuggestCache); return; }
    if (typeof db === 'undefined') { cb({artists:[],tracks:[],albums:[]}); return; }
    var cache = { artists:[], tracks:[], albums:[] };
    // Parallel fetch artists + tracks
    Promise.all([
        db.collection('beats_artists').orderBy('name','asc').limit(300).get(),
        db.collection('beats_tracks').orderBy('title','asc').limit(500).get()
    ]).then(function(results) {
        var artistSnap = results[0], trackSnap = results[1];
        var seenArtist = {}, seenAlbum = {};
        artistSnap.forEach(function(doc) {
            var n = (doc.data().name||'').trim();
            if (n && !seenArtist[n.toLowerCase()]) {
                seenArtist[n.toLowerCase()] = true;
                cache.artists.push(n);
            }
        });
        trackSnap.forEach(function(doc) {
            var d = doc.data();
            var t = (d.title||'').trim();
            var a = (d.artist||d.authorName||'').trim();
            var al = (d.album||'').trim();
            if (t) cache.tracks.push(t);
            if (a && !seenArtist[a.toLowerCase()]) { seenArtist[a.toLowerCase()]=true; cache.artists.push(a); }
            if (al && !seenAlbum[al.toLowerCase()]) { seenAlbum[al.toLowerCase()]=true; cache.albums.push(al); }
        });
        cache.artists.sort(function(a,b){return a.localeCompare(b,undefined,{sensitivity:'base'});});
        _beatsSuggestCache = cache;
        cb(cache);
    }).catch(function() { cb({artists:[],tracks:[],albums:[]}); });
}

function _beatsShowSuggestions(terms) {
    _beatsHideSuggestions();
    if (!terms || terms.length === 0) return;
    var input = document.getElementById('beatsSearchInput');
    if (!input) return;
    var wrap = input.closest('div[style]');
    if (!wrap) return;
    var container = wrap.parentElement;
    var box = document.createElement('div');
    box.id = 'beatsSuggestBox';
    // Use literal dark colour so the box is always fully opaque regardless of theme variable
    box.style.cssText = 'position:absolute;left:0;right:0;top:' + (wrap.offsetTop + wrap.offsetHeight + 4) + 'px;background:#1a1a2e;border:1px solid var(--accent);border-radius:12px;z-index:10050;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.85);';
    terms.slice(0,8).forEach(function(item) {
        var row = document.createElement('div');
        row.style.cssText = 'padding:10px 14px;cursor:pointer;font-size:0.83rem;color:var(--text);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:8px;';
        row.innerHTML = '<span style="color:var(--text-faint);font-size:0.75rem;">' + (item.type==='artist'?'🎤':item.type==='album'?'💿':'🎵') + '</span><span style="color:#fff;font-weight:500;">' + escapeHtml(item.label) + '</span>';
        (function(label) {
            function _pick(e) {
                e.preventDefault();
                e.stopPropagation();
                window._beatsSuggestPicking = true;
                var inp = document.getElementById('beatsSearchInput');
                if (inp) inp.value = label;
                _beatsHideSuggestions();
                beatsPerformSearch();
                setTimeout(function() { window._beatsSuggestPicking = false; }, 400);
            }
            row.addEventListener('mousedown', _pick);
            row.addEventListener('touchstart', _pick, {passive:false});
        })(item.label);
        row.addEventListener('mouseover', function() { row.style.background='rgba(247,147,26,0.2)'; });
        row.addEventListener('mouseout',  function() { row.style.background=''; });
        box.appendChild(row);
    });
    // Position relative to container
    if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
    container.appendChild(box);
}

function _beatsHideSuggestions() {
    var box = document.getElementById('beatsSuggestBox');
    if (box) box.remove();
}

window.beatsWireSearchInput = function() {
    var input = document.getElementById('beatsSearchInput');
    if (!input || input._suggestWired) return;
    input._suggestWired = true;
    input.setAttribute('autocomplete','off');

    input.addEventListener('input', function() {
        var q = input.value.trim().toLowerCase();
        if (q.length < 1) { _beatsHideSuggestions(); return; }
        _beatsBuildSuggestCache(function(cache) {
            var matches = [];
            var seen = {};
            function addMatch(label, type) {
                var key = label.toLowerCase();
                if (seen[key]) return;
                seen[key] = true;
                matches.push({label:label, type:type});
            }
            // Artists first (exact prefix > contains)
            cache.artists.forEach(function(a) { if (a.toLowerCase().indexOf(q) !== -1) addMatch(a,'artist'); });
            // Tracks
            cache.tracks.forEach(function(t) { if (t.toLowerCase().indexOf(q) !== -1) addMatch(t,'track'); });
            // Albums
            cache.albums.forEach(function(a) { if (a.toLowerCase().indexOf(q) !== -1) addMatch(a,'album'); });
            // Sort: prefix matches first, then contains
            matches.sort(function(a,b) {
                var aPrefix = a.label.toLowerCase().startsWith(q) ? 0 : 1;
                var bPrefix = b.label.toLowerCase().startsWith(q) ? 0 : 1;
                return aPrefix - bPrefix || a.label.localeCompare(b.label);
            });
            _beatsShowSuggestions(matches);
        });
    });

    input.addEventListener('keydown', function(e) {
        var box = document.getElementById('beatsSuggestBox');
        if (e.key === 'Escape') { _beatsHideSuggestions(); return; }
        if (!box) return;
        var rows = box.querySelectorAll('div');
        var active = box.querySelector('.sg-active');
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            if (!active) { if (rows[0]) { rows[0].classList.add('sg-active'); rows[0].style.background='rgba(247,147,26,0.18)'; } }
            else {
                var next = active.nextElementSibling;
                active.classList.remove('sg-active'); active.style.background='';
                if (next) { next.classList.add('sg-active'); next.style.background='rgba(247,147,26,0.18)'; }
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (active) {
                var prev = active.previousElementSibling;
                active.classList.remove('sg-active'); active.style.background='';
                if (prev) { prev.classList.add('sg-active'); prev.style.background='rgba(247,147,26,0.18)'; }
            }
        } else if (e.key === 'Enter') {
            if (active) {
                e.preventDefault();
                var txt = active.querySelector('span:last-child');
                if (txt) { input.value = txt.textContent; }
                _beatsHideSuggestions();
                beatsPerformSearch();
            }
        }
    });

    input.addEventListener('blur', function() {
        // Delay hiding so mousedown/touchstart on a suggestion fires first.
        // If _beatsSuggestPicking is set, skip hiding entirely (pick handler manages it).
        setTimeout(function() {
            if (!window._beatsSuggestPicking) _beatsHideSuggestions();
        }, 250);
    });
};

// ================================================================
// ARTISTS FEATURE
// ================================================================
window.beatsRenderArtists=function(){
    var listEl=document.getElementById('beatsTrackList');
    if(!listEl)return;
    listEl.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-faint);">Loading artists...</div>';
    if(typeof db==='undefined'){listEl.innerHTML='<div style="text-align:center;padding:40px;">Firebase not ready</div>';return;}

    // Read directly from beats_artists collection (populated by importer and user uploads)
    db.collection('beats_artists').orderBy('name','asc').limit(200).get().then(function(snap){
        if(snap.empty){listEl.innerHTML='<div style="text-align:center;padding:40px;"><div style="font-size:2.5rem;">🎤</div><div style="color:var(--text-muted);">No artists yet</div></div>';return;}

        // Build artist list — count tracks per artist from the tracks collection
        var artistById={};
        snap.forEach(function(doc){
            var d=doc.data();
            artistById[doc.id]={id:doc.id, name:d.name||doc.id, avatarUrl:d.avatarUrl||'', slug:d.slug||doc.id, claimed:d.claimed||false, count:0};
        });

        // Count ALL tracks per artist in one query
        db.collection('beats_tracks').get().then(function(tSnap){
            tSnap.forEach(function(doc){
                var t=doc.data();
                var aid=t.authorId||t.artistDocId;
                if(aid && artistById[aid]) artistById[aid].count++;
            });

            // Filter out artists with 0 tracks, sort strictly A→Z
            var artistList=Object.values(artistById)
                .filter(function(a){return a.count>0;})
                .sort(function(a,b){return a.name.localeCompare(b.name,undefined,{sensitivity:'base'});});
            var n=artistList.length;

            var html='<div style="margin-bottom:16px;"><div style="color:var(--heading);font-weight:800;font-size:1.1rem;margin-bottom:4px;">🎤 Artists</div><div style="color:var(--text-faint);font-size:0.75rem;">'+n+' artist'+(n!==1?'s':'')+' on Bitcoin Beats</div></div>';
            html+='<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:12px;">';
            artistList.forEach(function(artist){
                var img=artist.avatarUrl ? '<div style="width:68px;height:68px;border-radius:50%;margin:0 auto 8px;background:linear-gradient(135deg,#1e293b,#0f172a);overflow:hidden;flex-shrink:0;"><img src="'+_safeCover(artist.avatarUrl)+'" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display=\'none\'"></div>' : '<div style="width:68px;height:68px;border-radius:50%;margin:0 auto 8px;background:linear-gradient(135deg,var(--accent),#ea580c);display:flex;align-items:center;justify-content:center;font-size:1.6rem;">🎤</div>';
                html+='<div onclick="beatsShowArtistPage(\''+artist.id+'\')" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px 10px;cursor:pointer;text-align:center;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-2px)\'" onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'\'">';
                html+=img;
                html+='<div style="color:var(--heading);font-weight:700;font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;margin-bottom:3px;">'+escapeHtml(artist.name)+'</div>';
                html+='<div style="color:var(--text-faint);font-size:0.65rem;">'+artist.count+' track'+(artist.count!==1?'s':'')+(artist.claimed&&artist.claimed!==false?' • ⚡ V4V':'')+'</div>';
                html+='</div>';
            });
            html+='</div>';
            listEl.innerHTML=html;
        }).catch(function(e){console.error('[Beats Artists]',e);listEl.innerHTML='<div style="text-align:center;padding:40px;">Error loading artists</div>';});
    }).catch(function(e){console.error('[Beats Artists]',e);listEl.innerHTML='<div style="text-align:center;padding:40px;">Error loading artists</div>';});
};

// NOTE: Artist Catalog is already rendered by the original beatsShowArtistPage
// (see "Discography" section). No override needed.

// ================================================================
// PUMP IT! — Embedded price game
// ================================================================
window.beatsRenderPumpIt = function() {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;
    listEl.innerHTML = '<div style="position:relative;width:100%;padding-top:75%;border-radius:12px;overflow:hidden;background:#000;">'
        + '<iframe src="https://leo-mattes.com/pump-it-up/" style="position:absolute;top:0;left:0;width:100%;height:100%;border:none;" allow="autoplay" allowfullscreen></iframe>'
        + '</div>'
        + '<div style="text-align:center;margin-top:12px;">'
        + '<a href="https://leo-mattes.com/pump-it-up/" target="_blank" rel="noopener" style="color:var(--text-faint);font-size:0.72rem;text-decoration:none;">Open in new tab ↗</a>'
        + '</div>';
};


// ================================================================
// V4V — Split Tip Overlay + V4V Badge support
// ================================================================

// Payment type icons and labels
function _v4vPayIcon(paymentType) {
    if (paymentType === 'lnaddress') return '⚡';
    if (paymentType === 'keysend_wavlake') return '🎵';
    return '🔑';
}
function _v4vPayLabel(r) {
    if (r.paymentType === 'lnaddress')        return r.lightningAddress || r.displayAddress || '';
    if (r.paymentType === 'keysend_wavlake')  return 'via Wavlake · keysend';
    if (r.nodeAddress) return r.nodeAddress.slice(0,16) + '…';
    return 'keysend';
}

// Show V4V split tip overlay — fans out to each artist's Lightning address
window.beatsShowV4VTip = async function(track) {
    if (!track || !track.id) return;
    var splits = track.v4vSplits || [];
    if (!splits.length) {
        if (typeof showTipOverlay === 'function') showTipOverlay({ recipientName: track.artist || 'Artist', recipientUid: track.authorId || '', context: 'Bitcoin Beats tip', label: 'Tip Artist' });
        return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'v4vTipOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.88);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:10002;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeSlideIn 0.25s ease-out;overflow-y:auto;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var totalSplit = splits.reduce(function(s, r) { return s + (r.split || 0); }, 0) || 100;
    var splitsHtml = splits.map(function(r) {
        var pct = Math.round((r.split / totalSplit) * 100);
        var label = _v4vPayLabel(r);
        var icon  = _v4vPayIcon(r.paymentType);
        var hasDirectPay = r.paymentType === 'lnaddress' && r.lightningAddress;
        var isKeysend    = r.paymentType === 'keysend' || r.paymentType === 'keysend_wavlake';
        var statusColor  = hasDirectPay ? '#22c55e' : (isKeysend ? '#f59e0b' : '#6b7280');
        var statusDot    = hasDirectPay ? '●' : '●';
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;margin-bottom:6px;">' +
            '<div style="min-width:36px;text-align:center;padding:3px 6px;background:rgba(247,147,26,0.15);border-radius:6px;color:var(--accent);font-weight:800;font-size:0.78rem;">' + pct + '%</div>' +
            '<div style="flex:1;min-width:0;">' +
                '<div style="color:var(--heading);font-size:0.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(r.name || 'Artist') + '</div>' +
                '<div style="color:' + statusColor + ';font-size:0.62rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:flex;align-items:center;gap:3px;">' +
                    '<span style="font-size:0.45rem;">' + statusDot + '</span>' + icon + ' ' + escapeHtml(label.slice(0,42)) +
                '</div>' +
            '</div>' +
            (hasDirectPay ? '<div style="font-size:0.6rem;color:#22c55e;font-weight:700;white-space:nowrap;">LNURL</div>' :
             isKeysend    ? '<div style="font-size:0.6rem;color:#f59e0b;font-weight:700;white-space:nowrap;">keysend</div>' : '') +
        '</div>';
    }).join('');

    var hasKeysend = splits.some(function(r) { return r.paymentType && r.paymentType.startsWith('keysend'); });
    var hasWebLN = !!(window.webln);
    var keysendNote = hasKeysend ?
        '<div style="padding:8px 12px;background:rgba(245,158,11,0.08);border:1px solid rgba(245,158,11,0.25);border-radius:8px;margin-bottom:12px;font-size:0.7rem;color:#f59e0b;line-height:1.5;">' +
        (hasWebLN
            ? '🔑 <strong>Keysend detected</strong> — your wallet will auto-pay these artists directly.'
            : '🔑 <strong>No wallet detected.</strong> For keysend artists, you can tip them on <a href="https://wavlake.com" target="_blank" rel="noopener" style="color:var(--accent);">Wavlake.com</a> directly, or ' +
              '<a href="https://getalby.com" target="_blank" rel="noopener" style="color:var(--accent);">install Alby</a> (free) for one-click payments. Lightning address artists below can be paid by copying their address into any wallet.') +
        '</div>' : '';

    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:22px;padding:24px;max-width:400px;width:100%;animation:fadeSlideIn 0.3s ease-out;">' +
        '<div style="text-align:center;margin-bottom:14px;">' +
            '<div style="font-size:2rem;margin-bottom:4px;">⚡</div>' +
            '<h3 style="color:var(--heading);font-size:1.05rem;font-weight:800;margin:0 0 4px;">V4V Split — Pay Each Artist</h3>' +
            '<p style="color:var(--text-muted);font-size:0.78rem;margin:0 0 10px;">' + escapeHtml(track.title || '') + '</p>' +
        '</div>' +
        '<div style="margin-bottom:12px;max-height:220px;overflow-y:auto;">' + splitsHtml + '</div>' +
        keysendNote +
        '<div style="margin-bottom:10px;">' +
            '<input type="number" id="v4vTipAmount" placeholder="Amount in sats" min="10" value="1000" style="width:100%;padding:12px;background:var(--input-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:1.05rem;font-family:inherit;outline:none;text-align:center;box-sizing:border-box;font-weight:700;">' +
            '<div style="text-align:center;color:var(--text-faint);font-size:0.68rem;margin-top:3px;">Split proportionally to each artist</div>' +
        '</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:12px;justify-content:center;">' +
            [100,500,1000,5000,21000].map(function(v){return '<button onclick="document.getElementById(\'v4vTipAmount\').value='+v+'" style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.72rem;font-weight:600;cursor:pointer;font-family:inherit;">'+(v>=1000?v/1000+'K':v)+' sats</button>';}).join('') +
        '</div>' +
        '<div id="v4vTipResult" style="margin-bottom:10px;"></div>' +
        '<button id="v4vTipBtn" onclick="beatsExecuteV4VTip(\'' + track.id + '\')" style="width:100%;padding:13px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-size:0.92rem;font-weight:800;cursor:pointer;font-family:inherit;margin-bottom:8px;">⚡ Pay All Artists</button>' +
        '<button onclick="document.getElementById(\'v4vTipOverlay\').remove()" style="width:100%;padding:9px;background:none;border:none;color:var(--text-faint);font-size:0.82rem;cursor:pointer;font-family:inherit;">Cancel</button>' +
    '</div>';
    document.body.appendChild(overlay);
};

window.beatsExecuteV4VTip = async function(trackId) {
    var btn    = document.getElementById('v4vTipBtn');
    var result = document.getElementById('v4vTipResult');
    var amount = parseInt(document.getElementById('v4vTipAmount') ? document.getElementById('v4vTipAmount').value : 0) || 0;
    if (amount < 10) { result.innerHTML = '<div style="color:#ef4444;text-align:center;font-size:0.82rem;">Minimum 10 sats</div>'; return; }
    btn.disabled = true; btn.textContent = '⏳ Getting payment info…';

    try {
        var fn = firebase.functions().httpsCallable('v4vSplitRelay');
        var resp = await fn({ trackId: trackId, amountSats: amount });
        var data = resp.data;
        var invoices = data.invoices || [];

        // Split into payment types
        var lnurlPayable  = invoices.filter(function(i) { return i.canPayLnurl && i.invoice; });
        var keysendable   = invoices.filter(function(i) { return i.canKeysend && i.keysend; });
        var unpayable     = invoices.filter(function(i) { return !i.canPay; });

        if (!lnurlPayable.length && !keysendable.length) {
            result.innerHTML = '<div style="padding:12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;color:#ef4444;font-size:0.82rem;text-align:center;">No payable routes found.</div>';
            btn.disabled = false; btn.textContent = '⚡ Pay All Artists';
            return;
        }

        var lnState = null; try { lnState = JSON.parse(localStorage.getItem('btc_ln_state')); } catch(e) {}
        var hasWallet = lnState && ((lnState.method === 'nwc' && lnState.nwcRelay) || (lnState.method === 'webln' && window.webln));
        var hasWebLN  = !!(window.webln);

        var paidCount = 0;
        var rowHtml = '';

        // 1. Pay LNURL invoices
        if (lnurlPayable.length && hasWallet) {
            btn.textContent = '⏳ Paying ' + lnurlPayable.length + ' LNURL…';
            for (var i = 0; i < lnurlPayable.length; i++) {
                var inv = lnurlPayable[i];
                try {
                    if (typeof window.lnSendPaymentDirect === 'function') {
                        await window.lnSendPaymentDirect(inv.invoice);
                        paidCount++;
                        rowHtml += _v4vRow(inv.name, inv.amountSats, 'paid', '✓ ' + escapeHtml(inv.lightningAddress||inv.displayAddress||''));
                    }
                } catch(pe) {
                    rowHtml += _v4vRow(inv.name, inv.amountSats, 'fail', 'failed: ' + escapeHtml(pe.message||'unknown'));
                }
            }
        } else if (lnurlPayable.length) {
            // No wallet — show QR codes
            lnurlPayable.forEach(function(inv) {
                rowHtml += _v4vRow(inv.name, inv.amountSats, 'qr',
                    (inv.qr ? '<img src="'+inv.qr+'" style="width:120px;height:120px;border-radius:8px;display:block;margin:6px auto 4px;">' : '') +
                    '<div onclick="navigator.clipboard.writeText(this.dataset.inv);if(typeof showToast===\'function\')showToast(\'📋 Copied!\')" data-inv="'+escapeHtml(inv.invoice)+'" style="font-family:monospace;font-size:0.52rem;cursor:pointer;color:var(--text-faint);word-break:break-all;padding:2px 4px;background:var(--input-bg);border-radius:4px;">'+inv.invoice.slice(0,40)+'…</div>'
                );
            });
        }

        // 2. Pay keysend (requires WebLN keysend support)
        if (keysendable.length) {
            btn.textContent = '⏳ Keysend ' + keysendable.length + ' artist(s)…';
            for (var j = 0; j < keysendable.length; j++) {
                var ks = keysendable[j];
                var ksData = ks.keysend;
                var ksLabel = ks.paymentType === 'keysend_wavlake' ? 'Wavlake node' : ksData.nodeAddress.slice(0,12)+'…';
                if (hasWebLN && window.webln && typeof window.webln.keysend === 'function') {
                    try {
                        var customRecords = {};
                        if (ksData.customKey && ksData.customValue) {
                            customRecords[ksData.customKey] = ksData.customValue;
                        }
                        await window.webln.enable();
                        await window.webln.keysend({ destination: ksData.nodeAddress, amount: ks.amountSats, customRecords: customRecords });
                        paidCount++;
                        rowHtml += _v4vRow(ks.name, ks.amountSats, 'paid', '✓ keysend → ' + ksLabel);
                    } catch(ke) {
                        rowHtml += _v4vRow(ks.name, ks.amountSats, 'fail', 'keysend failed: ' + escapeHtml(ke.message||'unknown'));
                    }
                } else {
                    // No keysend / no Alby — give user actionable alternatives
                    var wavlakeSlug = ksData.customValue ? ksData.customValue : null;
                    var wavlakeArtistUrl = (ks.paymentType === 'keysend_wavlake' && wavlakeSlug)
                        ? 'https://wavlake.com' // artist root — best we can do without slug→url lookup
                        : null;
                    var altHtml = '';
                    if (ks.paymentType === 'keysend_wavlake') {
                        altHtml = '🎧 <a href="https://wavlake.com" target="_blank" rel="noopener" style="color:var(--accent);font-weight:700;">Tip on Wavlake.com</a> ' +
                            '<span style="color:var(--text-faint);font-size:0.62rem;">or install <a href="https://getalby.com" target="_blank" rel="noopener" style="color:#f59e0b;">Alby</a> for auto-pay</span>';
                    } else if (ks.lightningAddress || ks.displayAddress) {
                        var la = ks.lightningAddress || ks.displayAddress;
                        var laSafe = escapeHtml(la);
                        altHtml = '<span style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">' +
                            '<span style="font-family:monospace;font-size:0.68rem;color:var(--accent);">' + laSafe + '</span>' +
                            '<button data-la="' + laSafe + '" onclick="navigator.clipboard.writeText(this.dataset.la);if(typeof showToast===\'function\')showToast(\'⚡ Copied!\')" style="background:none;border:1px solid var(--border);border-radius:4px;padding:1px 6px;font-size:0.6rem;cursor:pointer;color:var(--text-muted);">copy</button>' +
                            '</span>';
                    } else {
                        altHtml = '<span style="color:#f59e0b;font-size:0.62rem;">Install <a href="https://getalby.com" target="_blank" rel="noopener" style="color:#f59e0b;">Alby wallet</a> for keysend payments</span>';
                    }
                }
            }
        }

        if (unpayable.length) {
            unpayable.forEach(function(u) {
                rowHtml += _v4vRow(u.name, u.amountSats, 'skip', 'no payment route available');
            });
        }

        result.innerHTML = '<div style="margin-bottom:8px;">' + rowHtml + '</div>' +
            (paidCount > 0 ? '<div style="text-align:center;color:#22c55e;font-size:0.85rem;font-weight:700;">⚡ ' + paidCount + ' payment(s) sent!</div>' : '');

        if (paidCount > 0) {
            if (typeof launchConfetti === 'function') launchConfetti();
            if (typeof awardPoints === 'function') awardPoints(10, 'V4V split tip sent');
        }

        btn.textContent = '✓ Done';
        if (paidCount > 0) setTimeout(function() { var o = document.getElementById('v4vTipOverlay'); if (o) o.remove(); }, 5000);
        else { btn.disabled = false; }

    } catch(e) {
        console.error('[V4V Tip]', e);
        result.innerHTML = '<div style="color:#ef4444;text-align:center;font-size:0.82rem;">Error: ' + escapeHtml(e.message || 'unknown') + '</div>';
        btn.disabled = false; btn.textContent = '⚡ Pay All Artists';
    }
};

function _v4vRow(name, sats, status, detail) {
    var colors = { paid:'rgba(34,197,94,0.08)', fail:'rgba(239,68,68,0.08)', qr:'var(--card-bg)', info:'rgba(245,158,11,0.08)', skip:'rgba(100,100,100,0.06)' };
    var border = { paid:'rgba(34,197,94,0.3)', fail:'rgba(239,68,68,0.3)', qr:'var(--border)', info:'rgba(245,158,11,0.3)', skip:'var(--border)' };
    return '<div style="padding:8px 12px;background:'+colors[status]+';border:1px solid '+border[status]+';border-radius:8px;margin-bottom:6px;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:3px;">' +
            '<span style="color:var(--heading);font-size:0.8rem;font-weight:700;">' + escapeHtml(name) + '</span>' +
            '<span style="color:var(--text-faint);font-size:0.75rem;">' + sats.toLocaleString() + ' sats</span>' +
        '</div>' +
        '<div style="color:var(--text-muted);font-size:0.68rem;line-height:1.4;">' + detail + '</div>' +
    '</div>';
}

// Patch beatsShowTrackDetail to add V4V tip button + badge for v4v tracks
(function() {
    var _orig = window.beatsShowTrackDetail;
    window.beatsShowTrackDetail = function(idx) {
        _orig(idx);
        var track = window._beatsQueue && window._beatsQueue[idx];
        if (!track || !track.hasV4VSplits) return;

        // Add V4V badge to overlay title area and swap tip button
        var overlay = document.getElementById('beatsDetailOverlay');
        if (!overlay) return;

        // Add V4V badge after genre tag
        var genreEl = overlay.querySelector('[style*="border-radius:20px"]');
        if (genreEl && genreEl.parentElement) {
            var badge = document.createElement('div');
            badge.style.cssText = 'text-align:center;margin-bottom:10px;';
            badge.innerHTML = '<span style="background:rgba(247,147,26,0.2);border:1px solid rgba(247,147,26,0.5);color:#f7931a;font-size:0.65rem;font-weight:700;padding:3px 10px;border-radius:20px;letter-spacing:0.5px;">⚡ V4V · ' + (track.v4vSplits ? track.v4vSplits.length : 1) + ' artist split</span>';
            genreEl.parentElement.insertBefore(badge, genreEl.nextSibling);
        }

        // Prepend V4V tip button before the button row
        var btnRow = overlay.querySelector('[style*="display:flex;gap:8px"]');
        if (btnRow) {
            var v4vBtn = document.createElement('button');
            v4vBtn.style.cssText = 'width:100%;padding:11px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.5);border-radius:12px;color:#f7931a;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:8px;';
            v4vBtn.textContent = '⚡ Zap All Artists (Split)';
            v4vBtn.onclick = function(e) {
                e.stopPropagation();
                document.getElementById('beatsDetailOverlay').remove();
                beatsShowV4VTip(track);
            };
            btnRow.parentElement.insertBefore(v4vBtn, btnRow);
        }

        // V4V source attribution line
        if (track.feedTitle) {
            var inner = overlay.querySelector('[style*="background:var(--bg-side"]');
            if (inner) {
                var attr = document.createElement('div');
                attr.style.cssText = 'text-align:center;color:var(--text-faint);font-size:0.65rem;margin-top:12px;';
                attr.innerHTML = '🎙️ Via <a href="https://podcastindex.org" target="_blank" rel="noopener" style="color:var(--accent);">Podcast Index</a> · ' + escapeHtml(track.feedTitle || '') +
                    ' · <a href="/terms.html#bitcoin-beats" target="_blank" rel="noopener" style="color:var(--accent);">V4V License</a>';
                inner.appendChild(attr);
            }
        }
    };
})();

// Add ⚡ V4V badge to track list cards
(function() {
    var _origRender = window._beatsRenderTrackCard;
    // Patch the track card render inline — add badge to track title row for v4v tracks
    // The actual card HTML is built inside beatsLoadTracks; we patch the data check
    window._beatsV4VBadgeHtml = function(track) {
        if (!track || !track.hasV4VSplits) return '';
        return '<span style="display:inline-block;margin-left:6px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.4);color:#f7931a;font-size:0.58rem;font-weight:700;padding:1px 6px;border-radius:10px;vertical-align:middle;letter-spacing:0.3px;">V4V</span>';
    };
})();

// Artist claim CTA — shown on beats_artists page for unclaimed artists
window.beatsShowArtistClaimCTA = function(artistName) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);z-index:10003;display:flex;align-items:center;justify-content:center;padding:16px;animation:fadeSlideIn 0.25s;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:28px;max-width:380px;width:100%;text-align:center;">' +
        '<div style="font-size:2.5rem;margin-bottom:12px;">🎤</div>' +
        '<h3 style="color:var(--heading);font-size:1.1rem;font-weight:800;margin:0 0 8px;">Are you ' + escapeHtml(artistName) + '?</h3>' +
        '<p style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;margin:0 0 16px;">Claim your artist page to manage your profile, update your Lightning address, and receive zaps directly from fans.</p>' +
        '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;text-align:left;margin-bottom:16px;font-size:0.78rem;color:var(--text-muted);line-height:1.6;">' +
            '<div style="font-weight:700;color:var(--heading);margin-bottom:6px;">To claim your page, email us:</div>' +
            '<div>📧 <a href="mailto:info.603btc@gmail.com?subject=Artist Claim: ' + encodeURIComponent(artistName) + '&body=Artist name: ' + encodeURIComponent(artistName) + '%0A%0AMy name:%0ASocial proof (website%2FFountain%2FWavlake%2Fetc.):%0AMy Lightning address:" style="color:var(--accent);">info.603btc@gmail.com</a></div>' +
            '<div style="margin-top:6px;">Include: (1) your name, (2) social proof link, (3) your Lightning address</div>' +
        '</div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="width:100%;padding:12px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.9rem;font-weight:700;cursor:pointer;font-family:inherit;">Got it</button>' +
        '</div>';
    document.body.appendChild(overlay);
};
