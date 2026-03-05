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
            <div class="channel-logos" style="display:flex;gap:12px;">
                <img src="images/btc-grad-logo.jpg" alt="Home" class="channel-logo-img" onclick="goHome()" style="width:44px;height:44px;border-radius:50%;cursor:pointer;box-shadow:0 0 12px rgba(247,147,26,0.3);object-fit:cover;" title="Home">
            </div>
            <div style="flex:1;">
                <h2 style="color:var(--heading);font-weight:900;font-size:1.6rem;margin:0;letter-spacing:-0.5px;">🎸 Bitcoin Beats</h2>
                <div style="color:var(--text-muted);font-size:0.75rem;">Community Music · Powered by Lightning</div>
            </div>
            <button onclick="beatsShowUpload()" style="padding:10px 18px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;gap:6px;">
                <span style="font-size:1rem;">+</span> Upload
            </button>
        </div>

        <!-- Copyright Disclaimer Banner -->
        <div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:12px;padding:12px 16px;margin-bottom:20px;font-size:0.75rem;color:#eab308;line-height:1.5;">
            <strong>⚠️ Copyright Notice:</strong> By uploading music, you confirm you own the rights or have permission to share it. Copyrighted material uploaded without authorization will be removed. Bitcoin Education Archive is not responsible for user-uploaded content. 
            <a href="/terms.html#bitcoin-beats" style="color:#eab308;text-decoration:underline;">Full Terms</a> · 
            <a href="#" onclick="event.preventDefault();beatsShowDMCA()" style="color:#eab308;text-decoration:underline;">DMCA Policy</a>
        </div>

        <!-- Tab Bar -->
        <div style="display:flex;gap:0;border-bottom:2px solid var(--border);margin-bottom:20px;">
            <button onclick="beatsTab('discover')" id="beatsTabDiscover" class="beats-tab active" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid var(--accent);margin-bottom:-2px;color:var(--accent);font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;">🔥 Discover</button>
            <button onclick="beatsTab('mymusic')" id="beatsTabMymusic" class="beats-tab" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;">📚 My Music</button>
            <button onclick="beatsTab('likes')" id="beatsTabLikes" class="beats-tab" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;">❤️ Liked</button>
            <button onclick="beatsTab('livestream')" id="beatsTabLivestream" class="beats-tab" style="padding:10px 20px;background:none;border:none;border-bottom:2px solid transparent;margin-bottom:-2px;color:var(--text-muted);font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;">📡 Livestream</button>
        </div>

        <!-- Track List -->
        <div id="beatsTrackList" style="min-height:200px;">
            <div style="text-align:center;padding:40px;color:var(--text-faint);">Loading tracks...</div>
        </div>

    </div>`;

    container.innerHTML = html;

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
        css.textContent = '@media(min-width:901px){#beatsGlobalPlayer{bottom:0!important;}}';
        document.head.appendChild(css);
    }
    gp.innerHTML =
        '<div id="beatsProgressWrap" onclick="beatsSeek(event)" style="height:4px;background:rgba(255,255,255,0.1);cursor:pointer;position:relative;">' +
            '<div id="beatsProgressBar" style="height:100%;background:linear-gradient(90deg,var(--accent),#ea580c);width:0%;transition:width 0.3s linear;border-radius:0 2px 2px 0;"></div>' +
        '</div>' +
        '<div style="display:flex;align-items:center;gap:12px;padding:10px 16px;">' +
            '<div id="beatsNowArt" onclick="if(typeof go===\'function\')go(\'bitcoin-beats\')" style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#1a1a2e,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.4rem;flex-shrink:0;overflow:hidden;cursor:pointer;">🎵</div>' +
            '<div onclick="if(typeof go===\'function\')go(\'bitcoin-beats\')" style="flex:1;min-width:0;cursor:pointer;">' +
                '<div id="beatsNowTitle" style="color:#fff;font-size:0.85rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Not Playing</div>' +
                '<div id="beatsNowArtist" style="color:rgba(255,255,255,0.4);font-size:0.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Bitcoin Beats</div>' +
            '</div>' +
            '<div id="beatsTime" style="color:rgba(255,255,255,0.4);font-size:0.65rem;white-space:nowrap;">0:00 / 0:00</div>' +
            '<button onclick="beatsPrevTrack()" style="background:none;border:none;color:#fff;font-size:1rem;cursor:pointer;padding:4px;">⏮</button>' +
            '<button id="beatsPlayBtn" onclick="beatsTogglePlay()" style="background:var(--accent);border:none;color:#fff;width:36px;height:36px;border-radius:50%;font-size:1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;">▶</button>' +
            '<button onclick="beatsNextTrack()" style="background:none;border:none;color:#fff;font-size:1rem;cursor:pointer;padding:4px;">⏭</button>' +
            '<input type="range" id="beatsVolume" min="0" max="100" value="80" oninput="beatsSetVolume(this.value)" style="width:60px;accent-color:var(--accent);cursor:pointer;" title="Volume">' +
            '<button onclick="beatsShowComments()" style="background:none;border:none;color:rgba(255,255,255,0.4);font-size:0.9rem;cursor:pointer;padding:4px;" title="Comments">💬</button>' +
            '<button onclick="beatsClosePlayer()" style="background:none;border:none;color:rgba(255,255,255,0.3);font-size:0.9rem;cursor:pointer;padding:4px;" title="Close">✕</button>' +
        '</div>';
    document.body.appendChild(gp);
};

window.beatsShowGlobalPlayer = function() {
    beatsEnsureGlobalPlayer();
    var gp = document.getElementById('beatsGlobalPlayer');
    if (gp) gp.style.display = 'block';
};

window.beatsClosePlayer = function() {
    if (window._beatsAudio) { window._beatsAudio.pause(); window._beatsAudio = null; }
    clearInterval(window._beatsUpdateInterval);
    var gp = document.getElementById('beatsGlobalPlayer');
    if (gp) gp.style.display = 'none';
    var cp = document.getElementById('beatsCommentsPanel');
    if (cp) cp.remove();
    window._beatsNowPlaying = null;
    window._beatsQueueIdx = -1;
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
    if (artEl) artEl.innerHTML = np.coverArt ? '<img src="' + np.coverArt + '" style="width:100%;height:100%;object-fit:cover;">' : '🎵';
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
                { src: 'images/bitcoin-beats-logo.jpg', sizes: '120x120', type: 'image/jpeg' }
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
    ['discover','mymusic','likes','livestream'].forEach(function(t) {
        var btn = document.getElementById('beatsTab' + t.charAt(0).toUpperCase() + t.slice(1));
        if (btn) {
            btn.style.borderBottomColor = (t === tab) ? 'var(--accent)' : 'transparent';
            btn.style.color = (t === tab) ? 'var(--accent)' : 'var(--text-muted)';
        }
    });
    if (tab === 'livestream') {
        beatsRenderLivestream();
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
        query = db.collection('beats_tracks').where('authorId', '==', auth.currentUser.uid).orderBy('createdAt', 'desc').limit(50);
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
        query = db.collection('beats_tracks').orderBy('createdAt', 'desc').limit(50);
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
            html += '<div class="beats-track-row" onclick="beatsPlayTrack(' + idx + ')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:12px;cursor:pointer;transition:0.15s;' + (isPlaying ? 'background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);' : 'background:var(--card-bg);border:1px solid var(--border);') + 'margin-bottom:8px;" onmouseover="this.style.background=\'rgba(247,147,26,0.08)\'" onmouseout="this.style.background=\'' + (isPlaying ? 'rgba(247,147,26,0.1)' : 'var(--card-bg)') + '\'">' +
                '<div style="width:36px;text-align:center;color:' + (isPlaying ? 'var(--accent)' : 'var(--text-faint)') + ';font-size:0.8rem;font-weight:700;flex-shrink:0;">' + (isPlaying ? '<span style="display:flex;gap:1px;justify-content:center;align-items:flex-end;height:14px;"><div style="width:2px;height:60%;background:var(--accent);animation:beatsEqualizer 0.8s infinite alternate;"></div><div style="width:2px;height:100%;background:var(--accent);animation:beatsEqualizer 1.1s infinite alternate;"></div><div style="width:2px;height:40%;background:var(--accent);animation:beatsEqualizer 0.9s infinite alternate;"></div></span>' : (idx + 1)) + '</div>' +
                '<div style="width:40px;height:40px;border-radius:8px;background:linear-gradient(135deg,#1e293b,#0f172a);display:flex;align-items:center;justify-content:center;font-size:1.2rem;flex-shrink:0;overflow:hidden;">' + (t.coverArt ? '<img src="' + t.coverArt + '" style="width:100%;height:100%;object-fit:cover;">' : (t.genre === 'podcast' ? '🎙️' : '🎵')) + '</div>' +
                '<div style="flex:1;min-width:0;">' +
                    '<div style="color:' + (isPlaying ? 'var(--accent)' : 'var(--heading)') + ';font-weight:700;font-size:0.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.title || 'Untitled') + '</div>' +
                    '<div style="color:var(--text-faint);font-size:0.7rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(t.artist || t.authorName || 'Unknown') + (t.genre ? ' · ' + t.genre : '') + '</div>' +
                '</div>' +
                '<div style="color:var(--text-faint);font-size:0.7rem;flex-shrink:0;">' + duration + '</div>' +
                '<button onclick="event.stopPropagation();beatsShowComments(\'' + t.id + '\')" style="background:none;border:none;font-size:0.85rem;cursor:pointer;padding:4px;color:var(--text-faint);display:flex;align-items:center;gap:2px;" title="Comments">💬' + (t.commentCount ? '<span style="font-size:0.6rem;">' + t.commentCount + '</span>' : '') + '</button>' +
                '<button onclick="event.stopPropagation();beatsToggleLike(\'' + t.id + '\',this)" style="background:none;border:none;font-size:1rem;cursor:pointer;padding:4px;color:' + (isLiked ? '#ef4444' : 'var(--text-faint)') + ';" title="Like">' + (isLiked ? '❤️' : '🤍') + '</button>' +
                '<button onclick="event.stopPropagation();beatsTrackMenu(\'' + t.id + '\',' + idx + ')" style="background:none;border:none;font-size:0.9rem;cursor:pointer;padding:4px;color:var(--text-faint);" title="More">⋮</button>' +
            '</div>';
        });
        listEl.innerHTML = html;
    }).catch(function(e) {
        console.error('Beats load error:', e);
        listEl.innerHTML = '<div style="text-align:center;padding:40px;color:var(--text-faint);">Error loading tracks. Try again.</div>';
    });
};

// ---- Play track ----
window.beatsPlayTrack = function(idx) {
    var track = window._beatsQueue[idx];
    if (!track || !track.audioData) { if (typeof showToast === 'function') showToast('Track not available'); return; }

    window._beatsQueueIdx = idx;

    // Stop existing
    if (window._beatsAudio) { window._beatsAudio.pause(); window._beatsAudio = null; }
    clearInterval(window._beatsUpdateInterval);

    // Create audio element
    window._beatsAudio = new Audio(track.audioData);
    window._beatsAudio.volume = (document.getElementById('beatsVolume') ? document.getElementById('beatsVolume').value : 80) / 100;
    window._beatsAudio.play().catch(function(e) { console.log('Play error:', e); });

    // Store now-playing info (survives navigation)
    window._beatsNowPlaying = {
        title: track.title || 'Untitled',
        artist: track.artist || track.authorName || 'Unknown',
        genre: track.genre || '',
        coverArt: track.coverArt || ''
    };

    // Show & update global player
    beatsShowGlobalPlayer();
    beatsUpdatePlayerUI();
    var playBtn = document.getElementById('beatsPlayBtn');
    if (playBtn) playBtn.textContent = '⏸';

    // MediaSession for lock screen / background / minimized controls
    beatsSetMediaSession(track);

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
            if (!window._beatsListenedIds[trackId]) {
                window._beatsListenedIds[trackId] = true;
                awardPoints(10, 'Listened to a full track on Bitcoin Beats 🎵');
            }
        }
        beatsNextTrack();
    };

    // Increment play count
    if (track.id && typeof db !== 'undefined') {
        db.collection('beats_tracks').doc(track.id).update({
            plays: firebase.firestore.FieldValue.increment(1)
        }).catch(function() {});
    }

    // Refresh list to show playing indicator
    beatsLoadTracks(window._beatsCurrentTab);
};

// ---- Controls ----
window.beatsTogglePlay = function() {
    if (!window._beatsAudio) return;
    var btn = document.getElementById('beatsPlayBtn');
    if (window._beatsAudio.paused) {
        window._beatsAudio.play();
        if (btn) btn.textContent = '⏸';
        if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
    } else {
        window._beatsAudio.pause();
        if (btn) btn.textContent = '▶';
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
    var liked = safeJSON('btc_beats_liked', []);
    var idx = liked.indexOf(trackId);
    if (idx === -1) {
        liked.push(trackId);
        if (btn) { btn.textContent = '❤️'; btn.style.color = '#ef4444'; }
        if (typeof db !== 'undefined') {
            db.collection('beats_tracks').doc(trackId).update({ likes: firebase.firestore.FieldValue.increment(1) }).catch(function() {});
        }
    } else {
        liked.splice(idx, 1);
        if (btn) { btn.textContent = '🤍'; btn.style.color = 'var(--text-faint)'; }
        if (typeof db !== 'undefined') {
            db.collection('beats_tracks').doc(trackId).update({ likes: firebase.firestore.FieldValue.increment(-1) }).catch(function() {});
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

    var overlay = document.createElement('div');
    overlay.id = 'beatsUploadOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.85);display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };
    overlay.innerHTML =
        '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--accent);border-radius:20px;padding:28px;max-width:460px;width:100%;max-height:90vh;overflow-y:auto;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">' +
                '<h3 style="color:var(--heading);font-weight:800;margin:0;">🎵 Upload a Track</h3>' +
                '<button onclick="document.getElementById(\'beatsUploadOverlay\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;">✕</button>' +
            '</div>' +
            '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:4px;">Track Title *</label>' +
            '<input type="text" id="beatsUpTitle" maxlength="100" placeholder="My Bitcoin Song" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +
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
            '<label style="display:block;font-size:0.75rem;color:var(--text-faint);margin-bottom:4px;">Audio File * (MP3, WAV, FLAC, OGG, AAC — max 25MB)</label>' +
            '<input type="file" id="beatsUpFile" accept="audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/flac,audio/ogg,audio/aac,audio/mp4,audio/x-m4a" style="width:100%;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;margin-bottom:12px;box-sizing:border-box;">' +
            '<div id="beatsUpProgress" style="display:none;margin-bottom:12px;">' +
                '<div style="background:var(--border);border-radius:8px;height:6px;overflow:hidden;"><div id="beatsUpBar" style="height:100%;background:var(--accent);width:0%;transition:width 0.3s;"></div></div>' +
                '<div id="beatsUpStatus" style="font-size:0.75rem;color:var(--text-faint);margin-top:4px;">Processing...</div>' +
            '</div>' +
            '<div style="background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:10px;padding:12px;margin-bottom:16px;">' +
                '<label style="display:flex;align-items:flex-start;gap:10px;cursor:pointer;">' +
                    '<input type="checkbox" id="beatsUpCopyright" style="width:18px;height:18px;accent-color:var(--accent);margin-top:2px;flex-shrink:0;">' +
                    '<span style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;">I confirm that I own the rights to this music or have explicit permission from the copyright holder to upload it. I understand that copyrighted material uploaded without authorization will be removed and my account may be suspended.</span>' +
                '</label>' +
            '</div>' +
            '<button onclick="beatsDoUpload()" id="beatsUpBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Upload Track</button>' +
        '</div>';
    document.body.appendChild(overlay);
};

window.beatsDoUpload = function() {
    var title = (document.getElementById('beatsUpTitle').value || '').trim();
    var artist = (document.getElementById('beatsUpArtist').value || '').trim();
    var genre = document.getElementById('beatsUpGenre').value;
    var fileInput = document.getElementById('beatsUpFile');
    var copyrightCheck = document.getElementById('beatsUpCopyright');

    if (!title) { showToast('Please enter a track title'); return; }
    if (!fileInput.files || !fileInput.files[0]) { showToast('Please select an audio file'); return; }
    if (!copyrightCheck.checked) { showToast('You must confirm copyright ownership'); return; }

    var file = fileInput.files[0];
    if (file.size > 25 * 1024 * 1024) { showToast('File too large. Max 25MB.'); return; }
    if (!file.type.match(/audio\/(mpeg|mp3|wav|wave|x-wav|flac|ogg|aac|mp4|x-m4a)/)) { showToast('Unsupported format. Use MP3, WAV, FLAC, OGG, or AAC.'); return; }

    var btn = document.getElementById('beatsUpBtn');
    btn.disabled = true;
    btn.textContent = 'Uploading...';
    document.getElementById('beatsUpProgress').style.display = 'block';
    document.getElementById('beatsUpBar').style.width = '30%';
    document.getElementById('beatsUpStatus').textContent = 'Reading file...';

    var reader = new FileReader();
    reader.onload = function(e) {
        var audioData = e.target.result; // data:audio/mpeg;base64,...
        document.getElementById('beatsUpBar').style.width = '60%';
        document.getElementById('beatsUpStatus').textContent = 'Getting audio duration...';

        // Get duration
        var tempAudio = new Audio(audioData);
        tempAudio.onloadedmetadata = function() {
            var duration = tempAudio.duration || 0;
            document.getElementById('beatsUpBar').style.width = '80%';
            document.getElementById('beatsUpStatus').textContent = 'Saving to archive...';

            var trackData = {
                title: title.substring(0, 100),
                artist: artist.substring(0, 60) || (currentUser ? currentUser.username : 'Anonymous'),
                genre: genre,
                audioData: audioData,
                duration: Math.round(duration),
                authorId: auth.currentUser.uid,
                authorName: currentUser ? currentUser.username : 'Anonymous',
                plays: 0,
                likes: 0,
                copyrightConfirmed: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            db.collection('beats_tracks').add(trackData).then(function() {
                document.getElementById('beatsUpBar').style.width = '100%';
                document.getElementById('beatsUpStatus').textContent = '✅ Upload complete!';
                showToast('🎵 Track uploaded!');
                if (typeof awardPoints === 'function') awardPoints(25, 'Uploaded a track to Bitcoin Beats!');
                setTimeout(function() {
                    var overlay = document.getElementById('beatsUploadOverlay');
                    if (overlay) overlay.remove();
                    beatsLoadTracks(window._beatsCurrentTab);
                }, 1000);
            }).catch(function(err) {
                console.error('Upload error:', err);
                showToast('Upload failed: ' + (err.message || 'Unknown error'));
                btn.disabled = false;
                btn.textContent = 'Upload Track';
            });
        };
        tempAudio.onerror = function() {
            // Can't get duration, upload anyway
            document.getElementById('beatsUpBar').style.width = '80%';
            document.getElementById('beatsUpStatus').textContent = 'Saving...';
            var trackData = {
                title: title.substring(0, 100),
                artist: artist.substring(0, 60) || (currentUser ? currentUser.username : 'Anonymous'),
                genre: genre,
                audioData: audioData,
                duration: 0,
                authorId: auth.currentUser.uid,
                authorName: currentUser ? currentUser.username : 'Anonymous',
                plays: 0,
                likes: 0,
                copyrightConfirmed: true,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };
            db.collection('beats_tracks').add(trackData).then(function() {
                document.getElementById('beatsUpBar').style.width = '100%';
                showToast('🎵 Track uploaded!');
                if (typeof awardPoints === 'function') awardPoints(25, 'Uploaded a track!');
                setTimeout(function() {
                    var overlay = document.getElementById('beatsUploadOverlay');
                    if (overlay) overlay.remove();
                    beatsLoadTracks(window._beatsCurrentTab);
                }, 1000);
            }).catch(function(err) {
                showToast('Upload failed: ' + (err.message || 'Unknown error'));
                btn.disabled = false;
                btn.textContent = 'Upload Track';
            });
        };
    };
    reader.onerror = function() { showToast('Error reading file'); btn.disabled = false; btn.textContent = 'Upload Track'; };
    reader.readAsDataURL(file);
};

// ---- Track menu (report/delete) ----
window.beatsTrackMenu = function(trackId, idx) {
    var track = window._beatsQueue[idx];
    if (!track) return;

    var isOwner = auth && auth.currentUser && track.authorId === auth.currentUser.uid;
    var overlay = document.createElement('div');
    overlay.id = 'beatsMenuOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.7);display:flex;align-items:flex-end;justify-content:center;padding:16px;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var html = '<div style="background:var(--bg-side,#1a1a2e);border:2px solid var(--border);border-radius:20px 20px 0 0;padding:20px;max-width:400px;width:100%;">' +
        '<div style="width:40px;height:4px;background:var(--border);border-radius:2px;margin:0 auto 16px;"></div>' +
        '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;margin-bottom:4px;">' + escapeHtml(track.title || 'Untitled') + '</div>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-bottom:16px;">' + escapeHtml(track.artist || 'Unknown') + '</div>';

    if (isOwner) {
        html += '<button onclick="beatsDeleteTrack(\'' + trackId + '\')" style="width:100%;padding:14px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:12px;color:#ef4444;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;margin-bottom:8px;">🗑️ Delete My Track</button>';
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

// ---- Livestream Tab ----
window.beatsRenderLivestream = function() {
    var listEl = document.getElementById('beatsTrackList');
    if (!listEl) return;

    var tweetUrl = 'https://x.com/Bitcoin_Beats_/status/2009432279760711788?s=20';

    listEl.innerHTML =
        '<div style="text-align:center;animation:fadeSlideIn 0.4s ease-out;">' +
            '<div style="margin-bottom:24px;">' +
                '<div style="display:flex;align-items:center;justify-content:center;gap:12px;margin-bottom:16px;">' +
                    '<span style="padding:4px 12px;background:rgba(239,68,68,0.2);color:#ff4444;border-radius:20px;font-size:0.7rem;font-weight:900;text-transform:uppercase;letter-spacing:1.5px;border:1px solid rgba(239,68,68,0.3);box-shadow:0 0 15px rgba(239,68,68,0.2);">' +
                        '<span style="display:inline-block;width:8px;height:8px;background:#ff4444;border-radius:50%;margin-right:6px;animation:beatsBlink 1s infinite;box-shadow:0 0 8px #ff4444;"></span>' +
                        'LIVE SIGNAL' +
                    '</span>' +
                    '<span style="color:var(--text-muted);font-size:0.9rem;font-weight:500;">Broadcasts & Community Streams</span>' +
                '</div>' +
            '</div>' +

            // Stream embed container
            '<div id="beatsStreamBox" style="background:#020617;border:4px solid transparent;background-image:linear-gradient(#020617, #020617), linear-gradient(135deg, var(--accent) 0%, #ea580c 100%);background-origin:border-box;background-clip:padding-box, border-box;border-radius:24px;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.7), 0 0 30px rgba(247,147,26,0.15);position:relative;margin-bottom:28px;">' +
                // Window dots
                '<div style="position:absolute;top:12px;right:16px;display:flex;gap:5px;z-index:10;">' +
                    '<div style="width:9px;height:9px;border-radius:50%;background:#ff5f57;"></div>' +
                    '<div style="width:9px;height:9px;border-radius:50%;background:#ffbd2e;"></div>' +
                    '<div style="width:9px;height:9px;border-radius:50%;background:#27c93f;"></div>' +
                '</div>' +

                // Embed area
                '<div id="beatsLiveEmbed" style="min-height:450px;display:flex;align-items:center;justify-content:center;background:radial-gradient(circle at center, #0f172a 0%, #020617 100%);padding:20px 0;">' +
                    '<div style="color:var(--text-faint);text-align:center;">' +
                        '<div style="font-size:3.5rem;margin-bottom:16px;animation:beatsPulse 2s infinite;filter:drop-shadow(0 0 12px var(--accent));">🎸</div>' +
                        '<div style="font-weight:800;letter-spacing:2px;font-size:0.95rem;color:var(--text);">CONNECTING TO THE TIMECHAIN...</div>' +
                        '<div style="font-size:0.7rem;margin-top:6px;opacity:0.5;">Est. Sync in 21 blocks</div>' +
                    '</div>' +
                '</div>' +

                // Bottom bar
                '<div style="background:rgba(15,23,42,0.9);backdrop-filter:blur(10px);padding:14px 24px;display:flex;justify-content:space-between;align-items:center;border-top:1px solid rgba(247,147,26,0.2);">' +
                    '<div style="color:var(--heading);font-weight:800;font-size:0.85rem;display:flex;align-items:center;gap:8px;">' +
                        '<span style="font-size:1.1rem;">🎧</span> NOW PLAYING' +
                    '</div>' +
                    '<div style="display:flex;align-items:center;gap:16px;">' +
                        '<div style="color:var(--accent);font-size:0.75rem;font-weight:800;letter-spacing:1px;display:flex;align-items:center;gap:5px;">' +
                            '<span style="display:flex;gap:2px;align-items:flex-end;height:12px;">' +
                                '<div style="width:2px;height:60%;background:currentColor;animation:beatsEqualizer 0.8s infinite alternate;"></div>' +
                                '<div style="width:2px;height:100%;background:currentColor;animation:beatsEqualizer 1.1s infinite alternate;"></div>' +
                                '<div style="width:2px;height:40%;background:currentColor;animation:beatsEqualizer 0.9s infinite alternate;"></div>' +
                            '</span>' +
                            'SYNC: 100%' +
                        '</div>' +
                        '<button onclick="window.open(\'https://x.com/Bitcoin_Beats_\',\'_blank\')" style="background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;padding:7px 16px;border-radius:10px;font-size:0.75rem;font-weight:900;cursor:pointer;font-family:inherit;box-shadow:0 4px 12px rgba(247,147,26,0.3);">Follow for Lives</button>' +
                    '</div>' +
                '</div>' +
            '</div>' +

            // Music platform links
            '<div style="padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;text-align:center;">' +
                '<h3 style="color:var(--heading);font-weight:800;font-size:0.95rem;margin-bottom:14px;">Support our friends with great Bitcoin Lightning music platforms!</h3>' +
                '<div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;">' +
                    '<a href="https://www.twitch.tv/noderunnersradio" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:linear-gradient(135deg,rgba(247,147,26,0.15),rgba(247,147,26,0.05));border:1px solid rgba(247,147,26,0.3);border-radius:12px;color:var(--accent);font-weight:700;font-size:0.9rem;text-decoration:none;transition:0.2s;">📻 Noderunners Radio</a>' +
                    '<a href="https://wavlake.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:linear-gradient(135deg,rgba(139,92,246,0.15),rgba(139,92,246,0.05));border:1px solid rgba(139,92,246,0.3);border-radius:12px;color:#8b5cf6;font-weight:700;font-size:0.9rem;text-decoration:none;transition:0.2s;">🎵 Wavlake</a>' +
                    '<a href="https://lnbeats.com" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:8px;padding:12px 20px;background:linear-gradient(135deg,rgba(234,179,8,0.15),rgba(234,179,8,0.05));border:1px solid rgba(234,179,8,0.3);border-radius:12px;color:#eab308;font-weight:700;font-size:0.9rem;text-decoration:none;transition:0.2s;">⚡ LN Beats</a>' +
                '</div>' +
            '</div>' +
        '</div>' +

        // Animations
        '<style>' +
            '@keyframes beatsPulse { 0% { opacity: 0.3; transform: scale(0.95); } 50% { opacity: 1; transform: scale(1.05); } 100% { opacity: 0.3; transform: scale(0.95); } }' +
            '@keyframes beatsBlink { 0% { opacity: 1; } 50% { opacity: 0.4; } 100% { opacity: 1; } }' +
            '@keyframes beatsEqualizer { 0% { height: 20%; } 100% { height: 100%; } }' +
        '</style>';

    // Load the X/Twitter embed after a short delay
    setTimeout(function() {
        var embedArea = document.getElementById('beatsLiveEmbed');
        if (!embedArea) return;

        embedArea.innerHTML = '<blockquote class="twitter-tweet" data-theme="dark" data-align="center" data-width="500"><a href="' + tweetUrl + '"></a></blockquote>';

        if (!window.twttr) {
            var script = document.createElement('script');
            script.id = 'twitter-wjs';
            script.src = 'https://platform.twitter.com/widgets.js';
            script.charset = 'utf-8';
            script.async = true;
            document.head.appendChild(script);
        } else {
            window.twttr.widgets.load(embedArea);
        }

        // Fallback if embed doesn't load after 10s
        setTimeout(function() {
            var embed = document.getElementById('beatsLiveEmbed');
            if (embed && embed.querySelector('.twitter-tweet') && !embed.querySelector('iframe')) {
                embed.innerHTML =
                    '<div style="padding:40px;text-align:center;">' +
                        '<div style="font-size:2rem;margin-bottom:12px;">📡</div>' +
                        '<div style="color:var(--text);font-weight:700;margin-bottom:8px;">Stream loading...</div>' +
                        '<a href="' + tweetUrl + '" target="_blank" rel="noopener" style="color:var(--accent);font-weight:600;text-decoration:none;">Open on 𝕏 →</a>' +
                    '</div>';
            }
        }, 10000);
    }, 300);
};

// ---- Comments System ----
window.beatsShowComments = function(trackId) {
    if (!trackId) {
        // Use currently playing track
        var current = window._beatsQueue[window._beatsQueueIdx];
        if (!current) { showToast('No track selected'); return; }
        trackId = current.id;
    }

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
            '<div style="font-weight:700;font-size:0.85rem;color:var(--heading);">💬 Comments' + (track ? ' — ' + '<span style="color:var(--accent);font-weight:600;">' + escapeHtml((track.title || 'Untitled').substring(0, 30)) + '</span>' : '') + '</div>' +
            '<button onclick="document.getElementById(\'beatsCommentsPanel\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:4px;">✕</button>' +
        '</div>' +
        '<div id="beatsCommentsList" style="flex:1;overflow-y:auto;padding:12px 16px;min-height:80px;">' +
            '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Loading comments...</div>' +
        '</div>' +
        '<div style="padding:10px 16px;border-top:1px solid rgba(255,255,255,0.06);display:flex;gap:8px;flex-shrink:0;">' +
            '<input type="text" id="beatsCommentInput" maxlength="280" placeholder="Leave a comment..." style="flex:1;padding:10px 14px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:10px;color:#fff;font-size:0.85rem;font-family:inherit;outline:none;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')beatsPostComment(\'' + trackId + '\')" onfocus="this.style.borderColor=\'var(--accent)\'" onblur="this.style.borderColor=\'rgba(255,255,255,0.1)\'">' +
            '<button onclick="beatsPostComment(\'' + trackId + '\')" style="padding:10px 16px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;white-space:nowrap;">Send</button>' +
        '</div>';

    document.body.appendChild(panel);

    // Adjust position based on screen — on desktop no bottom nav
    var mq = window.matchMedia('(min-width:901px)');
    if (mq.matches) panel.style.bottom = '56px'; // just above player

    // Load comments
    beatsLoadComments(trackId);
};

window.beatsLoadComments = function(trackId) {
    var listEl = document.getElementById('beatsCommentsList');
    if (!listEl || typeof db === 'undefined') return;

    db.collection('beats_tracks').doc(trackId).collection('comments')
        .orderBy('createdAt', 'desc').limit(50).get()
        .then(function(snap) {
            if (snap.empty) {
                listEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">No comments yet. Be the first! 🎵</div>';
                return;
            }
            var html = '';
            snap.forEach(function(doc) {
                var c = doc.data();
                var timeStr = c.createdAt ? timeAgo(c.createdAt) : '';
                html += '<div style="display:flex;gap:10px;margin-bottom:12px;align-items:flex-start;">' +
                    '<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#1e293b,#334155);display:flex;align-items:center;justify-content:center;font-size:0.7rem;flex-shrink:0;color:var(--accent);font-weight:700;">' + (c.authorName ? c.authorName.charAt(0).toUpperCase() : '?') + '</div>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:2px;">' +
                            '<span style="color:var(--heading);font-weight:700;font-size:0.8rem;">' + escapeHtml(c.authorName || 'Anonymous') + '</span>' +
                            '<span style="color:var(--text-faint);font-size:0.65rem;">' + timeStr + '</span>' +
                        '</div>' +
                        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.4;word-break:break-word;">' + escapeHtml(c.text || '') + '</div>' +
                    '</div>' +
                '</div>';
            });
            listEl.innerHTML = html;
        })
        .catch(function(e) {
            console.error('Load comments error:', e);
            listEl.innerHTML = '<div style="text-align:center;color:var(--text-faint);font-size:0.8rem;padding:20px;">Error loading comments</div>';
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
            }
        }
        // Increment comment count on track
        db.collection('beats_tracks').doc(trackId).update({
            commentCount: firebase.firestore.FieldValue.increment(1)
        }).catch(function() {});
    }).catch(function(e) {
        console.error('Post comment error:', e);
        showToast('Error posting comment');
        input.disabled = false;
    });
};

// ---- Helpers ----
window.beatsFormatTime = function(secs) {
    if (!secs || isNaN(secs)) return '0:00';
    var m = Math.floor(secs / 60);
    var s = Math.floor(secs % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
};
