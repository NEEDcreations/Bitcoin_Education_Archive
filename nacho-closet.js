// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// 🦌 Nacho's Closet — Collectible Outfits & Accessories
// Unlock items as your friendship with Nacho grows!
// =============================================

(function() {

// ---- Collectible Items ----
// RULE: Use the ITEM emoji (not a face wearing it). Position realistically ON Nacho's body.
const NACHO_ITEMS = [
    // Level 1 — Just Met (1+ interactions)
    { id: 'orange_scarf', name: 'Bitcoin Scarf', emoji: '🧣', desc: 'A cozy orange scarf with the ₿ symbol.', level: 1, overlay: { top: '68%', left: '50.5%', transform: 'translateX(-50%)', fontSize: '1.8em' }, hidden: false, colorable: true },
    { id: 'sunglasses', name: 'Cool Shades', emoji: '🕶️', desc: 'Sunglasses so cool, even the blockchain can\'t see through them.', level: 1, overlay: { top: '43%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.4em' }, hidden: false },
    { id: 'bowtie', name: 'Fancy Bowtie', emoji: '🎀', desc: 'A dapper bowtie for a distinguished buck. Class and sats.', level: 1, overlay: { top: '64%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.3em' }, hidden: false, colorable: true },

    // Level 2 — Getting Acquainted (10+ interactions)
    { id: 'mining_helmet', name: 'Mining Helmet', emoji: '⛑️', desc: 'A safety helmet for a hardworking miner. Ready to find the next block!', level: 2, overlay: { top: '5%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.2em' }, hidden: false },
    { id: 'lightning_chain', name: 'Lightning Chain', emoji: '⚡', desc: 'A chain necklace with a Lightning bolt pendant.', level: 2, overlay: { top: '65%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.4em' }, hidden: false },
    { id: 'party_hat', name: 'Party Hat', emoji: '🎉', desc: 'Every day is a party when you\'re stacking sats!', level: 2, overlay: { top: '2%', left: '58%', transform: 'translateX(-50%) rotate(15deg)', fontSize: '1.8em' }, hidden: false, colorable: true },

    // Level 3 — Good Friends (25+ interactions)
    { id: 'hodl_hoodie', name: 'HODL Hoodie', emoji: '🧥', desc: 'A hoodie that says HODL on the back. For diamond-handed deer.', level: 3, overlay: { top: '72%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.2em' }, hidden: false, colorable: true },
    { id: 'laser_eyes', name: 'Laser Eyes', emoji: '🔴', desc: 'The legendary Bitcoin laser eyes. Number go up!', level: 3, overlay: { top: '43%', left: '50.5%', transform: 'translateX(-50%)', fontSize: '0.9em', custom: '🔴  🔴' }, hidden: false },
    { id: 'wizard_hat', name: 'Wizard Hat', emoji: '🪄', desc: 'A mystical wizard hat. Nacho casts spells of financial sovereignty!', level: 3, overlay: { top: '-5%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.4em' }, hidden: false, colorable: true },
    { id: 'crown', name: 'Royal Crown', emoji: '👑', desc: 'Fit for the king of cryptocurrency. There is no second best!', level: 3, overlay: { top: '3%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.2em' }, hidden: false },

    // Level 4 — Close Friends (50+ interactions)
    { id: 'steak', name: 'Proof of Steak', emoji: '🥩', desc: 'A juicy steak for a hardworking buck. Proof of Steak > Proof of Stake!', level: 4, overlay: { top: '58%', right: '-18%', fontSize: '1.8em', transform: 'rotate(20deg)' }, hidden: false },
    { id: 'diamond_hooves', name: 'Diamond Hooves', emoji: '💎', desc: 'Diamond hooves for a deer with diamond hands. Never selling!', level: 4, overlay: { bottom: '2%', left: '50%', transform: 'translateX(-50%)', fontSize: '1.4em', custom: '💎💎' }, hidden: false },
    { id: 'astronaut', name: 'Moon Helmet', emoji: '🪖', desc: 'To the moon! A space helmet for the ultimate HODLer.', level: 4, overlay: { top: '8%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.8em' }, hidden: false },
    { id: 'cape_permanent', name: 'Hero Cape', emoji: '🦸', desc: 'A permanent cape for a Bitcoin hero. Earned, not given!', level: 4, overlay: { top: '55%', right: '-15%', fontSize: '2.4em', transform: 'rotate(-12deg)' }, hidden: false, colorable: true },

    // Level 5 — Best Buds (100+ interactions) — HIDDEN until unlocked!
    { id: 'golden_antlers', name: '???', emoji: '✨', desc: 'Reach Best Buds friendship to reveal this item!', level: 5, overlay: { top: '0.5%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.4em' }, hidden: true, revealName: 'Golden Antlers', revealEmoji: '✨', revealDesc: 'Antlers plated in pure gold. Only the closest friends get to see these shine!' },
    { id: 'satoshi_cloak', name: '???', emoji: '🧥', desc: 'Reach Best Buds friendship to reveal this item!', level: 5, overlay: { top: '68%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.4em' }, hidden: true, revealName: 'Satoshi\'s Cloak', revealEmoji: '🧥', revealDesc: 'A mysterious cloak worn by Satoshi himself. Legend says it grants anonymity to any deer who wears it.' },
    { id: 'flame_aura', name: '???', emoji: '🔥', desc: 'Reach Best Buds friendship to reveal this item!', level: 5, overlay: { top: '25%', left: '50%', transform: 'translateX(-50%)', fontSize: '3.5em' }, hidden: true, revealName: 'Flame Aura', revealEmoji: '🔥', revealDesc: 'A blazing aura of pure Bitcoin energy. The ultimate flex for Nacho\'s best friend!' },
    { id: 'rainbow_antlers', name: '???', emoji: '🌈', desc: 'Reach Best Buds friendship to reveal this item!', level: 5, overlay: { top: '2%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.8em' }, hidden: true, revealName: 'Rainbow Antlers', revealEmoji: '🌈', revealDesc: 'Prismatic rainbow antlers that shimmer in every color. Legendary!' },

    // Secret — Easter egg only
    { id: 'bitcoin_eyes', name: '???', emoji: '₿', desc: 'How do you find this one?', level: 1, overlay: { top: '43%', left: '50.5%', transform: 'translateX(-50%)', fontSize: '1.2em', custom: '₿  ₿' }, hidden: true, revealName: 'Bitcoin Eyes', revealEmoji: '₿', revealDesc: 'Eyes made of pure Bitcoin. You found the secret! Nacho sees everything in sats now.' },

    // Seasonal — toggled via localStorage
    { id: 'santa_hat', name: 'Santa Hat', emoji: '🎅', desc: 'Ho ho HODL! A festive Santa hat for the holiday season.', level: 1, overlay: { top: '1%', left: '54%', transform: 'translateX(-50%) rotate(15deg)', fontSize: '2.2em' }, hidden: false, seasonal: 'december' },
    { id: 'pumpkin', name: 'Pumpkin Head', emoji: '🎃', desc: 'Spooky season! A jack-o-lantern for Halloween.', level: 1, overlay: { top: '8%', left: '50%', transform: 'translateX(-50%)', fontSize: '2.8em' }, hidden: false, seasonal: 'october' },
    { id: 'halving_pickaxe', name: 'Golden Pickaxe', emoji: '⛏️', desc: 'A golden pickaxe to celebrate the halving! Limited edition.', level: 1, overlay: { top: '22%', right: '-15%', fontSize: '2.2em', transform: 'rotate(30deg)' }, hidden: false, seasonal: 'april' },
];

// ---- Inject CSS for overlay animations ----
var closetStyle = document.createElement('style');
closetStyle.textContent = `
    @keyframes nachoEquipPop {
        0% { transform: scale(0) rotate(-45deg); opacity: 0; }
        50% { transform: scale(1.5) rotate(10deg); opacity: 1; }
        70% { transform: scale(0.9) rotate(-5deg); }
        100% { transform: scale(1) rotate(0deg); opacity: 1; }
    }
    @keyframes nachoEquipGlow {
        0% { filter: drop-shadow(0 0 0px transparent); }
        30% { filter: drop-shadow(0 0 12px rgba(247,147,26,0.8)); }
        100% { filter: drop-shadow(0 0 4px rgba(247,147,26,0.3)); }
    }
    @keyframes nachoUnequip {
        0% { transform: scale(1); opacity: 1; }
        40% { transform: scale(1.3) rotate(15deg); opacity: 0.8; }
        100% { transform: scale(0) rotate(-30deg); opacity: 0; }
    }
    @keyframes nachoItemFloat {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-3px); }
    }
    @keyframes nachoLaserPulse {
        0%, 100% { opacity: 0.8; filter: drop-shadow(0 0 4px #ff0000); }
        50% { opacity: 1; filter: drop-shadow(0 0 10px #ff0000) drop-shadow(0 0 20px #ff3300); }
    }
    @keyframes nachoSparkle {
        0%, 100% { filter: drop-shadow(0 0 4px rgba(255,215,0,0.3)); }
        50% { filter: drop-shadow(0 0 10px rgba(255,215,0,0.8)) drop-shadow(0 0 20px rgba(255,215,0,0.4)); }
    }
    @keyframes nachoCloakWave {
        0%, 100% { transform: translateX(-50%) rotate(-2deg); }
        50% { transform: translateX(-50%) rotate(2deg); }
    }
    .nacho-overlay-item {
        position: absolute;
        pointer-events: none;
        z-index: 3;
    }
    .nacho-overlay-item.equipping {
        animation: nachoEquipPop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards,
                   nachoEquipGlow 0.8s ease-out forwards;
    }
    .nacho-overlay-item.unequipping {
        animation: nachoUnequip 0.35s ease-in forwards;
    }
    .nacho-overlay-item.idle-float {
        animation: nachoItemFloat 3s ease-in-out infinite;
    }
    .nacho-overlay-item.idle-laser {
        animation: nachoLaserPulse 1.5s ease-in-out infinite;
    }
    .nacho-overlay-item.idle-sparkle {
        animation: nachoSparkle 2s ease-in-out infinite;
    }
    .nacho-overlay-item.idle-wave {
        animation: nachoCloakWave 4s ease-in-out infinite;
    }
`;
document.head.appendChild(closetStyle);

// ---- Get idle animation class for each item ----
function getIdleAnimation(itemId) {
    switch(itemId) {
        case 'laser_eyes': return 'idle-laser';
        case 'golden_antlers': return 'idle-sparkle';
        case 'satoshi_cloak': return 'idle-wave';
        case 'lightning_chain': return 'idle-float';
        case 'diamond_hooves': return 'idle-sparkle';
        default: return 'idle-float';
    }
}

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
    if (item.level > getFriendLevel()) return null;
    return item;
}

// ---- Equip an item (with animation) ----
window.equipNachoItem = function(itemId) {
    var current = localStorage.getItem('btc_nacho_equipped');
    var avatar = document.getElementById('nacho-avatar');

    if (current === itemId) {
        // Unequip with animation
        var existing = document.getElementById('nacho-overlay');
        if (existing) {
            existing.classList.remove('equipping', 'idle-float', 'idle-laser', 'idle-sparkle', 'idle-wave');
            existing.classList.add('unequipping');
            existing.addEventListener('animationend', function() {
                existing.remove();
            });
        }
        localStorage.removeItem('btc_nacho_equipped');
        // Nacho reacts
        if (typeof forceShowBubble === 'function') {
            forceShowBubble('Back to natural! I look great either way. 🦌');
        }
    } else {
        // Remove old overlay with animation if exists
        var old = document.getElementById('nacho-overlay');
        if (old) {
            old.classList.remove('equipping', 'idle-float', 'idle-laser', 'idle-sparkle', 'idle-wave');
            old.classList.add('unequipping');
            old.addEventListener('animationend', function() { old.remove(); });
        }

        localStorage.setItem('btc_nacho_equipped', itemId);

        // Short delay so unequip animation plays first
        setTimeout(function() {
            renderNachoOverlay(true);
        }, old ? 300 : 0);

        // Nacho reacts to specific items
        var item = NACHO_ITEMS.find(function(i) { return i.id === itemId; });
        if (item && typeof forceShowBubble === 'function') {
            var displayName = item.hidden ? item.revealName : item.name;
            var reactions = {
                'orange_scarf': "Looking cozy! This scarf really brings out my orange. 🧣🦌",
                'mining_helmet': "Safety first! Time to mine some blocks! ⛑️⛏️",
                'lightning_chain': "Bling bling! Fast as Lightning! ⚡🦌",
                'hodl_hoodie': "HODL gang! This hoodie makes me feel unstoppable! 🧥💎",
                'laser_eyes': "LASER EYES ACTIVATED! Number go up! 🔴🔴🚀",
                'steak': "Mmm, Proof of Steak! Way better than Proof of Stake! 🥩😋",
                'diamond_hooves': "Diamond hooves, diamond hands! Never selling! 💎🦌",
                'golden_antlers': "These golden antlers are MAGNIFICENT! Only for my best friends! 👑✨",
                'satoshi_cloak': "Who am I? Nobody knows... I am Satoshi Nachoamoto! 🧙🦌"
            };
            forceShowBubble(reactions[itemId] || "Looking fresh with my " + displayName + "! 🦌");
        }
    }

    if (typeof nachoPlaySound === 'function') nachoPlaySound('coin');

    // Re-render closet UI if open
    if (document.getElementById('nachoClosetGrid')) {
        renderNachoClosetUI(document.getElementById('nachoClosetGrid').parentElement);
    }
};

// ---- Render equipped item overlay on Nacho avatar ----
window.renderNachoOverlay = function(animate) {
    var existing = document.getElementById('nacho-overlay');
    if (existing) existing.remove();

    var item = getEquippedItem();
    if (!item) return;

    var avatar = document.getElementById('nacho-avatar');
    if (!avatar) return;

    var emoji = item.hidden ? item.revealEmoji : item.emoji;
    var idleClass = getIdleAnimation(item.id);

    var overlay = document.createElement('span');
    overlay.id = 'nacho-overlay';
    overlay.className = 'nacho-overlay-item' + (animate ? ' equipping' : ' ' + idleClass);
    // Use custom text if defined (e.g. chain of emojis), otherwise single emoji
    overlay.textContent = item.overlay.custom || emoji;
    if (item.overlay.custom) {
        overlay.style.letterSpacing = '-0.1em';
        overlay.style.whiteSpace = 'nowrap';
    }

    // Apply positioning from item config
    for (var prop in item.overlay) {
        if (prop !== 'filter' && prop !== 'custom') {
            overlay.style[prop] = item.overlay[prop];
        }
    }

    // Apply user-selected color (hue-rotate filter)
    if (item.colorable) {
        var savedHue = localStorage.getItem('btc_nacho_color_' + item.id);
        if (savedHue && savedHue !== '0deg') {
            overlay.style.filter = 'hue-rotate(' + savedHue + ')';
        }
    }

    // After equip animation, switch to idle
    if (animate) {
        overlay.addEventListener('animationend', function handler() {
            overlay.classList.remove('equipping');
            overlay.classList.add(idleClass);
            overlay.removeEventListener('animationend', handler);
        }, { once: true });

        // Spawn sparkle particles around Nacho during equip
        spawnEquipParticles(avatar);
    }

    avatar.appendChild(overlay);
};

// ---- Sparkle particles on equip ----
function spawnEquipParticles(avatar) {
    var rect = avatar.getBoundingClientRect();
    var sparkles = ['✨', '⭐', '💫', '🌟'];
    for (var i = 0; i < 6; i++) {
        (function(idx) {
            setTimeout(function() {
                var p = document.createElement('div');
                p.className = 'nacho-trail';
                p.textContent = sparkles[idx % sparkles.length];
                p.style.left = (rect.left + Math.random() * rect.width) + 'px';
                p.style.top = (rect.top + Math.random() * rect.height) + 'px';
                p.style.fontSize = (0.8 + Math.random() * 0.8) + 'rem';
                document.body.appendChild(p);
                setTimeout(function() { if (p.parentNode) p.remove(); }, 800);
            }, idx * 80);
        })(i);
    }
}

// ---- Render Nacho's Closet UI (for settings) ----
window.renderNachoClosetUI = function(container) {
    var level = getFriendLevel();
    var equipped = localStorage.getItem('btc_nacho_equipped') || '';
    var interactions = parseInt(localStorage.getItem('btc_nacho_interactions') || '0');
    var friendship = typeof getNachoFriendship === 'function' ? getNachoFriendship() : { level: 0, name: 'Strangers', emoji: '❓' };

    var nextThresholds = [1, 10, 100, 350, 750];
    var nextLevel = '';
    for (var i = 0; i < nextThresholds.length; i++) {
        if (interactions < nextThresholds[i]) {
            nextLevel = '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">Next level in ' + (nextThresholds[i] - interactions) + ' more interactions</div>';
            break;
        }
    }

    // ---- Nacho Preview (shows equipped item on deer) ----
    var previewItem = equipped ? NACHO_ITEMS.find(function(i) { return i.id === equipped; }) : null;
    var previewEmoji = '';
    var previewOverlayStyle = '';
    if (previewItem) {
        previewEmoji = previewItem.hidden ? previewItem.revealEmoji : previewItem.emoji;
        if (previewItem.overlay && previewItem.overlay.custom) previewEmoji = previewItem.overlay.custom;
        // Build overlay positioning
        var ovr = previewItem.overlay || {};
        previewOverlayStyle = 'position:absolute;font-size:' + (ovr.fontSize || '1.5rem') + ';';
        if (ovr.top) previewOverlayStyle += 'top:' + ovr.top + ';';
        if (ovr.bottom) previewOverlayStyle += 'bottom:' + ovr.bottom + ';';
        if (ovr.left) previewOverlayStyle += 'left:' + ovr.left + ';';
        if (ovr.right) previewOverlayStyle += 'right:' + ovr.right + ';';
        if (ovr.transform) previewOverlayStyle += 'transform:' + ovr.transform + ';';
        previewOverlayStyle += 'z-index:5;pointer-events:none;';
        // Apply color if set
        if (previewItem.colorable) {
            var savedHue = localStorage.getItem('btc_nacho_color_' + previewItem.id);
            if (savedHue && savedHue !== '0deg') previewOverlayStyle += 'filter:hue-rotate(' + savedHue + ');';
        }
    }

    var nickname = (typeof nachoNickname === 'function') ? nachoNickname() : 'Nacho';
    var html = '<div style="font-size:0.75rem;color:var(--text-faint);letter-spacing:1px;margin-bottom:10px;font-weight:700;">🦌 ' + escapeHtml(nickname) + '\'s Closet</div>';

    // Nacho preview avatar
    html += '<div id="nachoClosetPreview" style="text-align:center;margin-bottom:16px;background:radial-gradient(circle,rgba(247,147,26,0.08) 0%,transparent 70%);border-radius:16px;padding:16px 0 8px;">' +
        '<div style="position:relative;display:inline-block;width:120px;height:120px;">' +
            '<img src="nacho-deer.svg" alt="Nacho" style="width:120px;height:120px;position:relative;z-index:2;">' +
            (previewEmoji ? '<span id="nachoClosetOverlay" style="' + previewOverlayStyle + '">' + previewEmoji + '</span>' : '') +
        '</div>' +
        '<div style="color:var(--text-muted);font-size:0.75rem;margin-top:4px;">' + (previewItem ? '✨ Wearing: <strong style="color:var(--accent);">' + (previewItem.hidden ? previewItem.revealName : previewItem.name) + '</strong>' : 'No item equipped — tap one below!') + '</div>' +
    '</div>';

    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">' +
        '<span style="color:var(--text);font-size:0.85rem;">Friendship: <strong style="color:var(--accent);">' + friendship.emoji + ' ' + friendship.name + '</strong></span>' +
        '<span style="color:var(--text-muted);font-size:0.8rem;">' + interactions + ' interactions</span></div>' + nextLevel;

    var maxInteractions = 750;
    var pct = Math.min(100, Math.round((interactions / maxInteractions) * 100));
    html += '<div style="height:4px;background:var(--border);border-radius:4px;margin:10px 0 16px;overflow:hidden;">' +
        '<div style="height:100%;background:linear-gradient(90deg,#f97316,#eab308);width:' + pct + '%;border-radius:4px;transition:width 0.5s;"></div></div>';

    html += '<div id="nachoClosetGrid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;">';

    var currentMonth = new Date().toLocaleString('en', { month: 'long' }).toLowerCase();
    for (var j = 0; j < NACHO_ITEMS.length; j++) {
        var item = NACHO_ITEMS[j];
        // Skip seasonal items outside their month
        if (item.seasonal && currentMonth.indexOf(item.seasonal) === -1) continue;
        var unlocked = item.level <= level;
        var isEquipped = equipped === item.id;
        var isHidden = item.hidden && !unlocked;

        var displayName = isHidden ? '???' : (item.hidden && unlocked ? item.revealName : item.name);
        var displayEmoji = isHidden ? '❓' : (item.hidden && unlocked ? item.revealEmoji : item.emoji);

        html += '<div onclick="' + (unlocked ? 'equipNachoItem(\'' + item.id + '\')' : '') + '" style="' +
            'background:' + (isEquipped ? 'var(--accent-bg,rgba(247,147,26,0.15))' : 'var(--card-bg,#1a1a2e)') + ';' +
            'border:2px solid ' + (isEquipped ? '#f7931a' : unlocked ? 'var(--border,#333)' : 'rgba(100,100,100,0.2)') + ';' +
            'border-radius:12px;padding:12px 8px;text-align:center;cursor:' + (unlocked ? 'pointer' : 'default') + ';' +
            'opacity:' + (unlocked ? '1' : '0.4') + ';transition:all 0.2s;position:relative;' +
            '"' + (unlocked ? ' onmouseover="this.style.transform=\'scale(1.05)\';this.style.borderColor=\'#f7931a\'" onmouseout="this.style.transform=\'scale(1)\';this.style.borderColor=\'' + (isEquipped ? '#f7931a' : 'var(--border,#333)') + '\'"' : '') + '>' +
            '<div style="font-size:1.8rem;margin-bottom:4px;' + (isEquipped ? 'animation:nachoItemFloat 2s ease-in-out infinite;' : '') + '">' + displayEmoji + '</div>' +
            '<div style="font-size:0.7rem;color:' + (unlocked ? 'var(--text)' : 'var(--text-faint)') + ';font-weight:600;line-height:1.3;">' + displayName + '</div>' +
            (isEquipped ? '<div style="font-size:0.6rem;color:#f7931a;font-weight:700;margin-top:2px;">✓ EQUIPPED</div>' : '') +
            (isEquipped && item.colorable ? '<div onclick="event.stopPropagation();if(typeof showColorPicker===\'function\')showColorPicker(\'' + item.id + '\')" style="font-size:0.65rem;color:var(--accent);cursor:pointer;margin-top:4px;font-weight:600;padding:2px 6px;background:var(--accent-bg,rgba(247,147,26,0.1));border-radius:4px;display:inline-block;">🎨 Color</div>' : '') +
            (!unlocked && !isHidden ? '<div style="font-size:0.55rem;color:var(--text-faint);margin-top:2px;">Lvl ' + item.level + '</div>' : '') +
            (isHidden ? '<div style="font-size:0.55rem;color:var(--text-faint);margin-top:2px;">🔒</div>' : '') +
            (item.seasonal ? '<div style="font-size:0.5rem;color:var(--accent);margin-top:2px;">🗓️ ' + item.seasonal + '</div>' : '') +
            '</div>';
    }

    html += '</div>';

    html += '<div style="margin-top:12px;padding:10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;min-height:40px;">' +
        '<div style="color:var(--text-muted);font-size:0.8rem;line-height:1.5;" id="nachoItemDesc">' +
        (equipped ? (function() {
            var eq = NACHO_ITEMS.find(function(i) { return i.id === equipped; });
            if (!eq) return 'Tap an item to equip it on ' + escapeHtml(nickname) + '!';
            var dn = eq.hidden ? eq.revealDesc : eq.desc;
            return '<strong style="color:var(--accent);">' + (eq.hidden ? eq.revealName : eq.name) + ':</strong> ' + dn;
        })() : 'Tap an unlocked item to equip it on ' + escapeHtml(nickname) + '!<br>Tap again to unequip.') +
        '</div></div>';

    container.innerHTML = html;
};

// ---- Nacho talks about the closet ----
window.NACHO_CLOSET_TIPS = [
    { pose: 'cool', text: "Did you know I have a whole closet of outfits, {name}? Check Settings → Q&A/Stats → " + escapeHtml(nickname) + "'s Closet to dress me up! 👔🦌" },
    { pose: 'celebrate', text: "The more we interact, the more items you unlock for me to wear! Check my closet in Settings! 🧣⚡" },
    { pose: 'eyes', text: "I heard there are some mystery items in my closet that only my closest friends get to see... 👀🔒" },
    { pose: 'fire', text: "Proof of Steak > Proof of Stake. Ask me about it... or better yet, unlock it in my closet! 🥩🦌" },
    { pose: 'cheese', text: "Fashion tip from a deer: orange goes with everything. Especially Bitcoin orange. Check my closet in Settings! 🟠" },
];

// ---- Check for newly unlocked items ----
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

        return { pose: 'celebrate', text: "🎁 New item unlocked: " + displayEmoji + " " + displayName + "! Go to Settings → Q&A/Stats → " + escapeHtml(nickname) + "'s Closet to try it on, {name}! 🦌" };
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
