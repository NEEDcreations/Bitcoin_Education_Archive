// © 2024-2026 603BTC LLC. All rights reserved.
// Bitcoin Quest — daily gifts, labeled keys, locked ciphers.
// Lazy-loaded. Rewards and limits are decided by Cloud Functions.

(function() {
'use strict';

var CIPHER_OPENS_PER_DAY = 21;

function _callCF(name, data) {
    if (typeof firebase === 'undefined' || !firebase.functions) return Promise.reject(new Error('Firebase unavailable'));
    return firebase.functions().httpsCallable(name)(data || {});
}

function _isSignedIn() {
    return typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous;
}

function _getUid() {
    return auth.currentUser.uid;
}

function _esc(s) {
    return typeof escapeHtml === 'function' ? escapeHtml(String(s || '')) : String(s || '');
}

function _utcDay() {
    return new Date().toISOString().slice(0, 10);
}

function _toast(msg, ms) {
    if (typeof showToast === 'function') showToast(msg, ms || 3500);
}

function _injectGiftingCSS() {
    if (document.getElementById('giftingCSS')) return;
    var s = document.createElement('style');
    s.id = 'giftingCSS';
    s.textContent = [
        '@keyframes giftBounce{0%{transform:scale(0.5)}60%{transform:scale(1.15)}100%{transform:scale(1)}}',
        '@keyframes giftShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-8deg)}40%{transform:rotate(8deg)}60%{transform:rotate(-5deg)}80%{transform:rotate(5deg)}}',
        '@keyframes giftReveal{from{opacity:0;transform:scale(0.86)}to{opacity:1;transform:scale(1)}}',
        '@keyframes decryptScan{0%{opacity:0.45}50%{opacity:1}100%{opacity:0.45}}',
        '@keyframes decryptReveal{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}',
        '@keyframes decryptConfetti{to{transform:translateY(220px) rotate(720deg);opacity:0}}',
        '@keyframes decryptPulse{0%,100%{text-shadow:0 0 8px #f7931a}50%{text-shadow:0 0 24px #f7931a}}',
        '.gifting-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.88);z-index:120000;display:flex;align-items:center;justify-content:center;padding:16px;}',
        '.gifting-modal{background:var(--card-bg,#0f172a);border:1px solid rgba(247,147,26,0.25);border-radius:20px;padding:22px 18px;max-width:420px;width:100%;text-align:center;box-shadow:0 8px 40px rgba(247,147,26,0.12);max-height:90vh;overflow-y:auto;}',
        '.gift-open-btn,.cipher-open-btn,.key-send-btn{padding:8px 12px;border:none;border-radius:8px;color:#fff;font-size:0.78rem;font-weight:800;cursor:pointer;font-family:inherit;white-space:nowrap;}',
        '@media (max-width:700px){.gifting-modal{padding:18px 14px;border-radius:16px;}}'
    ].join('');
    document.head.appendChild(s);
}

function _rewardEmoji(rw) {
    if (!rw) return '🎁';
    if (rw.rewardType === 'tickets') return '🎫';
    if (rw.rewardType === 'xp_bonus' || rw.rewardType === 'xp_tickets') return '⭐';
    if (rw.rewardType === 'streak_shield') return '🛡️';
    if (rw.rewardType === 'closet_item') return rw.itemEmoji || '👑';
    if (rw.rewardType === 'nacho_shoutout') return '🦌';
    if (rw.rewardType === 'keys') return '🔑';
    if (rw.rewardType === 'locked_ciphers') return '🔒';
    if (rw.rewardType === 'sats') return '⚡';
    return '🎁';
}

function _rewardLabel(rw) {
    if (!rw) return 'Reward';
    if (rw.rewardType === 'tickets') return '+' + (rw.ticketCount || 1) + ' Orange Ticket' + ((rw.ticketCount || 1) > 1 ? 's' : '');
    if (rw.rewardType === 'xp_bonus') return '+' + (rw.xpAmount || 50) + ' XP';
    if (rw.rewardType === 'xp_tickets') {
        var bits = ['+' + (rw.xpAmount || 50) + ' XP'];
        if ((rw.ticketCount || 0) > 0) bits.push('+' + rw.ticketCount + ' ticket' + (rw.ticketCount > 1 ? 's' : ''));
        return bits.join(' and ');
    }
    if (rw.rewardType === 'streak_shield') return 'Streak Shield';
    if (rw.rewardType === 'closet_item') return rw.itemName || 'Closet item';
    if (rw.rewardType === 'nacho_shoutout') return 'Nacho Shoutout';
    if (rw.rewardType === 'keys') {
        var labels = (rw.keyLabels || []).join(', ');
        return (rw.keyLabels || []).length + ' key' + ((rw.keyLabels || []).length === 1 ? '' : 's') + (labels ? ' (' + labels + ')' : '');
    }
    if (rw.rewardType === 'locked_ciphers') {
        var cl = (rw.cipherLabels || []).join(', ');
        return (rw.cipherLabels || []).length + ' locked cipher' + ((rw.cipherLabels || []).length === 1 ? '' : 's') + (cl ? ' (' + cl + ')' : '');
    }
    if (rw.rewardType === 'sats') {
        var amt = (rw.satsAmount || 0).toLocaleString();
        if (rw.satsStatus === 'pending') return amt + ' sats — Phil will pay this one';
        return amt + ' sats';
    }
    return 'Reward';
}

function _playHex(el, ms) {
    return new Promise(function(resolve) {
        if (!el) { setTimeout(resolve, ms); return; }
        var hex = '0123456789ABCDEF';
        el.style.animation = 'decryptScan 0.8s ease-in-out infinite';
        var timer = setInterval(function() {
            var s = '3045022100';
            for (var i = 0; i < 32; i++) s += hex[(Math.random() * 16) | 0];
            el.textContent = s;
        }, 45);
        setTimeout(function() {
            clearInterval(timer);
            el.style.animation = 'none';
            resolve();
        }, ms);
    });
}

function _confetti() {
    var colors = ['#f7931a', '#fbbf24', '#a78bfa', '#34d399', '#f472b6', '#60a5fa'];
    for (var i = 0; i < 12; i++) {
        var dot = document.createElement('div');
        dot.style.cssText = 'position:fixed;width:8px;height:8px;border-radius:50%;pointer-events:none;z-index:120001;left:' + (15 + Math.random() * 70) + '%;top:' + (8 + Math.random() * 30) + '%;background:' + colors[i % colors.length] + ';animation:decryptConfetti 1.2s ease-out forwards;';
        document.body.appendChild(dot);
        setTimeout(function(d) { if (d && d.parentNode) d.parentNode.removeChild(d); }, 1400, dot);
    }
}

function _btn(label, bg) {
    var b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.cssText = 'padding:10px 16px;background:' + (bg || 'linear-gradient(135deg,#f7931a,#ea580c)') + ';color:#fff;border:none;border-radius:10px;font-size:0.88rem;font-weight:800;cursor:pointer;font-family:inherit;';
    return b;
}

// ─── After the daily spin ────────────────────────────────────────────────────

window.awardDailyGifts = async function() {
    if (!_isSignedIn()) return;
    _injectGiftingCSS();
    window._suppressPendingGifts = true;
    try {
        var result = await _callCF('awardDailyGifts', {});
        var d = result.data || {};
        if (d.alreadyAwarded) {
            window._suppressPendingGifts = false;
            return;
        }
        if (d.giftsAdded > 0 && Array.isArray(d.gifts) && d.gifts.length) {
            _toast('🎁 ' + d.giftsAdded + ' gifts earned!');
            window.showPostSpinGiftModal(d.gifts);
        }
    } catch (e) {
        window._suppressPendingGifts = false;
        console.warn('[gifting] awardDailyGifts failed:', e.message);
    }
};

window.checkPendingGifts = async function() {
    if (window._pendingGiftsChecked || window._suppressPendingGifts) return;
    if (!_isSignedIn() || typeof db === 'undefined') return;
    window._pendingGiftsChecked = true;
    try {
        var snap = await db.collection('gifts')
            .where('ownerId', '==', _getUid())
            .where('status', 'in', ['unopened', 'inventory', 'sent'])
            .limit(40).get();
        if (window._suppressPendingGifts || document.getElementById('postSpinGiftOverlay')) return;
        if (snap.empty) return;
        var gifts = snap.docs.map(function(d) {
            return { id: d.id, rewardType: (d.data().rewardType || '') };
        });
        window.showPostSpinGiftModal(gifts, { pending: true });
    } catch (e) {
        console.warn('[gifting] pending gifts:', e.message);
    }
};

window.showPostSpinGiftModal = function(gifts, opts) {
    _injectGiftingCSS();
    opts = opts || {};
    var existing = document.getElementById('postSpinGiftOverlay');
    if (existing) existing.remove();
    window._postSpinGifts = gifts.slice();
    window._openedGiftRewards = [];

    var overlay = document.createElement('div');
    overlay.id = 'postSpinGiftOverlay';
    overlay.className = 'gifting-overlay';

    var modal = document.createElement('div');
    modal.className = 'gifting-modal';

    var count = gifts.length;
    var title = document.createElement('div');
    title.innerHTML = '<div style="font-size:2.6rem;animation:giftBounce 0.6s ease-out;">🎁</div>' +
        '<div style="color:#f7931a;font-weight:900;font-size:1.2rem;margin:4px 0;">' +
        (opts.pending ? 'You have ' + count + ' gift' + (count > 1 ? 's' : '') + ' to open' : 'You won ' + count + ' gift' + (count > 1 ? 's' : '') + '!') +
        '</div>' +
        '<div style="color:var(--text-muted);font-size:0.8rem;margin-bottom:8px;">Open them now — gifts are not saved for later.</div>';
    modal.appendChild(title);

    var stage = document.createElement('div');
    stage.id = 'giftAnimStage';
    stage.style.cssText = 'display:none;font-family:monospace;font-size:0.68rem;color:#f7931a;word-break:break-all;min-height:36px;margin:0 0 10px;padding:8px;background:rgba(247,147,26,0.06);border-radius:8px;';
    modal.appendChild(stage);

    var list = document.createElement('div');
    list.id = 'postSpinGiftList';
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin-bottom:14px;text-align:left;';
    gifts.forEach(function(g, i) {
        var row = document.createElement('div');
        row.id = 'giftRow_' + g.id;
        row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:10px 12px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:12px;';
        var icon = document.createElement('span');
        icon.textContent = '🎁';
        icon.style.fontSize = '1.4rem';
        var label = document.createElement('div');
        label.style.cssText = 'flex:1;color:var(--text-muted);font-size:0.85rem;';
        label.textContent = 'Gift ' + (i + 1);
        var btn = _btn('Open');
        btn.style.padding = '7px 14px';
        btn.style.fontSize = '0.8rem';
        btn.onclick = function() { window.openSingleGift(g.id); };
        row.appendChild(icon);
        row.appendChild(label);
        row.appendChild(btn);
        list.appendChild(row);
    });
    modal.appendChild(list);

    var follow = document.createElement('div');
    follow.id = 'giftFollowUp';
    follow.style.marginBottom = '12px';
    modal.appendChild(follow);

    var actions = document.createElement('div');
    actions.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;';
    var openAll = _btn('Open all');
    openAll.id = 'openAllGiftsBtn';
    openAll.onclick = function() { window.openAllPostSpinGifts(); };
    var later = _btn(opts.pending ? 'Not now' : 'Close', 'transparent');
    later.style.border = '1px solid var(--border,#333)';
    later.style.color = 'var(--text-muted)';
    later.onclick = function() {
        overlay.remove();
        if (opts.pending) window._suppressPendingGifts = true;
    };
    actions.appendChild(openAll);
    actions.appendChild(later);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
};

function _markGiftRow(giftId, rw, failed) {
    var row = document.getElementById('giftRow_' + giftId);
    if (!row) return;
    row.innerHTML = '';
    var icon = document.createElement('span');
    icon.style.cssText = 'font-size:1.3rem;animation:giftReveal 0.35s ease-out;';
    icon.textContent = failed ? '⚠️' : _rewardEmoji(rw);
    var label = document.createElement('div');
    label.style.cssText = 'flex:1;font-size:0.85rem;font-weight:700;color:var(--text);';
    label.textContent = failed ? 'Could not open — try again' : _rewardLabel(rw);
    row.appendChild(icon);
    row.appendChild(label);
    row.style.borderColor = failed ? 'rgba(239,68,68,0.35)' : 'rgba(52,211,153,0.35)';
    row.style.background = failed ? 'rgba(239,68,68,0.05)' : 'rgba(52,211,153,0.06)';
    if (!failed) {
        var ok = document.createElement('span');
        ok.textContent = '✓';
        ok.style.color = '#34d399';
        ok.style.fontWeight = '800';
        row.appendChild(ok);
    }
}

async function _openGiftRequest(giftId) {
    var res = await _callCF('openGift', { giftId: giftId });
    var rw = (res.data && res.data.reward) ? res.data.reward : { rewardType: 'tickets', ticketCount: 1 };
    window._openedGiftRewards.push(rw);
    return rw;
}

window.openSingleGift = async function(giftId) {
    _injectGiftingCSS();
    var row = document.getElementById('giftRow_' + giftId);
    if (row) {
        var old = row.querySelector('button');
        if (old) { old.disabled = true; old.textContent = 'Opening…'; }
    }
    var stage = document.getElementById('giftAnimStage');
    if (stage) {
        stage.style.display = 'block';
        stage.textContent = '🔓 Unlocking gift…';
    }
    var anim = _playHex(stage, 700);
    try {
        var rw = await _openGiftRequest(giftId);
        await anim;
        if (stage) stage.style.display = 'none';
        _markGiftRow(giftId, rw, false);
        _confetti();
        _toast('🎁 ' + _rewardLabel(rw));
        _showGiftFollowUp();
    } catch (e) {
        await anim;
        if (stage) stage.style.display = 'none';
        _markGiftRow(giftId, null, true);
        if (row) {
            var retry = _btn('Try again');
            retry.style.padding = '6px 10px';
            retry.style.fontSize = '0.75rem';
            retry.onclick = function() { window.openSingleGift(giftId); };
            row.appendChild(retry);
        }
        _toast('❌ ' + (e.message || 'Could not open that gift'));
    }
};

window.openAllPostSpinGifts = async function() {
    var gifts = window._postSpinGifts || [];
    var openAll = document.getElementById('openAllGiftsBtn');
    if (openAll) { openAll.disabled = true; openAll.textContent = 'Opening…'; }
    var stage = document.getElementById('giftAnimStage');
    for (var i = 0; i < gifts.length; i++) {
        var g = gifts[i];
        var row = document.getElementById('giftRow_' + g.id);
        if (row && row.querySelector('button') == null && row.textContent.indexOf('✓') !== -1) continue;
        if (row) row.style.opacity = '0.7';
        if (stage) { stage.style.display = 'block'; stage.textContent = '🎁'; }
        var anim = _playHex(stage, 550);
        try {
            var rw = await _openGiftRequest(g.id);
            await anim;
            _markGiftRow(g.id, rw, false);
        } catch (e) {
            await anim;
            _markGiftRow(g.id, null, true);
        }
    }
    if (stage) stage.style.display = 'none';
    if (openAll) { openAll.textContent = 'All opened'; openAll.style.background = '#34d399'; }
    _confetti();
    _showGiftFollowUp();
    var summary = _summarize(window._openedGiftRewards || []);
    if (summary) _toast('🎁 Opened! ' + summary, 4500);
};

function _summarize(list) {
    var tickets = 0, xp = 0, keys = 0, ciphers = 0, shields = 0, sats = 0;
    list.forEach(function(rw) {
        if (rw.rewardType === 'tickets') tickets += rw.ticketCount || 1;
        if (rw.rewardType === 'xp_bonus' || rw.rewardType === 'xp_tickets') xp += rw.xpAmount || 0;
        if (rw.rewardType === 'xp_tickets') tickets += rw.ticketCount || 0;
        if (rw.rewardType === 'keys') keys += (rw.keyLabels || []).length;
        if (rw.rewardType === 'locked_ciphers') ciphers += (rw.cipherLabels || []).length;
        if (rw.rewardType === 'streak_shield') shields++;
        if (rw.rewardType === 'sats') sats += rw.satsAmount || 0;
    });
    var parts = [];
    if (tickets) parts.push('+' + tickets + ' tickets');
    if (xp) parts.push('+' + xp + ' XP');
    if (keys) parts.push(keys + ' key' + (keys > 1 ? 's' : ''));
    if (ciphers) parts.push(ciphers + ' cipher' + (ciphers > 1 ? 's' : ''));
    if (shields) parts.push(shields + ' shield' + (shields > 1 ? 's' : ''));
    if (sats) parts.push(sats + ' sats');
    return parts.join(' · ');
}

async function _showGiftFollowUp() {
    var box = document.getElementById('giftFollowUp');
    if (!box) return;
    var rewards = window._openedGiftRewards || [];
    var keyIds = [];
    rewards.forEach(function(rw) {
        (rw.keyIds || []).forEach(function(id) { keyIds.push(id); });
    });
    box.innerHTML = '';
    if (keyIds.length) {
        var note = document.createElement('div');
        note.style.cssText = 'font-size:0.8rem;color:var(--text);margin-bottom:8px;';
        note.textContent = 'You got ' + keyIds.length + ' key' + (keyIds.length > 1 ? 's' : '') + '. Send ' + (keyIds.length > 3 ? 'up to 3 of them' : (keyIds.length > 1 ? 'them' : 'it')) + ' to a peer?';
        var send = _btn('Send keys to a peer');
        send.style.width = '100%';
        send.style.marginBottom = '8px';
        var ids = keyIds.slice(0, 3);
        send.onclick = function() { window.showPeerPickerForKeys(ids); };
        box.appendChild(note);
        box.appendChild(send);
    }
    try {
        var matches = await _matchingLabels();
        if (!matches.length) return;
        matches.forEach(function(m) {
            var banner = document.createElement('div');
            banner.style.cssText = 'margin-top:8px;padding:10px;border-radius:10px;background:rgba(52,211,153,0.08);border:1px solid rgba(52,211,153,0.35);text-align:left;';
            var t = document.createElement('div');
            t.style.cssText = 'font-weight:800;color:#34d399;font-size:0.85rem;margin-bottom:6px;';
            t.textContent = 'You have a matching ' + m.label + ' key and cipher. Open it now?';
            var b = _btn('Open ' + m.label, 'linear-gradient(135deg,#34d399,#10b981)');
            b.style.width = '100%';
            b.onclick = function() { window.openCipherWithMatch(m.cipherId, m.label); };
            banner.appendChild(t);
            banner.appendChild(b);
            box.appendChild(banner);
        });
    } catch (e) { /* inventory read can fail before rules deploy */ }
    if (typeof window.renderKeysAndCiphersPanel === 'function') {
        var host = document.getElementById('nookKeysCiphers');
        if (host) window.renderKeysAndCiphersPanel(host);
    }
}

async function _matchingLabels() {
    var data = await _loadHoldings();
    var keyLabels = {};
    data.ownKeys.concat(data.peerKeys).forEach(function(k) { keyLabels[k.label] = true; });
    var seen = {};
    var out = [];
    data.ciphers.forEach(function(c) {
        if (keyLabels[c.label] && !seen[c.label]) {
            seen[c.label] = true;
            out.push({ label: c.label, cipherId: c.id });
        }
    });
    return out;
}

// ─── Holdings ────────────────────────────────────────────────────────────────

async function _loadHoldings() {
    var empty = { ownKeys: [], peerKeys: [], ciphers: [] };
    if (!_isSignedIn() || typeof db === 'undefined') return empty;
    var uid = _getUid();
    try {
        var snaps = await Promise.all([
            db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'inventory').limit(100).get(),
            db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'sent').limit(100).get(),
            db.collection('locked_ciphers').where('ownerId', '==', uid).where('status', '==', 'inventory').limit(200).get(),
        ]);
        function map(snap) { return snap.docs.map(function(d) { return Object.assign({ id: d.id }, d.data()); }); }
        return { ownKeys: map(snaps[0]), peerKeys: map(snaps[1]), ciphers: map(snaps[2]) };
    } catch (e) {
        console.warn('[gifting] holdings:', e.message);
        return empty;
    }
}

window.loadKeyInventory = async function() {
    var h = await _loadHoldings();
    return { inventory: h.ownKeys, received: h.peerKeys };
};

window.loadCipherInventory = async function() {
    var h = await _loadHoldings();
    return { ciphers: h.ciphers };
};

function _group(list) {
    var g = {};
    list.forEach(function(item) {
        var label = item.label || '?';
        if (!g[label]) g[label] = [];
        g[label].push(item);
    });
    return g;
}

function _card(el) {
    var d = document.createElement('div');
    d.style.cssText = 'display:flex;align-items:center;gap:10px;padding:12px;background:var(--card-bg,#1a1a2e);border:1px solid var(--border,#333);border-radius:12px;';
    el.appendChild(d);
    return d;
}

window.renderKeysAndCiphersPanel = async function(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el) return;
    _injectGiftingCSS();
    el.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">Loading keys and ciphers…</div>';
    if (!_isSignedIn()) {
        el.innerHTML = '<div style="padding:8px;color:var(--text-muted);font-size:0.8rem;">Sign in to see keys and locked ciphers.</div>';
        return;
    }
    var data = await _loadHoldings();
    el.innerHTML = '';

    var heading = document.createElement('div');
    heading.style.cssText = 'font-size:0.72rem;font-weight:800;color:#f7931a;letter-spacing:0.08em;text-transform:uppercase;margin:4px 0 8px;';
    heading.textContent = 'Locked ciphers';
    el.appendChild(heading);

    var cipherGroups = _group(data.ciphers);
    var ownGroups = _group(data.ownKeys);
    var peerGroups = _group(data.peerKeys);
    var labels = Object.keys(cipherGroups).sort();

    if (!labels.length) {
        var empty = document.createElement('div');
        empty.style.cssText = 'padding:12px;border:1px dashed var(--border,#333);border-radius:12px;color:var(--text-muted);font-size:0.8rem;margin-bottom:12px;';
        empty.textContent = 'No locked ciphers yet. Spin the daily wheel and open your gifts — some gifts contain ciphers.';
        el.appendChild(empty);
    }

    labels.forEach(function(label) {
        var group = cipherGroups[label];
        var peerKey = (peerGroups[label] || [])[0] || null;
        var ownKey = (ownGroups[label] || [])[0] || null;
        var match = peerKey || ownKey;
        var card = _card(el);
        card.style.marginBottom = '8px';
        card.style.borderColor = match ? 'rgba(52,211,153,0.45)' : 'var(--border,#333)';
        var icon = document.createElement('div');
        icon.style.textAlign = 'center';
        icon.innerHTML = '<div style="font-size:1.4rem;">' + (match ? '🔓' : '🔒') + '</div><div style="font-family:monospace;font-weight:900;color:' + (match ? '#34d399' : '#a78bfa') + ';">' + _esc(label) + '</div>';
        var mid = document.createElement('div');
        mid.style.cssText = 'flex:1;min-width:0;';
        var title = document.createElement('div');
        title.style.cssText = 'font-weight:800;font-size:0.88rem;color:var(--heading,#fff);';
        title.textContent = '× ' + group.length;
        var sub = document.createElement('div');
        sub.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-top:2px;';
        if (peerKey) sub.textContent = 'Matching key from ' + (peerKey.sentByName || 'a peer') + '.';
        else if (ownKey) sub.textContent = 'You have your own ' + label + ' key. You can open this.';
        else sub.textContent = 'Needs a ' + label + ' key from you or a peer.';
        mid.appendChild(title);
        mid.appendChild(sub);
        card.appendChild(icon);
        card.appendChild(mid);
        if (match) {
            var open = _btn('Open', 'linear-gradient(135deg,#34d399,#10b981)');
            open.className = 'cipher-open-btn';
            open.onclick = function() { window.openCipherWithMatch(group[0].id, label); };
            card.appendChild(open);
        }
    });

    var keyHead = document.createElement('div');
    keyHead.style.cssText = 'font-size:0.72rem;font-weight:800;color:#f7931a;letter-spacing:0.08em;text-transform:uppercase;margin:14px 0 8px;';
    keyHead.textContent = 'Your keys — send to peers';
    el.appendChild(keyHead);

    var ownLabels = Object.keys(ownGroups).sort();
    if (!ownLabels.length) {
        var noKeys = document.createElement('div');
        noKeys.style.cssText = 'padding:12px;border:1px dashed var(--border,#333);border-radius:12px;color:var(--text-muted);font-size:0.8rem;margin-bottom:8px;';
        noKeys.textContent = 'No keys waiting to send. Open gifts from the daily wheel to earn some.';
        el.appendChild(noKeys);
    }
    ownLabels.forEach(function(label) {
        var group = ownGroups[label];
        var card = _card(el);
        card.style.marginBottom = '8px';
        var lab = document.createElement('div');
        lab.style.cssText = 'font-family:monospace;font-weight:900;font-size:1.05rem;color:#f7931a;min-width:52px;';
        lab.textContent = '🔑 ' + label;
        var qty = document.createElement('div');
        qty.style.cssText = 'flex:1;font-size:0.85rem;font-weight:700;';
        qty.textContent = '× ' + group.length;
        var send = _btn('Send');
        send.className = 'key-send-btn';
        var ids = group.slice(0, 3).map(function(k) { return k.id; });
        send.onclick = function() { window.showPeerPickerForKeys(ids); };
        card.appendChild(lab);
        card.appendChild(qty);
        card.appendChild(send);
    });
    var hint = document.createElement('div');
    hint.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin:2px 0 8px;';
    hint.textContent = 'Up to 3 keys per peer each day. You can send to as many peers as you like.';
    el.appendChild(hint);

    var recvHead = document.createElement('div');
    recvHead.style.cssText = 'font-size:0.72rem;font-weight:800;color:#a78bfa;letter-spacing:0.08em;text-transform:uppercase;margin:12px 0 8px;';
    recvHead.textContent = 'Keys from peers';
    el.appendChild(recvHead);
    if (!data.peerKeys.length) {
        var noRecv = document.createElement('div');
        noRecv.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:8px;';
        noRecv.textContent = 'When a peer sends you a key, it shows up here.';
        el.appendChild(noRecv);
    }
    data.peerKeys.forEach(function(k) {
        var card = _card(el);
        card.style.marginBottom = '8px';
        var lab = document.createElement('div');
        lab.style.cssText = 'font-family:monospace;font-weight:900;color:#a78bfa;';
        lab.textContent = '🔑 ' + (k.label || '');
        var from = document.createElement('div');
        from.style.cssText = 'flex:1;font-size:0.78rem;color:var(--text-muted);';
        from.textContent = 'from ' + (k.sentByName || 'a peer');
        card.appendChild(lab);
        card.appendChild(from);
        if ((cipherGroups[k.label] || []).length) {
            var open = _btn('Open ' + k.label, 'linear-gradient(135deg,#34d399,#10b981)');
            open.onclick = function() { window.openCipherWithMatch(cipherGroups[k.label][0].id, k.label); };
            card.appendChild(open);
        }
    });

    var winsHost = document.createElement('div');
    winsHost.id = 'nookCipherWins';
    winsHost.style.marginTop = '12px';
    el.appendChild(winsHost);
    _renderMyWins(winsHost);

    var cap = document.createElement('div');
    cap.style.cssText = 'font-size:0.72rem;color:var(--text-faint);text-align:center;margin-top:8px;';
    cap.textContent = 'You can open up to ' + CIPHER_OPENS_PER_DAY + ' ciphers per day.';
    el.appendChild(cap);
};

window.renderKeysTab = function(containerId) { return window.renderKeysAndCiphersPanel(containerId); };
window.renderCiphersTab = window.renderKeysTab;

async function _renderMyWins(el) {
    try {
        var res = await _callCF('listMyCipherWins', {});
        var wins = (res.data && res.data.wins) || [];
        var open = wins.filter(function(w) { return w.status === 'claimable' || w.status === 'pending' || w.status === 'paying'; });
        if (!open.length) { el.innerHTML = ''; return; }
        el.innerHTML = '';
        var h = document.createElement('div');
        h.style.cssText = 'font-size:0.72rem;font-weight:800;color:#f7931a;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;';
        h.textContent = 'Sats from ciphers';
        el.appendChild(h);
        open.forEach(function(w) {
            var card = _card(el);
            card.style.marginBottom = '8px';
            var mid = document.createElement('div');
            mid.style.flex = '1';
            var t = document.createElement('div');
            t.style.cssText = 'font-weight:800;font-size:0.88rem;';
            t.textContent = (w.amount || 0).toLocaleString() + ' sats';
            var s = document.createElement('div');
            s.style.cssText = 'font-size:0.72rem;color:var(--text-muted);';
            if (w.status === 'claimable') s.textContent = 'Cipher ' + (w.cipherLabel || '') + ' — ready to claim';
            else if (w.status === 'paying') s.textContent = 'Payment in progress';
            else s.textContent = 'Cipher ' + (w.cipherLabel || '') + ' — Phil pays prizes of 1,000 sats and up';
            mid.appendChild(t);
            mid.appendChild(s);
            card.appendChild(mid);
            if (w.status === 'claimable') {
                var b = _btn('Claim');
                b.onclick = function() { window.showCipherClaim(w); };
                card.appendChild(b);
            }
        });
    } catch (e) { el.innerHTML = ''; }
}

// ─── Open a cipher ───────────────────────────────────────────────────────────

async function _findKeyForLabel(label) {
    var uid = _getUid();
    var peer = await db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'sent').where('label', '==', label).limit(1).get();
    if (!peer.empty) return Object.assign({ id: peer.docs[0].id }, peer.docs[0].data());
    var own = await db.collection('keys').where('ownerId', '==', uid).where('status', '==', 'inventory').where('label', '==', label).limit(1).get();
    if (!own.empty) return Object.assign({ id: own.docs[0].id }, own.docs[0].data());
    return null;
}

window.openCipherWithMatch = async function(cipherId, label) {
    if (!_isSignedIn()) { _toast('Sign in to open a cipher'); return; }
    _injectGiftingCSS();
    var key = null;
    try { key = await _findKeyForLabel(label); } catch (e) { _toast('Could not look up a matching key'); return; }
    if (!key) { _toast('You need a ' + label + ' key to open this cipher'); return; }
    window.decryptCipherModal(cipherId, label, key);
};

window.decryptCipherModal = async function(cipherId, cipherLabel, knownKey) {
    if (!_isSignedIn()) { _toast('Sign in to open a cipher'); return; }
    _injectGiftingCSS();
    var key = knownKey || null;
    if (!key) {
        try { key = await _findKeyForLabel(cipherLabel); } catch (e) { key = null; }
    }
    if (!key) { _toast('No matching ' + cipherLabel + ' key'); return; }

    var old = document.getElementById('decryptCipherOverlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'decryptCipherOverlay';
    overlay.className = 'gifting-overlay';
    var modal = document.createElement('div');
    modal.className = 'gifting-modal';
    var own = key.status === 'inventory';
    modal.innerHTML =
        '<div id="dcLabel" style="font-family:monospace;font-size:2.4rem;font-weight:900;color:#a78bfa;letter-spacing:3px;">🔒 ' + _esc(cipherLabel) + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.78rem;margin:6px 0 12px;">' + (own ? 'Using your own ' + _esc(cipherLabel) + ' key' : 'Using the ' + _esc(cipherLabel) + ' key from ' + _esc(key.sentByName || 'a peer')) + '</div>' +
        '<div id="dcHex" style="font-family:monospace;font-size:0.7rem;color:#f7931a;word-break:break-all;min-height:48px;margin-bottom:12px;padding:10px;background:rgba(247,147,26,0.05);border-radius:8px;"></div>' +
        '<div id="dcStatus" style="color:var(--text-muted);font-size:0.85rem;font-weight:600;">Checking the key…</div>' +
        '<div id="dcResult" style="display:none;"></div>';
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    var hexEl = document.getElementById('dcHex');
    var statusEl = document.getElementById('dcStatus');
    var anim = _playHex(hexEl, 1200);
    var result, err;
    try { result = await _callCF('decryptCipher', { cipherId: cipherId, keyId: key.id }); }
    catch (e) { err = e.message || 'Could not open the cipher'; }
    await anim;

    var resultDiv = document.getElementById('dcResult');
    if (!overlay.parentNode) return;
    if (statusEl) statusEl.textContent = '';
    if (hexEl) hexEl.style.display = 'none';
    if (err) {
        if (resultDiv) {
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<div style="color:#ef4444;font-weight:700;margin-bottom:12px;">❌ ' + _esc(err) + '</div>';
            var close = _btn('Close', 'transparent');
            close.style.border = '1px solid var(--border,#333)';
            close.style.color = 'var(--text-muted)';
            close.style.width = '100%';
            close.onclick = function() { overlay.remove(); };
            resultDiv.appendChild(close);
        }
        return;
    }

    var labelEl = document.getElementById('dcLabel');
    if (labelEl) labelEl.innerHTML = '🔓 <span style="color:#f7931a;animation:decryptPulse 1.2s ease-in-out 2;">' + _esc(cipherLabel) + '</span>';
    var rw = (result && result.data && result.data.reward) ? result.data.reward : { rewardType: 'xp_tickets', xpAmount: 50, ticketCount: 0 };
    if (resultDiv) {
        resultDiv.style.display = 'block';
        resultDiv.style.animation = 'decryptReveal 0.4s ease-out';
        var emoji = document.createElement('div');
        emoji.style.cssText = 'font-size:2.4rem;margin-bottom:6px;';
        emoji.textContent = _rewardEmoji(rw);
        var line = document.createElement('div');
        line.style.cssText = 'color:#f7931a;font-weight:900;font-size:1.2rem;';
        line.textContent = _rewardLabel(rw);
        resultDiv.appendChild(emoji);
        resultDiv.appendChild(line);
        if (rw.opensToday) {
            var used = document.createElement('div');
            used.style.cssText = 'font-size:0.72rem;color:var(--text-faint);margin-top:6px;';
            used.textContent = rw.opensToday + ' / ' + (rw.opensMax || CIPHER_OPENS_PER_DAY) + ' ciphers opened today';
            resultDiv.appendChild(used);
        }
        if (rw.rewardType === 'sats' && rw.satsStatus === 'claimable' && rw.winId) {
            var claim = _btn('Claim ' + (rw.satsAmount || '') + ' sats');
            claim.style.width = '100%';
            claim.style.marginTop = '12px';
            claim.onclick = function() { window.showCipherClaim({ id: rw.winId, amount: rw.satsAmount, cipherLabel: cipherLabel, status: 'claimable' }); };
            resultDiv.appendChild(claim);
        }
        var done = _btn('Nice!');
        done.style.width = '100%';
        done.style.marginTop = '10px';
        done.onclick = function() { overlay.remove(); };
        resultDiv.appendChild(done);
    }
    _confetti();
    _toast('🔓 Cipher ' + cipherLabel + ' opened! ' + _rewardLabel(rw));
    var host = document.getElementById('nookKeysCiphers');
    if (host) window.renderKeysAndCiphersPanel(host);
};

// ─── Claim a small sats win ──────────────────────────────────────────────────

window.showCipherClaim = function(win) {
    _injectGiftingCSS();
    var old = document.getElementById('cipherClaimOverlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'cipherClaimOverlay';
    overlay.className = 'gifting-overlay';
    var modal = document.createElement('div');
    modal.className = 'gifting-modal';
    modal.style.textAlign = 'left';
    var title = document.createElement('div');
    title.style.cssText = 'font-weight:900;color:#f7931a;font-size:1.05rem;margin-bottom:6px;text-align:center;';
    title.textContent = 'Claim ' + (win.amount || 0).toLocaleString() + ' sats';
    var help = document.createElement('div');
    help.style.cssText = 'font-size:0.78rem;color:var(--text-muted);margin-bottom:10px;text-align:center;';
    help.textContent = 'Paste a Lightning invoice for exactly this amount, or type a Lightning Address (name@wallet).';
    var input = document.createElement('textarea');
    input.id = 'cipherClaimInput';
    input.rows = 3;
    input.placeholder = 'lnbc… invoice   or   you@walletofsatoshi.com';
    input.style.cssText = 'width:100%;box-sizing:border-box;padding:10px;border-radius:10px;border:1px solid var(--border,#333);background:var(--input-bg,#111);color:var(--text,#fff);font-family:inherit;font-size:0.85rem;margin-bottom:10px;';
    var row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;';
    var go = _btn('Pay me');
    go.style.flex = '1';
    var cancel = _btn('Cancel', 'transparent');
    cancel.style.border = '1px solid var(--border,#333)';
    cancel.style.color = 'var(--text-muted)';
    cancel.onclick = function() { overlay.remove(); };
    go.onclick = async function() {
        var raw = (input.value || '').trim();
        if (!raw) { _toast('Paste an invoice or Lightning Address'); return; }
        go.disabled = true;
        go.textContent = 'Paying…';
        var payload = { winId: win.id };
        if (raw.toLowerCase().indexOf('lnbc') === 0) payload.invoice = raw;
        else payload.lightningAddress = raw;
        try {
            var res = await _callCF('claimCipherWin', payload);
            var d = res.data || {};
            if (!d.success) {
                go.disabled = false;
                go.textContent = 'Pay me';
                _toast('❌ ' + (d.error || 'Payment failed'));
                return;
            }
            overlay.remove();
            _toast('⚡ ' + (d.amount || win.amount) + ' sats sent!');
            var host = document.getElementById('nookKeysCiphers');
            if (host) window.renderKeysAndCiphersPanel(host);
        } catch (e) {
            go.disabled = false;
            go.textContent = 'Pay me';
            _toast('❌ ' + (e.message || 'Payment failed'));
        }
    };
    row.appendChild(go);
    row.appendChild(cancel);
    modal.appendChild(title);
    modal.appendChild(help);
    modal.appendChild(input);
    modal.appendChild(row);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    setTimeout(function() { input.focus(); }, 50);
};

// ─── Send keys ───────────────────────────────────────────────────────────────

window.showPeerPickerForKeys = async function(keyIds) {
    if (!_isSignedIn()) { _toast('Sign in to send keys'); return; }
    _injectGiftingCSS();
    var ids = (keyIds || []).slice(0, 3);
    if (!ids.length) { _toast('Pick a key first'); return; }
    var uid = _getUid();
    var peers = [];
    try {
        var doc = await db.collection('users').doc(uid).get();
        var list = (doc.exists && doc.data().peers) || [];
        var profiles = await Promise.all(list.slice(0, 40).map(function(p) {
            return db.collection('public_profiles').doc(p).get().then(function(s) {
                return { uid: p, name: s.exists ? (s.data().username || s.data().displayName || 'Bitcoiner') : 'Bitcoiner' };
            });
        }));
        peers = profiles;
    } catch (e) { peers = []; }

    var old = document.getElementById('peerPickerOverlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'peerPickerOverlay';
    overlay.className = 'gifting-overlay';
    overlay.style.alignItems = 'flex-end';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--card-bg,#0f172a);border:1px solid var(--border,#333);border-radius:18px 18px 0 0;padding:18px;width:100%;max-width:480px;max-height:80vh;overflow-y:auto;';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:6px;';
    h.textContent = 'Send ' + ids.length + ' key' + (ids.length > 1 ? 's' : '') + ' to…';
    var sub = document.createElement('div');
    sub.style.cssText = 'font-size:0.75rem;color:var(--text-muted);margin-bottom:12px;';
    sub.textContent = 'One send per peer each day, up to 3 keys.';
    sheet.appendChild(h);
    sheet.appendChild(sub);
    if (!peers.length) {
        var none = document.createElement('div');
        none.style.cssText = 'font-size:0.85rem;color:var(--text-muted);margin-bottom:10px;';
        none.textContent = 'You have no peers yet. Add one from Settings → Account → Peers, then come back.';
        sheet.appendChild(none);
    }
    peers.forEach(function(p) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = p.name;
        b.style.cssText = 'display:block;width:100%;text-align:left;margin-bottom:8px;padding:12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.3);border-radius:10px;color:var(--text,#fff);font-weight:700;cursor:pointer;font-family:inherit;';
        b.onclick = async function() {
            b.disabled = true;
            b.textContent = 'Sending…';
            try {
                await _callCF('sendKeys', { keyIds: ids, recipientUid: p.uid });
                _toast('🔑 Sent to ' + p.name + '! +25 XP');
                overlay.remove();
                var host = document.getElementById('nookKeysCiphers');
                if (host) window.renderKeysAndCiphersPanel(host);
            } catch (e) {
                b.disabled = false;
                b.textContent = p.name;
                _toast('❌ ' + (e.message || 'Could not send'));
            }
        };
        sheet.appendChild(b);
    });
    var close = _btn('Close', 'transparent');
    close.style.border = '1px solid var(--border,#333)';
    close.style.color = 'var(--text-muted)';
    close.style.width = '100%';
    close.onclick = function() { overlay.remove(); };
    sheet.appendChild(close);
    overlay.appendChild(sheet);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
};

window.showKeyPickerForPeer = async function(recipientUid, recipientName) {
    if (!_isSignedIn()) { _toast('Sign in to send keys'); return; }
    _injectGiftingCSS();
    var isPeer = (window._myPeers && window._myPeers.has && window._myPeers.has(recipientUid));
    if (!isPeer && typeof currentUser !== 'undefined' && currentUser && Array.isArray(currentUser.peers)) {
        isPeer = currentUser.peers.indexOf(recipientUid) !== -1;
    }
    if (!isPeer) {
        _toast('Add ' + (recipientName || 'them') + ' as a peer before sending keys');
        return;
    }
    var holdings = await _loadHoldings();
    var keys = holdings.ownKeys;
    var old = document.getElementById('keyPickerOverlay');
    if (old) old.remove();
    var overlay = document.createElement('div');
    overlay.id = 'keyPickerOverlay';
    overlay.className = 'gifting-overlay';
    overlay.style.alignItems = 'flex-end';
    var sheet = document.createElement('div');
    sheet.style.cssText = 'background:var(--card-bg,#0f172a);border-radius:18px 18px 0 0;padding:18px;width:100%;max-width:480px;max-height:80vh;overflow:auto;border:1px solid var(--border,#333);';
    var h = document.createElement('div');
    h.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:8px;';
    h.textContent = 'Send keys to ' + (recipientName || 'peer');
    sheet.appendChild(h);

    var today = _utcDay();
    var offset = (typeof getDailyKey === 'function') ? getDailyKey() : today;
    try {
        var dates = today === offset ? [today] : [today, offset];
        var pairSnap = await db.collection('key_send_pairs').where('senderUid', '==', _getUid()).where('date', 'in', dates).limit(100).get();
        var alreadySent = false;
        pairSnap.forEach(function(d) {
            if (d.data().recipientUid === recipientUid) alreadySent = true;
        });
        if (alreadySent) {
            var blocked = document.createElement('div');
            blocked.style.cssText = 'padding:10px;border-radius:8px;background:rgba(239,68,68,0.08);color:#ef4444;font-size:0.8rem;font-weight:700;margin-bottom:10px;';
            blocked.textContent = 'You already sent keys to this peer today.';
            sheet.appendChild(blocked);
            var closeBlocked = _btn('Close', 'transparent');
            closeBlocked.style.border = '1px solid var(--border,#333)';
            closeBlocked.style.color = 'var(--text-muted)';
            closeBlocked.style.width = '100%';
            closeBlocked.onclick = function() { overlay.remove(); };
            sheet.appendChild(closeBlocked);
            overlay.appendChild(sheet);
            document.body.appendChild(overlay);
            return;
        }
    } catch (e) { /* server still enforces the cap */ }

    if (!keys.length) {
        var none = document.createElement('div');
        none.style.cssText = 'color:var(--text-muted);font-size:0.85rem;margin-bottom:10px;';
        none.textContent = 'No keys to send. Open gifts from the daily wheel first.';
        sheet.appendChild(none);
    }
    var selected = [];
    var list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin-bottom:12px;';
    function paint() {
        list.innerHTML = '';
        keys.forEach(function(k) {
            var on = selected.indexOf(k.id) !== -1;
            var chip = document.createElement('button');
            chip.type = 'button';
            chip.textContent = (on ? '✓ ' : '') + k.label;
            chip.style.cssText = 'padding:8px 12px;font-family:monospace;font-weight:900;border-radius:8px;cursor:pointer;border:2px solid ' + (on ? '#f7931a' : 'rgba(247,147,26,0.3)') + ';background:' + (on ? 'rgba(247,147,26,0.2)' : 'transparent') + ';color:' + (on ? '#f7931a' : 'var(--text-muted)') + ';';
            chip.onclick = function() {
                var idx = selected.indexOf(k.id);
                if (idx !== -1) selected.splice(idx, 1);
                else if (selected.length >= 3) _toast('Max 3 keys per send');
                else selected.push(k.id);
                paint();
                send.disabled = selected.length === 0;
                send.style.opacity = selected.length ? '1' : '0.4';
            };
            list.appendChild(chip);
        });
    }
    var send = _btn('Send keys');
    send.style.width = '100%';
    send.disabled = true;
    send.style.opacity = '0.4';
    send.onclick = async function() {
        send.disabled = true;
        send.textContent = 'Sending…';
        try {
            await _callCF('sendKeys', { keyIds: selected.slice(), recipientUid: recipientUid });
            _toast('🔑 Sent to ' + (recipientName || 'your peer') + '! +25 XP');
            overlay.remove();
            var host = document.getElementById('nookKeysCiphers');
            if (host) window.renderKeysAndCiphersPanel(host);
        } catch (e) {
            send.disabled = false;
            send.textContent = 'Send keys';
            _toast('❌ ' + (e.message || 'Could not send'));
        }
    };
    paint();
    sheet.appendChild(list);
    sheet.appendChild(send);
    var close = _btn('Close', 'transparent');
    close.style.border = '1px solid var(--border,#333)';
    close.style.color = 'var(--text-muted)';
    close.style.width = '100%';
    close.style.marginTop = '8px';
    close.onclick = function() { overlay.remove(); };
    sheet.appendChild(close);
    overlay.appendChild(sheet);
    document.body.appendChild(overlay);
};

// ─── Settings blurb: pending gifts only (the explanation is in the page) ────

window.renderGiftsSettingsTab = async function() {
    var container = document.getElementById('giftsTabContent');
    if (!container) return;
    if (!_isSignedIn()) {
        container.innerHTML = '';
        return;
    }
    try {
        var snap = await db.collection('gifts')
            .where('ownerId', '==', _getUid())
            .where('status', 'in', ['unopened', 'inventory', 'sent'])
            .limit(40).get();
        container.innerHTML = '';
        if (snap.empty) return;
        var gifts = snap.docs.map(function(d) { return { id: d.id }; });
        var wrap = document.createElement('div');
        wrap.style.cssText = 'margin-top:10px;padding:12px;border-radius:12px;background:rgba(247,147,26,0.08);border:1px solid rgba(247,147,26,0.3);';
        var t = document.createElement('div');
        t.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:8px;';
        t.textContent = gifts.length + ' gift' + (gifts.length > 1 ? 's' : '') + ' waiting to be opened';
        var b = _btn('Open them');
        b.style.width = '100%';
        b.onclick = function() { window.showPostSpinGiftModal(gifts, { pending: true }); };
        wrap.appendChild(t);
        wrap.appendChild(b);
        container.appendChild(wrap);
    } catch (e) {
        container.textContent = '';
    }
};

window.openNookInventory = function() {
    if (typeof showQuestHub !== 'function') return;
    showQuestHub();
    setTimeout(function() {
        window._questHubTab = 'nook';
        window._nookSubTab = 'inventory';
        if (typeof _renderQuestHubTab === 'function') _renderQuestHubTab();
    }, 120);
};

// ─── Admin ledger ────────────────────────────────────────────────────────────

window.renderCipherWinsAdmin = async function(container) {
    var el = typeof container === 'string' ? document.getElementById(container) : container;
    if (!el || window._isAdminClaim !== true) { if (el) el.innerHTML = ''; return; }
    el.innerHTML = '<div style="font-size:0.8rem;color:var(--text-muted);padding:8px;">Loading cipher wins…</div>';
    try {
        var res = await _callCF('adminListCipherWins', {});
        var wins = (res.data && res.data.wins) || [];
        el.innerHTML = '';
        var h = document.createElement('div');
        h.style.cssText = 'font-weight:800;color:#f7931a;margin-bottom:8px;';
        h.textContent = 'Cipher sats wins (' + wins.length + ')';
        el.appendChild(h);
        if (!wins.length) {
            var none = document.createElement('div');
            none.style.cssText = 'font-size:0.8rem;color:var(--text-muted);';
            none.textContent = 'No sats wins yet.';
            el.appendChild(none);
            return;
        }
        wins.forEach(function(w) {
            var card = document.createElement('div');
            card.style.cssText = 'padding:10px;margin-bottom:8px;border:1px solid var(--border,#333);border-radius:10px;font-size:0.78rem;';
            var line = document.createElement('div');
            line.style.fontWeight = '800';
            line.textContent = (w.amount || 0).toLocaleString() + ' sats — ' + (w.status || '') + (w.announced ? '' : ' (chat not posted)');
            var who = document.createElement('div');
            who.style.color = 'var(--text-muted)';
            who.textContent = '@' + (w.username || w.uid || '') + ' · cipher ' + (w.cipherLabel || '') +
                ' · key ' + (w.keyOrigin === 'peer' ? ('from ' + (w.keySentByName || w.keySentBy || 'a peer')) : 'their own') +
                ' · roll ' + (w.roll != null ? w.roll : '?');
            card.appendChild(line);
            card.appendChild(who);
            if (w.status !== 'paid' || w.announced !== true) {
                var b = _btn(w.status === 'paid' ? 'Post Nacho message' : 'Mark paid');
                b.style.marginTop = '8px';
                b.onclick = async function() {
                    b.disabled = true;
                    try {
                        await _callCF('adminMarkCipherWinPaid', { winId: w.id });
                        _toast('Marked paid');
                        window.renderCipherWinsAdmin(el);
                    } catch (e) {
                        b.disabled = false;
                        _toast('❌ ' + (e.message || 'Could not update'));
                    }
                };
                card.appendChild(b);
            }
            el.appendChild(card);
        });
    } catch (e) {
        el.innerHTML = '<div style="color:#ef4444;font-size:0.8rem;">Could not load wins. ' + _esc(e.message || '') + '</div>';
    }
};

function _boot() {
    var tries = 0;
    var timer = setInterval(function() {
        tries++;
        if (_isSignedIn() && typeof db !== 'undefined') {
            clearInterval(timer);
            window.checkPendingGifts();
        } else if (tries > 40) clearInterval(timer);
    }, 500);
}
_boot();

console.log('[gifting] keys/ciphers loaded');
})();
