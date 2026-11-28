// Cloudflare Stream player for Bitcoin Quest Originals.
// YouTube embeds stay on Timechain TV and never set source to "stream".
(function () {
    'use strict';

    var SDK_SRC = 'https://embed.cloudflarestream.com/embed/sdk.latest.js';
    var sdkLoading = false;
    var sdkCallbacks = [];

    function loadSdk(done) {
        if (window.Stream) {
            done(null);
            return;
        }
        sdkCallbacks.push(done);
        if (sdkLoading) return;
        sdkLoading = true;
        var s = document.createElement('script');
        s.src = SDK_SRC;
        s.async = true;
        s.onload = function () {
            sdkLoading = false;
            var err = window.Stream ? null : new Error('Stream SDK missing');
            while (sdkCallbacks.length) sdkCallbacks.shift()(err);
        };
        s.onerror = function () {
            sdkLoading = false;
            var err = new Error('Stream SDK failed');
            while (sdkCallbacks.length) sdkCallbacks.shift()(err);
        };
        document.head.appendChild(s);
    }

    function bindPlayer(player, videoId) {
        window._tctvStreamPlayer = player;
        window._tctvCurrentSource = 'stream';
        window._tctvCurrentVideoId = videoId || '';
        function sync() {
            try {
                if (typeof player.muted === 'boolean') window._tctvStreamMuted = player.muted;
                if (typeof player.volume === 'number') window._tctvStreamVolume = player.volume;
                if (typeof player.playbackRate === 'number') window._tctvStreamRate = player.playbackRate;
                if (typeof player.paused === 'boolean') window._tctvStreamPaused = player.paused;
            } catch (e) {}
        }
        ['play', 'pause', 'volumechange', 'ratechange', 'ended'].forEach(function (ev) {
            try {
                if (typeof player.addEventListener === 'function') player.addEventListener(ev, sync);
            } catch (e) {}
        });
        sync();
    }

    window._tctvClearOriginalsPlayer = function () {
        window._tctvStreamPlayer = null;
        if (window._tctvCurrentSource === 'stream') {
            window._tctvCurrentSource = '';
            window._tctvCurrentVideoId = '';
        }
    };

    // Mount a Stream iframe for an allowlisted Original. Never used for YouTube ids.
    window._tctvMountOriginal = function (videoId, iframe) {
        var originals = window._tctvOriginals;
        if (!originals || !originals.isOriginal(videoId) || !iframe) return;
        loadSdk(function (err) {
            if (err || !window.Stream) {
                if (typeof window._tctvRewardNote === 'function') {
                    window._tctvRewardNote({
                        text: 'Watch credit needs the Originals player. Tap to retry',
                        onRetry: function () { window._tctvMountOriginal(videoId, iframe); }
                    });
                }
                return;
            }
            try {
                var player = window.Stream(iframe);
                bindPlayer(player, videoId);
                if (typeof window._tctvRewardNote === 'function') window._tctvRewardNote({ text: '' });
            } catch (e) {
                if (typeof window._tctvRewardNote === 'function') {
                    window._tctvRewardNote({
                        text: 'Watch credit needs the Originals player. Tap to retry',
                        onRetry: function () { window._tctvMountOriginal(videoId, iframe); }
                    });
                }
            }
        });
    };
})();
