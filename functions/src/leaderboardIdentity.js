'use strict';

// Keep quest and prediction stats aligned with the user doc.
// Ghost mode is toggled by a direct user write. Username changes land on
// the same doc. This runs from the public-profile trigger so both stay
// in sync without a client call. A missing stats doc is left alone.

const questBoard = require('./questBoard');

function identityPatch(before, after) {
    if (!after) return null;
    const nameKey = questBoard.nameKeyOf(after.username);
    const ghost = after.ghostMode === true;
    const prevName = before ? questBoard.nameKeyOf(before.username) : null;
    const usernameChanged = !before || prevName !== nameKey;
    const ghostChanged = !before || (before.ghostMode === true) !== ghost;
    const userNameMissing = after.nameKey !== nameKey;
    if (!usernameChanged && !ghostChanged && !userNameMissing) return null;
    return {
        nameKey: nameKey,
        ghostMode: ghost,
        quest: usernameChanged || userNameMissing || ghostChanged,
        predict: ghostChanged,
        user: userNameMissing
    };
}

function missingDoc(err) {
    const code = err && (err.code === 5 || err.code === 'not-found');
    const msg = String(err && err.message || err);
    return code || msg.indexOf('NOT_FOUND') !== -1 || msg.indexOf('No document') !== -1;
}

async function updateIfPresent(db, coll, uid, data) {
    try {
        await db.collection(coll).doc(uid).update(data);
        return 1;
    } catch (err) {
        if (missingDoc(err)) return 0;
        throw err;
    }
}

async function syncBoardIdentity(db, uid, before, after) {
    const plan = identityPatch(before, after);
    if (!plan || !uid) return { patched: 0 };
    let patched = 0;
    if (plan.quest) {
        const questPatch = {};
        if (plan.user || before == null || questBoard.nameKeyOf(before && before.username) !== plan.nameKey || (before && before.nameKey) !== plan.nameKey) {
            questPatch.nameKey = plan.nameKey;
        }
        if (plan.predict || before == null || (before && before.ghostMode === true) !== plan.ghostMode) {
            questPatch.ghostMode = plan.ghostMode;
        }
        if (!Object.keys(questPatch).length) {
            questPatch.nameKey = plan.nameKey;
            questPatch.ghostMode = plan.ghostMode;
        }
        patched += await updateIfPresent(db, 'quest_lb_stats', uid, questPatch);
    }
    if (plan.predict) {
        patched += await updateIfPresent(db, 'prediction_stats', uid, { ghostMode: plan.ghostMode });
    }
    if (plan.user) {
        await db.collection('users').doc(uid).update({ nameKey: plan.nameKey });
    }
    return { patched: patched };
}

module.exports = {
    identityPatch: identityPatch,
    syncBoardIdentity: syncBoardIdentity
};
