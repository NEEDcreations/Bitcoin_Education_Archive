'use strict';
// Guest policy for callables. A guest is a caller with no auth or a Firebase
// anonymous session. Guests can use features, but they never earn rewards
// (XP, badges, OrangeTix, sats, streaks, leaderboard entries) and never link
// outside accounts. Nothing a guest does banks or carries over after sign-up.

function isGuestContext(context) {
    if (!context || !context.auth) return true;
    const token = context.auth.token || {};
    const fb = token.firebase || {};
    return fb.sign_in_provider === 'anonymous';
}

// The zero result a reward callable returns to a guest. success:false with
// guest:true lets the client show the "log in" note instead of an error.
function guestRewardResult() {
    return { success: false, guest: true, error: 'Log in to earn rewards', awarded: 0, tickets: 0 };
}

module.exports = { isGuestContext, guestRewardResult };
