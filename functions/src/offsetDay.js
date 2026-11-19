'use strict';

// One day key for rewards that reset at 5 AM UTC.
// Same boundary as getOffsetDateKey() in functions/index.js and the
// client's getDailyKey() (bundle app.js). Pass the server clock in.

const RESET_HOUR_UTC = 5;

function offsetDateKey(nowMs) {
    const ms = Number(nowMs);
    const shifted = new Date((Number.isFinite(ms) ? ms : Date.now()) - RESET_HOUR_UTC * 3600 * 1000);
    if (Number.isNaN(shifted.getTime())) return '';
    return shifted.toISOString().slice(0, 10);
}

// Calendar date in America/New_York, including daylight saving.
// Practice limits and other midnight-ET resets use this, not offsetDateKey
// (which is the 5 AM UTC reward day).
function nyDateKey(nowMs) {
    const ms = Number(nowMs);
    const when = new Date(Number.isFinite(ms) ? ms : Date.now());
    if (Number.isNaN(when.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(when);
    const get = function (type) {
        for (let i = 0; i < parts.length; i++) {
            if (parts[i].type === type) return parts[i].value;
        }
        return '';
    };
    const y = get('year');
    const m = get('month');
    const d = get('day');
    return y && m && d ? y + '-' + m + '-' + d : '';
}

module.exports = {
    RESET_HOUR_UTC: RESET_HOUR_UTC,
    offsetDateKey: offsetDateKey,
    nyDateKey: nyDateKey,
};
