// ==========================================
// PROOF OF PLAY
// Bitcoin gaming hub: Timechain Arcade + PVP Battle
// ==========================================

(function() {
'use strict';

var _popActive = false;

// Safe thumbnail error handler — avoids escaped-quote HTML injection issues
window._popThumbErr = function(img) {
    try {
        var fb = img.getAttribute('data-fb') || '🎮';
        img.style.display = 'none';
        var div = document.createElement('div');
        div.className = 'pop-game-thumb-fallback';
        div.textContent = fb;
        if (img.parentNode) img.parentNode.insertBefore(div, img);
    } catch(e) {}
};


// Safe https-only URL check. Rejects anything that is not an absolute https URL.
function _popSafeHttpsUrl(raw) {
    if (typeof raw !== 'string') return '';
    var trimmed = raw.trim();
    if (!/^https:\/\//i.test(trimmed)) return '';
    try {
        var u = new URL(trimmed);
        if (u.protocol !== 'https:') return '';
        if (u.username || u.password) return '';
        return u.href;
    } catch (e) {
        return '';
    }
}

function _popOpenOutside(url) {
    var safe = _popAllowedExternalUrl(url);
    if (!safe) return null;
    var win = window.open(safe, '_blank', 'noopener,noreferrer');
    if (win) {
        try { win.opener = null; } catch (e) {}
    }
    return win;
}

function _popExternalAnchor(url, text) {
    var a = document.createElement('a');
    var safe = _popAllowedExternalUrl(url);
    if (safe) {
        a.setAttribute('href', safe);
        a.setAttribute('target', '_blank');
        a.setAttribute('rel', 'noopener noreferrer');
    }
    if (text != null && text !== '') a.textContent = text;
    return a;
}

// Embed allowlist: iframe src must start with this exact prefix after https normalization.
var POP_SAT_ARCADE_PREFIX = 'https://ck121212195.github.io/SAT-ARCADE/';
var POP_SAT_ARCADE_URL = POP_SAT_ARCADE_PREFIX;
var POP_EMBED_SANDBOX = 'allow-scripts allow-same-origin';
var POP_EMBED_ALLOW = 'fullscreen';

// Outside links (new tab) must match one of these hosts exactly, https only.
// The approved Sat Arcade prefix may also open in a new tab (Full Tab).
var POP_EXTERNAL_HOSTS = {
    'timechainarcade.com': true,
    'galaxymind.space': true,
    'ryracer.com': true
};

var _popLiveIframe = null;
var _popKeydownBound = false;
var _popHashBound = false;

function _popAllowedEmbedUrl(raw) {
    var safe = _popSafeHttpsUrl(raw);
    if (!safe) return '';
    if (safe.indexOf(POP_SAT_ARCADE_PREFIX) !== 0) return '';
    return safe;
}

function _popAllowedExternalUrl(raw) {
    var safe = _popSafeHttpsUrl(raw);
    if (!safe) return '';
    if (safe.indexOf(POP_SAT_ARCADE_PREFIX) === 0) return safe;
    try {
        var host = new URL(safe).hostname;
        if (Object.prototype.hasOwnProperty.call(POP_EXTERNAL_HOSTS, host) && POP_EXTERNAL_HOSTS[host]) {
            return safe;
        }
    } catch (e) {}
    return '';
}

// Embed iframe for Sat Arcade only. Created on Play tap. src is left unset until start.
function _popCreateEmbedIframe(url) {
    var safe = _popAllowedEmbedUrl(url);
    if (!safe) return null;
    var iframe = document.createElement('iframe');
    iframe.setAttribute('sandbox', POP_EMBED_SANDBOX);
    iframe.setAttribute('allow', POP_EMBED_ALLOW);
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('referrerpolicy', 'no-referrer');
    iframe.setAttribute('data-pop-embed-src', safe);
    iframe.style.cssText = 'flex:1;width:100%;border:none;display:block;background:#000;';
    return iframe;
}

function _popStartEmbed(iframe) {
    if (!iframe) return false;
    var safe = _popAllowedEmbedUrl(iframe.getAttribute('data-pop-embed-src') || '');
    if (!safe) return false;
    iframe.src = safe;
    _popLiveIframe = iframe;
    return true;
}

// Blank the frame first, then remove it from the DOM. Never leave it hidden.
function _popDestroyEmbed(iframe) {
    if (!iframe) return;
    try { iframe.src = 'about:blank'; } catch (e) {}
    try { iframe.removeAttribute('data-pop-embed-src'); } catch (e2) {}
    var parent = iframe.parentNode;
    if (parent && typeof parent.removeChild === 'function') {
        try { parent.removeChild(iframe); } catch (e3) {
            try { if (typeof iframe.remove === 'function') iframe.remove(); } catch (e4) {}
        }
    } else if (typeof iframe.remove === 'function') {
        try { iframe.remove(); } catch (e5) {}
    }
    if (_popLiveIframe === iframe) _popLiveIframe = null;
}

function _popCollectIframes(root, out) {
    if (!root) return;
    if (root.tagName && String(root.tagName).toLowerCase() === 'iframe') {
        if (out.indexOf(root) === -1) out.push(root);
    }
    if (typeof root.querySelectorAll === 'function') {
        try {
            var list = root.querySelectorAll('iframe');
            if (list) {
                for (var i = 0; i < list.length; i++) {
                    if (out.indexOf(list[i]) === -1) out.push(list[i]);
                }
            }
        } catch (e) {}
    }
    var kids = root.childNodes || root.children;
    if (kids && kids.length && typeof root.querySelectorAll !== 'function') {
        for (var j = 0; j < kids.length; j++) _popCollectIframes(kids[j], out);
    }
}

function _popDestroyAllEmbeds(root) {
    var seen = [];
    if (_popLiveIframe) seen.push(_popLiveIframe);
    _popCollectIframes(root || document, seen);
    try {
        if (typeof document.getElementById === 'function') {
            _popCollectIframes(document.getElementById('popOverlay'), seen);
            _popCollectIframes(document.getElementById('popBody'), seen);
        }
    } catch (e) {}
    for (var i = 0; i < seen.length; i++) _popDestroyEmbed(seen[i]);
    _popLiveIframe = null;
}

function _popOnKeydown(e) {
    if (!_popActive) return;
    if (!e) return;
    var key = e.key;
    if (key === 'Escape' || key === 'Esc') {
        if (typeof e.preventDefault === 'function') e.preventDefault();
        window.exitProofOfPlay();
    }
}

function _popOnRouteChange() {
    if (!_popActive) return;
    var h = '';
    try { h = String((window.location && window.location.hash) || '').replace(/^#/, ''); } catch (e) {}
    if (h === 'proof-of-play' || h === 'proof-of-play-pvp' || h.indexOf('proof-of-play/') === 0) return;
    window.exitProofOfPlay();
}

function _popBindCloseListeners() {
    if (!_popKeydownBound) {
        document.addEventListener('keydown', _popOnKeydown, true);
        _popKeydownBound = true;
    }
    if (!_popHashBound) {
        window.addEventListener('hashchange', _popOnRouteChange);
        _popHashBound = true;
    }
}

function _popUnbindCloseListeners() {
    if (_popKeydownBound) {
        try { document.removeEventListener('keydown', _popOnKeydown, true); } catch (e) {}
        _popKeydownBound = false;
    }
    if (_popHashBound) {
        try { window.removeEventListener('hashchange', _popOnRouteChange); } catch (e2) {}
        _popHashBound = false;
    }
    try { window.removeEventListener('popstate', _popHandlePop); } catch (e3) {}
}

function _popBuildArcadeCard(game) {
    game = game || {};
    var card = document.createElement('div');
    card.className = 'pop-game-card' + (game.hot ? ' hot' : '');
    var url = _popAllowedExternalUrl(game.url);

    var thumbUrl = _popAllowedExternalUrl(game.thumb || '');
    if (thumbUrl) {
        var img = document.createElement('img');
        img.className = 'pop-game-thumb';
        img.setAttribute('src', thumbUrl);
        img.setAttribute('alt', '');
        img.setAttribute('data-fb', game.thumbFallback || '\uD83C\uDFAE');
        img.addEventListener('error', function() { window._popThumbErr(img); });
        card.appendChild(img);
    } else {
        var fb = document.createElement('div');
        fb.className = 'pop-game-thumb-fallback';
        fb.textContent = game.thumbFallback || '\uD83C\uDFAE';
        card.appendChild(fb);
    }

    var info = document.createElement('div');
    info.className = 'pop-game-info';

    var titleEl = document.createElement('div');
    titleEl.className = 'pop-game-title';
    titleEl.textContent = game.title || '';
    info.appendChild(titleEl);

    var meta = document.createElement('div');
    meta.className = 'pop-game-meta';
    var genre = document.createElement('span');
    genre.className = 'pop-game-tag';
    genre.textContent = game.genre || '';
    var players = document.createElement('span');
    players.className = 'pop-game-tag';
    players.textContent = game.players || '';
    meta.appendChild(genre);
    meta.appendChild(players);
    info.appendChild(meta);

    var desc = document.createElement('div');
    desc.className = 'pop-game-desc';
    desc.textContent = game.desc || '';
    info.appendChild(desc);

    var label = document.createElement('div');
    label.className = 'pop-open-label';
    label.textContent = 'Opens outside BQ';
    info.appendChild(label);

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'pop-game-play-btn';
    btn.textContent = 'Opens outside BQ';
    if (url) {
        card.addEventListener('click', function() { _popOpenOutside(url); });
        btn.addEventListener('click', function(e) {
            e.stopPropagation();
            _popOpenOutside(url);
        });
    } else {
        btn.disabled = true;
    }
    info.appendChild(btn);
    card.appendChild(info);
    return card;
}

window._popSafeHttpsUrl = _popSafeHttpsUrl;
window._popAllowedEmbedUrl = _popAllowedEmbedUrl;
window._popAllowedExternalUrl = _popAllowedExternalUrl;
window._popCreateEmbedIframe = _popCreateEmbedIframe;
window._popStartEmbed = _popStartEmbed;
window._popDestroyEmbed = _popDestroyEmbed;
window._popDestroyAllEmbeds = _popDestroyAllEmbeds;
window._popBuildArcadeCard = _popBuildArcadeCard;
window._popOpenOutside = _popOpenOutside;
window._popExternalAnchor = _popExternalAnchor;

// ---- Game catalogue ----
var POP_GAMES = [
    {
        slug: 'tothemoon',
        title: 'To The Moon!',
        emoji: '🚀',
        genre: 'Shooter',
        players: '1P',
        desc: 'Battle fiat systems and regulators in this 3D space arcade shooter. Stack sats and HODL strong.',
        thumb: 'https://timechainarcade.com/images/poster-to-the-moon.jpg',
        thumbFallback: '🚀',
        url: 'https://timechainarcade.com/games/tothemoon',
        hot: true
    },
    {
        slug: 'noderunner',
        title: 'Node Runner',
        emoji: '⚡',
        genre: 'Puzzle',
        players: '1P',
        desc: 'You ARE a Bitcoin transaction routing through the Lightning Network. Dodge bad actors, find your path.',
        thumb: 'https://timechainarcade.com/images/games/noderunner-intro.jpg',
        thumbFallback: '⚡',
        url: 'https://timechainarcade.com/games/noderunner',
        hot: false
    },
    {
        slug: 'nakamotoknights',
        title: 'Nakamoto Knights',
        emoji: '♟️',
        genre: 'Chess',
        players: '1P',
        desc: 'Strategic battle between Bitcoin and legacy finance. Satoshi leads the charge against the Planner.',
        thumb: 'https://timechainarcade.com/images/games/nakamoto-knights-intro.jpg',
        thumbFallback: '♟️',
        url: 'https://timechainarcade.com/games/nakamotoknights',
        hot: false
    },
    {
        slug: 'block-hunt',
        title: 'Block Hunt',
        emoji: '⛏️',
        genre: 'Strategy',
        players: '1P',
        desc: 'Race against HashCorp to find the nonce first. Turn-based Bitcoin mining simulation.',
        thumb: 'https://timechainarcade.com/images/games/block-hunt-intro.jpg',
        thumbFallback: '⛏️',
        url: 'https://timechainarcade.com/games/block-hunt',
        hot: false
    },
    {
        slug: 'getrekt',
        title: 'Get Rekt Simulator',
        emoji: '📉',
        genre: 'Trading',
        players: '1P',
        desc: 'Experience the chaos of Bitcoin trading. Learn what NOT to do the fun way.',
        thumb: 'https://timechainarcade.com/images/games/get-rekt-simulator-intro.jpg',
        thumbFallback: '📉',
        url: 'https://timechainarcade.com/games/getrekt',
        hot: false
    },
    {
        slug: 'breakingoutbitcoin',
        title: 'Breaking Out Bitcoin',
        emoji: '🧱',
        genre: 'Arcade',
        players: '1P',
        desc: 'Classic brick-breaker with Bitcoin\'s price resistance levels. Break through to new ATHs.',
        thumb: null,
        thumbFallback: '🧱',
        url: 'https://timechainarcade.com/games/breakingoutbitcoin',
        hot: false
    },
    {
        slug: 'satoshisscramble',
        title: 'Satoshi\'s Scramble',
        emoji: '🔡',
        genre: 'Word',
        players: '1P',
        desc: 'Unscramble Bitcoin terminology before time runs out. Grow your Bitcoin vocabulary.',
        thumb: 'https://timechainarcade.com/images/games/satoshis-scramble-intro.jpg',
        thumbFallback: '🔡',
        url: 'https://timechainarcade.com/games/satoshisscramble',
        hot: false
    },
    {
        slug: 'trivianight',
        title: 'Trivia Night',
        emoji: '🧠',
        genre: 'Quiz',
        players: '1P',
        desc: 'Test your Bitcoin knowledge across Basics, History, and Technical. How deep is your stack of knowledge?',
        thumb: 'https://timechainarcade.com/images/games/trivia-night-intro.jpg',
        thumbFallback: '🧠',
        url: 'https://timechainarcade.com/games/trivianight',
        hot: false
    },
    {
        slug: 'stackmachine',
        title: 'Stack Machine',
        emoji: '🖥️',
        genre: 'Educational',
        players: '1P',
        desc: 'Learn Bitcoin Script opcodes through interactive puzzles. Actually understand how BTC transactions work.',
        thumb: 'https://timechainarcade.com/images/games/amazing-stack-machine-intro.jpg',
        thumbFallback: '🖥️',
        url: 'https://timechainarcade.com/games/stackmachine',
        hot: false
    },
    {
        slug: 'banhammer',
        title: 'Banhammer',
        emoji: '🔨',
        genre: 'Arcade',
        players: '1P',
        desc: 'Smash through censors and central bankers trying to stop Bitcoin.',
        thumb: 'https://timechainarcade.com/images/games/banhammer-intro.jpg',
        thumbFallback: '🔨',
        url: 'https://timechainarcade.com/games/banhammer',
        hot: false
    },
    {
        slug: 'bcracers',
        title: 'BC Grand Prix',
        emoji: '🏎️',
        genre: 'Racing',
        players: '1P',
        desc: 'High-speed Bitcoin racing game. Outrun inflation.',
        thumb: 'https://timechainarcade.com/images/games/bcracers-bb1.png',
        thumbFallback: '🏎️',
        url: 'https://timechainarcade.com/games/bcracers',
        hot: false
    }
];

// ---- CSS ----
function _injectPOPStyles() {
    if (document.getElementById('pop-styles')) return;
    var s = document.createElement('style');
    s.id = 'pop-styles';
    s.textContent = `
        #popOverlay {
            position: fixed; inset: 0; z-index: 100003;
            background: var(--bg, #0a0a1a);
            display: flex; flex-direction: column;
            overflow: hidden;
        }
        .pop-header {
            display: flex; align-items: center; justify-content: space-between;
            gap: 8px; flex-wrap: wrap;
            padding: 10px 16px;
            background: #030712;
            border-bottom: 1px solid rgba(247,147,26,0.2);
            flex-shrink: 0;
        }
        .pop-tabs {
            display: flex; gap: 4px;
            background: rgba(255,255,255,0.04);
            border-radius: 10px; padding: 4px;
            flex-shrink: 0;
        }
        .pop-tab {
            padding: 7px 16px; border-radius: 8px; border: none;
            font-size: 0.78rem; font-weight: 700; cursor: pointer;
            font-family: inherit; transition: all 0.2s; color: var(--text-muted);
            background: transparent;
        }
        .pop-tab.active {
            background: var(--accent, #f7931a); color: #fff;
            box-shadow: 0 2px 10px rgba(247,147,26,0.35);
        }
        .pop-body {
            flex: 1; overflow-y: auto; padding: 16px;
        }
        .pop-section-title {
            font-size: 0.65rem; font-weight: 800; color: var(--accent);
            text-transform: uppercase; letter-spacing: 1.5px;
            margin: 0 0 12px;
        }
        /* Arcade grid */
        .pop-arcade-notice {
            display: flex; align-items: flex-start; gap: 12px;
            background: rgba(247,147,26,0.07);
            border: 1px solid rgba(247,147,26,0.25);
            border-radius: 12px; padding: 14px 16px;
            margin-bottom: 20px;
        }
        .pop-arcade-notice-icon { font-size: 1.4rem; flex-shrink: 0; margin-top: 2px; }
        .pop-arcade-notice-text { font-size: 0.8rem; color: var(--text-muted); line-height: 1.55; }
        .pop-arcade-notice-text strong { color: var(--text); }
        .pop-games-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
            gap: 12px;
            margin-bottom: 24px;
        }
        @media (max-width: 480px) {
            .pop-games-grid { grid-template-columns: 1fr 1fr; }
        }
        .pop-game-card {
            background: var(--card-bg, #1a1a2e);
            border: 1px solid var(--border);
            border-radius: 14px; overflow: hidden;
            cursor: pointer; transition: all 0.2s;
            display: flex; flex-direction: column;
            position: relative;
        }
        .pop-game-card:hover, .pop-game-card:active {
            border-color: var(--accent);
            transform: translateY(-2px);
            box-shadow: 0 6px 24px rgba(247,147,26,0.2);
        }
        .pop-game-card.hot::after {
            content: '🔥 HOT'; position: absolute; top: 8px; right: 8px;
            background: #ef4444; color: #fff; font-size: 0.6rem; font-weight: 800;
            padding: 2px 7px; border-radius: 20px; letter-spacing: 0.5px;
        }
        .pop-game-thumb {
            width: 100%; aspect-ratio: 16/9; object-fit: cover;
            background: #111;
        }
        .pop-game-thumb-fallback {
            width: 100%; aspect-ratio: 16/9;
            display: flex; align-items: center; justify-content: center;
            font-size: 2.5rem; background: linear-gradient(135deg, #111, #1a1a2e);
        }
        .pop-game-info { padding: 10px 12px 12px; flex: 1; display: flex; flex-direction: column; }
        .pop-game-title { font-size: 0.85rem; font-weight: 800; color: var(--text); margin-bottom: 2px; }
        .pop-game-meta { display: flex; gap: 6px; margin-bottom: 6px; }
        .pop-game-tag {
            font-size: 0.6rem; font-weight: 700; padding: 1px 7px; border-radius: 20px;
            border: 1px solid var(--border); color: var(--text-muted);
        }
        .pop-game-desc { font-size: 0.72rem; color: var(--text-muted); line-height: 1.5; flex: 1; }
        .pop-game-play-btn {
            display: block; width: 100%; margin-top: 10px;
            padding: 8px; background: linear-gradient(135deg, #f7931a, #e8720c);
            border: none; border-radius: 8px; color: #fff;
            font-size: 0.78rem; font-weight: 800; cursor: pointer;
            font-family: inherit; text-align: center;
            transition: filter 0.15s;
        }
        .pop-game-play-btn:hover { filter: brightness(1.15); }
        /* Attribution footer */
        .pop-arcade-footer {
            text-align: center; padding: 16px 0 4px;
            font-size: 0.72rem; color: var(--text-faint); line-height: 1.6;
        }
        .pop-arcade-footer a { color: #f7931a; text-decoration: none; font-weight: 700; }
        /* PVP wrapper inside Proof of Play */
        #popPVPWrap {
            width: 100%; min-height: 400px;
            display: flex; flex-direction: column; align-items: center;
        }
        @keyframes popFadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .pop-anim { animation: popFadeIn 0.3s ease forwards; }
        .pop-open-label {
            font-size: 0.6rem; font-weight: 700; color: var(--text-muted);
            letter-spacing: 0.04em; text-transform: uppercase; margin-top: 6px;
        }
        .pop-sat-play {
            flex: 1; display: flex; flex-direction: column; align-items: center;
            justify-content: center; background: #000; gap: 14px; padding: 24px; text-align: center;
        }
        .pop-sat-play-title { font-size: 1.05rem; font-weight: 800; color: #f7931a; }
        .pop-sat-play-copy { font-size: 0.78rem; color: rgba(255,255,255,0.55); max-width: 280px; line-height: 1.5; }
    `;
    document.head.appendChild(s);
}

// ---- Render Sat Arcade tab ----
// ck121212195.github.io/SAT-ARCADE — embeddable. Load the iframe only after Play.
function _renderSatArcadeTab(wrap) {
    _popDestroyAllEmbeds(wrap);
    wrap.textContent = '';
    wrap.style.padding = '0';
    wrap.style.overflow = 'hidden';
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';

    var banner = document.createElement('div');
    banner.style.cssText = 'padding:8px 14px;background:#0a0a0f;display:flex;align-items:center;justify-content:space-between;gap:8px;flex-shrink:0;border-bottom:1px solid rgba(255,255,255,0.07);';
    var bannerLeft = document.createElement('div');
    bannerLeft.style.cssText = 'font-size:0.75rem;color:rgba(255,255,255,0.5);';
    var strong = document.createElement('strong');
    strong.style.color = '#f7931a';
    strong.textContent = 'Sat Arcade';
    bannerLeft.appendChild(document.createTextNode('\uD83E\uDE99 '));
    bannerLeft.appendChild(strong);
    bannerLeft.appendChild(document.createTextNode(' — Bitcoin arcade games · Play here'));
    var fullTab = _popExternalAnchor(POP_SAT_ARCADE_URL, '⧉ Full Tab');
    fullTab.style.cssText = 'flex-shrink:0;padding:5px 10px;background:rgba(247,147,26,0.12);border:1px solid rgba(247,147,26,0.35);border-radius:7px;color:#f7931a;font-size:0.7rem;font-weight:700;text-decoration:none;';
    banner.appendChild(bannerLeft);
    banner.appendChild(fullTab);

    var playPanel = document.createElement('div');
    playPanel.className = 'pop-sat-play';
    var playTitle = document.createElement('div');
    playTitle.className = 'pop-sat-play-title';
    playTitle.textContent = 'Sat Arcade';
    var playCopy = document.createElement('div');
    playCopy.className = 'pop-sat-play-copy';
    playCopy.textContent = 'Bitcoin arcade games. Tap Play here to load the games in this screen.';
    var playBtn = document.createElement('button');
    playBtn.type = 'button';
    playBtn.className = 'pop-game-play-btn';
    playBtn.style.maxWidth = '280px';
    playBtn.textContent = 'Play here';
    playPanel.appendChild(playTitle);
    playPanel.appendChild(playCopy);
    playPanel.appendChild(playBtn);

    wrap.appendChild(banner);
    wrap.appendChild(playPanel);

    playBtn.addEventListener('click', function() {
        var iframe = _popCreateEmbedIframe(POP_SAT_ARCADE_URL);
        if (!iframe) return;
        iframe.setAttribute('title', 'Sat Arcade');
        playPanel.remove();
        wrap.appendChild(iframe);
        _popStartEmbed(iframe);
    });
}

// ---- Render RyRacer tab ----
function _renderRyRacerTab(wrap) {
    _popDestroyAllEmbeds(wrap);
    wrap.textContent = '';
    wrap.style.padding = '0';
    wrap.style.overflowY = 'auto';

    var root = document.createElement('div');
    root.style.cssText = 'background:#0a0a0f;min-height:100%;';

    var hero = document.createElement('div');
    hero.style.cssText = 'position:relative;overflow:hidden;';
    var heroImg = document.createElement('img');
    var heroSrc = _popAllowedExternalUrl('https://ryracer.com/metaimage-hero.webp');
    if (heroSrc) heroImg.setAttribute('src', heroSrc);
    heroImg.setAttribute('alt', 'RyRacer');
    heroImg.setAttribute('loading', 'eager');
    heroImg.style.cssText = 'width:100%;height:200px;object-fit:cover;object-position:center;opacity:0.75;display:block;';
    heroImg.addEventListener('error', function() {
        heroImg.style.display = 'none';
    });
    var heroShade = document.createElement('div');
    heroShade.style.cssText = 'position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.2),rgba(10,10,15,0.95));';
    var heroText = document.createElement('div');
    heroText.style.cssText = 'position:absolute;bottom:0;left:0;right:0;padding:16px 20px;';
    var kicker = document.createElement('div');
    kicker.style.cssText = 'font-size:0.65rem;color:#f7931a;letter-spacing:0.18em;text-transform:uppercase;font-weight:800;margin-bottom:4px;';
    kicker.textContent = '⚡ BITCOIN RACING';
    var name = document.createElement('div');
    name.style.cssText = 'font-size:1.5rem;font-weight:900;color:#fff;letter-spacing:-0.5px;line-height:1.1;';
    name.textContent = 'RyRacer';
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.75rem;color:rgba(255,255,255,0.55);margin-top:4px;';
    sub.textContent = '3D arcade combat racing · 1 free race · weekly challenges';
    var outside = document.createElement('div');
    outside.className = 'pop-open-label';
    outside.style.color = 'rgba(255,255,255,0.55)';
    outside.textContent = 'Opens outside BQ';
    heroText.appendChild(kicker);
    heroText.appendChild(name);
    heroText.appendChild(sub);
    heroText.appendChild(outside);
    hero.appendChild(heroImg);
    hero.appendChild(heroShade);
    hero.appendChild(heroText);
    root.appendChild(hero);

    var playWrap = document.createElement('div');
    playWrap.style.cssText = 'padding:16px 16px 8px;';
    var raceBtn = document.createElement('button');
    raceBtn.type = 'button';
    raceBtn.style.cssText = 'width:100%;padding:16px;background:linear-gradient(135deg,#f7931a,#ea580c);border:none;border-radius:14px;color:#fff;font-size:1.05rem;font-weight:900;cursor:pointer;font-family:inherit;letter-spacing:0.05em;touch-action:manipulation;box-shadow:0 4px 20px rgba(247,147,26,0.4);';
    raceBtn.textContent = '🏎️ RACE NOW — 1 FREE RUN';
    raceBtn.addEventListener('click', function() { _popOpenOutside('https://ryracer.com'); });
    var raceNote = document.createElement('div');
    raceNote.style.cssText = 'text-align:center;margin-top:8px;font-size:0.68rem;color:rgba(255,255,255,0.35);';
    raceNote.textContent = '1 free race included · weekly challenges and friend races';
    playWrap.appendChild(raceBtn);
    playWrap.appendChild(raceNote);
    root.appendChild(playWrap);

    var stats = document.createElement('div');
    stats.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:1px;background:rgba(255,255,255,0.06);margin:12px 16px;border-radius:12px;overflow:hidden;';
    function statCell(top, bottom) {
        var cell = document.createElement('div');
        cell.style.cssText = 'background:#0d0d14;padding:12px;text-align:center;';
        var t = document.createElement('div');
        t.style.cssText = 'font-size:1rem;font-weight:900;color:#f7931a;';
        t.textContent = top;
        var b = document.createElement('div');
        b.style.cssText = 'font-size:0.6rem;color:rgba(255,255,255,0.4);margin-top:2px;';
        b.textContent = bottom;
        cell.appendChild(t);
        cell.appendChild(b);
        return cell;
    }
    stats.appendChild(statCell('3D', 'COMBAT RACING'));
    stats.appendChild(statCell('FREE', 'FRIEND RACES'));
    stats.appendChild(statCell('WEEKLY', 'CHALLENGES'));
    root.appendChild(stats);

    var controls = document.createElement('div');
    controls.style.cssText = 'margin:0 16px 12px;padding:14px;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;';
    var cTitle = document.createElement('div');
    cTitle.style.cssText = 'font-size:0.65rem;color:#f7931a;text-transform:uppercase;letter-spacing:0.15em;font-weight:800;margin-bottom:10px;';
    cTitle.textContent = '🕹️ CONTROLS';
    var cGrid = document.createElement('div');
    cGrid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:6px;';
    controls.appendChild(cTitle);
    controls.appendChild(cGrid);
    var mobile = document.createElement('div');
    mobile.style.cssText = 'margin-top:8px;font-size:0.68rem;color:rgba(255,255,255,0.35);';
    mobile.textContent = '📱 Mobile: on-screen touch controls appear automatically';
    controls.appendChild(mobile);
    root.appendChild(controls);

    var note = document.createElement('div');
    note.style.cssText = 'margin:0 16px 20px;padding:10px 12px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:10px;display:flex;align-items:center;justify-content:space-between;gap:10px;';
    var noteText = document.createElement('div');
    noteText.style.cssText = 'font-size:0.7rem;color:rgba(255,255,255,0.4);line-height:1.5;';
    noteText.textContent = '🔒 RyRacer opens in a new tab. Opens outside BQ.';
    var openLink = _popExternalAnchor('https://ryracer.com', 'Open ↗');
    openLink.style.cssText = 'flex-shrink:0;padding:7px 12px;background:rgba(247,147,26,0.15);border:1px solid rgba(247,147,26,0.4);border-radius:8px;color:#f7931a;font-size:0.72rem;font-weight:700;text-decoration:none;';
    note.appendChild(noteText);
    note.appendChild(openLink);
    root.appendChild(note);

    wrap.appendChild(root);

    // Fill controls grid after the shell exists (plain text, no URLs).
    [['← →', 'Steer'], ['SHIFT', 'Boost'], ['SPACE', 'Drift'], ['Z', 'Fire weapon']].forEach(function(pair) {
        var row = document.createElement('div');
        row.style.cssText = 'font-size:0.73rem;color:rgba(255,255,255,0.55);';
        var k = document.createElement('span');
        k.style.cssText = 'color:#fff;font-weight:700;';
        k.textContent = pair[0];
        row.appendChild(k);
        row.appendChild(document.createTextNode(' ' + pair[1]));
        cGrid.appendChild(row);
    });
}

// ---- Render Galaxy Mind tab ----
// galaxymind.space blocks framing. Open each game in a new tab.
function _renderGalaxyMindTab(wrap) {
    _popDestroyAllEmbeds(wrap);
    wrap.textContent = '';
    wrap.style.padding = '0';
    wrap.style.overflowY = 'auto';
    var games = [
        { slug: 'super-saylor', path: 'super-saylor', emoji: '🏃', label: 'THE FLAGSHIP', name: 'SUPER SAYLOR', desc: 'Mario-style platformer through bitcoin history. Run 21 levels from genesis to the moon, stomp FUD bears, face Peter Schiff.' },
        { slug: 'wen', path: 'wen', emoji: '📅', label: 'DAILY · 30 SECONDS', name: 'WEN', desc: 'A real 90-day slice of the tape with dates redacted. Five guesses — closeness is the score.' },
        { slug: 'gauntlet', path: 'gauntlet', emoji: '⚔️', label: 'DAILY · BLIND HISTORY', name: 'THE BITCOIN GAUNTLET', desc: 'Trade a hidden bitcoin history window blind against a DCA bot. Beat the bot that never thinks.' },
        { slug: 'runner', path: 'runner', emoji: '⚡', label: 'ONE TAP · REAL CANDLES', name: 'NODE RUNNER', desc: 'One-tap arcade run over the real price tape. Bear markets run downhill — reach the present and go to the moon.' },
        { slug: 'horizon', path: 'horizon', emoji: '⛓️', label: 'ONE TAP · BUILD THE CHAIN', name: 'TIMECHAIN', desc: 'One-tap block stacker on the halving clock. Blocks start at 50, then 25, then 12.5 — stack a clean chain.' }
    ];

    var root = document.createElement('div');
    root.style.cssText = 'background:var(--bg,#0d0d0d);min-height:100%;padding:0 0 80px;';

    var header = document.createElement('div');
    header.style.cssText = 'padding:16px;background:rgba(0,0,0,0.6);border-bottom:1px solid rgba(247,147,26,0.2);display:flex;align-items:center;justify-content:space-between;';
    var hLeft = document.createElement('div');
    hLeft.style.cssText = 'display:flex;align-items:center;gap:8px;';
    var hEmoji = document.createElement('span');
    hEmoji.style.fontSize = '1.2rem';
    hEmoji.textContent = '🌌';
    var hText = document.createElement('div');
    var hTitle = document.createElement('div');
    hTitle.style.cssText = 'font-size:0.85rem;font-weight:800;color:#fff;letter-spacing:0.05em;';
    hTitle.textContent = 'GALAXY MIND ARCADE';
    var hSub = document.createElement('div');
    hSub.style.cssText = 'font-size:0.65rem;color:#f7931a;letter-spacing:0.15em;text-transform:uppercase;';
    hSub.textContent = '5 games · real bitcoin data';
    hText.appendChild(hTitle);
    hText.appendChild(hSub);
    hLeft.appendChild(hEmoji);
    hLeft.appendChild(hText);
    var playAll = _popExternalAnchor('https://galaxymind.space/arcade', 'PLAY ↗');
    playAll.style.cssText = 'display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#f7931a;color:#000;font-weight:800;font-size:0.72rem;text-decoration:none;border-radius:8px;letter-spacing:0.08em;';
    header.appendChild(hLeft);
    header.appendChild(playAll);
    root.appendChild(header);

    var notice = document.createElement('div');
    notice.style.cssText = 'margin:12px 12px 0;padding:10px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;font-size:0.72rem;color:rgba(255,255,255,0.5);line-height:1.5;';
    notice.textContent = "🔒 Galaxy Mind doesn't allow in-app embedding. Tap any game to play on their site — Opens outside BQ.";
    root.appendChild(notice);

    var grid = document.createElement('div');
    grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;';
    games.forEach(function(g, i) {
        var isWide = (i === 0);
        var href = _popAllowedExternalUrl('https://galaxymind.space/' + g.path);
        var card = document.createElement(href ? 'a' : 'div');
        if (href) {
            card.setAttribute('href', href);
            card.setAttribute('target', '_blank');
            card.setAttribute('rel', 'noopener noreferrer');
        }
        card.style.cssText = (isWide ? 'grid-column:1/-1;' : '') + 'display:block;background:rgba(255,255,255,0.04);border:1px solid rgba(247,147,26,0.25);border-radius:12px;overflow:hidden;text-decoration:none;transition:border-color 0.2s;';
        var imgWrap = document.createElement('div');
        imgWrap.style.cssText = 'position:relative;width:100%;height:' + (isWide ? '140px' : '90px') + ';overflow:hidden;background:#111;';
        var thumb = _popAllowedExternalUrl('https://galaxymind.space/arcade-previews/' + g.slug + '.png');
        if (thumb) {
            var img = document.createElement('img');
            img.setAttribute('src', thumb);
            img.setAttribute('alt', '');
            img.setAttribute('loading', 'lazy');
            img.style.cssText = 'width:100%;height:100%;object-fit:cover;object-position:top;opacity:0.85;';
            imgWrap.appendChild(img);
        }
        var fade = document.createElement('div');
        fade.style.cssText = 'position:absolute;bottom:0;left:0;right:0;height:40px;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);';
        imgWrap.appendChild(fade);
        card.appendChild(imgWrap);
        var body = document.createElement('div');
        body.style.cssText = 'padding:8px 10px;';
        var lab = document.createElement('div');
        lab.style.cssText = 'font-size:0.6rem;color:#f7931a;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:2px;';
        lab.textContent = g.label;
        var nm = document.createElement('div');
        nm.style.cssText = 'font-size:0.78rem;font-weight:800;color:#fff;margin-bottom:3px;';
        nm.textContent = g.name;
        var ds = document.createElement('div');
        ds.style.cssText = 'font-size:0.68rem;color:rgba(255,255,255,0.5);line-height:1.4;';
        ds.textContent = g.desc;
        var ol = document.createElement('div');
        ol.className = 'pop-open-label';
        ol.textContent = 'Opens outside BQ';
        body.appendChild(lab);
        body.appendChild(nm);
        body.appendChild(ds);
        body.appendChild(ol);
        card.appendChild(body);
        grid.appendChild(card);
    });
    root.appendChild(grid);
    wrap.appendChild(root);
}

function _renderArcadeTab(wrap) {
    _popDestroyAllEmbeds(wrap);
    wrap.textContent = '';

    var notice = document.createElement('div');
    notice.className = 'pop-arcade-notice';
    var nIcon = document.createElement('div');
    nIcon.className = 'pop-arcade-notice-icon';
    nIcon.textContent = '🕹️';
    var nText = document.createElement('div');
    nText.className = 'pop-arcade-notice-text';
    var nStrong = document.createElement('strong');
    nStrong.textContent = 'Timechain Arcade';
    nText.appendChild(nStrong);
    nText.appendChild(document.createTextNode(' — Bitcoin games powered by the Lightning Network. Tap any game to open it on Timechain Arcade. Opens outside BQ. '));
    var nLink = _popExternalAnchor('https://timechainarcade.com', 'timechainarcade.com');
    nLink.style.cssText = 'color:#f7931a;font-weight:700;';
    nText.appendChild(nLink);
    notice.appendChild(nIcon);
    notice.appendChild(nText);
    wrap.appendChild(notice);

    var section = document.createElement('div');
    section.className = 'pop-section-title';
    section.textContent = '🔥 ' + POP_GAMES.length + ' Games Available';
    wrap.appendChild(section);

    var grid = document.createElement('div');
    grid.className = 'pop-games-grid';
    POP_GAMES.forEach(function(game) {
        grid.appendChild(_popBuildArcadeCard(game));
    });
    wrap.appendChild(grid);

    var footer = document.createElement('div');
    footer.className = 'pop-arcade-footer';
    footer.appendChild(document.createTextNode('Games by '));
    footer.appendChild(_popExternalAnchor('https://timechainarcade.com', 'Timechain Arcade'));
    footer.appendChild(document.createTextNode(' · Powered by ⚡ Lightning Network · '));
    footer.appendChild(_popExternalAnchor('https://twitter.com/TimechainArcade', '@TimechainArcade'));
    wrap.appendChild(footer);
}

// ---- Render PVP tab ----
function _renderPVPTab(wrap) {
    _popDestroyAllEmbeds(wrap);
    wrap.innerHTML = '<div id="popPVPWrap" class="pop-anim">' +
        '<div style="text-align:center;padding:20px 0 24px;">' +
            '<div style="font-size:2.2rem;margin-bottom:6px;">⚔️</div>' +
            '<div style="font-size:1.2rem;font-weight:800;color:var(--accent);">PVP Battle</div>' +
            '<div style="font-size:0.8rem;color:var(--text-muted);margin-top:4px;">1v1 real-time Bitcoin trivia — live opponents</div>' +
        '</div>' +
        '<button onclick="window._popEnterPVP()" style="display:block;width:100%;max-width:320px;margin:0 auto;padding:16px;background:linear-gradient(135deg,#f7931a,#e8720c);border:none;border-radius:14px;color:#fff;font-size:1rem;font-weight:800;cursor:pointer;font-family:inherit;text-transform:uppercase;letter-spacing:1px;box-shadow:0 4px 20px rgba(247,147,26,0.4);">⚔️ Enter the Arena</button>' +
        '<div style="display:flex;justify-content:center;gap:28px;margin-top:28px;">' +
            '<div style="text-align:center;">' +
                '<div style="font-size:1.6rem;font-weight:800;color:#22c55e;">' + (parseInt(localStorage.getItem('btc_pvp_wins') || '0')) + '</div>' +
                '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Wins</div>' +
            '</div>' +
            '<div style="text-align:center;">' +
                '<div style="font-size:1.6rem;font-weight:800;color:#ef4444;">' + (parseInt(localStorage.getItem('btc_pvp_losses') || '0')) + '</div>' +
                '<div style="font-size:0.65rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-top:2px;">Losses</div>' +
            '</div>' +
        '</div>' +
        '<div style="margin-top:28px;background:var(--card-bg,#1a1a2e);border:1px solid var(--border);border-radius:14px;padding:16px;">' +
            '<div style="font-size:0.65rem;color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">How It Works</div>' +
            '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.7;">' +
                '5 questions per match · First correct answer wins the round · Streaks earn bonus pts · Win 3 of 5 rounds for victory' +
            '</div>' +
        '</div>' +
    '</div>';
}

// ---- Open Proof of Play overlay ----
window.enterProofOfPlay = function(startTab) {
    if (_popActive) return;
    _popActive = true;
    startTab = startTab || 'pvp';
    window._popShareTab = startTab;
    window._popActive = true;
    _popBindCloseListeners();

    _injectPOPStyles();

    // Close Nacho bubble if open
    var nb = document.getElementById('nacho-bubble');
    if (nb) { nb.classList.remove('show'); nb.removeAttribute('data-interactive'); }

    var overlay = document.createElement('div');
    overlay.id = 'popOverlay';

    var popHash = (startTab && startTab !== 'pvp') ? ('#proof-of-play/' + startTab) : '#proof-of-play';
    history.pushState({ overlay: 'pop' }, '', popHash);
    window.addEventListener('popstate', _popHandlePop, { once: true });

    overlay.innerHTML =
        '<div class="pop-header">' +
            '<button onclick="exitProofOfPlay()" style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;padding:4px 8px;display:flex;align-items:center;touch-action:manipulation;" title="Back">←</button>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:1.2rem;">🕹️</span>' +
                '<span style="font-size:0.95rem;font-weight:800;color:var(--heading);">Proof of Play</span>' +
            '</div>' +
            '<button type="button" id="popShareBtn" data-mini-share="pop" onclick="if(window.miniAppShare)miniAppShare(\'pop\')" style="min-width:44px;min-height:44px;margin-left:auto;padding:8px 12px;border-radius:10px;border:1px solid rgba(247,147,26,0.55);background:#1a120b;color:#fff;font-weight:700;cursor:pointer;font-family:inherit;">Share</button>' +
            '<div class="pop-tabs">' +
                '<button id="popTabPVP" class="pop-tab ' + (startTab === 'pvp' ? 'active' : '') + '" onclick="window._popSwitchTab(\'pvp\')">⚔️ PVP</button>' +
                '<button id="popTabArcade" class="pop-tab ' + (startTab === 'arcade' ? 'active' : '') + '" onclick="window._popSwitchTab(\'arcade\')">🎮 Arcade</button>' +
                '<button id="popTabSatArcade" class="pop-tab ' + (startTab === 'sat_arcade' ? 'active' : '') + '" onclick="window._popSwitchTab(\'sat_arcade\')">🪙 Sat Arcade</button>' +
                '<button id="popTabGalaxy" class="pop-tab ' + (startTab === 'galaxy' ? 'active' : '') + '" onclick="window._popSwitchTab(\'galaxy\')">🌌 Galaxy Mind</button>' +
                '<button id="popTabRyRacer" class="pop-tab ' + (startTab === 'ryracer' ? 'active' : '') + '" onclick="window._popSwitchTab(\'ryracer\')">🏎️ RyRacer</button>' +
            '</div>' +
        '</div>' +
        '<div class="pop-body" id="popBody"></div>';

    document.body.appendChild(overlay);

    var body = document.getElementById('popBody');
    if (startTab === 'pvp') {
        _renderPVPTab(body);
    } else if (startTab === 'sat_arcade') {
        _renderSatArcadeTab(body);
    } else if (startTab === 'galaxy') {
        _renderGalaxyMindTab(body);
    } else if (startTab === 'ryracer') {
        _renderRyRacerTab(body);
    } else {
        _renderArcadeTab(body);
    }
};

window.exitProofOfPlay = function() {
    _popDestroyAllEmbeds();
    _popUnbindCloseListeners();
    _popActive = false;
    window._popActive = false;
    var overlay = document.getElementById('popOverlay');
    if (overlay) overlay.remove();
    if (window.location.hash.indexOf('#proof-of-play') === 0) {
        history.pushState({ home: true }, '', window.location.pathname);
    }
};

function _popHandlePop() {
    window.exitProofOfPlay();
}

window._popSwitchTab = function(tab) {
    _popDestroyAllEmbeds();
    window._popShareTab = tab;
    var body = document.getElementById('popBody');
    if (!body) return;
    document.getElementById('popTabArcade').classList.toggle('active', tab === 'arcade');
    document.getElementById('popTabPVP').classList.toggle('active', tab === 'pvp');
    var saTab = document.getElementById('popTabSatArcade');
    if (saTab) saTab.classList.toggle('active', tab === 'sat_arcade');
    var gTab = document.getElementById('popTabGalaxy');
    if (gTab) gTab.classList.toggle('active', tab === 'galaxy');
    var rTab = document.getElementById('popTabRyRacer');
    if (rTab) rTab.classList.toggle('active', tab === 'ryracer');
    body.style.opacity = '0';
    body.style.transition = 'opacity 0.15s';
    setTimeout(function() {
        if (tab === 'pvp') {
            _renderPVPTab(body);
        } else if (tab === 'sat_arcade') {
            _renderSatArcadeTab(body);
        } else if (tab === 'galaxy') {
            _renderGalaxyMindTab(body);
        } else if (tab === 'ryracer') {
            _renderRyRacerTab(body);
        } else {
            _renderArcadeTab(body);
        }
        body.style.opacity = '';
        body.style.transition = '';
    }, 150);
};

window._renderSatArcadeTab = _renderSatArcadeTab;
window._popOnKeydown = _popOnKeydown;
window._popOnRouteChange = _popOnRouteChange;

window._popLaunchGame = function(url, title) {
    // Timechain Arcade and other outside titles open in a new tab.
    // They block framing, so this no longer tries an iframe overlay.
    _popOpenOutside(url);
};

window._popEnterPVP = function() {
    // Exit Proof of Play overlay and hand off to PVP
    window.exitProofOfPlay();
    setTimeout(function() {
        if (typeof window._launchPVP === 'function') {
            window._launchPVP();
        } else if (typeof window.enterPVPMode === 'function') {
            window.enterPVPMode();
        }
    }, 100);
};

// Hash routing
window._popHandleHash = function(hash) {
    var h = String(hash || '').replace(/^#/, '');
    if (h.indexOf('proof-of-play/') === 0) {
        var tab = h.slice('proof-of-play/'.length).split('/')[0];
        var allowed = { arcade: 1, sat_arcade: 1, galaxy: 1, ryracer: 1, pvp: 1 };
        if (!allowed[tab]) tab = 'arcade';
        if (!_popActive) window.enterProofOfPlay(tab);
        else window._popSwitchTab(tab);
        return;
    }
    if (h === 'proof-of-play') {
        if (!_popActive) window.enterProofOfPlay('arcade');
    } else if (h === 'proof-of-play-pvp') {
        if (!_popActive) window.enterProofOfPlay('pvp');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var h = window.location.hash.replace('#', '');
    if (h.indexOf('proof-of-play/') === 0) window._popHandleHash(h);
    else if (h === 'proof-of-play') window.enterProofOfPlay('arcade');
    else if (h === 'proof-of-play-pvp') window.enterProofOfPlay('pvp');
});

})();
