'use strict';

// Thin schedules. The boss table, the 1 PM Eastern clock, the final Nacho
// post, and the Phil DM live in raidBossEngine.js. No next-month placeholder.

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const engine = require('./raidBossEngine');

function db() {
    return admin.firestore();
}

exports.scheduleRaidBoss = onSchedule({
    schedule: '0 13 1 * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
    invoker: 'private',
}, async () => {
    await engine.spawnOrAlert(db(), admin, new Date());
    return null;
});

// Hourly on the 1st and 2nd, Eastern. Before 1 PM on the 1st the engine no-ops.
exports.scheduleRaidBossCatchup = onSchedule({
    schedule: '0 * 1,2 * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
    invoker: 'private',
}, async () => {
    await engine.spawnOrAlert(db(), admin, new Date());
    return null;
});

// Hourly. A forum post or article deals damage only after it has survived 24 hours.
exports.scheduleRaidForumCredit = onSchedule({
    schedule: '15 * * * *',
    timeZone: 'UTC',
    region: 'us-central1',
    timeoutSeconds: 300,
    invoker: 'private',
}, async () => {
    await engine.sweepForumDamage(db(), admin, new Date());
    return null;
});
