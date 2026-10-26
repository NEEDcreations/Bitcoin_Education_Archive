// Experience modes: names, Lite visibility, quest steps, and identical earning.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const reg = require('../features.registry.js');
const { normalizeMode, stepsForMode, decideGrant } = require('../functions/src/onboardingQuest');
const { awardBadge } = require('../functions/src/awardBadge');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    const run = fn();
    const ok = function () { console.log('  ok  ' + name); passed++; };
    const bad = function (e) { console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e)); failed++; };
    if (run && typeof run.then === 'function') return run.then(ok, bad);
    try { ok(); } catch (e) { bad(e); }
    return Promise.resolve();
}

const admin = {
    firestore: {
        FieldValue: {
            serverTimestamp: function () { return { _serverTimestamp: true }; },
            increment: function (n) { return { _increment: n }; },
            arrayUnion: function () { return { _arrayUnion: Array.prototype.slice.call(arguments) }; },
        },
    },
};

function memoryDb(seed) {
    const docs = Object.assign({}, seed || {});
    function collectionAt(prefix) {
        return {
            path: prefix,
            doc: function (id) { return ref(prefix + '/' + id); },
            get: async function () {
                const out = [];
                Object.keys(docs).forEach(function (p) {
                    const head = prefix + '/';
                    if (p.indexOf(head) !== 0) return;
                    const rest = p.slice(head.length);
                    if (!rest || rest.indexOf('/') !== -1) return;
                    out.push({ id: rest, exists: true, data: function () { return Object.assign({}, docs[p]); } });
                });
                return { empty: out.length === 0, docs: out, forEach: function (fn) { out.forEach(fn); } };
            },
        };
    }
    function ref(docPath) {
        return {
            path: docPath,
            collection: function (name) { return collectionAt(docPath + '/' + name); },
            get: async function () {
                const data = docs[docPath];
                return { exists: data != null, data: function () { return data ? Object.assign({}, data) : undefined; } };
            },
        };
    }
    return {
        docs: docs,
        collection: function (name) {
            return { doc: function (id) { return ref(name + '/' + id); } };
        },
        runTransaction: async function (fn) {
            const staged = [];
            const t = {
                get: function (r) { return r.get(); },
                set: function (r, data) { staged.push({ path: r.path, data: data }); },
                update: function (r, data) { staged.push({ path: r.path, data: data, update: true }); },
            };
            const result = await fn(t);
            staged.forEach(function (w) {
                if (w.update) {
                    const next = Object.assign({}, docs[w.path]);
                    Object.keys(w.data).forEach(function (key) {
                        const value = w.data[key];
                        if (value && value._increment) next[key] = (next[key] || 0) + value._increment;
                        else if (value && value._arrayUnion) {
                            const cur = Array.isArray(next[key]) ? next[key].slice() : [];
                            value._arrayUnion.forEach(function (item) {
                                if (cur.indexOf(item) === -1) cur.push(item);
                            });
                            next[key] = cur;
                        } else next[key] = value;
                    });
                    docs[w.path] = next;
                } else docs[w.path] = w.data;
            });
            return result;
        },
    };
}

function totals(db, uid) {
    const user = db.docs['users/' + uid];
    const award = db.docs['users/' + uid + '/badge_awards/say_hi_1'];
    return {
        points: user.points,
        weeklyXP: user.weeklyXP,
        monthlyXP: user.monthlyXP,
        visibleBadges: user.visibleBadges,
        awardXp: award.xp,
        favor: db.docs['satoshiFavor/current'].points,
    };
}

const queue = [];

queue.push(test('mode names and descriptions stay in one catalog', function () {
    assert.deepStrictEqual(reg.BQ_EXPERIENCE_MODES.map(function (m) { return m.label; }), [
        '📖 Lite', '🌱 Guided', '📘 Balanced', '🔥 Everything'
    ]);
    assert.strictEqual(reg.bqExperienceModeMeta('lite').desc, 'Just the learning. No games, badges or leaderboards.');
    assert.strictEqual(reg.bqExperienceModeMeta('beginner').desc, 'A calm start with the essentials and a few extras.');
    assert.strictEqual(reg.bqExperienceModeMeta('intermediate').desc, 'Most features, fewer popups.');
    assert.strictEqual(reg.bqExperienceModeMeta('advanced').desc, 'Every app, game and event.');
    assert.strictEqual(reg.bqNormalizeExperienceMode('nope'), 'advanced');
    assert.strictEqual(reg.bqNormalizeExperienceMode('lite'), 'lite');
}));

queue.push(test('hidden explore apps are counted from the registry', function () {
    assert.strictEqual(reg.bqHiddenExploreAppCount('lite'), 9);
    assert.strictEqual(reg.bqHiddenExploreAppCount('beginner'), 6);
    assert.strictEqual(reg.bqHiddenExploreAppCount('intermediate'), 0);
    assert.strictEqual(reg.bqHiddenExploreAppCount('advanced'), 0);
    assert.strictEqual(reg.bqModeAllows('nacho', 'lite'), true);
    assert.strictEqual(reg.bqModeAllows('wallet', 'lite'), true);
    assert.strictEqual(reg.bqModeAllows('tv', 'lite'), true);
    assert.strictEqual(reg.bqModeAllows('leaderboard', 'lite'), false);
    assert.strictEqual(reg.bqModeAllows('badges', 'lite'), false);
    assert.strictEqual(reg.bqModeAllows('tv', 'beginner'), true);
    assert.strictEqual(reg.bqModeAllows('spin', 'beginner'), false);
    assert.strictEqual(reg.bqModeAllows('spin', 'intermediate'), true);
}));

queue.push(test('every mode has a summary and an included/hidden list', function () {
    assert.deepStrictEqual(reg.BQ_MODES, ['lite', 'beginner', 'intermediate', 'advanced']);
    reg.BQ_MODES.forEach(function (id) {
        var brief = reg.bqModeBrief(id);
        assert.strictEqual(brief.summary, reg.bqExperienceModeMeta(id).desc, id);
        assert.ok(Array.isArray(brief.included) && brief.included.length >= 1, id + ' included');
        assert.ok(Array.isArray(brief.hidden) && brief.hidden.length >= 1, id + ' hidden');
        var bullets = brief.included.length + brief.hidden.length;
        assert.ok(bullets >= 3 && bullets <= 6, id + ' bullets ' + bullets);
        assert.ok(brief.notes.some(function (n) { return n.indexOf('in the background in every mode') !== -1; }), id);
        assert.ok(brief.notes.some(function (n) { return n.indexOf('mode chip next to your XP meter') !== -1; }), id);
    });
    var lite = reg.bqModeBrief('lite');
    assert.ok(lite.notes.some(function (n) { return n.indexOf('XP-to-sats claim') !== -1; }));
    assert.ok(lite.notes.some(function (n) { return n.indexOf('You stay ranked') !== -1; }));
    assert.ok(lite.hidden.some(function (n) { return /leaderboard/i.test(n); }));
    assert.ok(reg.bqModeBrief('advanced').included.length >= 1);
    assert.ok(read('onboarding.js.src').includes('bqFillModePicker'));
    assert.ok(read('ranking.js').includes('experienceModePicker'));
    assert.ok(read('onboarding.js.src').includes("setExperienceMode('advanced')"));
}));

queue.push(test('lite uses the beginner quest steps and unknown modes stay advanced', function () {
    assert.strictEqual(normalizeMode('lite'), 'lite');
    assert.strictEqual(normalizeMode('mystery'), 'advanced');
    assert.deepStrictEqual(stepsForMode('lite'), stepsForMode('beginner'));
    const spin = decideGrant({ stepId: 'spin_wheel', mode: 'lite', evidence: { spin: true }, ledger: { steps: {} } });
    assert.strictEqual(spin.error, 'not_in_mode');
    const quiz = decideGrant({ stepId: 'first_quiz', mode: 'lite', evidence: { quiz: true }, ledger: { steps: {} } });
    assert.strictEqual(quiz.ok, true);
    assert.strictEqual(quiz.awarded, 50);
}));

queue.push(test('the same badge award ignores experience mode', async function () {
    const day = { day: '2026-10-22', nowMs: 1700000000000, verified: true };
    const base = { sayHiDays: 1, points: 100, weeklyXP: 40, monthlyXP: 40, faction: 'cyber_hornets', visibleBadges: [] };
    const lite = memoryDb({ 'users/lite': Object.assign({ experienceMode: 'lite' }, base) });
    const advanced = memoryDb({ 'users/adv': Object.assign({ experienceMode: 'advanced' }, base) });
    const a = await awardBadge(lite, admin, 'lite', 'say_hi_1', day);
    const b = await awardBadge(advanced, admin, 'adv', 'say_hi_1', day);
    assert.strictEqual(a.granted, true);
    assert.strictEqual(b.granted, true);
    assert.strictEqual(a.xp, b.xp);
    assert.strictEqual(a.awarded, b.awarded);
    assert.strictEqual(a.favor, b.favor);
    assert.strictEqual(a.favorPoint, b.favorPoint);
    assert.deepStrictEqual(totals(lite, 'lite'), totals(advanced, 'adv'));
    assert.ok(a.xp > 0);
}));

queue.push(test('earning paths do not read experienceMode', function () {
    ['awardBadge.js', 'applyDailyXp.js', 'grantBadge.js', 'dailyXp.js', 'favorPool.js', 'awardActions.js'].forEach(function (name) {
        assert.ok(!read('functions/src/' + name).includes('experienceMode'), name);
    });
    assert.ok(!read('badges.js').includes('experienceMode'));
    const rules = read('firestore.rules');
    assert.ok(!rules.includes('experienceMode'));
    assert.ok(!rules.includes('modeCardDismissed'));
    const src = read('onboarding.js.src');
    assert.ok(src.includes("setExperienceMode('advanced')"));
    assert.ok(!src.includes("setExperienceMode('intermediate')"));
    assert.ok(src.includes('New: choose how much you see'));
    assert.ok(src.includes('bqModeChip'));
    assert.ok(src.includes('btc_mode_card_dismissed'));
    assert.ok(src.includes("What's the difference?"));
    assert.ok(read('mobile-ux.js').includes('apps hidden in '));
    assert.ok(read('ranking.js').includes("showSettingsPage('prefs')"));
    assert.ok(read('badges.js').includes("'+' + plainPts + ' XP · ' + plainReason"));
    assert.ok(read('badges.js').includes("window.bqModeAllows('badges')"));
    assert.ok(!read('badges.js').includes('experienceMode'));
    assert.ok(!read('ux-patches.js').includes('checkBadges = function'));
    assert.ok(read('ux-patches.js').includes('window.renderDesktopHomeMenus()'));
    assert.ok(!read('onboarding.js.src').includes('#em-quick-actions'));
    assert.ok(!read('onboarding.js.src').includes('#homeAppsMenu'));
}));

queue.push(test('lite celebrations, spin, and picker follow the registry', function () {
    assert.strictEqual(reg.bqModeAllows('confetti', 'lite'), false);
    assert.strictEqual(reg.bqModeAllows('confetti', 'beginner'), false);
    assert.strictEqual(reg.bqModeAllows('confetti', 'intermediate'), false);
    assert.strictEqual(reg.bqModeAllows('confetti', 'advanced'), true);
    assert.strictEqual(reg.bqModeAllows('progressRings', 'advanced'), true);
    assert.strictEqual(reg.bqModeAllows('progressRings', 'beginner'), false);
    assert.strictEqual(reg.bqModeAllows('progressRings', 'lite'), false);
    assert.strictEqual(reg.bqModeAllows('explorationMap', 'intermediate'), false);
    assert.strictEqual(reg.bqModeAllows('continueReading', 'beginner'), false);
    assert.strictEqual(reg.bqModeAllows('continueReading', 'intermediate'), true);
    assert.strictEqual(reg.bqModeAllows('featuredOn', 'beginner'), true);
    assert.strictEqual(reg.bqModeAllows('featuredOn', 'intermediate'), false);
    assert.strictEqual(reg.bqModeAllows('introVideo', 'lite'), true);
    assert.strictEqual(reg.bqModeAllows('introVideo', 'intermediate'), false);
    assert.strictEqual(reg.bqModeAllows('countryUsers', 'advanced'), true);
    assert.strictEqual(reg.bqModeAllows('countryUsers', 'intermediate'), false);
    var invite = reg.BQ_SURFACES.filter(function (row) { return row.id === 'invite'; })[0];
    assert.ok(invite.selector.indexOf('#homeInvitesTile') !== -1);
    var liteGuide = reg.bqGuideCards('lite');
    var liteTitles = liteGuide.start.concat(liteGuide.daily, liteGuide.apps, liteGuide.more).map(function (g) { return g.title; });
    assert.ok(liteTitles.indexOf('AI Nacho Mode') !== -1);
    assert.ok(liteTitles.indexOf('Lightning Tipping') === -1);
    var advGuide = reg.bqGuideCards('advanced');
    var advTitles = advGuide.start.concat(advGuide.daily, advGuide.apps, advGuide.more).map(function (g) { return g.title; });
    assert.ok(advTitles.indexOf('Lightning Tipping') !== -1);
    assert.ok(advTitles.indexOf('AI Nacho Mode') !== -1);
    assert.ok(read('badges.js').includes("window.bqModeAllows('confetti')"));
    assert.ok(read('ranking.js').includes("'Level up: ' + "));
    assert.ok(read('ranking.js').includes("window.bqModeAllows('confetti')"));
    assert.ok(read('features.js').includes("'+' + badge.pts + ' XP · ' + secretName"));
    assert.ok(read('features.js').includes("window.bqModeAllows('confetti')"));
    assert.ok(read('app.js').includes("window.bqModeAllows('spin')"));
    assert.ok(read('app.js').includes("window.bqModeAllows('confetti')"));
    assert.ok(read('nacho.js').includes('Ask Nacho'));
    assert.ok(read('nacho.js').includes("window.bqModeAllows('spin')"));
    assert.ok(read('mobile-ux.js').includes("if (streakMode === 'lite') return;"));
    assert.ok(read('notifications.js').includes('function notifListedInMode'));
    assert.ok(read('global-chat.js').includes('m.pvpShout'));
    assert.ok(read('global-chat.js').includes('m.cycleId'));
    assert.ok(!read('global-chat.js').includes('leveled up'));
    assert.ok(read('features.registry.js').includes('color:#94a3b8;'));
    assert.ok(!read('features.registry.js').includes('var recommend = !stored'));
    assert.ok(read('features.registry.js').includes("else if (meta.id === 'beginner')"));
    var src = read('onboarding.js.src');
    assert.ok(!src.includes('firstMode.focus'));
    assert.ok(src.includes('#bqModeChipPanel{') && src.includes('text-align:left;'));
    assert.ok(!read('nacho-live.js').includes('bqModeAllows(\'btcTicker\')'));
}));

Promise.all(queue).then(function () {
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
});
