'use strict';

// Quest leaderboard. Rank is distinct quests passed in the period.
// A quest passes at 3/5 or better. A later pass of the same quest does not
// add another pass. Pass rate is passed attempts / attempts in that period.
// Week and month boundaries are America/New_York. The week starts Monday 00:00.
//
// gradeQuest writes quest_lb_stats and users/{uid}/quest_attempts. Both are
// Admin SDK only. The public lists are three stats docs, one per tab.
// Profile counters are not a source for this board.

const PASS_SCORE = 3;
const BOARD_SIZE = 25;
const FETCH_LIMIT = 200;
const DEBOUNCE_MS = 60 * 1000;
const DOC_MAX = 800000;
const PIC_MAX = 8000;
const ZONE = 'America/New_York';

const MIN = { alltime: 5, week: 3, month: 3 };
const DOC = {
    alltime: 'quest_leaderboard_alltime',
    week: 'quest_leaderboard_week',
    month: 'quest_leaderboard_month'
};

const DOW = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };

function pad(n) {
    const s = String(n);
    return s.length < 2 ? '0' + s : s;
}

function etParts(ms) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: ZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'short'
    });
    const out = { year: '', month: '', day: '', weekday: '' };
    fmt.formatToParts(new Date(Number(ms) || 0)).forEach(function (part) {
        if (Object.prototype.hasOwnProperty.call(out, part.type)) out[part.type] = part.value;
    });
    return out;
}

function weekdayIndex(label) {
    const key = String(label || '').toLowerCase().slice(0, 3);
    return Object.prototype.hasOwnProperty.call(DOW, key) ? DOW[key] : -1;
}

function weekKey(ms) {
    const p = etParts(ms);
    const dow = weekdayIndex(p.weekday);
    if (dow < 0 || !p.year || !p.month || !p.day) return '';
    const sinceMonday = dow === 0 ? 6 : dow - 1;
    const monday = new Date(Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day)) - sinceMonday * 86400000);
    return monday.getUTCFullYear() + '-' + pad(monday.getUTCMonth() + 1) + '-' + pad(monday.getUTCDate());
}

function monthKey(ms) {
    const p = etParts(ms);
    if (!p.year || !p.month) return '';
    return p.year + '-' + p.month;
}

function timeMs(value) {
    if (value == null || value === '') return 0;
    if (typeof value === 'number' && isFinite(value)) return value > 0 ? value : 0;
    if (typeof value === 'object' && typeof value.toMillis === 'function') {
        const n = Number(value.toMillis());
        return n > 0 ? n : 0;
    }
    if (typeof value === 'object' && typeof value._seconds === 'number') {
        const n = value._seconds * 1000 + Math.floor((Number(value._nanoseconds) || 0) / 1e6);
        return n > 0 ? n : 0;
    }
    if (typeof value === 'string') {
        const n = Date.parse(value);
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return 0;
}

function whole(value) {
    const n = Math.floor(Number(value) || 0);
    return n > 0 ? n : 0;
}

function sanitizeQuestId(id) {
    const s = String(id || '');
    if (!s || s.length > 120) return '';
    if (!/^quest_[A-Za-z0-9_-]+$/.test(s)) return '';
    return s;
}

function cloneMap(map) {
    const out = {};
    if (!map || typeof map !== 'object') return out;
    Object.keys(map).forEach(function (key) {
        const id = sanitizeQuestId(key);
        if (!id) return;
        const n = timeMs(map[key]);
        out[id] = n;
    });
    return out;
}

function emptyStats() {
    return {
        attempts: 0,
        passedAttempts: 0,
        passes: 0,
        reachedAt: 0,
        passed: {},
        weekKey: '',
        weekAttempts: 0,
        weekPassedAttempts: 0,
        weekPasses: 0,
        weekReachedAt: 0,
        weekPassed: {},
        monthKey: '',
        monthAttempts: 0,
        monthPassedAttempts: 0,
        monthPasses: 0,
        monthReachedAt: 0,
        monthPassed: {},
        live: false,
        updatedAt: 0
    };
}

function syncCounts(attempts, passedAttempts, passes) {
    let passCount = whole(passes);
    let passed = whole(passedAttempts);
    let total = whole(attempts);
    if (passed < passCount) passed = passCount;
    if (total < passed) total = passed;
    return { attempts: total, passedAttempts: passed, passes: passCount };
}

function normalizeStats(src) {
    const raw = src || {};
    const passed = cloneMap(raw.passed);
    const weekPassed = cloneMap(raw.weekPassed);
    const monthPassed = cloneMap(raw.monthPassed);
    const all = syncCounts(raw.attempts, raw.passedAttempts, Math.max(whole(raw.passes), Object.keys(passed).length));
    const week = syncCounts(raw.weekAttempts, raw.weekPassedAttempts, Math.max(whole(raw.weekPasses), Object.keys(weekPassed).length));
    const month = syncCounts(raw.monthAttempts, raw.monthPassedAttempts, Math.max(whole(raw.monthPasses), Object.keys(monthPassed).length));
    return {
        attempts: all.attempts,
        passedAttempts: all.passedAttempts,
        passes: all.passes,
        reachedAt: timeMs(raw.reachedAt),
        passed: passed,
        weekKey: typeof raw.weekKey === 'string' ? raw.weekKey : '',
        weekAttempts: week.attempts,
        weekPassedAttempts: week.passedAttempts,
        weekPasses: week.passes,
        weekReachedAt: timeMs(raw.weekReachedAt),
        weekPassed: weekPassed,
        monthKey: typeof raw.monthKey === 'string' ? raw.monthKey : '',
        monthAttempts: month.attempts,
        monthPassedAttempts: month.passedAttempts,
        monthPasses: month.passes,
        monthReachedAt: timeMs(raw.monthReachedAt),
        monthPassed: monthPassed,
        live: raw.live === true,
        updatedAt: timeMs(raw.updatedAt)
    };
}

function rollPeriod(stats, prefix, key) {
    if (stats[prefix + 'Key'] === key) return;
    stats[prefix + 'Key'] = key;
    stats[prefix + 'Attempts'] = 0;
    stats[prefix + 'PassedAttempts'] = 0;
    stats[prefix + 'Passes'] = 0;
    stats[prefix + 'ReachedAt'] = 0;
    stats[prefix + 'Passed'] = {};
}

function notePass(stats, prefix, questId, at) {
    const mapKey = prefix ? prefix + 'Passed' : 'passed';
    const countKey = prefix ? prefix + 'Passes' : 'passes';
    const reachKey = prefix ? prefix + 'ReachedAt' : 'reachedAt';
    const map = stats[mapKey];
    if (!questId || Object.prototype.hasOwnProperty.call(map, questId)) return;
    map[questId] = at;
    stats[countKey] = whole(stats[countKey]) + 1;
    if (at > 0) stats[reachKey] = at;
}

// Commit 0730b656, when gradeQuest started scoring from the server bank.
// Answer-key docs created before this are pre-cutover history. Later ones
// overlap the server pass and attempt records.
const CUTOVER_MS = Date.parse('2026-10-23T17:14:38.000Z');

function alreadyPassed(stats, questId) {
    return !!(questId && stats && stats.passed && Object.prototype.hasOwnProperty.call(stats.passed, questId));
}

// A replay of a quest that already passed does not move attempts or
// passedAttempts on any period. Fails before the first pass still count.
// Only that first pass increases the distinct-quest rank.
function applyAttempt(prev, attempt, nowMs) {
    const stats = normalizeStats(prev);
    const at = timeMs(attempt && attempt.at) || timeMs(nowMs);
    const score = Math.floor(Number(attempt && attempt.score) || 0);
    const questId = sanitizeQuestId(attempt && attempt.questId);
    const passed = score >= PASS_SCORE;
    if (alreadyPassed(stats, questId)) {
        stats.updatedAt = timeMs(nowMs) || at;
        return stats;
    }
    stats.attempts += 1;
    if (passed) stats.passedAttempts += 1;
    if (passed) notePass(stats, '', questId, at);
    const week = weekKey(at);
    rollPeriod(stats, 'week', week);
    stats.weekAttempts += 1;
    if (passed) stats.weekPassedAttempts += 1;
    if (passed) notePass(stats, 'week', questId, at);
    const month = monthKey(at);
    rollPeriod(stats, 'month', month);
    stats.monthAttempts += 1;
    if (passed) stats.monthPassedAttempts += 1;
    if (passed) notePass(stats, 'month', questId, at);
    stats.updatedAt = timeMs(nowMs) || at;
    delete stats.estimatedRate;
    return stats;
}

// completedQuests and quest_passes share one shape: quest_<topic>__<part>,
// part 1-based. Legacy part 1 was quest_<topic>. Static client ids were
// q__<topic>__<part>. This does not decide whether the id is a real quest.
function canonicalQuestId(raw) {
    const s = String(raw == null ? '' : raw).trim();
    if (!s || s.length > 160) return '';
    let match = /^q__([A-Za-z0-9_-]+)__(\d+)$/.exec(s);
    if (match) return sanitizeQuestId('quest_' + match[1] + '__' + String(Number(match[2])));
    match = /^quest_([A-Za-z0-9_-]+)__(\d+)$/.exec(s);
    if (match) return sanitizeQuestId('quest_' + match[1] + '__' + String(Number(match[2])));
    match = /^quest_([A-Za-z0-9_-]+)$/.exec(s);
    if (match) return sanitizeQuestId(s + '__1');
    match = /^([A-Za-z0-9_-]+)$/.exec(s);
    if (match) return sanitizeQuestId('quest_' + s + '__1');
    return '';
}

let questCatalogCache = null;

function partsInTopic(rows) {
    const parts = Object.create(null);
    const list = Array.isArray(rows) ? rows : [];
    list.forEach(function (row, i) {
        const qi = row && Number.isInteger(row.questIndex) ? row.questIndex : Math.floor(i / 5);
        if (qi >= 0 && qi <= 40) parts[qi] = true;
    });
    return parts;
}

function catalogFromBank(quests) {
    const ids = Object.create(null);
    const topics = Object.create(null);
    Object.keys(quests || {}).forEach(function (topic) {
        if (!/^[A-Za-z0-9_-]+$/.test(topic)) return;
        topics[topic] = true;
        const parts = partsInTopic(quests[topic]);
        Object.keys(parts).forEach(function (qi) {
            ids['quest_' + topic + '__' + (Number(qi) + 1)] = true;
        });
    });
    return { ids: ids, topics: topics };
}

// Current reward bank plus the previous published bank. Anything else,
// including quest_dynamic_N, is not a quest.
function questCatalog() {
    if (questCatalogCache) return questCatalogCache;
    const current = catalogFromBank(require('../reward-banks.json').quests);
    let prevQuests = null;
    try { prevQuests = require('../reward-banks.prev.json').quests; } catch (err) { prevQuests = null; }
    const prev = catalogFromBank(prevQuests);
    Object.keys(prev.ids).forEach(function (id) { current.ids[id] = true; });
    Object.keys(prev.topics).forEach(function (topic) { current.topics[topic] = true; });
    questCatalogCache = current;
    return current;
}

function catalogQuestId(raw) {
    const id = canonicalQuestId(raw);
    if (!id || !questCatalog().ids[id]) return '';
    return id;
}

// questIndex is 0-based, matching gradeQuest. part and partNum are 1-based,
// matching the client part number baked into quest_<topic>__<part>.
function explicitPart(doc) {
    if (!doc || typeof doc !== 'object') return null;
    if (Number.isInteger(doc.questIndex) && doc.questIndex >= 0 && doc.questIndex <= 40) return doc.questIndex + 1;
    if (Number.isInteger(doc.partNum) && doc.partNum >= 1 && doc.partNum <= 41) return doc.partNum;
    if (Number.isInteger(doc.part) && doc.part >= 1 && doc.part <= 41) return doc.part;
    const keys = Array.isArray(doc.keys) ? doc.keys : [];
    for (let i = 0; i < keys.length; i++) {
        const row = keys[i];
        if (!row || typeof row !== 'object') continue;
        if (Number.isInteger(row.questIndex) && row.questIndex >= 0 && row.questIndex <= 40) return row.questIndex + 1;
        if (Number.isInteger(row.partNum) && row.partNum >= 1 && row.partNum <= 41) return row.partNum;
    }
    return null;
}

// Graded answer keys often stored only topicKey. Do not invent part 1.
// No part → an attempt only. Unknown topic or a part that is not in the
// catalog → drop, including a failed key.
function resolveAnswerKey(doc) {
    const catalog = questCatalog();
    const topicRaw = String((doc && (doc.topicKey || doc.topic)) || '').trim();
    let topic = '';
    let part = explicitPart(doc);
    const full = /^quest_([A-Za-z0-9_-]+)__(\d+)$/.exec(topicRaw);
    const legacy = /^q__([A-Za-z0-9_-]+)__(\d+)$/.exec(topicRaw);
    if (full) {
        topic = full[1];
        if (part == null) part = Number(full[2]);
    } else if (legacy) {
        topic = legacy[1];
        if (part == null) part = Number(legacy[2]);
    } else if (catalog.topics[topicRaw]) {
        topic = topicRaw;
    } else if (/^quest_([A-Za-z0-9_-]+)$/.test(topicRaw) && catalog.topics[topicRaw.slice('quest_'.length)]) {
        topic = topicRaw.slice('quest_'.length);
    } else {
        return { kind: 'drop' };
    }
    if (!topic || !catalog.topics[topic]) return { kind: 'drop' };
    if (part == null) return { kind: 'attempt' };
    const id = 'quest_' + topic + '__' + part;
    if (!catalog.ids[id]) return { kind: 'drop' };
    return { kind: 'quest', id: id };
}

function copyPeriod(stats, from, prefix) {
    stats[prefix + 'Key'] = from[prefix + 'Key'];
    stats[prefix + 'Attempts'] = from[prefix + 'Attempts'];
    stats[prefix + 'PassedAttempts'] = from[prefix + 'PassedAttempts'];
    stats[prefix + 'Passes'] = from[prefix + 'Passes'];
    stats[prefix + 'ReachedAt'] = from[prefix + 'ReachedAt'];
    stats[prefix + 'Passed'] = from[prefix + 'Passed'];
}

// Pre-cutover history plus server records after 0730b656.
// All-time attempts = distinct catalog passes + pre-cutover failed keys
// for a known part + answer keys that name a real topic but no part.
// Repeat passes add nothing. A key with no part is never a distinct pass.
// Ids that are not in the current or previous quest bank are dropped,
// including failed keys and quest_dynamic_N. Week and month use dated
// rows only. estimatedRate (the old 65.5% placeholder) is not kept.
function buildLegacyStats(input, nowMs) {
    const src = input || {};
    const cutover = src.cutoverMs == null ? CUTOVER_MS : Number(src.cutoverMs);
    const passAt = Object.create(null);
    const datedPassAt = Object.create(null);

    function addPass(raw, at) {
        const id = canonicalQuestId(raw);
        if (!id) return;
        const t = timeMs(at);
        if (!Object.prototype.hasOwnProperty.call(passAt, id)) passAt[id] = t;
        else if (t > 0 && (passAt[id] === 0 || t < passAt[id])) passAt[id] = t;
        if (t > 0) {
            if (!Object.prototype.hasOwnProperty.call(datedPassAt, id) || t < datedPassAt[id]) datedPassAt[id] = t;
        }
    }

    let dropped = 0;
    const completed = Array.isArray(src.completedQuests) ? src.completedQuests : [];
    completed.forEach(function (id) {
        const canon = catalogQuestId(id);
        if (!canon) { dropped++; return; }
        addPass(canon, 0);
    });

    const oldFails = [];
    const partless = [];
    (src.answerKeys || []).forEach(function (doc) {
        if (!doc || doc.graded !== true) return;
        const at = timeMs(doc.createdAt);
        if (!(at > 0) || !(at < cutover)) return;
        const resolved = resolveAnswerKey(doc);
        if (resolved.kind === 'drop') { dropped++; return; }
        const score = Number(doc.score);
        if (resolved.kind === 'attempt') {
            partless.push({ at: at, score: score });
            return;
        }
        if (score >= PASS_SCORE) addPass(resolved.id, at);
        else oldFails.push({ questId: resolved.id, at: at, score: score });
    });

    (src.passes || []).forEach(function (row) {
        const at = timeMs(row && row.at);
        const canon = catalogQuestId((row && (row.questId || row.id)) || '');
        if (!canon) { dropped++; return; }
        if (at >= cutover) return;
        addPass(canon, at);
    });

    const postEvents = [];
    (src.passes || []).forEach(function (row) {
        const at = timeMs(row && row.at);
        if (!(at >= cutover)) return;
        const canon = catalogQuestId((row && (row.questId || row.id)) || '');
        if (!canon) return;
        postEvents.push({
            questId: canon,
            score: row.score == null ? PASS_SCORE : Number(row.score),
            at: at
        });
    });
    (src.attempts || []).forEach(function (row) {
        const at = timeMs(row && row.at);
        if (!(at >= cutover)) return;
        const canon = catalogQuestId(row && row.questId);
        if (!canon) { dropped++; return; }
        postEvents.push({
            questId: canon,
            score: Number(row && row.score) || 0,
            at: at
        });
    });
    postEvents.sort(function (a, b) { return a.at - b.at || String(a.questId).localeCompare(String(b.questId)); });

    // A post-cutover dated pass should be applied in order, so fails recorded
    // before it still count. Keep an earlier dated pass in the seed so a
    // later replay does not move the rate.
    const postPassIds = Object.create(null);
    postEvents.forEach(function (ev) {
        if (ev.questId && ev.score >= PASS_SCORE) postPassIds[ev.questId] = true;
    });
    Object.keys(postPassIds).forEach(function (id) {
        if (!(datedPassAt[id] > 0) || datedPassAt[id] >= cutover) delete passAt[id];
    });

    const seedIds = Object.keys(passAt);
    let stats = emptyStats();
    seedIds.forEach(function (id) { stats.passed[id] = passAt[id]; });
    stats.passes = seedIds.length;
    stats.passedAttempts = seedIds.length;
    stats.attempts = seedIds.length + oldFails.length + partless.length;
    let reached = 0;
    seedIds.forEach(function (id) { if (passAt[id] > reached) reached = passAt[id]; });
    stats.reachedAt = reached;
    postEvents.forEach(function (ev) {
        stats = applyAttempt(stats, ev, ev.at);
    });

    const dated = oldFails.map(function (row) {
        return { questId: row.questId, score: row.score, at: row.at };
    });
    // No part: an attempt in that period, never a distinct pass.
    partless.forEach(function (row) {
        dated.push({ questId: '', score: 0, at: row.at });
    });
    Object.keys(datedPassAt).forEach(function (id) {
        if (postPassIds[id]) return;
        dated.push({ questId: id, score: PASS_SCORE, at: datedPassAt[id] });
    });
    postEvents.forEach(function (ev) { dated.push(ev); });
    dated.sort(function (a, b) { return a.at - b.at || String(a.questId).localeCompare(String(b.questId)); });
    let periods = emptyStats();
    dated.forEach(function (ev) { periods = applyAttempt(periods, ev, ev.at); });
    copyPeriod(stats, periods, 'week');
    copyPeriod(stats, periods, 'month');
    stats.updatedAt = timeMs(nowMs) || stats.updatedAt;
    stats.live = postEvents.length > 0;
    delete stats.estimatedRate;
    return {
        stats: stats,
        distinctPasses: stats.passes,
        oldFails: oldFails.length,
        partless: partless.length,
        dropped: dropped,
        postEvents: postEvents.length
    };
}

function seedStatsFromPasses(events) {
    const list = (events || []).slice().sort(function (a, b) {
        return (timeMs(a && a.at) || 0) - (timeMs(b && b.at) || 0);
    });
    let stats = emptyStats();
    list.forEach(function (ev) {
        const score = ev && ev.score == null ? PASS_SCORE : Number(ev.score);
        if (!(score >= PASS_SCORE)) return;
        const at = timeMs(ev.at);
        stats = applyAttempt(stats, {
            questId: ev.questId,
            score: score,
            at: at
        }, at);
    });
    stats.live = false;
    return stats;
}

function addHistoricalPass(stats, prefix, questId, at, periodKey) {
    const keyName = prefix + 'Key';
    const mapName = prefix + 'Passed';
    if (!at || (prefix === 'week' ? weekKey(at) : monthKey(at)) !== periodKey) return;
    if (Object.prototype.hasOwnProperty.call(stats[mapName], questId)) return;
    if (stats[keyName] !== periodKey) rollPeriod(stats, prefix, periodKey);
    stats[mapName][questId] = at;
    stats[prefix + 'Passes'] = whole(stats[prefix + 'Passes']) + 1;
    stats[prefix + 'Attempts'] = whole(stats[prefix + 'Attempts']) + 1;
    stats[prefix + 'PassedAttempts'] = whole(stats[prefix + 'PassedAttempts']) + 1;
    if (at > timeMs(stats[prefix + 'ReachedAt'])) stats[prefix + 'ReachedAt'] = at;
}

// Live grading already counted newer attempts. Add server pass docs that
// happened before that, without replaying them through the period roll.
function absorbHistoricalPasses(prev, events, nowMs) {
    const stats = normalizeStats(prev);
    const now = timeMs(nowMs) || Date.now();
    const currentWeek = weekKey(now);
    const currentMonth = monthKey(now);
    const list = (events || []).slice().sort(function (a, b) {
        return (timeMs(a && a.at) || 0) - (timeMs(b && b.at) || 0);
    });
    list.forEach(function (ev) {
        const questId = sanitizeQuestId(ev && ev.questId);
        const at = timeMs(ev && ev.at);
        const score = ev && ev.score == null ? PASS_SCORE : Number(ev.score);
        if (!questId || !(score >= PASS_SCORE)) return;
        if (!Object.prototype.hasOwnProperty.call(stats.passed, questId)) {
            stats.passed[questId] = at;
            stats.passes += 1;
            stats.attempts += 1;
            stats.passedAttempts += 1;
            if (at > stats.reachedAt) stats.reachedAt = at;
        }
        addHistoricalPass(stats, 'week', questId, at, currentWeek);
        addHistoricalPass(stats, 'month', questId, at, currentMonth);
    });
    stats.updatedAt = now;
    stats.live = true;
    return stats;
}

function mergeForBackfill(existing, events, nowMs) {
    if (existing && existing.live === true) return absorbHistoricalPasses(existing, events, nowMs);
    const seeded = seedStatsFromPasses(events);
    seeded.updatedAt = timeMs(nowMs) || seeded.updatedAt;
    return seeded;
}

function sameTotals(a, b) {
    if (!a || !b) return false;
    return whole(a.passes) === whole(b.passes)
        && whole(a.attempts) === whole(b.attempts)
        && whole(a.passedAttempts) === whole(b.passedAttempts)
        && timeMs(a.reachedAt) === timeMs(b.reachedAt)
        && String(a.weekKey || '') === String(b.weekKey || '')
        && whole(a.weekPasses) === whole(b.weekPasses)
        && whole(a.weekAttempts) === whole(b.weekAttempts)
        && whole(a.weekPassedAttempts) === whole(b.weekPassedAttempts)
        && timeMs(a.weekReachedAt) === timeMs(b.weekReachedAt)
        && String(a.monthKey || '') === String(b.monthKey || '')
        && whole(a.monthPasses) === whole(b.monthPasses)
        && whole(a.monthAttempts) === whole(b.monthAttempts)
        && whole(a.monthPassedAttempts) === whole(b.monthPassedAttempts)
        && timeMs(a.monthReachedAt) === timeMs(b.monthReachedAt);
}

function displayName(username) {
    const name = String(username || '').replace(/\s+/g, ' ').trim();
    if (!name || /^(anon|anonymous)$/i.test(name)) return 'Anon';
    if (name.indexOf('@') !== -1) return 'Anon';
    return name.slice(0, 40);
}

function safePic(pic) {
    if (typeof pic !== 'string' || !pic || pic.length > PIC_MAX) return '';
    if (/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=]+$/i.test(pic)) return pic;
    if (/^https:\/\/[^\s"'<>]+$/i.test(pic) && pic.length < 500) return pic;
    return '';
}

function boardLines(rows) {
    return (rows || []).map(function (row) {
        const name = displayName(row && row.username);
        return String(row && row.rank || 0) + '. ' + name + '  ' + whole(row && row.passes) + '  ' + whole(row && row.pct) + '%';
    });
}

function displayPct(passedAttempts, attempts) {
    const total = whole(attempts);
    if (total <= 0) return 0;
    return Math.round((whole(passedAttempts) / total) * 100);
}

function blankView() {
    return { passes: 0, attempts: 0, passedAttempts: 0, reachedAt: 0 };
}

function viewFromStats(stats, period, nowMs) {
    const s = stats || {};
    if (period === 'week') {
        if (s.weekKey !== weekKey(nowMs)) return blankView();
        return {
            passes: whole(s.weekPasses),
            attempts: whole(s.weekAttempts),
            passedAttempts: whole(s.weekPassedAttempts),
            reachedAt: timeMs(s.weekReachedAt)
        };
    }
    if (period === 'month') {
        if (s.monthKey !== monthKey(nowMs)) return blankView();
        return {
            passes: whole(s.monthPasses),
            attempts: whole(s.monthAttempts),
            passedAttempts: whole(s.monthPassedAttempts),
            reachedAt: timeMs(s.monthReachedAt)
        };
    }
    return {
        passes: whole(s.passes),
        attempts: whole(s.attempts),
        passedAttempts: whole(s.passedAttempts),
        reachedAt: timeMs(s.reachedAt)
    };
}

function rateDelta(a, b) {
    const aa = whole(a.attempts);
    const ba = whole(b.attempts);
    if (aa <= 0 && ba <= 0) return 0;
    if (aa <= 0) return 1;
    if (ba <= 0) return -1;
    const left = whole(a.passedAttempts) * ba;
    const right = whole(b.passedAttempts) * aa;
    if (left === right) return 0;
    return right > left ? 1 : -1;
}

function reachOf(value) {
    const n = timeMs(value);
    return n > 0 ? n : Number.MAX_SAFE_INTEGER;
}

function compareRows(a, b) {
    const ap = whole(a.passes);
    const bp = whole(b.passes);
    if (bp !== ap) return bp - ap;
    const rate = rateDelta(a, b);
    if (rate !== 0) return rate;
    const ar = reachOf(a.reachedAt);
    const br = reachOf(b.reachedAt);
    if (ar !== br) return ar - br;
    const an = displayName(a.username).toLowerCase();
    const bn = displayName(b.username).toLowerCase();
    if (an !== bn) return an < bn ? -1 : 1;
    return 0;
}

// selectBoard computes pct from attempt counts. refresh then packs those
// public rows again. A packed row has pct and no counts, so a second
// displayPct() would be 0. Keep a pct that is already final.
function pctOf(row) {
    const src = row || {};
    if (src.attempts == null && src.passedAttempts == null && src.pct != null && src.pct !== '') {
        const n = Math.round(Number(src.pct));
        return Number.isFinite(n) && n > 0 ? n : 0;
    }
    return displayPct(src.passedAttempts, src.attempts);
}

function publicEntry(row, rank) {
    return {
        rank: rank,
        username: displayName(row.username),
        profilePic: safePic(row.profilePic),
        passes: whole(row.passes),
        pct: pctOf(row)
    };
}

function selectBoard(rows, period) {
    const min = MIN[period] || MIN.alltime;
    const qualified = (rows || []).filter(function (row) {
        if (!row || row.ghostMode === true) return false;
        return whole(row.attempts) >= min;
    });
    qualified.sort(compareRows);
    return qualified.slice(0, BOARD_SIZE).map(function (row, i) {
        return publicEntry(row, i + 1);
    });
}

function buildBoards(entries, nowMs) {
    const now = timeMs(nowMs) || Date.now();
    function rowsFor(period) {
        return (entries || []).map(function (entry) {
            const src = entry || {};
            const view = viewFromStats(src.stats || src, period, now);
            return {
                username: src.username,
                profilePic: src.profilePic,
                ghostMode: src.ghostMode === true,
                passes: view.passes,
                attempts: view.attempts,
                passedAttempts: view.passedAttempts,
                reachedAt: view.reachedAt
            };
        });
    }
    return {
        updatedAt: now,
        weekKey: weekKey(now),
        monthKey: monthKey(now),
        alltime: selectBoard(rowsFor('alltime'), 'alltime'),
        week: selectBoard(rowsFor('week'), 'week'),
        month: selectBoard(rowsFor('month'), 'month')
    };
}

function packPeriod(period, rows, now, extra) {
    const doc = {
        updatedAt: timeMs(now) || Date.now(),
        period: period,
        minAttempts: MIN[period] || MIN.alltime,
        rows: (rows || []).map(function (row) {
            return publicEntry(row, row.rank);
        })
    };
    if (extra) {
        Object.keys(extra).forEach(function (key) { doc[key] = extra[key]; });
    }
    if (JSON.stringify(doc).length > DOC_MAX) {
        doc.rows.forEach(function (row) { row.profilePic = ''; });
    }
    return doc;
}

function attemptRecord(attempt) {
    const score = Math.floor(Number(attempt && attempt.score) || 0);
    const topic = String(attempt && attempt.topicKey || '').slice(0, 80);
    const index = Number.isInteger(attempt && attempt.questIndex) ? attempt.questIndex : -1;
    return {
        questId: sanitizeQuestId(attempt && attempt.questId),
        topicKey: /^[A-Za-z0-9_-]*$/.test(topic) ? topic : '',
        questIndex: index,
        score: score > 0 ? score : 0,
        passed: score >= PASS_SCORE,
        at: timeMs(attempt && attempt.at)
    };
}

function passEventFromDoc(id, data) {
    const src = data || {};
    const fromFields = src.topicKey && Number.isInteger(src.questIndex)
        ? 'quest_' + src.topicKey + '__' + (src.questIndex + 1)
        : '';
    return {
        questId: sanitizeQuestId(id) || sanitizeQuestId(src.questId) || sanitizeQuestId(fromFields),
        score: src.score == null ? PASS_SCORE : Number(src.score),
        at: timeMs(src.at)
    };
}

async function readQuery(query) {
    const snap = await query.get();
    const rows = [];
    snap.forEach(function (doc) {
        rows.push({ id: doc.id, data: doc.data() || {} });
    });
    return rows;
}

async function readSnaps(db, refs) {
    const snaps = [];
    if (!refs.length) return snaps;
    if (typeof db.getAll === 'function') {
        for (let i = 0; i < refs.length; i += 10) {
            const part = refs.slice(i, i + 10);
            const rows = await db.getAll.apply(db, part);
            rows.forEach(function (row) { snaps.push(row); });
        }
        return snaps;
    }
    return Promise.all(refs.map(function (ref) { return ref.get(); }));
}

async function loadUserBits(db, ids) {
    const out = {};
    const refs = ids.map(function (id) { return db.collection('users').doc(id); });
    const snaps = await readSnaps(db, refs);
    snaps.forEach(function (snap) {
        const data = snap.exists ? (snap.data() || {}) : {};
        out[snap.id] = {
            username: data.username,
            profilePic: data.profilePic,
            ghostMode: data.ghostMode === true
        };
    });
    const missing = ids.filter(function (id) {
        const name = out[id] && out[id].username ? String(out[id].username).trim() : '';
        return !name || name === 'Anon' || name === 'Anonymous';
    });
    if (!missing.length) return out;
    const pubs = await readSnaps(db, missing.map(function (id) {
        return db.collection('public_profiles').doc(id);
    }));
    pubs.forEach(function (snap) {
        if (!snap.exists) return;
        const data = snap.data() || {};
        const user = out[snap.id] || { username: '', profilePic: '', ghostMode: false };
        const name = user.username ? String(user.username).trim() : '';
        if (!name || name === 'Anon' || name === 'Anonymous') user.username = data.username;
        if (!user.profilePic && data.profilePic) user.profilePic = data.profilePic;
        if (data.ghostMode === true) user.ghostMode = true;
        out[snap.id] = user;
    });
    return out;
}

async function refresh(db, nowMs, opts) {
    const now = timeMs(nowMs) || Date.now();
    const allRef = db.collection('stats').doc(DOC.alltime);
    if (!(opts && opts.force === true)) {
        const existing = await allRef.get();
        const prev = existing.exists ? timeMs((existing.data() || {}).updatedAt) : 0;
        if (prev && now - prev < DEBOUNCE_MS) return { skipped: true, updatedAt: prev };
    }
    const week = weekKey(now);
    const month = monthKey(now);
    const stats = db.collection('quest_lb_stats');
    const parts = await Promise.all([
        readQuery(stats.orderBy('passes', 'desc').limit(FETCH_LIMIT)),
        readQuery(stats.where('weekKey', '==', week).orderBy('weekPasses', 'desc').limit(FETCH_LIMIT)),
        readQuery(stats.where('monthKey', '==', month).orderBy('monthPasses', 'desc').limit(FETCH_LIMIT))
    ]);
    const byId = {};
    parts.forEach(function (rows) {
        rows.forEach(function (row) { byId[row.id] = row.data; });
    });
    const ids = Object.keys(byId);
    const users = await loadUserBits(db, ids);
    const entries = ids.map(function (id) {
        const user = users[id] || {};
        return {
            stats: byId[id],
            username: user.username,
            profilePic: user.profilePic,
            ghostMode: user.ghostMode === true
        };
    });
    const built = buildBoards(entries, now);
    const docs = {
        alltime: packPeriod('alltime', built.alltime, now, {}),
        week: packPeriod('week', built.week, now, { weekKey: week }),
        month: packPeriod('month', built.month, now, { monthKey: month })
    };
    await Promise.all([
        allRef.set(docs.alltime),
        db.collection('stats').doc(DOC.week).set(docs.week),
        db.collection('stats').doc(DOC.month).set(docs.month)
    ]);
    return {
        skipped: false,
        alltime: docs.alltime.rows.length,
        week: docs.week.rows.length,
        month: docs.month.rows.length
    };
}

module.exports = {
    PASS_SCORE: PASS_SCORE,
    BOARD_SIZE: BOARD_SIZE,
    FETCH_LIMIT: FETCH_LIMIT,
    DEBOUNCE_MS: DEBOUNCE_MS,
    MIN: MIN,
    DOC: DOC,
    weekKey: weekKey,
    monthKey: monthKey,
    timeMs: timeMs,
    emptyStats: emptyStats,
    normalizeStats: normalizeStats,
    CUTOVER_MS: CUTOVER_MS,
    canonicalQuestId: canonicalQuestId,
    questCatalog: questCatalog,
    buildLegacyStats: buildLegacyStats,
    applyAttempt: applyAttempt,
    seedStatsFromPasses: seedStatsFromPasses,
    absorbHistoricalPasses: absorbHistoricalPasses,
    mergeForBackfill: mergeForBackfill,
    sameTotals: sameTotals,
    displayName: displayName,
    boardLines: boardLines,
    safePic: safePic,
    displayPct: displayPct,
    viewFromStats: viewFromStats,
    selectBoard: selectBoard,
    buildBoards: buildBoards,
    packPeriod: packPeriod,
    attemptRecord: attemptRecord,
    passEventFromDoc: passEventFromDoc,
    refresh: refresh
};
