'use strict';

// Shared username-repick rules. The browser and the tests both load this file.
// A guest who never picked a name is left alone. A guest who had a name
// (usernameNeedsRepick) and a signed-in account with no name after onboarding
// have to pick one.

function missingPublicName(name) {
    var text = String(name == null ? '' : name).trim();
    if (!text) return true;
    var lower = text.toLowerCase();
    return lower === 'anonymous' || lower === 'anon';
}

function usernameRepickNeeded(user, authUser) {
    if (!authUser || !user || user._isLocal) return false;
    if (user.usernameNeedsRepick === true) return true;
    var name = user.username ? String(user.username).trim() : '';
    if (name) return false;
    if (authUser.isAnonymous === true) return false;
    if (user.onboardingComplete === true || user.introSeen === true) return true;
    // A doc made by an XP grant (or before a name was picked) has progress but
    // no name. Brand-new signups start at 0 points and get the signup prompt.
    return Number(user.points) > 0 || Number(user.totalXP) > 0;
}

// True when the player never had a name (vs. lost one in a cleanup).
function usernameNeverPicked(user) {
    return !!user && user.usernameNeedsRepick !== true && missingPublicName(user.username);
}

// A stored leaderboard label of Anon or Anonymous loses to the live public
// profile name. A real stored name is left as it is.
function leaderboardDisplayName(entryName, profileName) {
    if (!missingPublicName(entryName)) return String(entryName).trim();
    if (!missingPublicName(profileName)) return String(profileName).trim();
    return 'Anon';
}

var api = {
    missingPublicName: missingPublicName,
    usernameRepickNeeded: usernameRepickNeeded,
    usernameNeverPicked: usernameNeverPicked,
    leaderboardDisplayName: leaderboardDisplayName,
};

if (typeof module !== 'undefined' && module.exports) module.exports = api;
if (typeof window !== 'undefined') {
    window.missingPublicName = missingPublicName;
    window.usernameRepickNeeded = usernameRepickNeeded;
    window.usernameNeverPicked = usernameNeverPicked;
    window.leaderboardDisplayName = leaderboardDisplayName;
}
