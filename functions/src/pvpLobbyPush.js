'use strict';

// Lobby wake-ups keep the pvpPushEnabled opt-in and the pvp_rate caps.
// Delivery goes through sendUserPush so master, the pvp category, and
// device tokens are the same gate as every other send.

function createLobbyPush(deps) {
    const db = deps.db;
    const pvpFlow = deps.pvpFlow;
    const sendUserPush = deps.sendUserPush;

    async function pushPvpLobby(joinerUid, name, nowMs) {
        const now = typeof nowMs === 'number' ? nowMs : Date.now();
        const globalRef = db.collection('pvp_rate').doc('global');
        const globalSnap = await globalRef.get();
        const room = pvpFlow.lobbyGlobalRoom(globalSnap.exists ? globalSnap.data() : {}, now);
        if (!room.push) return { sent: 0 };
        const order = pvpFlow.pushShardOrder(Math.floor(Math.random() * 10));
        const delivered = [];
        for (let s = 0; s < order.length && !delivered.length; s++) {
            const usersSnap = await db.collection('users').where('pvpPushShard', '==', order[s]).limit(40).get();
            const docs = usersSnap.docs.slice();
            for (let i = docs.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                const tmp = docs[i];
                docs[i] = docs[j];
                docs[j] = tmp;
            }
            for (const userDoc of docs) {
                const uid = userDoc.id;
                const data = userDoc.data() || {};
                if (data.pvpPushEnabled !== true) continue;
                if (data.banned === true) continue;
                const rateRef = db.collection('pvp_rate').doc(uid);
                const rate = await rateRef.get();
                const rateData = rate.exists ? rate.data() : {};
                const decision = pvpFlow.decidePvpPush({
                    uid: uid,
                    joinerUid: joinerUid,
                    optedIn: true,
                    muted: data.pvpAlertsMuted === true,
                    lastPushMs: rateData.lastPushMs,
                    pushTimes: rateData.pvpPushTimes || [],
                    nowMs: now,
                });
                if (!decision.send) continue;
                let result = null;
                try {
                    result = await sendUserPush(uid, 'pvp', {
                        title: '⚔️ PvP lobby',
                        body: pvpFlow.safeDisplayName(name) + ' is waiting for a PvP match!',
                        url: 'https://bitcoineducation.quest/#pvp'
                    });
                } catch (e) {
                    console.warn('[pvp] lobby push failed', e.message);
                    continue;
                }
                if (!result || !(result.sent > 0)) continue;
                const prev = Array.isArray(rateData.pvpPushTimes) ? rateData.pvpPushTimes.filter(function (t) {
                    return typeof t === 'number' && (now - t) < pvpFlow.PUSH_WEEK_MS;
                }) : [];
                prev.push(now);
                await rateRef.set({ lastPvpPushMs: now, pvpPushTimes: prev.slice(-5) }, { merge: true });
                delivered.push(uid);
                if (delivered.length >= 20) break;
            }
        }
        if (!delivered.length) return { sent: 0 };
        await globalRef.set({
            windowStart: room.windowStart,
            shoutCount: room.shoutCount,
            pushCount: room.pushCount + 1,
            lastPushWaveMs: now,
        }, { merge: true });
        return { sent: delivered.length };
    }

    return { pushPvpLobby: pushPvpLobby };
}

module.exports = { createLobbyPush: createLobbyPush };
