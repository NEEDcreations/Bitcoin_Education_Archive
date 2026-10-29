'use strict';

// Shared cipher prize. One roll is decided by the opener. This module
// decides whether the key's server-written sender is paid that same prize.
// It does not read the client request. A key the user earned has no sender.

const { planXpGrant } = require('./grantXp');
const { createdMs, samePerson } = require('./badgeProgress');
const { assessCipherClaim } = require('./cipherClaim');

const CIPHER_OPENS_PER_DAY = 21;
const SHARE_MIN_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SATS_PENDING_MIN = 1000;

function shareDocId(cipherId) {
    return String(cipherId || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
}

function shareNoticeId(cipherId) {
    const id = shareDocId(cipherId);
    return id ? ('cshare_' + id).slice(0, 140) : '';
}

// Only the server field counts. A client payload is ignored, including when
// it is passed in by mistake. Inventory keys (not status "sent") have no sender.
function senderFromKey(key) {
    if (!key || typeof key !== 'object') return '';
    if (key.status !== 'sent') return '';
    const raw = key.sender;
    if (typeof raw !== 'string') return '';
    const id = raw.trim();
    if (!id || id.length > 128) return '';
    if (!/^[A-Za-z0-9:_-]+$/.test(id)) return '';
    return id;
}

function acceptedPeers(opener, sender) {
    const a = opener && opener.uid;
    const b = sender && sender.uid;
    if (!a || !b) return false;
    const peersA = Array.isArray(opener.peers) ? opener.peers : [];
    const peersB = Array.isArray(sender.peers) ? sender.peers : [];
    return peersA.indexOf(b) !== -1 && peersB.indexOf(a) !== -1;
}

function senderOldEnough(user, nowMs) {
    const born = createdMs(user);
    if (born == null) return false;
    return (Number(nowMs) || 0) - born >= SHARE_MIN_AGE_MS;
}

function blockReason(user, ledger) {
    const u = user || {};
    const l = ledger || {};
    if (u.lock && u.lock.state === 'locked') return 'locked';
    if (u.banned === true || u.ban_reason || l.banned === true) return 'banned';
    if (u.satsDisabled === true) return 'sats-disabled';
    return '';
}

function linkedPair(opener, sender) {
    if (!opener || !sender) return false;
    if (opener.linkedBanned === true || sender.linkedBanned === true) return true;
    if (opener.multiAccount === true || sender.multiAccount === true) return true;
    return samePerson(opener, sender);
}

function opensOnDay(user, today) {
    if (!user || user.ciphersDecryptedDate !== today) return 0;
    const n = Number(user.ciphersDecryptedToday) || 0;
    return n > 0 ? n : 0;
}

function prizeText(reward) {
    const r = reward || {};
    if (r.rewardType === 'sats') {
        const amount = Math.max(0, Math.round(Number(r.satsAmount) || 0));
        return amount.toLocaleString('en-US') + ' sats';
    }
    const bits = [];
    const xp = Math.max(0, Math.round(Number(r.xpAmount) || 0));
    const tickets = Math.max(0, Math.round(Number(r.ticketCount) || 0));
    if (xp > 0) bits.push(xp.toLocaleString('en-US') + ' XP');
    if (tickets > 0) bits.push(tickets.toLocaleString('en-US') + (tickets === 1 ? ' ticket' : ' tickets'));
    if (!bits.length) bits.push('a cipher prize');
    return bits.join(' and ');
}

function emptyCredit() {
    return {
        xp: 0,
        tickets: 0,
        sats: 0,
        satsStatus: null,
        opensToday: 0,
        fullRing: false,
        dailyXp: null,
    };
}

function clonePrize(reward) {
    const r = reward || {};
    return {
        rewardType: r.rewardType || '',
        xpAmount: Math.max(0, Math.round(Number(r.xpAmount) || 0)),
        ticketCount: Math.max(0, Math.round(Number(r.ticketCount) || 0)),
        satsAmount: Math.max(0, Math.round(Number(r.satsAmount) || 0)),
        roll: r.roll,
    };
}

// input.marker is the cipher_shares doc, if one is already committed.
// input.requestSender is ignored. The sender comes from key.sender.
function planCipherShare(input) {
    const src = input || {};
    const cipherId = shareDocId(src.cipherId);
    const prize = clonePrize(src.reward);
    const base = {
        pay: false,
        reason: 'skip',
        shareId: cipherId,
        noticeId: shareNoticeId(cipherId),
        senderUid: '',
        prize: prize,
        credit: emptyCredit(),
        notice: null,
    };
    if (src.marker && src.marker.paid === true) {
        base.reason = 'already';
        base.senderUid = senderFromKey(src.key) || String(src.marker.senderUid || '');
        return base;
    }
    const senderUid = senderFromKey(src.key);
    if (!senderUid) {
        base.reason = 'no-sender';
        return base;
    }
    base.senderUid = senderUid;
    const openerUid = String(src.openerUid || '');
    if (!openerUid || senderUid === openerUid) {
        base.reason = 'self';
        return base;
    }
    const opener = src.opener ? Object.assign({ uid: openerUid }, src.opener) : null;
    const sender = src.sender ? Object.assign({ uid: senderUid }, src.sender) : null;
    if (!opener || !sender) {
        base.reason = 'missing';
        return base;
    }
    opener.uid = openerUid;
    sender.uid = senderUid;
    if (!acceptedPeers(opener, sender)) {
        base.reason = 'not-peers';
        return base;
    }
    if (!senderOldEnough(sender, src.nowMs)) {
        base.reason = 'young';
        return base;
    }
    const openerBlock = blockReason(opener, src.openerLedger);
    const senderBlock = blockReason(sender, src.senderLedger);
    if (openerBlock === 'banned' || senderBlock === 'banned') {
        base.reason = 'banned';
        return base;
    }
    if (openerBlock === 'sats-disabled' || senderBlock === 'sats-disabled') {
        base.reason = 'sats-disabled';
        return base;
    }
    if (linkedPair(opener, sender)) {
        base.reason = 'linked';
        return base;
    }
    const usedOpens = opensOnDay(sender, src.today);
    if (usedOpens >= CIPHER_OPENS_PER_DAY) {
        base.reason = 'cap';
        return base;
    }
    // A sats share is another way to pay the opener's roll. The opener must
    // already pass the same claim gates, or the sender is paid nothing.
    if (prize.rewardType === 'sats' && !assessCipherClaim(src.openerClaim || {}).ok) {
        base.reason = 'opener-claim';
        return base;
    }

    const credit = emptyCredit();
    credit.opensToday = usedOpens + 1;
    credit.fullRing = credit.opensToday >= CIPHER_OPENS_PER_DAY;
    if (prize.rewardType === 'sats') {
        credit.sats = prize.satsAmount;
        credit.satsStatus = prize.satsAmount >= SATS_PENDING_MIN ? 'pending' : 'claimable';
    } else {
        const tapered = planXpGrant({
            base: prize.xpAmount,
            user: src.sender,
            now: src.nowMs,
            dailyUsed: src.senderDailyXpUsed,
        });
        credit.xp = tapered.awarded;
        credit.dailyXp = tapered.dailyXp;
        credit.base = tapered.base;
        credit.boosted = tapered.boosted;
        credit.doubled = tapered.doubled === true;
        credit.tickets = prize.ticketCount;
    }
    const name = String(src.openerUsername || 'a Bitcoiner').replace(/[\r\n<>]/g, ' ').trim().slice(0, 40) || 'a Bitcoiner';
    const message = ('Your key opened @' + name + "'s cipher. You both won " + prizeText(prize) + '!').slice(0, 180);
    base.pay = true;
    base.reason = 'ok';
    base.credit = credit;
    base.notice = {
        recipientId: senderUid,
        senderId: 'system',
        senderName: 'Bitcoin Quest',
        type: 'cipher_share',
        status: 'completed',
        message: message,
        openerUsername: name,
        cipherId: cipherId,
        cipherLabel: String(src.cipherLabel || '').slice(0, 16),
        cipherType: String(src.cipherLabel || '').slice(0, 16),
        shareId: cipherId,
        prizeRewardType: prize.rewardType,
        prizeXp: prize.xpAmount,
        prizeTickets: prize.ticketCount,
        prizeSats: prize.satsAmount,
        xp: credit.xp,
        tickets: credit.tickets,
        sats: credit.sats,
        icon: '🔓',
        revealed: false,
        read: false,
        targetType: null,
        targetId: null,
    };
    return base;
}

function cloneBooks(books) {
    const src = books || {};
    return {
        users: JSON.parse(JSON.stringify(src.users || {})),
        daily: JSON.parse(JSON.stringify(src.daily || {})),
        wins: JSON.parse(JSON.stringify(src.wins || [])),
        shares: JSON.parse(JSON.stringify(src.shares || {})),
        notices: JSON.parse(JSON.stringify(src.notices || [])),
    };
}

// Applies a planned share once. A second call sees the marker and does not pay again.
function applyCipherShare(books, input) {
    const next = cloneBooks(books);
    const cipherId = shareDocId(input && input.cipherId);
    const existing = (cipherId && next.shares[cipherId]) || (input && input.marker) || null;
    const plan = planCipherShare(Object.assign({}, input || {}, { marker: existing }));
    if (!plan.pay) return { books: next, plan: plan };
    const uid = plan.senderUid;
    const user = next.users[uid] || {};
    user.points = (Number(user.points) || 0) + plan.credit.xp;
    user.orangeTickets = (Number(user.orangeTickets) || 0) + plan.credit.tickets;
    user.ciphersDecryptedToday = plan.credit.opensToday;
    user.ciphersDecryptedDate = input.today;
    if (plan.credit.fullRing) user.cipherFullRing = true;
    next.users[uid] = user;
    if (plan.credit.xp > 0) next.daily[uid] = plan.credit.dailyXp;
    if (plan.credit.sats > 0) {
        next.wins.push({
            uid: uid,
            amount: plan.credit.sats,
            status: plan.credit.satsStatus,
            cipherId: cipherId,
            roll: plan.prize.roll,
            share: true,
        });
    }
    next.shares[cipherId] = {
        paid: true,
        senderUid: uid,
        openerName: plan.notice.openerUsername,
        prize: plan.prize,
        xp: plan.credit.xp,
        tickets: plan.credit.tickets,
        sats: plan.credit.sats,
        revealed: false,
    };
    if (plan.notice) next.notices.push(plan.notice);
    return { books: next, plan: plan };
}

module.exports = {
    CIPHER_OPENS_PER_DAY: CIPHER_OPENS_PER_DAY,
    SHARE_MIN_AGE_MS: SHARE_MIN_AGE_MS,
    SATS_PENDING_MIN: SATS_PENDING_MIN,
    shareDocId: shareDocId,
    shareNoticeId: shareNoticeId,
    senderFromKey: senderFromKey,
    acceptedPeers: acceptedPeers,
    prizeText: prizeText,
    clonePrize: clonePrize,
    planCipherShare: planCipherShare,
    applyCipherShare: applyCipherShare,
};
