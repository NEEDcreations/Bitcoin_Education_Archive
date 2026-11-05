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

    root.BipBreakthrough = {
        showPopup: showPopup,
        offerShare: offerShare,
        handleSpinReward: handleSpinReward,
        shareUrl: shareUrl
    };
})(typeof window !== 'undefined' ? window : globalThis);
