// BIP Breakthrough / Bit Devs Socratic Seminar Breakthrough — client UI
(function (root) {
    'use strict';

    function esc(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function referralCode() {
        try {
            if (typeof currentUser !== 'undefined' && currentUser && currentUser.referralCode) {
                return String(currentUser.referralCode);
            }
        } catch (e) {}
        return '';
    }

    function shareUrl() {
        var code = referralCode();
        var base = 'https://bitcoineducation.quest/';
        return code ? (base + '?ref=' + encodeURIComponent(code)) : base;
    }

    function dismiss(id) {
        var el = document.getElementById(id);
        if (el) el.remove();
    }

    function showPopup(payload) {
        payload = payload || {};
        var bip = payload.bip || {};
        var num = bip.number || '';
        var title = bip.title || '';
        var plain = bip.plain || '';
        var shortName = bip.short || '';
        var headline = payload.headline || ('You merged BIP-' + num + '!');
        dismiss('bipBreakthroughModal');
        var wrap = document.createElement('div');
        wrap.id = 'bipBreakthroughModal';
        wrap.style.cssText = 'position:fixed;inset:0;z-index:450000;background:rgba(0,0,0,0.72);display:flex;align-items:center;justify-content:center;padding:16px;';
        wrap.onclick = function (e) { if (e.target === wrap) dismiss('bipBreakthroughModal'); };
        wrap.innerHTML =
            '<div role="dialog" aria-label="BIP Breakthrough" style="background:var(--bg-side,#111);border:1px solid rgba(247,147,26,0.45);border-radius:18px;max-width:420px;width:100%;padding:22px 20px;box-shadow:0 20px 60px rgba(0,0,0,0.45);position:relative;">' +
            '<button type="button" aria-label="Close" onclick="document.getElementById(\'bipBreakthroughModal\').remove()" style="position:absolute;top:10px;right:10px;background:none;border:1px solid var(--border,#333);border-radius:8px;width:32px;height:32px;color:var(--text-muted,#aaa);cursor:pointer;">✕</button>' +
            '<div style="text-align:center;font-size:2.4rem;margin-bottom:8px;">🔧📜</div>' +
            '<div style="text-align:center;font-size:0.72rem;letter-spacing:0.08em;text-transform:uppercase;color:#f97316;font-weight:700;margin-bottom:6px;">Bit Devs Socratic Seminar Breakthrough</div>' +
            '<div style="text-align:center;font-weight:800;font-size:1.25rem;color:var(--heading,#fff);margin-bottom:8px;">' + esc(headline) + '</div>' +
            '<div style="text-align:center;color:var(--text-muted,#bbb);font-size:0.92rem;line-height:1.45;margin-bottom:14px;">' +
            esc(title) + (shortName ? (' · ' + esc(shortName)) : '') + '<br>' + esc(plain) +
            '</div>' +
            '<div style="display:flex;flex-direction:column;gap:8px;margin-bottom:14px;font-size:0.85rem;color:var(--text,#ddd);">' +
            '<div>🏅 Collectible BIP badge unlocked</div>' +
            '<div>💎 Guaranteed top-tier prize on this spin</div>' +
            '<div>🔧 <b>Core Contributor</b> title in chat for 7 days</div>' +
            '</div>' +
            '<button type="button" id="bipBreakthroughShareBtn" style="width:100%;padding:12px 16px;border:none;border-radius:10px;background:linear-gradient(135deg,#f7931a,#f97316);color:#111;font-weight:800;cursor:pointer;font-family:inherit;">Share your merge</button>' +
            '<button type="button" onclick="document.getElementById(\'bipBreakthroughModal\').remove()" style="width:100%;margin-top:8px;padding:10px;border:1px solid var(--border,#333);border-radius:10px;background:transparent;color:var(--text-muted,#aaa);cursor:pointer;font-family:inherit;">Nice!</button>' +
            '</div>';
        document.body.appendChild(wrap);
        var btn = document.getElementById('bipBreakthroughShareBtn');
        if (btn) {
            btn.onclick = function () {
                offerShare(payload);
            };
        }
        if (typeof launchConfetti === 'function') {
            try { launchConfetti(); } catch (e) {}
        }
    }

    function offerShare(payload) {
        payload = payload || {};
        var bip = payload.bip || {};
        var event = {
            type: 'bip_breakthrough',
            id: 'bip_breakthrough_' + (payload.weekKey || bip.id || 'week'),
            title: payload.shareTitle || ('I merged BIP-' + (bip.number || '') + ' on Bitcoin Quest'),
            bipNumber: bip.number,
            manual: true,
            kind: 'manual',
            code: referralCode()
        };
        var AS = root.AchievementShare;
        if (AS && typeof AS.acceptEvents === 'function') {
            AS.acceptEvents([event]);
            return;
        }
        // Fallback: small dismissible toast with link
        dismiss('bipBreakthroughShareToast');
        var toast = document.createElement('div');
        toast.id = 'bipBreakthroughShareToast';
        toast.style.cssText = 'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:460000;max-width:360px;width:calc(100% - 24px);background:#111;border:1px solid rgba(247,147,26,0.4);border-radius:14px;padding:12px 14px;box-shadow:0 10px 40px rgba(0,0,0,0.4);';
        toast.innerHTML =
            '<div style="font-weight:700;color:#f7931a;margin-bottom:4px;">Share your BIP merge</div>' +
            '<div style="font-size:0.85rem;color:#ddd;margin-bottom:8px;">' + esc(event.title) + '</div>' +
            '<a href="' + esc(shareUrl()) + '" target="_blank" rel="noopener" style="color:#f7931a;font-size:0.8rem;word-break:break-all;">' + esc(shareUrl()) + '</a>' +
            '<button type="button" onclick="this.parentNode.remove()" style="position:absolute;top:8px;right:8px;background:none;border:none;color:#888;cursor:pointer;">✕</button>';
        document.body.appendChild(toast);
        setTimeout(function () { dismiss('bipBreakthroughShareToast'); }, 10000);
    }

    function handleSpinReward(reward) {
        if (!reward || !reward.breakthrough || !reward.breakthrough.unlocked) return;
        try {
            if (typeof currentUser !== 'undefined' && currentUser) {
                currentUser.coreContributorUntil = reward.breakthrough.coreContributorUntil || (Date.now() + 7 * 86400000);
                currentUser.activeTitle = 'core_contributor';
                var titles = currentUser.earnedTitles || [];
                if (titles.indexOf('core_contributor') === -1) {
                    currentUser.earnedTitles = titles.concat(['core_contributor']);
                }
                if (reward.breakthrough.badgeId) {
                    var badges = currentUser.bipBadges || [];
                    if (badges.indexOf(reward.breakthrough.badgeId) === -1) {
                        currentUser.bipBadges = badges.concat([reward.breakthrough.badgeId]);
                    }
                }
            }
        } catch (e) {}
        setTimeout(function () {
            showPopup(reward.breakthrough);
            offerShare(reward.breakthrough);
        }, 900);
    }

    // Spin streak line for the Daily Spin modal. Reads the same fields the
    // server's dailySpin uses for the BIP Breakthrough / Core Contributor gate
    // (bipBreakthroughStreak, bipBreakthroughLastDay, bipBreakthroughWeekKey).
    // Eastern days; the streak restarts each Monday 00:00 ET; bonus spins never count.
    var STREAK_TARGET = 7;
    var WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    function nyParts(ms) {
        var out = { y: '', m: '', d: '', wd: '' };
        try {
            var parts = new Intl.DateTimeFormat('en-US', {
                timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'short'
            }).formatToParts(new Date(ms));
            parts.forEach(function (p) {
                if (p.type === 'year') out.y = p.value;
                else if (p.type === 'month') out.m = p.value;
                else if (p.type === 'day') out.d = p.value;
                else if (p.type === 'weekday') out.wd = p.value;
            });
        } catch (e) {}
        return out;
    }
    function pad2(n) { return (n < 10 ? '0' : '') + n; }
    function nyDayKey(ms) {
        var p = nyParts(ms);
        return (p.y && p.m && p.d) ? (p.y + '-' + p.m + '-' + p.d) : '';
    }
    function nyWeekInfo(ms) {
        var p = nyParts(ms);
        var idx = WEEKDAYS.indexOf(p.wd);
        if (idx < 0 || !p.y) return { key: '', sinceMonday: 0 };
        var monday = new Date(Date.UTC(Number(p.y), Number(p.m) - 1, Number(p.d)) - idx * 86400000);
        return {
            key: monday.getUTCFullYear() + '-' + pad2(monday.getUTCMonth() + 1) + '-' + pad2(monday.getUTCDate()),
            sinceMonday: idx
        };
    }
    function dayDiff(a, b) {
        var x = Date.parse(a + 'T12:00:00Z'), y = Date.parse(b + 'T12:00:00Z');
        if (!isFinite(x) || !isFinite(y)) return null;
        return Math.round((y - x) / 86400000);
    }
    function spinStreakInfo(user, nowMs) {
        var now = isFinite(Number(nowMs)) && nowMs ? Number(nowMs) : Date.now();
        var u = user || {};
        var today = nyDayKey(now);
        var week = nyWeekInfo(now);
        var lastDay = typeof u.bipBreakthroughLastDay === 'string' ? u.bipBreakthroughLastDay : '';
        var sameWeek = !!week.key && u.bipBreakthroughWeekKey === week.key;
        var gap = lastDay && today ? dayDiff(lastDay, today) : null;
        var spunToday = sameWeek && gap === 0;
        var alive = sameWeek && (gap === 0 || gap === 1);
        var streak = alive ? Math.max(0, Math.min(STREAK_TARGET, Math.floor(Number(u.bipBreakthroughStreak) || 0))) : 0;
        var claimed = !!week.key && u.bipBreakthroughClaimedWeek === week.key;
        var left = Math.max(0, STREAK_TARGET - streak);
        // Eastern days still open this week for a counted spin, today included if not spun yet.
        var daysOpen = (STREAK_TARGET - week.sinceMonday) - (spunToday ? 1 : 0);
        return { streak: streak, target: STREAK_TARGET, left: left, claimed: claimed, spunToday: spunToday, reachable: left <= daysOpen, weekKey: week.key };
    }
    function spinStreakText(info) {
        if (!info) return '';
        var n = info.streak;
        var head = '\uD83D\uDD25 Spin streak: ' + n + ' day' + (n === 1 ? '' : 's');
        if (info.claimed) return head + ' \u00b7 BIP Breakthrough unlocked this week';
        if (info.left <= 0) return head + ' \u00b7 BIP Breakthrough ready';
        if (!info.reachable) return head + ' \u00b7 BIP Breakthrough streak restarts Monday';
        return head + ' \u00b7 ' + info.left + ' more for BIP Breakthrough';
    }
    // Paint into the modal's #spinStreakLine. Guests and missing data hide the line.
    function paintSpinStreak(el, user, nowMs) {
        if (!el) return null;
        var signedIn = false;
        try { signedIn = !!(root.auth && root.auth.currentUser && !root.auth.currentUser.isAnonymous); } catch (e) {}
        if (!signedIn && typeof auth !== 'undefined') {
            try { signedIn = !!(auth && auth.currentUser && !auth.currentUser.isAnonymous); } catch (e2) {}
        }
        if (!signedIn || !user) { el.hidden = true; el.textContent = ''; return null; }
        var info = spinStreakInfo(user, nowMs);
        el.textContent = spinStreakText(info);
        el.hidden = false;
        return info;
    }
    // Fold a dailySpin response into the user copy so the line updates right after a spin.
    function applySpinResponse(user, reward, nowMs) {
        if (!user || !reward || !reward.breakthrough || reward.countedDay === false) return user;
        var b = reward.breakthrough;
        if (typeof b.streak === 'number') user.bipBreakthroughStreak = b.streak;
        if (b.weekKey) user.bipBreakthroughWeekKey = b.weekKey;
        user.bipBreakthroughLastDay = nyDayKey(isFinite(Number(nowMs)) && nowMs ? Number(nowMs) : Date.now());
        if (b.unlocked && b.weekKey) user.bipBreakthroughClaimedWeek = b.weekKey;
        return user;
    }

    root.BipBreakthrough = {
        showPopup: showPopup,
        offerShare: offerShare,
        handleSpinReward: handleSpinReward,
        shareUrl: shareUrl,
        spinStreakInfo: spinStreakInfo,
        spinStreakText: spinStreakText,
        paintSpinStreak: paintSpinStreak,
        applySpinResponse: applySpinResponse,
        nyDayKey: nyDayKey
    };
})(typeof window !== 'undefined' ? window : globalThis);
