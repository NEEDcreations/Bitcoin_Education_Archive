/**
 * scheduleRaidBoss – Scheduled Cloud Function (v2)
 * Runs every Tuesday at 1 PM ET (America/New_York).
 * Creates a new Raid Boss doc and a placeholder for the next week's boss.
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
 * Get the ISO week number for a given date.
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Calculate the next Tuesday at 1 PM ET from a given date.
 */
function getNextTuesday1pmET(fromDate) {
  // Work in UTC, compute next Tuesday
  const d = new Date(fromDate);
  const dayOfWeek = d.getDay(); // 0=Sun, 2=Tue
  let daysUntilTuesday = (2 - dayOfWeek + 7) % 7;
  if (daysUntilTuesday === 0) daysUntilTuesday = 7; // always next Tuesday, not today
  d.setDate(d.getDate() + daysUntilTuesday);

  // Create a date string for that Tuesday at 13:00 America/New_York
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');

  // Determine if that date is in EDT or EST
  // Simple check: EDT is roughly second Sunday of March to first Sunday of November
  const targetDate = new Date(`${year}-${month}-${day}T13:00:00`);
  
  // Use a reliable method: check offset by creating date in ET
  // EDT = UTC-4, EST = UTC-5
  // For safety, check if the month is in the EDT range (Mar-Nov roughly)
  const m = targetDate.getMonth(); // 0-indexed
  let utcHour;
  if (m >= 2 && m <= 10) {
    // Likely EDT (UTC-4) — March through October
    utcHour = 17; // 1 PM ET = 5 PM UTC during EDT
  } else {
    // Likely EST (UTC-5) — November through February
    utcHour = 18; // 1 PM ET = 6 PM UTC during EST
  }

  const nextTuesday = new Date(Date.UTC(
    d.getFullYear(),
    d.getMonth(),
    d.getDate(),
    utcHour, 0, 0, 0
  ));

  return nextTuesday;
}

exports.scheduleRaidBoss = onSchedule(
  {
    schedule: '0 13 * * 2', // Every Tuesday at 1 PM
    timeZone: 'America/New_York',
    region: 'us-central1',
  },
  async (event) => {
    const now = new Date();
    const weekIndex = getWeekNumber(now) % BOSS_COUNT;
    const nextWeekIndex = (weekIndex + 1) % BOSS_COUNT;

    const boss = BOSS_DEFINITIONS[weekIndex];
    const nextBoss = BOSS_DEFINITIONS[nextWeekIndex];

    const startTime = admin.firestore.Timestamp.now();
    const endTime = admin.firestore.Timestamp.fromDate(getNextTuesday1pmET(now));

    // Create the active boss document
    const bossRef = db.collection('raid_bosses').doc();
    await bossRef.set({
      name: boss.name,
      description: boss.description,
      metric: boss.metric,
      target: boss.target,
      current: 0,
      defeated: false,
      placeholder: false,
      startTime: startTime,
      endTime: endTime,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      weekIndex: weekIndex,
    });

    console.log(`Raid Boss created: ${boss.name} (week ${weekIndex}), doc: ${bossRef.id}`);

    // Create placeholder for NEXT week's boss
    const nextEndTime = admin.firestore.Timestamp.fromDate(
      getNextTuesday1pmET(getNextTuesday1pmET(now))
    );

    const placeholderRef = db.collection('raid_bosses').doc();
    await placeholderRef.set({
      name: nextBoss.name,
      description: nextBoss.description,
      metric: nextBoss.metric,
      target: nextBoss.target,
      current: 0,
      defeated: false,
      placeholder: true,
      startTime: endTime, // starts when current boss ends
      endTime: nextEndTime,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      weekIndex: nextWeekIndex,
    });

    console.log(`Placeholder created: ${nextBoss.name} (week ${nextWeekIndex}), doc: ${placeholderRef.id}`);

    return null;
  }
);
