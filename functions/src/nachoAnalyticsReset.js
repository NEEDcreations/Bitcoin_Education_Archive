'use strict';

// Dry-run plan for stats/nacho-analytics. Does not read or write Firestore.
// Kept counters are small integers. Injected keys are removed. totalQuestions
// follows the kept topic counts when any remain.

const SANE_MAX = 1000000;
const TOP_KEYS = ['totalQuestions', 'upvotes', 'downvotes', 'topics', 'sources', 'lastUpdated'];

function saneInt(value) {
    if (typeof value !== 'number' || !Number.isInteger(value)) return null;
    if (value < 0 || value > SANE_MAX) return null;
    return value;
}

function saneMap(value) {
    const kept = {};
    let removed = 0;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return { kept: kept, removed: value == null ? 0 : 1 };
    }
    Object.keys(value).forEach(function (key) {
        const safe = String(key).toLowerCase();
        const n = saneInt(value[key]);
        if (!/^[a-z0-9][a-z0-9_-]{0,31}$/.test(safe) || safe !== key || n == null) {
            removed++;
            return;
        }
        if (safe === 'constructor' || safe === 'prototype' || safe === '__proto__') {
            removed++;
            return;
        }
        kept[safe] = n;
    });
    return { kept: kept, removed: removed };
}

function sumMap(map) {
    let total = 0;
    Object.keys(map).forEach(function (key) { total += map[key]; });
    return total;
}

function planNachoReset(data) {
    const src = data && typeof data === 'object' ? data : {};
    const topics = saneMap(src.topics);
    const sources = saneMap(src.sources);
    const removed = [];
    Object.keys(src).forEach(function (key) {
        if (TOP_KEYS.indexOf(key) === -1) removed.push(key);
    });
    const topicSum = sumMap(topics.kept);
    const storedTotal = saneInt(src.totalQuestions);
    const totalQuestions = Object.keys(topics.kept).length ? topicSum : (storedTotal == null ? 0 : storedTotal);
    if (storedTotal == null || storedTotal !== totalQuestions) {
        if (src.totalQuestions !== totalQuestions) removed.push('totalQuestions');
    }
    const upvotes = saneInt(src.upvotes);
    const downvotes = saneInt(src.downvotes);
    if (upvotes == null && src.upvotes != null) removed.push('upvotes');
    if (downvotes == null && src.downvotes != null) removed.push('downvotes');
    if (topics.removed) removed.push('topics');
    if (sources.removed) removed.push('sources');
    const next = {
        totalQuestions: totalQuestions,
        upvotes: upvotes == null ? 0 : upvotes,
        downvotes: downvotes == null ? 0 : downvotes,
        topics: topics.kept,
        sources: sources.kept,
    };
    return {
        next: next,
        removedFields: removed,
        removedTopicKeys: topics.removed,
        removedSourceKeys: sources.removed,
    };
}

module.exports = {
    SANE_MAX: SANE_MAX,
    planNachoReset: planNachoReset,
    saneInt: saneInt,
};
