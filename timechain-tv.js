// © 2024-2026 603BTC LLC. All rights reserved.
// timechain-tv.js — Timechain TV: Live Bitcoin Television
// All users watch the same content at the same time — no rewind, no fast forward.

(function() {
'use strict';

// ── Station Definitions ──
// Each station is a "channel" with a themed playlist of YouTube videos
// Videos play in order, looping forever, synced to global clock
var STATIONS = [
    {
        id: 'tutorials',
        name: 'Tutorials',
        emoji: '📚',
        desc: 'Learn Bitcoin step by step',
        color: '#f7931a',
        videos: [
            // { id: 'YOUTUBE_ID', title: 'Video Title', duration: SECONDS },
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
            { id: '41JCpzvnn_0', title: 'Placeholder 2', duration: 180 },
        ]
    },
    {
        id: 'mining',
        name: 'Mining',
        emoji: '⛏️',
        desc: 'How Bitcoin mining works',
        color: '#ea580c',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    },
    {
        id: 'documentaries',
        name: 'Documentaries',
        emoji: '🎬',
        desc: 'Bitcoin documentaries & films',
        color: '#dc2626',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    },
    {
        id: 'economics',
        name: 'Economics',
        emoji: '💰',
        desc: 'Money, inflation & Austrian economics',
        color: '#eab308',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    },
    {
        id: 'lightning',
        name: 'Lightning',
        emoji: '⚡',
        desc: 'Lightning Network & Layer 2',
        color: '#8b5cf6',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    },
    {
        id: 'privacy',
        name: 'Privacy',
        emoji: '🔒',
        desc: 'Privacy, security & self-custody',
        color: '#22c55e',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    },
    {
        id: 'culture',
        name: 'Culture',
        emoji: '🟠',
        desc: 'Bitcoin culture, memes & community',
        color: '#f97316',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    },
    {
        id: 'developers',
        name: 'Dev',
        emoji: '💻',
        desc: 'Building on Bitcoin',
        color: '#6366f1',
        videos: [
            { id: 'dQw4w9WgXcQ', title: 'Placeholder — Replace with real video', duration: 212 },
        ]
    }
];

// ── Global Clock Engine ──
// Given current time, calculate which video + offset for a station
function getPlaybackState(station) {
    var totalDuration = 0;
    for (var i = 0; i < station.videos.length; i++) {
        totalDuration += station.videos[i].duration;
    }
    if (totalDuration === 0) return { videoIndex: 0, offset: 0, video: station.videos[0] };

    // Position in the loop based on Unix timestamp (seconds)
    var globalSec = Math.floor(Date.now() / 1000);
    var position = globalSec % totalDuration;

    // Find which video we're in
    var elapsed = 0;
    for (var j = 0; j < station.videos.length; j++) {
        if (position < elapsed + station.videos[j].duration) {
            return {
                videoIndex: j,
                offset: position - elapsed,
                video: station.videos[j],
                remaining: station.videos[j].duration - (position - elapsed),
                totalDuration: totalDuration,
                position: position
            };
        }
        elapsed += station.videos[j].duration;
    }
    return { videoIndex: 0, offset: 0, video: station.videos[0] };
}

// ── Viewer Counting ──
var _viewerUnsub = null;
var _currentStation = null;
var _viewerDocRef = null;
var _viewerCounts = {};

function joinStation(stationId) {
    leaveStation();
    _currentStation = stationId;

    if (typeof firebase !== 'undefined' && firebase.firestore) {
        var db = firebase.firestore();
        _viewerDocRef = db.collection('timechain_viewers').doc(stationId);

        // Increment viewer count
        _viewerDocRef.set({
            count: firebase.firestore.FieldValue.increment(1),
            lastUpdate: firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true }).catch(function() {});

        // Listen for viewer count changes across all stations
        if (!_viewerUnsub) {
            _viewerUnsub = db.collection('timechain_viewers').onSnapshot(function(snap) {
                snap.forEach(function(doc) {
                    _viewerCounts[doc.id] = doc.data().count || 0;
                });
                updateViewerBadges();
            });
        }
    }
}

function leaveStation() {
    if (_currentStation && _viewerDocRef) {
        _viewerDocRef.set({
            count: firebase.firestore.FieldValue.increment(-1)
        }, { merge: true }).catch(function() {});
    }
    _currentStation = null;
    _viewerDocRef = null;
}

function updateViewerBadges() {
    STATIONS.forEach(function(s) {
        var el = document.getElementById('tctv-viewers-' + s.id);
        if (el) {
            var count = _viewerCounts[s.id] || 0;
            el.textContent = count > 0 ? count + ' watching' : '';
        }
    });
    // Also update main viewer count
    var mainCount = document.getElementById('tctv-main-viewers');
    if (mainCount && _currentStation) {
        var c = _viewerCounts[_currentStation] || 0;
        mainCount.textContent = c > 0 ? '👁 ' + c + ' live' : '';
    }
}

// ── White Noise Loading Screen ──
function showWhiteNoise(callback) {
    var overlay = document.createElement('div');
    overlay.id = 'tctvNoise';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:200000;background:#000;display:flex;align-items:center;justify-content:center;flex-direction:column;';

    // Canvas for static noise
    var canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 240;
    canvas.style.cssText = 'width:100%;height:100%;object-fit:cover;position:absolute;inset:0;opacity:0.6;';
    overlay.appendChild(canvas);

    // Title overlay
    var title = document.createElement('div');
    title.style.cssText = 'position:relative;z-index:2;text-align:center;';
    title.innerHTML = '<div style="font-size:2.5rem;font-weight:900;color:#f7931a;text-shadow:0 0 30px rgba(247,147,26,0.5);letter-spacing:4px;margin-bottom:8px;">TIMECHAIN TV</div>' +
        '<div style="font-size:0.85rem;color:#888;letter-spacing:2px;">TUNING IN...</div>';
    overlay.appendChild(title);

    document.body.appendChild(overlay);

    // Animate static noise
    var ctx = canvas.getContext('2d');
    var noiseInterval = setInterval(function() {
        var imgData = ctx.createImageData(canvas.width, canvas.height);
        var data = imgData.data;
        for (var i = 0; i < data.length; i += 4) {
            var v = Math.random() * 255;
            data[i] = v;
            data[i + 1] = v;
            data[i + 2] = v;
            data[i + 3] = 255;
        }
        ctx.putImageData(imgData, 0, 0);
    }, 50);

    // White noise audio
    var audioCtx = null;
    var noiseNode = null;
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        var bufferSize = audioCtx.sampleRate * 0.5; // 0.5 seconds
        var buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        var channelData = buffer.getChannelData(0);
        for (var s = 0; s < bufferSize; s++) {
            channelData[s] = Math.random() * 2 - 1;
        }
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.loop = true;
        var gain = audioCtx.createGain();
        gain.gain.value = 0.08;
        noiseNode.connect(gain);
        gain.connect(audioCtx.destination);
        noiseNode.start();
    } catch(e) {}

    // Fade out after 1.5s
    setTimeout(function() {
        overlay.style.transition = 'opacity 0.5s';
        overlay.style.opacity = '0';
        if (noiseNode) { try { noiseNode.stop(); } catch(e) {} }
        if (audioCtx) { try { audioCtx.close(); } catch(e) {} }
        setTimeout(function() {
            clearInterval(noiseInterval);
            overlay.remove();
            if (callback) callback();
        }, 500);
    }, 1500);
}

// ── YouTube Player ──
var _player = null;
var _playerReady = false;
var _currentVideoId = null;
var _syncInterval = null;
var _channelSwitchTimer = null;

function loadYouTubeAPI() {
    if (window.YT && window.YT.Player) return;
    if (document.getElementById('yt-api-script')) return;
    var tag = document.createElement('script');
    tag.id = 'yt-api-script';
    tag.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(tag);
}

function createPlayer(containerId, videoId, startSeconds) {
    if (_player) {
        try { _player.destroy(); } catch(e) {}
        _player = null;
    }
    _playerReady = false;
    _currentVideoId = videoId;

    _player = new YT.Player(containerId, {
        videoId: videoId,
        playerVars: {
            start: Math.floor(startSeconds),
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            iv_load_policy: 3,
            fs: 0,
            playsinline: 1,
            disablekb: 1,
            origin: window.location.origin
        },
        events: {
            onReady: function(e) {
                _playerReady = true;
                e.target.playVideo();
            },
            onStateChange: function(e) {
                // If video ended, sync to next video
                if (e.data === YT.PlayerState.ENDED) {
                    syncPlayer();
                }
            }
        }
    });
}

function syncPlayer() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;

    var state = getPlaybackState(station);
    if (!state.video) return;

    // Update now playing info
    var nowPlaying = document.getElementById('tctv-now-playing');
    if (nowPlaying) {
        nowPlaying.textContent = state.video.title;
    }
    var timeLeft = document.getElementById('tctv-time-left');
    if (timeLeft) {
        var mins = Math.floor(state.remaining / 60);
        var secs = state.remaining % 60;
        timeLeft.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs + ' left';
    }

    // Check if we need to switch videos
    if (state.video.id !== _currentVideoId) {
        if (_player && _playerReady) {
            _player.loadVideoById({ videoId: state.video.id, startSeconds: state.offset });
            _currentVideoId = state.video.id;
        }
    }
}

// ── Timeline Bar ──
function updateTimeline() {
    if (!_currentStation) return;
    var station = STATIONS.find(function(s) { return s.id === _currentStation; });
    if (!station) return;
    var state = getPlaybackState(station);

    // Update progress within current video
    var bar = document.getElementById('tctv-progress');
    if (bar && state.video) {
        var pct = ((state.video.duration - state.remaining) / state.video.duration) * 100;
        bar.style.width = pct + '%';
    }

    // Update time display
    var timeLeft = document.getElementById('tctv-time-left');
    if (timeLeft) {
        var mins = Math.floor(state.remaining / 60);
        var secs = state.remaining % 60;
        timeLeft.textContent = mins + ':' + (secs < 10 ? '0' : '') + secs;
    }

    // Check for video transition
    if (state.video && state.video.id !== _currentVideoId) {
        syncPlayer();
    }
}

// ── Main Render ──
window.renderTimechainTV = function() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    loadYouTubeAPI();

    // Default to first station
    var activeStation = _currentStation || STATIONS[0].id;

    var html = '<div style="background:#0a0a0a;min-height:100vh;color:#fff;font-family:inherit;">';

    // Header bar
    html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:10px 16px;background:#111;border-bottom:1px solid rgba(247,147,26,0.3);">';
    html += '<div onclick="goHome()" style="cursor:pointer;display:flex;align-items:center;gap:8px;">';
    html += '<span style="color:var(--text-muted);font-size:0.8rem;">←</span>';
    html += '<span style="color:#f7931a;font-weight:900;font-size:1rem;letter-spacing:2px;">TIMECHAIN TV</span>';
    html += '</div>';
    html += '<div style="display:flex;align-items:center;gap:8px;">';
    html += '<span id="tctv-main-viewers" style="font-size:0.7rem;color:#22c55e;font-weight:600;"></span>';
    html += '<span style="width:8px;height:8px;background:#ef4444;border-radius:50%;display:inline-block;box-shadow:0 0 6px #ef4444;"></span>';
    html += '<span style="color:#ef4444;font-size:0.7rem;font-weight:800;letter-spacing:1px;">LIVE</span>';
    html += '</div></div>';

    // Video player area
    html += '<div style="position:relative;width:100%;aspect-ratio:16/9;background:#000;overflow:hidden;">';
    html += '<div id="tctv-player" style="width:100%;height:100%;"></div>';
    html += '</div>';

    // Now playing bar
    html += '<div style="padding:10px 16px;background:#161616;border-bottom:1px solid #222;display:flex;justify-content:space-between;align-items:center;">';
    html += '<div style="flex:1;min-width:0;">';
    html += '<div style="font-size:0.65rem;color:#f7931a;font-weight:700;text-transform:uppercase;letter-spacing:1px;">NOW PLAYING</div>';
    html += '<div id="tctv-now-playing" style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:#ddd;">Loading...</div>';
    html += '</div>';
    html += '<div id="tctv-time-left" style="font-size:0.75rem;color:#888;font-weight:600;flex-shrink:0;margin-left:12px;font-variant-numeric:tabular-nums;"></div>';
    html += '</div>';

    // Progress bar
    html += '<div style="height:3px;background:#222;"><div id="tctv-progress" style="height:100%;background:#f7931a;width:0%;transition:width 1s linear;"></div></div>';

    // Channel guide
    html += '<div style="padding:12px 16px 8px;"><div style="font-size:0.65rem;color:#666;font-weight:700;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:10px;">CHANNELS</div></div>';

    html += '<div style="display:flex;flex-direction:column;gap:2px;padding:0 8px 120px;">';
    STATIONS.forEach(function(s) {
        var isActive = s.id === activeStation;
        var state = getPlaybackState(s);
        var pct = state.video ? Math.round(((state.video.duration - state.remaining) / state.video.duration) * 100) : 0;

        html += '<div onclick="switchStation(\'' + s.id + '\')" style="display:flex;align-items:center;gap:12px;padding:12px 14px;border-radius:10px;cursor:pointer;transition:0.2s;background:' + (isActive ? 'rgba(247,147,26,0.1)' : 'transparent') + ';border:1px solid ' + (isActive ? 'rgba(247,147,26,0.3)' : 'transparent') + ';" onmouseover="this.style.background=\'' + (isActive ? 'rgba(247,147,26,0.15)' : 'rgba(255,255,255,0.03)') + '\'" onmouseout="this.style.background=\'' + (isActive ? 'rgba(247,147,26,0.1)' : 'transparent') + '\'">';

        // Station icon
        html += '<div style="width:44px;height:44px;border-radius:10px;background:' + s.color + '20;border:1px solid ' + s.color + '40;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">' + s.emoji + '</div>';

        // Station info
        html += '<div style="flex:1;min-width:0;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;">';
        html += '<div style="font-weight:700;font-size:0.85rem;color:' + (isActive ? '#f7931a' : '#ddd') + ';">' + s.name + '</div>';
        html += '<span id="tctv-viewers-' + s.id + '" style="font-size:0.6rem;color:#22c55e;font-weight:600;"></span>';
        html += '</div>';
        html += '<div style="font-size:0.72rem;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (state.video ? state.video.title : s.desc) + '</div>';
        // Mini progress bar
        html += '<div style="height:2px;background:#222;border-radius:1px;margin-top:4px;overflow:hidden;"><div style="height:100%;background:' + s.color + ';width:' + pct + '%;transition:width 1s linear;"></div></div>';
        html += '</div>';

        // Live indicator for active
        if (isActive) {
            html += '<div style="width:8px;height:8px;background:#ef4444;border-radius:50%;box-shadow:0 0 6px #ef4444;flex-shrink:0;"></div>';
        }

        html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    fc.innerHTML = html;

    // Start playback
    showWhiteNoise(function() {
        _currentStation = activeStation;
        joinStation(activeStation);

        // Wait for YouTube API
        function initPlayer() {
            if (window.YT && window.YT.Player) {
                var station = STATIONS.find(function(s) { return s.id === activeStation; });
                if (station) {
                    var state = getPlaybackState(station);
                    if (state.video) {
                        createPlayer('tctv-player', state.video.id, state.offset);
                        var np = document.getElementById('tctv-now-playing');
                        if (np) np.textContent = state.video.title;
                    }
                }
                // Sync every second
                if (_syncInterval) clearInterval(_syncInterval);
                _syncInterval = setInterval(updateTimeline, 1000);
            } else {
                setTimeout(initPlayer, 500);
            }
        }
        initPlayer();
    });
};

// ── Channel Switching ──
window.switchStation = function(stationId) {
    if (stationId === _currentStation) return;

    leaveStation();
    _currentStation = stationId;
    joinStation(stationId);

    var station = STATIONS.find(function(s) { return s.id === stationId; });
    if (!station) return;

    var state = getPlaybackState(station);
    if (state.video && _player && _playerReady) {
        _player.loadVideoById({ videoId: state.video.id, startSeconds: state.offset });
        _currentVideoId = state.video.id;
    }

    // Update now playing
    var np = document.getElementById('tctv-now-playing');
    if (np && state.video) np.textContent = state.video.title;

    // Update channel guide highlighting
    renderTimechainTV();
};

// ── Cleanup ──
window.cleanupTimechainTV = function() {
    leaveStation();
    if (_syncInterval) { clearInterval(_syncInterval); _syncInterval = null; }
    if (_viewerUnsub) { _viewerUnsub(); _viewerUnsub = null; }
    if (_player) { try { _player.destroy(); } catch(e) {} _player = null; }
    _playerReady = false;
    _currentVideoId = null;
};

// Handle leaving the page
window.addEventListener('pagehide', function() { leaveStation(); });
window.addEventListener('beforeunload', function() { leaveStation(); });

// YouTube API callback
window.onYouTubeIframeAPIReady = window.onYouTubeIframeAPIReady || function() {};

console.log('[TIMECHAIN TV] Module loaded — ' + STATIONS.length + ' stations');
})();
