// One display formula for raid boss health.
// Server docs store damage dealt in `current` and max HP in `target`.
// Every remaining-HP label and health bar uses this helper.
function raidHpRemaining(maxHp, damage) {
    var max = Number(maxHp);
    var dealt = Number(damage);
    if (!isFinite(max)) max = 0;
    if (!isFinite(dealt)) dealt = 0;
    return Math.max(0, max - dealt);
}

function raidHpCount(n) {
    var v = Math.round(Number(n));
    if (!isFinite(v)) v = 0;
    var sign = v < 0 ? '-' : '';
    var digits = String(Math.abs(v));
    return sign + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function _raidNum(value, fallback) {
    if (value === undefined || value === null || value === '') return fallback;
    var n = Number(value);
    return isFinite(n) ? n : fallback;
}

// damage is current (or currentHP). maxHp is target (or targetHP).
// hpPct is the health-bar fill: remaining health, so the bar shrinks as damage rises.
function raidBossStats(boss) {
    var b = boss || {};
    var damage = _raidNum(b.current, _raidNum(b.currentHP, 0));
    var maxHp = _raidNum(b.target, _raidNum(b.targetHP, 0));
    var remaining = raidHpRemaining(maxHp, damage);
    var damagePct = maxHp > 0 ? Math.min(100, Math.round((damage / maxHp) * 100)) : 0;
    if (!isFinite(damagePct) || damagePct < 0) damagePct = 0;
    var hpPct = Math.max(0, 100 - damagePct);
    return {
        damage: damage,
        maxHp: maxHp,
        remaining: remaining,
        damagePct: damagePct,
        hpPct: hpPct
    };
}

function raidHpReadout(remaining, maxHp) {
    return raidHpCount(remaining) + '/' + raidHpCount(maxHp) + ' HP';
}

function raidHomePillText(name, boss) {
    var stats = raidBossStats(boss);
    return '⚔️ Raid: ' + (name || 'Boss') + ' ❤️ ' + raidHpReadout(stats.remaining, stats.maxHp);
}

if (typeof window !== 'undefined') {
    window.raidHpRemaining = raidHpRemaining;
    window.raidHpCount = raidHpCount;
    window.raidBossStats = raidBossStats;
    window.raidHpReadout = raidHpReadout;
    window.raidHomePillText = raidHomePillText;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        raidHpRemaining: raidHpRemaining,
        raidHpCount: raidHpCount,
        raidBossStats: raidBossStats,
        raidHpReadout: raidHpReadout,
        raidHomePillText: raidHomePillText
    };
}
