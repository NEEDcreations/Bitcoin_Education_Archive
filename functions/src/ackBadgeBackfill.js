'use strict';

// The counter backfill sets users/{uid}.badgeBackfillToast. The owner
// acknowledges it by calling ackBadgeBackfillToast, which deletes that
// field and nothing else. The client cannot write the field itself.

function planAck(user) {
    const row = user || {};
    if (!row.badgeBackfillToast) return { clear: false };
    return { clear: true };
}

module.exports = {
    planAck: planAck,
};
