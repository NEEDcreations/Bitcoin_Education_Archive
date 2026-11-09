// Opt-in reset reminders. Clocks, quiet hours, and one-send planning. No network.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(rel) { return fs.readFileSync(path.join(root, rel), 'utf8'); }

assert.strictEqual(
    read('functions/src/resetReminders.js'),
    read('reset-reminders.js'),
    'reset-reminders.js must match functions/src/resetReminders.js'
);

const rr = require('../functions/src/resetReminders');

function test(name, fn) {
    fn();
    console.log('✅ ' + name);
}

function prefs(items, extra) {
    return Object.assign({
        optedIn: true,
        quietStart: 22,
        quietEnd: 8,
        timeZone: 'Asia/Tokyo',
        items: items
    }, extra || {});
}

test('nothing is due until the player opts in and turns that reset on', function () {
    const now = Date.UTC(2026, 10, 9, 4, 10);
    assert.deepStrictEqual(rr.dueForUser(now, {}), []);
    assert.deepStrictEqual(rr.dueForUser(now, { resetReminders: { optedIn: true, items: {} } }), []);
    assert.deepStrictEqual(rr.dueForUser(now, {
        resetReminders: prefs({ 'daily-spin': false })
    }), []);
    const stranger = rr.sanitize({ optedIn: 'true', items: { 'daily-spin': 'true', nope: true } });
    assert.strictEqual(stranger.optedIn, false);
    assert.strictEqual(stranger.items['daily-spin'], undefined);
    assert.strictEqual(stranger.items.nope, undefined);
});

test('daily spin is due in the hour before 05:00 UTC and not outside it', function () {
    const due = rr.dueForUser(Date.UTC(2026, 10, 9, 4, 10), {
        resetReminders: prefs({ 'daily-spin': true })
    });
    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0].id, 'daily-spin');
    assert.strictEqual(due[0].resetAt, Date.UTC(2026, 10, 9, 5, 0));
    assert.deepStrictEqual(rr.dueForUser(Date.UTC(2026, 10, 9, 3, 50), {
        resetReminders: prefs({ 'daily-spin': true })
    }), []);
    assert.deepStrictEqual(rr.dueForUser(Date.UTC(2026, 10, 9, 5, 0), {
        resetReminders: prefs({ 'daily-spin': true })
    }), []);
});

test('quiet hours hold the reminder even inside the lead window', function () {
    const now = Date.UTC(2026, 10, 9, 4, 10);
    const held = rr.dueForUser(now, {
        resetReminders: prefs({ 'daily-spin': true }, { timeZone: 'America/New_York' })
    });
    assert.deepStrictEqual(held, []);
    assert.strictEqual(rr.inQuietHours(now, rr.sanitize({
        quietStart: 22, quietEnd: 8, timeZone: 'America/New_York'
    })), true);
    assert.strictEqual(rr.inQuietHours(now, rr.sanitize({
        quietStart: 9, quietEnd: 9, timeZone: 'UTC'
    })), false);
});

test('default quiet hours deliver the 05:00 UTC reset when quiet hours end', function () {
    const resetAt = Date.UTC(2026, 10, 9, 5, 0);
    const zones = [
        { tz: 'America/New_York', quiet: Date.UTC(2026, 10, 9, 12, 59), send: Date.UTC(2026, 10, 9, 13, 0) },
        { tz: 'America/Chicago', quiet: Date.UTC(2026, 10, 9, 13, 59), send: Date.UTC(2026, 10, 9, 14, 0) },
        { tz: 'Europe/London', quiet: Date.UTC(2026, 10, 9, 7, 59), send: Date.UTC(2026, 10, 9, 8, 0) }
    ];
    zones.forEach(function (zone) {
        const during = rr.dueForUser(zone.quiet, {
            resetReminders: prefs({ 'daily-spin': true, 'weekly-xp': true }, { timeZone: zone.tz })
        });
        assert.deepStrictEqual(during, [], zone.tz + ' still inside quiet hours');
        const due = rr.dueForUser(zone.send, {
            resetReminders: prefs({ 'daily-spin': true, 'weekly-xp': true }, { timeZone: zone.tz })
        });
        const ids = due.map(function (hit) { return hit.id; }).sort();
        assert.deepStrictEqual(ids, ['daily-spin', 'weekly-xp'], zone.tz);
        due.forEach(function (hit) {
            assert.strictEqual(hit.resetAt, resetAt, zone.tz + ' ' + hit.id);
            assert.strictEqual(hit.deferred, true, zone.tz);
            assert.ok(hit.resetAt < zone.send);
        });
        const row = { uid: 'user_1', resetReminders: prefs({ 'daily-spin': true }, { timeZone: zone.tz }) };
        const planned = rr.planSends([row], zone.send, {});
        assert.strictEqual(planned.length, 1);
        assert.deepStrictEqual(rr.planSends([row], zone.send, { [planned[0].id]: true }), []);
    });
    const londonMonth = rr.dueForUser(Date.UTC(2026, 11, 1, 8, 0), {
        resetReminders: prefs({ 'monthly-xp': true }, { timeZone: 'Europe/London' })
    });
    assert.strictEqual(londonMonth.length, 1);
    assert.strictEqual(londonMonth[0].id, 'monthly-xp');
    assert.strictEqual(londonMonth[0].resetAt, Date.UTC(2026, 11, 1, 0, 0));
    assert.deepStrictEqual(rr.dueForUser(Date.UTC(2026, 10, 30, 23, 10), {
        resetReminders: prefs({ 'monthly-xp': true }, { timeZone: 'Europe/London' })
    }), []);
    const nextDay = rr.dueForUser(Date.UTC(2026, 10, 10, 13, 0), {
        resetReminders: prefs({ 'daily-spin': true }, { timeZone: 'America/New_York' })
    });
    assert.strictEqual(nextDay.length, 1);
    assert.strictEqual(nextDay[0].resetAt, Date.UTC(2026, 10, 10, 5, 0));
});

test('weekly and monthly clocks use the code schedules', function () {
    const monday = Date.UTC(2026, 10, 9, 4, 10);
    const week = rr.dueForUser(monday, {
        resetReminders: prefs({ 'weekly-xp': true })
    });
    assert.strictEqual(week.length, 1);
    assert.strictEqual(week[0].resetAt, Date.UTC(2026, 10, 9, 5, 0));
    assert.deepStrictEqual(rr.dueForUser(Date.UTC(2026, 10, 10, 4, 10), {
        resetReminders: prefs({ 'weekly-xp': true })
    }), []);

    const month = rr.dueForUser(Date.UTC(2026, 10, 30, 23, 10), {
        resetReminders: prefs({ 'monthly-xp': true }, { timeZone: 'UTC', quietStart: 1, quietEnd: 2 })
    });
    assert.strictEqual(month.length, 1);
    assert.strictEqual(month[0].resetAt, Date.UTC(2026, 11, 1, 0, 0));

    const quests = rr.dueForUser(Date.UTC(2026, 11, 1, 4, 10), {
        resetReminders: prefs({ 'monthly-quests': true })
    });
    assert.strictEqual(quests[0].resetAt, Date.UTC(2026, 11, 1, 5, 0));
});

test('raid boss stays at 1:00 PM Eastern, including daylight saving', function () {
    const summer = rr.nextReset({ tz: 'America/New_York', hour: 13, minute: 0, dom: 1 }, Date.UTC(2026, 6, 1, 16, 30));
    assert.strictEqual(summer, Date.UTC(2026, 6, 1, 17, 0));
    const winter = rr.nextReset({ tz: 'America/New_York', hour: 13, minute: 0, dom: 1 }, Date.UTC(2026, 11, 1, 17, 30));
    assert.strictEqual(winter, Date.UTC(2026, 11, 1, 18, 0));
});

test('faucet reminder is 24 hours after the last claim', function () {
    const last = Date.UTC(2026, 10, 8, 12, 0);
    const user = {
        lastSatsClaim: last,
        resetReminders: prefs({ 'faucet-ready': true }, { timeZone: 'UTC', quietStart: 22, quietEnd: 8 })
    };
    const due = rr.dueForUser(Date.UTC(2026, 10, 9, 11, 10), user);
    assert.strictEqual(due.length, 1);
    assert.strictEqual(due[0].resetAt, last + 24 * 60 * 60 * 1000);
    assert.deepStrictEqual(rr.dueForUser(Date.UTC(2026, 10, 9, 10, 30), user), []);
    assert.deepStrictEqual(rr.planSends([{ uid: 'user_1', banned: true, resetReminders: user.resetReminders, lastSatsClaim: last }], Date.UTC(2026, 10, 9, 11, 10)), []);
    assert.deepStrictEqual(rr.planSends([{ uid: 'user_1', anonymous: true, resetReminders: user.resetReminders, lastSatsClaim: last }], Date.UTC(2026, 10, 9, 11, 10)), []);
});

test('a claimed occurrence is not planned again', function () {
    const now = Date.UTC(2026, 10, 9, 4, 10);
    const row = { uid: 'user_1', resetReminders: prefs({ 'daily-trivia': true }) };
    const first = rr.planSends([row], now, {});
    assert.strictEqual(first.length, 1);
    const again = rr.planSends([row], now, { [first[0].id]: true });
    assert.deepStrictEqual(again, []);
    assert.strictEqual(first[0].id, rr.claimDocId('user_1', first[0].hit.occurrenceKey));
});

test('the scheduler and the rules are wired by name', function () {
    const index = read('functions/index.js');
    assert.ok(index.includes('exports.dispatchResetReminders = onSchedule'));
    assert.ok(index.includes("schedule: 'every 15 minutes'"));
    assert.ok(index.includes('runResetReminders'));
    const rules = read('firestore.rules');
    assert.ok(rules.includes('resetReminders'));
    assert.ok(rules.includes('match /reset_reminder_subs/{uid}'));
    assert.ok(rules.includes('match /reset_reminder_claims/{claimId}'));
    const subRule = rules.slice(rules.indexOf('match /reset_reminder_subs/{uid}'), rules.indexOf('match /reset_reminder_claims/{claimId}'));
    assert.ok(subRule.includes("sign_in_provider.matches('anonymous')"));
    assert.ok(rules.includes('resetReminderItemsOk'));
    const dispatch = read('functions/src/dispatchResetReminders.js');
    assert.ok(dispatch.includes('sub.ref.delete()'));
    assert.ok(dispatch.includes('user.anonymous === true'));
    const deletion = read('functions/src/deleteAccount.js');
    assert.ok(deletion.includes("deleteExactIfPresent(db, batcher, 'reset_reminder_subs', uid)"));
    assert.ok(deletion.includes("'rr_' + uid + '_'"));
    const ui = read('reset-reminder-ui.js');
    assert.ok(ui.includes('notificationPrefs: { reminders: true }'));
    assert.ok(!ui.includes('master: true'));
    assert.ok(ui.includes('id = \'resetReminderMasterNote\''));
    assert.ok(read('resets.html').includes('TODO(sats-caps)'));
    assert.ok(read('functions/src/resetReminders.js').includes('TODO(sats-caps)'));
    const html = read('index.html');
    assert.strictEqual(html, read('404.html'));
    assert.ok(html.includes('id="resetRemindersBtn"'));
    assert.ok(html.includes('Turn on notifications'));
    assert.ok(html.includes('Reminder resets'));
    assert.ok(html.includes('/reset-reminders.js?v=20261109_v2535'));
    assert.ok(html.includes('/reset-reminder-ui.js?v=20261109_v2535'));
    const page = read('resets.html');
    assert.ok(page.includes('id="reminder-resets"'));
    assert.ok(page.includes('05:00 UTC'));
    assert.ok(page.includes('00:00 UTC'));
    assert.ok(page.includes('sendKeys'));
    assert.ok(page.includes('FAUCET.COOLDOWN_HOURS'));
    assert.ok(page.includes('scheduleRaidBoss'));
});
