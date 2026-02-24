// =============================================
// 🦌 Nacho's Closet — Collectible Outfits & Accessories
// Unlock items as your friendship with Nacho grows!
// =============================================

(function() {

// ---- Collectible Items ----
// Each item has: id, name, emoji, desc, friendshipLevel required, cssOverlay position
const NACHO_ITEMS = [
    // Level 1 — Just Met (1+ interactions)
    { id: 'orange_scarf', name: 'Bitcoin Scarf', emoji: '🧣', desc: 'A cozy orange scarf with the ₿ symbol.', level: 1, overlay: { bottom: '22%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.4em' }, hidden: false },

    // Level 2 — Getting Acquainted (10+ interactions)
    { id: 'mining_helmet', name: 'Mining Helmet', emoji: '⛑️', desc: 'A miner\'s helmet with a headlamp. Ready to find the next block!', level: 2, overlay: { top: '-8%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.6em' }, hidden: false },
    { id: 'lightning_chain', name: 'Lightning Chain', emoji: '⚡', desc: 'A chain necklace with a Lightning bolt pendant.', level: 2, overlay: { bottom: '28%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.2em' }, hidden: false },

    // Level 3 — Good Friends (25+ interactions)
    { id: 'hodl_hoodie', name: 'HODL Hoodie', emoji: '🧥', desc: 'A hoodie that says HODL on the back. For diamond-handed deer.', level: 3, overlay: { bottom: '5%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.5em' }, hidden: false },
    { id: 'laser_eyes', name: 'Laser Eyes', emoji: '🔴', desc: 'The legendary Bitcoin laser eyes. Number go up!', level: 3, overlay: { top: '35%', left: '50%', transform: 'translateX(-50%)', fontSize: '0.8em', filter: 'drop-shadow(0 0 6px #ff0000)' }, hidden: false },

    // Level 4 — Close Friends (50+ interactions)
    { id: 'steak', name: 'Proof of Steak', emoji: '🥩', desc: 'A juicy steak for a hardworking buck. Proof of Steak > Proof of Stake!', level: 4, overlay: { bottom: '0%', right: '-15%', fontSize: '1.6em', transform: 'rotate(15deg)' }, hidden: false },
    { id: 'diamond_hooves', name: 'Diamond Hooves', emoji: '💎', desc: 'Diamond hooves for a deer with diamond hands. Never selling!', level: 4, overlay: { bottom: '-5%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.2em' }, hidden: false },

    // Level 5 — Best Buds (100+ interactions) — HIDDEN until unlocked!
    { id: 'golden_antlers', name: '???', emoji: '❓', desc: 'Reach Best Buds friendship to reveal this item!', level: 5, overlay: { top: '-12%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.8em' }, hidden: true, revealName: 'Golden Antlers', revealEmoji: '👑', revealDesc: 'Antlers plated in pure gold. Only the closest friends get to see these shine!' },
    { id: 'satoshi_cloak', name: '???', emoji: '❓', desc: 'Reach Best Buds friendship to reveal this item!', level: 5, overlay: { bottom: '10%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.5em' }, hidden: true, revealName: 'Satoshi\'s Cloak', revealEmoji: '🧙', revealDesc: 'A mysterious cloak worn by Satoshi himself. Legend says it grants anonymity to any deer who wears it.' },
];

// ---- Get friendship level ----
function getFriendLevel() {
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    if (interactions >= 750) return 5;
    if (interactions >= 350) return 4;
    if (interactions >= 100) return 3;
    if (interactions >= 10) return 2;
    if (interactions >= 1) return 1;
    return 0;
}

// ---- Get unlocked items ----
function getUnlockedItems() {
    var level = getFriendLevel();
    return NACHO_ITEMS.filter(function(item) { return item.level <= level; });
}

// ---- Get equipped item ----
function getEquippedItem() {
    var id = localStorage.getItem('btc_nacho_equipped');
    if (!id) return null;
    var item = NACHO_ITEMS.find(function(i) { return i.id === id; });
    if (!item) return null;
    // Make sure it's still unlocked
    if (item.level > getFriendLevel()) return null;
    return item;
}

// ---- Equip an item ----
window.equipNachoItem = function(itemId) {
    var current = localStorage.getItem('btc_nacho_equipped');
    if (current === itemId) {
        // Unequip
        localStorage.removeItem('btc_nacho_equipped');
    } else {
        localStorage.setItem('btc_nacho_equipped', itemId);
    }
    renderNachoOverlay();
    // Re-render closet if open
    if (document.getElementById('nachoClosetGrid')) {
        renderNachoClosetUI(document.getElementById('nachoClosetGrid').parentElement);
    }
    if (typeof nachoPlaySound === 'function') nachoPlaySound('coin');
};

// ---- Render equipped item overlay on Nacho avatar ----
window.renderNachoOverlay = function() {
    // Remove existing overlay
    var existing = document.getElementById('nacho-overlay');
    if (existing) existing.remove();

    var item = getEquippedItem();
    if (!item) return;

    var avatar = document.getElementById('nacho-avatar');
    if (!avatar) return;

    var emoji = item.hidden ? item.revealEmoji : item.emoji;

    var overlay = document.createElement('span');
    overlay.id = 'nacho-overlay';
    overlay.textContent = emoji;
    overlay.style.cssText = 'position:absolute;pointer-events:none;z-index:3;';
    for (var prop in item.overlay) {
        overlay.style[prop] = item.overlay[prop];
    }
    avatar.appendChild(overlay);
};

// ---- Render Nacho's Closet UI (for settings) ----
window.renderNachoClosetUI = function(container) {
    var level = getFriendLevel();
    var equipped = localStorage.getItem('btc_nacho_equipped') || '';
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    var friendship = typeof getNachoFriendship === 'function' ? getNachoFriendship() : { level: 0, name: 'Strangers', emoji: '❓' };

    // Next level info
    var nextThresholds = [1, 10, 100, 350, 750];
    var nextLevel = '';
    for (var i = 0; i < nextThresholds.length; i++) {
        if (interactions < nextThresholds[i]) {
            nextLevel = '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Next level in ' + (nextThresholds[i] - interactions) + ' more interactions</div>';
            break;
        }
    }

    var html = '<div style="font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">🦌 Nacho\'s Closet</div>';

    // Friendship status
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<span style="color:var(--text);font-size:0.85rem;">Friendship: <strong style="color:var(--accent);">' + friendship.emoji + ' ' + friendship.name + '</strong></span>' +
        '<span style="color:var(--text-muted);font-size:0.8rem;">' + interactions + ' interactions</span></div>' + nextLevel;

    // Progress bar
    var maxInteractions = 750;
    var pct = Math.min(100, Math.round((interactions / maxInteractions) * 100));
    html += '<div style="height:4px;background:var(--border);border-radius:4px;margin:10px 0 16px;overflow:hidden;">' +
        '<div style="height:100%;background:linear-gradient(90deg,#f97316,#eab308);width:' + pct + '%;border-radius:4px;transition:width 0.5s;"></div></div>';

    // Items grid
    html += '<div id="nachoClosetGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';

    for (var j = 0; j < NACHO_ITEMS.length; j++) {
        var item = NACHO_ITEMS[j];
        var unlocked = item.level <= level;
        var isEquipped = equipped === item.id;
        var isHidden = item.hidden && !unlocked;

        var displayName = isHidden ? '???' : (item.hidden && unlocked ? item.revealName : item.name);
        var displayEmoji = isHidden ? '❓' : (item.hidden && unlocked ? item.revealEmoji : item.emoji);
        var displayDesc = isHidden ? 'Reach Best Buds to reveal!' : (item.hidden && unlocked ? item.revealDesc : item.desc);

        html += '<div onclick="' + (unlocked ? 'equipNachoItem(\'' + item.id + '\')' : '') + '" style="' +
            'background:' + (isEquipped ? 'var(--accent-bg,rgba(247,147,26,0.15))' : 'var(--card-bg,#1a1a2e)') + ';' +
            'border:2px solid ' + (isEquipped ? '#f7931a' : unlocked ? 'var(--border,#333)' : 'rgba(100,100,100,0.2)') + ';' +
            'border-radius:12px;padding:12px 8px;text-align:center;cursor:' + (unlocked ? 'pointer' : 'default') + ';' +
            'opacity:' + (unlocked ? '1' : '0.4') + ';transition:0.2s;position:relative;' +
            '"' + (unlocked ? ' onmouseover="this.style.borderColor=\'#f7931a\'" onmouseout="this.style.borderColor=\'' + (isEquipped ? '#f7931a' : 'var(--border,#333)') + '\'"' : '') + '>' +
            '<div style="font-size:1.8rem;margin-bottom:4px;">' + displayEmoji + '</div>' +
            '<div style="font-size:0.7rem;color:' + (unlocked ? 'var(--text)' : 'var(--text-faint)') + ';font-weight:600;line-height:1.3;">' + displayName + '</div>' +
            (isEquipped ? '<div style="font-size:0.6rem;color:#f7931a;font-weight:700;margin-top:2px;">EQUIPPED</div>' : '') +
            (!unlocked && !isHidden ? '<div style="font-size:0.55rem;color:var(--text-faint);margin-top:2px;">Lvl ' + item.level + '</div>' : '') +
            (isHidden ? '<div style="font-size:0.55rem;color:var(--text-faint);margin-top:2px;">🔒</div>' : '') +
            '</div>';
    }

    html += '</div>';

    // Selected item description
    html += '<div style="margin-top:12px;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;min-height:40px;">' +
        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;" id="nachoItemDesc">' +
        (equipped ? (function() {
            var eq = NACHO_ITEMS.find(function(i) { return i.id === equipped; });
            if (!eq) return 'Tap an item to equip it on Nacho!';
            var dn = eq.hidden ? eq.revealDesc : eq.desc;
            return '<strong style="color:var(--accent);">' + (eq.hidden ? eq.revealName : eq.name) + ':</strong> ' + dn;
        })() : 'Tap an unlocked item to equip it on Nacho! Tap again to unequip.') +
        '</div></div>';

    container.innerHTML = html;
};

// ---- Nacho talks about the closet system ----
// These get mixed into his regular rotation
window.NACHO_CLOSET_TIPS = [
    { pose: 'cool', text: "Did you know I have a whole closet of outfits, {name}? Check Settings → Prefs → Nacho's Closet to dress me up! 👔🦌" },
    { pose: 'celebrate', text: "The more we interact, the more items you unlock for me to wear! Check my closet in Settings! 🧣⚡" },
    { pose: 'eyes', text: "I heard there are some mystery items in my closet that only my closest friends get to see... 👀🔒" },
    { pose: 'fire', text: "Proof of Steak > Proof of Stake. Ask me about it... or better yet, unlock it in my closet! 🥩🦌" },
    { pose: 'cheese', text: "Fashion tip from a deer: orange goes with everything. Especially Bitcoin orange. Check my closet in Settings! 🟠" },
];

// ---- Check for newly unlocked items and notify ----
window.checkNachoNewItems = function() {
    var level = getFriendLevel();
    var notified = JSON.parse(localStorage.getItem('btc_nacho_items_notified') || '[]');
    var newItems = NACHO_ITEMS.filter(function(item) {
        return item.level <= level && !notified.includes(item.id);
    });

    if (newItems.length > 0) {
        for (var i = 0; i < newItems.length; i++) {
            notified.push(newItems[i].id);
        }
        localStorage.setItem('btc_nacho_items_notified', JSON.stringify(notified));

        var item = newItems[0];
        var displayName = item.hidden ? item.revealName : item.name;
        var displayEmoji = item.hidden ? item.revealEmoji : item.emoji;

        return { pose: 'celebrate', text: "🎁 New item unlocked: " + displayEmoji + " " + displayName + "! Go to Settings → Prefs → Nacho's Closet to try it on, {name}! 🦌" };
    }
    return null;
};

// ---- Render overlay on page load ----
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(renderNachoOverlay, 1500); });
} else {
    setTimeout(renderNachoOverlay, 1500);
}

})();
