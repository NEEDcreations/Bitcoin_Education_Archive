/**
 * scheduleRaidBoss – Scheduled Cloud Function (v2)
 * Runs on the 1st of every month at 1 PM ET (America/New_York).
 * Creates a new Raid Boss doc (lasts 1 full month unless defeated earlier)
 * and a placeholder for the following month's boss.
 *
 * DO NOT call admin.initializeApp() here — it's called in index.js.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const admin = require('firebase-admin');
const path = require('path');

const db = admin.firestore();

// Load boss definitions
const BOSS_DEFINITIONS = require(path.join(__dirname, '..', 'raid-boss-data.json'));
const BOSS_COUNT = BOSS_DEFINITIONS.length; // 15

/**
 * Get the 1st of a given month at 1 PM ET as a UTC Date.
 * month is 0-indexed (0=Jan, 11=Dec).
 */
function getFirst1pmET(year, month) {
  // EDT (UTC-4): March through first Sunday of November
  // EST (UTC-5): November through February
  // Approximate: months 2-10 (Mar-Oct) = EDT, else EST
  let utcHour;
  if (month >= 2 && month <= 10) {
    utcHour = 17; // 1 PM EDT = 5 PM UTC
  } else {
    utcHour = 18; // 1 PM EST = 6 PM UTC
  }
  return new Date(Date.UTC(year, month, 1, utcHour, 0, 0, 0));
}

/**
 * Get the month index (0-based from a reference point) to cycle through bosses.
 * Uses year*12 + month so it always advances.
 */
function getMonthIndex(date) {
  return date.getFullYear() * 12 + date.getMonth();
}

exports.scheduleRaidBoss = onSchedule(
  {
    schedule: '0 13 1 * *', // 1st of every month at 1 PM
    timeZone: 'America/New_York',
    region: 'us-central1',
  },
  async (event) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const bossIndex = getMonthIndex(now) % BOSS_COUNT;

    // Next month
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear = month === 11 ? year + 1 : year;
    const nextBossIndex = (bossIndex + 1) % BOSS_COUNT;

    // Month after next (for next boss's endTime)
    const month2 = nextMonth === 11 ? 0 : nextMonth + 1;
    const year2 = nextMonth === 11 ? nextYear + 1 : nextYear;

    const boss = BOSS_DEFINITIONS[bossIndex];
    const nextBoss = BOSS_DEFINITIONS[nextBossIndex];

    const startTime = admin.firestore.Timestamp.fromDate(getFirst1pmET(year, month));
    const endTime = admin.firestore.Timestamp.fromDate(getFirst1pmET(nextYear, nextMonth));

    // Create the active boss document
    const bossRef = db.collection('raid_bosses').doc();
    await bossRef.set({
      name: boss.name,
      description: boss.description,
      metric: boss.metric,
      target: boss.target,
      image: boss.image || '',
      current: 0,
      defeated: false,
      placeholder: false,
      startTime: startTime,
      endTime: endTime,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      monthIndex: bossIndex,
    });

    console.log(`Raid Boss created: ${boss.name} (month ${bossIndex}), doc: ${bossRef.id}`);

    // Create placeholder for NEXT month's boss
    const nextEndTime = admin.firestore.Timestamp.fromDate(getFirst1pmET(year2, month2));

    const placeholderRef = db.collection('raid_bosses').doc();
    await placeholderRef.set({
      name: nextBoss.name,
      description: nextBoss.description,
      metric: nextBoss.metric,
      target: nextBoss.target,
      image: nextBoss.image || '',
      current: 0,
      defeated: false,
      placeholder: true,
      startTime: endTime, // starts when current boss ends
      endTime: nextEndTime,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      monthIndex: nextBossIndex,
    });

    console.log(`Placeholder created: ${nextBoss.name} (month ${nextBossIndex}), doc: ${placeholderRef.id}`);

    return null;
  }
);
