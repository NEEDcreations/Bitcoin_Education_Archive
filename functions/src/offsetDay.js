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

module.exports = {
    RESET_HOUR_UTC: RESET_HOUR_UTC,
    offsetDateKey: offsetDateKey,
};
