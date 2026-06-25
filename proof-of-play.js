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

// ---- Render arcade tab ----
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
            '</div>' +
        '</div>' +
        '<div class="pop-body" id="popBody"></div>';

    document.body.appendChild(overlay);

    var body = document.getElementById('popBody');
    if (startTab === 'pvp') {
        _renderPVPTab(body);
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
    body.style.opacity = '0';
    body.style.transition = 'opacity 0.15s';
    setTimeout(function() {
        if (tab === 'pvp') {
            _renderPVPTab(body);
        } else {
            _renderArcadeTab(body);
        }
        body.style.opacity = '';
        body.style.transition = '';
    }, 150);
};

window._popLaunchGame = function(url, title) {
    if (typeof showToast === 'function') showToast('🎮 Launching ' + title + '...');
    if (typeof awardPoints === 'function') awardPoints(5, '🎮 Proof of Play: ' + title);
    window.open(url, '_blank', 'noopener,noreferrer');
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
