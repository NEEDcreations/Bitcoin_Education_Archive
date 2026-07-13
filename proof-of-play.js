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

// ---- Game catalogue ----
var POP_GAMES = [
    {
        slug: 'tothemoon',
        title: 'To The Moon!',
        emoji: '🚀',
        genre: 'Shooter',
        players: '1P',
        desc: 'Battle fiat systems and regulators in this 3D space arcade shooter. Stack sats and HODL strong.',
        thumb: 'https://timechainarcade.com/images/games/tothemoon-intro.jpg',
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
        slug: 'stack-machine',
        title: 'Stack Machine',
        emoji: '🖥️',
        genre: 'Educational',
        players: '1P',
        desc: 'Learn Bitcoin Script opcodes through interactive puzzles. Actually understand how BTC transactions work.',
        thumb: 'https://timechainarcade.com/images/games/amazing-stack-machine-intro.jpg',
        thumbFallback: '🖥️',
        url: 'https://timechainarcade.com/games/stack-machine',
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
        title: 'BC Racers',
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
    `;
    document.head.appendChild(s);
}

// ---- Render Galaxy Mind tab ----
// galaxymind.space has X-Frame-Options: DENY — iframe embedding is blocked by them.
// We show a styled game card grid with preview images + deep links instead.
function _renderGalaxyMindTab(wrap) {
    wrap.style.padding = '0';
    wrap.style.overflowY = 'auto';
    var games = [
        { slug: 'super-saylor', path: 'super-saylor', emoji: '🏃', label: 'THE FLAGSHIP', name: 'SUPER SAYLOR', desc: 'Mario-style platformer through bitcoin history. Run 21 levels from genesis to the moon, stomp FUD bears, face Peter Schiff.' },
        { slug: 'wen', path: 'wen', emoji: '📅', label: 'DAILY · 30 SECONDS', name: 'WEN', desc: 'A real 90-day slice of the tape with dates redacted. Five guesses — closeness earns sats.' },
        { slug: 'gauntlet', path: 'gauntlet', emoji: '⚔️', label: 'DAILY · BLIND HISTORY', name: 'THE BITCOIN GAUNTLET', desc: 'Trade a hidden bitcoin history window blind against a DCA bot. Beat the bot that never thinks.' },
        { slug: 'runner', path: 'runner', emoji: '⚡', label: 'ONE TAP · REAL CANDLES', name: 'NODE RUNNER', desc: 'One-tap arcade run over the real price tape. Bear markets run downhill — reach the present and go to the moon.' },
        { slug: 'horizon', path: 'horizon', emoji: '⛓️', label: 'ONE TAP · BUILD THE CHAIN', name: 'TIMECHAIN', desc: 'One-tap block stacker on the halving clock. Blocks pay 50, 25, then 12.5 — stack clean, bank the sats.' }
    ];

    var html = '<div style="background:var(--bg,#0d0d0d);min-height:100%;padding:0 0 80px;">';
    // Header
    html += '<div style="padding:16px;background:rgba(0,0,0,0.6);border-bottom:1px solid rgba(247,147,26,0.2);display:flex;align-items:center;justify-content:space-between;">' +
        '<div style="display:flex;align-items:center;gap:8px;">' +
            '<span style="font-size:1.2rem;">🌌</span>' +
            '<div>' +
                '<div style="font-size:0.85rem;font-weight:800;color:#fff;letter-spacing:0.05em;">GALAXY MIND ARCADE</div>' +
                '<div style="font-size:0.65rem;color:#f7931a;letter-spacing:0.15em;text-transform:uppercase;">5 games · real bitcoin data</div>' +
            '</div>' +
        '</div>' +
        '<a href="https://galaxymind.space/arcade" target="_blank" rel="noopener" style="display:inline-flex;align-items:center;gap:4px;padding:6px 12px;background:#f7931a;color:#000;font-weight:800;font-size:0.72rem;text-decoration:none;border-radius:8px;letter-spacing:0.08em;">PLAY ↗</a>' +
    '</div>';

    // Notice
    html += '<div style="margin:12px 12px 0;padding:10px 12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.2);border-radius:10px;font-size:0.72rem;color:rgba(255,255,255,0.5);line-height:1.5;">' +
        '🔒 Galaxy Mind doesn&#39;t allow in-app embedding. Tap any game to play on their site \u2014 opens in a new tab.' +
    '</div>';

    // Game cards grid
    html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px;">';
    games.forEach(function(g, i) {
        var isWide = (i === 0); // Super Saylor spans full width (flagship)
        var gridSpan = isWide ? 'grid-column:1/-1;' : '';
        var imgHeight = isWide ? '140px' : '90px';
        html += '<a href="https://galaxymind.space/' + g.path + '" target="_blank" rel="noopener" style="' + gridSpan + 'display:block;background:rgba(255,255,255,0.04);border:1px solid rgba(247,147,26,0.25);border-radius:12px;overflow:hidden;text-decoration:none;transition:border-color 0.2s;">' +
            '<div style="position:relative;width:100%;height:' + imgHeight + ';overflow:hidden;background:#111;">' +
                '<img src="https://galaxymind.space/arcade-previews/' + g.slug + '.png" alt="' + g.name + '" loading="lazy" style="width:100%;height:100%;object-fit:cover;object-position:top;opacity:0.85;">' +
                '<div style="position:absolute;bottom:0;left:0;right:0;height:40px;background:linear-gradient(to top,rgba(0,0,0,0.8),transparent);"></div>' +
            '</div>' +
            '<div style="padding:8px 10px;">' +
                '<div style="font-size:0.6rem;color:#f7931a;letter-spacing:0.15em;text-transform:uppercase;margin-bottom:2px;">' + g.label + '</div>' +
                '<div style="font-size:0.78rem;font-weight:800;color:#fff;margin-bottom:3px;">' + g.name + '</div>' +
                '<div style="font-size:0.68rem;color:rgba(255,255,255,0.5);line-height:1.4;">' + g.desc + '</div>' +
            '</div>' +
        '</a>';
    });
    html += '</div>';

    html += '</div>';
    wrap.innerHTML = html;
}

function _renderArcadeTab(wrap) {
    var html = '';

    html += '<div class="pop-arcade-notice">' +
        '<div class="pop-arcade-notice-icon">🕹️</div>' +
        '<div class="pop-arcade-notice-text">' +
            '<strong>Timechain Arcade</strong> — Bitcoin games powered by the Lightning Network. ' +
            'Tap any game to launch it on Timechain Arcade. ' +
            '<a href="https://timechainarcade.com" target="_blank" rel="noopener noreferrer" style="color:#f7931a;font-weight:700;">timechainarcade.com</a>' +
        '</div>' +
    '</div>';

    html += '<div class="pop-section-title">🔥 ' + POP_GAMES.length + ' Games Available</div>';
    html += '<div class="pop-games-grid">';

    POP_GAMES.forEach(function(game) {
        var thumbEl = game.thumb
            ? '<img class="pop-game-thumb" src="' + game.thumb + '" alt="" data-fb="' + (game.thumbFallback||'🎮') + '" onerror="_popThumbErr(this)">'
            : '<div class="pop-game-thumb-fallback">' + (game.thumbFallback||'🎮') + '</div>';

        html += '<div class="pop-game-card' + (game.hot ? ' hot' : '') + '" onclick="window._popLaunchGame(\'' + game.url + '\',\'' + game.title.replace(/'/g, "\\'") + '\')">' +
            thumbEl +
            '<div class="pop-game-info">' +
                '<div class="pop-game-title">' + game.title + '</div>' +
                '<div class="pop-game-meta">' +
                    '<span class="pop-game-tag">' + game.genre + '</span>' +
                    '<span class="pop-game-tag">' + game.players + '</span>' +
                '</div>' +
                '<div class="pop-game-desc">' + game.desc + '</div>' +
                '<button class="pop-game-play-btn" onclick="event.stopPropagation();window._popLaunchGame(\'' + game.url + '\',\'' + game.title.replace(/'/g, "\\'") + '\')">▶ Play Now</button>' +
            '</div>' +
        '</div>';
    });

    html += '</div>';

    html += '<div class="pop-arcade-footer">' +
        'Games by <a href="https://timechainarcade.com" target="_blank" rel="noopener noreferrer">Timechain Arcade</a> · ' +
        'Powered by ⚡ Lightning Network · ' +
        '<a href="https://twitter.com/TimechainArcade" target="_blank" rel="noopener noreferrer">@TimechainArcade</a>' +
    '</div>';

    wrap.innerHTML = html;
}

// ---- Render PVP tab ----
function _renderPVPTab(wrap) {
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

    _injectPOPStyles();

    // Close Nacho bubble if open
    var nb = document.getElementById('nacho-bubble');
    if (nb) { nb.classList.remove('show'); nb.removeAttribute('data-interactive'); }

    var overlay = document.createElement('div');
    overlay.id = 'popOverlay';

    history.pushState({ overlay: 'pop' }, '', '#proof-of-play');
    window.addEventListener('popstate', _popHandlePop, { once: true });

    overlay.innerHTML =
        '<div class="pop-header">' +
            '<button onclick="exitProofOfPlay()" style="background:none;border:none;color:var(--text-muted);font-size:1.4rem;cursor:pointer;padding:4px 8px;display:flex;align-items:center;touch-action:manipulation;" title="Back">←</button>' +
            '<div style="display:flex;align-items:center;gap:8px;">' +
                '<span style="font-size:1.2rem;">🕹️</span>' +
                '<span style="font-size:0.95rem;font-weight:800;color:var(--heading);">Proof of Play</span>' +
            '</div>' +
            '<div class="pop-tabs">' +
                '<button id="popTabPVP" class="pop-tab ' + (startTab === 'pvp' ? 'active' : '') + '" onclick="window._popSwitchTab(\'pvp\')">⚔️ PVP</button>' +
                '<button id="popTabArcade" class="pop-tab ' + (startTab === 'arcade' ? 'active' : '') + '" onclick="window._popSwitchTab(\'arcade\')">🎮 Arcade</button>' +
                '<button id="popTabGalaxy" class="pop-tab ' + (startTab === 'galaxy' ? 'active' : '') + '" onclick="window._popSwitchTab(\'galaxy\')">🌌 Galaxy Mind</button>' +
            '</div>' +
        '</div>' +
        '<div class="pop-body" id="popBody"></div>';

    document.body.appendChild(overlay);

    var body = document.getElementById('popBody');
    if (startTab === 'pvp') {
        _renderPVPTab(body);
    } else if (startTab === 'galaxy') {
        _renderGalaxyMindTab(body);
    } else {
        _renderArcadeTab(body);
    }
};

window.exitProofOfPlay = function() {
    _popActive = false;
    var overlay = document.getElementById('popOverlay');
    if (overlay) overlay.remove();
    if (window.location.hash === '#proof-of-play') {
        history.pushState({ home: true }, '', window.location.pathname);
    }
};

function _popHandlePop() {
    window.exitProofOfPlay();
}

window._popSwitchTab = function(tab) {
    var body = document.getElementById('popBody');
    if (!body) return;
    document.getElementById('popTabArcade').classList.toggle('active', tab === 'arcade');
    document.getElementById('popTabPVP').classList.toggle('active', tab === 'pvp');
    var gTab = document.getElementById('popTabGalaxy');
    if (gTab) gTab.classList.toggle('active', tab === 'galaxy');
    body.style.opacity = '0';
    body.style.transition = 'opacity 0.15s';
    setTimeout(function() {
        if (tab === 'pvp') {
            _renderPVPTab(body);
        } else if (tab === 'galaxy') {
            _renderGalaxyMindTab(body);
        } else {
            _renderArcadeTab(body);
        }
        body.style.opacity = '';
        body.style.transition = '';
    }, 150);
};

window._popLaunchGame = function(url, title) {
    if (typeof awardPoints === 'function') awardPoints(5, '\uD83C\uDFAE Proof of Play: ' + title);

    // Open a full-screen in-app game overlay with the game in an iframe.
    // timechainarcade.com sets X-Frame-Options: SAMEORIGIN which blocks cross-origin iframes.
    // We attempt the iframe and fall back to a styled "open in tab" prompt if it gets blocked.
    var existing = document.getElementById('popGameOverlay');
    if (existing) existing.remove();

    var overlay = document.createElement('div');
    overlay.id = 'popGameOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:500000;background:#000;display:flex;flex-direction:column;';

    // Top bar
    var bar = document.createElement('div');
    bar.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 14px;background:#0a0a0a;border-bottom:1px solid #222;flex-shrink:0;';
    bar.innerHTML =
        '<button onclick="document.getElementById(\'popGameOverlay\').remove()" style="background:none;border:1px solid #333;color:#aaa;width:36px;height:36px;border-radius:8px;font-size:1.1rem;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;touch-action:manipulation;">←</button>' +
        '<div style="flex:1;font-size:0.9rem;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + (typeof escapeHtml === 'function' ? escapeHtml(title) : title) + '</div>' +
        '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="background:none;border:1px solid #444;color:#aaa;padding:6px 10px;border-radius:8px;font-size:0.72rem;font-weight:600;cursor:pointer;text-decoration:none;white-space:nowrap;flex-shrink:0;">⧉ Full Tab</a>';

    // iframe wrapper
    var iframeWrap = document.createElement('div');
    iframeWrap.style.cssText = 'flex:1;position:relative;overflow:hidden;';

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block;';
    iframe.setAttribute('allowfullscreen', '');
    iframe.setAttribute('allow', 'fullscreen; autoplay; payment');
    iframe.setAttribute('loading', 'eager');

    // Fallback: if iframe is blocked (SAMEORIGIN), show a prompt after a short delay
    var _blocked = false;
    var _fallbackTimer = setTimeout(function() {
        // Check if iframe navigated at all; if contentDocument is inaccessible and src unchanged, assume blocked
        try {
            // This throws if cross-origin blocked; if it didn't navigate, location.href is 'about:blank'
            var loc = iframe.contentWindow && iframe.contentWindow.location && iframe.contentWindow.location.href;
            if (!loc || loc === 'about:blank') _blocked = true;
        } catch(e) {
            // Cross-origin access denied = page loaded (good) or blocked (bad)
            // If we get a SecurityError, the iframe has content — it loaded!
            _blocked = false;
        }
        if (_blocked) _showFallback();
    }, 3000);

    iframe.onload = function() {
        clearTimeout(_fallbackTimer);
        try {
            // If SAMEORIGIN blocked, location.href will be empty or throw
            var loc = iframe.contentWindow.location.href;
            if (!loc || loc === 'about:blank') _showFallback();
        } catch(e) {
            // SecurityError = loaded cross-origin content = actually good!
        }
    };

    function _showFallback() {
        if (document.getElementById('popGameFallback')) return;
        iframeWrap.style.display = 'none';
        var fb = document.createElement('div');
        fb.id = 'popGameFallback';
        fb.style.cssText = 'flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px;text-align:center;background:#0a0a10;';
        fb.innerHTML =
            '<div style="font-size:3rem;margin-bottom:12px;">🎮</div>' +
            '<div style="font-size:1.1rem;font-weight:800;color:#fff;margin-bottom:8px;">' + (typeof escapeHtml === 'function' ? escapeHtml(title) : title) + '</div>' +
            '<div style="font-size:0.82rem;color:#888;line-height:1.6;margin-bottom:24px;max-width:320px;">This game can\'t be embedded in-app due to the platform\'s security policy.<br>Tap below to play in your browser — tap Back when done.</div>' +
            '<a href="' + url + '" target="_blank" rel="noopener noreferrer" style="padding:14px 32px;background:#f7931a;color:#000;border-radius:14px;font-size:1rem;font-weight:800;text-decoration:none;display:inline-block;">\u25B6 Play Now</a>';
        overlay.appendChild(fb);
    }

    iframeWrap.appendChild(iframe);
    overlay.appendChild(bar);
    overlay.appendChild(iframeWrap);
    document.body.appendChild(overlay);

    // Back-button support
    history.pushState({ popGame: title }, '', window.location.pathname + window.location.hash);
    var _popGamePopstate = function() {
        var el = document.getElementById('popGameOverlay');
        if (el) el.remove();
        window.removeEventListener('popstate', _popGamePopstate);
    };
    window.addEventListener('popstate', _popGamePopstate);
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
    if (hash === 'proof-of-play') {
        if (!_popActive) window.enterProofOfPlay('arcade');
    } else if (hash === 'proof-of-play-pvp') {
        if (!_popActive) window.enterProofOfPlay('pvp');
    }
};

document.addEventListener('DOMContentLoaded', function() {
    var h = window.location.hash.replace('#', '');
    if (h === 'proof-of-play') window.enterProofOfPlay('arcade');
    else if (h === 'proof-of-play-pvp') window.enterProofOfPlay('pvp');
});

})();
