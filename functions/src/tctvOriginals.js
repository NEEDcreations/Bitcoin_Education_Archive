'use strict';

// Bitcoin Quest Originals hosted on Cloudflare Stream.
// Only these video ids may count toward the 10-minute daily task,
// lifetime watch badges, or the TCTV pot. YouTube ids never appear here.
// Keep this file in sync with /tctv-originals.js (tested).

const MIN_ORIGINALS_FOR_TASK = 1;
const MIN_DURATION_SECONDS_FOR_TASK = 600;

// Each entry: { id, title, durationSeconds, rights: '603BTC' | 'BQ' | 'written' }
// Empty until an Original is published with 603BTC/BQ or written rights.
const ORIGINALS = [];

const TASK_CARD = 'Watch 10 minutes of Bitcoin Quest Originals today to earn 100 XP and 1 OrangeTix. Only Bitcoin Quest Original videos count; other videos on Timechain TV are just for watching.';
const TERMS_REWARDS = 'Timechain TV daily task: earned only by watching Bitcoin Quest Original videos we host. Videos from YouTube or other third-party channels never earn XP, OrangeTix, sats, or other rewards. Rewards are fixed, capped daily, and require active playback.';

function list() {
    return ORIGINALS.slice();
}

function count() {
    return ORIGINALS.length;
}

function totalDurationSeconds() {
    let total = 0;
    for (let i = 0; i < ORIGINALS.length; i++) {
        const n = Math.floor(Number(ORIGINALS[i] && ORIGINALS[i].durationSeconds) || 0);
        if (n > 0) total += n;
    }
    return total;
}

function isOriginal(videoId) {
    if (typeof videoId !== 'string' || !videoId) return false;
    for (let i = 0; i < ORIGINALS.length; i++) {
        if (ORIGINALS[i] && ORIGINALS[i].id === videoId) return true;
    }
    return false;
}

function taskEnabled() {
    return count() >= MIN_ORIGINALS_FOR_TASK && totalDurationSeconds() >= MIN_DURATION_SECONDS_FOR_TASK;
}

module.exports = {
    MIN_ORIGINALS_FOR_TASK: MIN_ORIGINALS_FOR_TASK,
    MIN_DURATION_SECONDS_FOR_TASK: MIN_DURATION_SECONDS_FOR_TASK,
    ORIGINALS: ORIGINALS,
    TASK_CARD: TASK_CARD,
    TERMS_REWARDS: TERMS_REWARDS,
    list: list,
    count: count,
    totalDurationSeconds: totalDurationSeconds,
    isOriginal: isOriginal,
    taskEnabled: taskEnabled,
};
