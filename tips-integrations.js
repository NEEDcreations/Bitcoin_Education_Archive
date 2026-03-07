// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ⚡ Lightning Tips — Feature Integrations
// Injects tip/pay buttons into:
//   1. PlebTalk (forum posts & replies)
//   2. Bitcoin Beats (tracks)
//   3. LightningMart (marketplace listings)
//   4. IRL Sync (event tickets)
//   5. Leaderboard (user rows)
//
// Uses MutationObserver to inject buttons
// non-invasively (no edits to existing files).
// Load AFTER lightning-tips.js.
// =============================================

(function() {
'use strict';

// ─── Utility: safely get attribute ───────────────────────
function esc(s) { return typeof escapeHtml === 'function' ? escapeHtml(s) : s; }

function makeDataAttr(obj) {
    return JSON.stringify(obj).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tipBtn(opts, label, size) {
    label = label || '⚡ Tip';
    size = size || 'sm';
    var pad = size === 'md' ? 'padding:7px 16px;font-size:0.82rem;' : 'padding:4px 11px;font-size:0.72rem;';
    return '<button data-tip-action=\'' + JSON.stringify(opts).replace(/'/g, '&#39;') + '\' style="' + pad +
        'background:rgba(234,179,8,0.06);border:1px solid rgba(234,179,8,0.2);border-radius:10px;color:#eab308;' +
        'font-weight:700;cursor:pointer;font-family:inherit;transition:0.15s;touch-action:manipulation;' +
        'display:inline-flex;align-items:center;gap:4px;" ' +
        'onmouseover="this.style.background=\'rgba(234,179,8,0.15)\';this.style.borderColor=\'#eab308\'" ' +
        'onmouseout="this.style.background=\'rgba(234,179,8,0.06)\';this.style.borderColor=\'rgba(234,179,8,0.2)\'">' +
        label + '</button>';
}

// =============================================
// 1. PLEBTALK — Tip Forum Posts & Replies
// =============================================

function injectForumTips() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    // Find upvote buttons (they contain "⚡" and a number)
    // Pattern: <button onclick="forumVotePost('id')">⚡ N</button>
    var voteBtns = fc.querySelectorAll('button[onclick*="forumVotePost"], button[onclick*="forumVoteReply"]');
    voteBtns.forEach(function(btn) {
        // Skip if already has a tip sibling
        if (btn.nextElementSibling && btn.nextElementSibling.hasAttribute('data-tip-action')) return;
        if (btn.parentElement && btn.parentElement.querySelector('[data-tip-action]')) return;

        // Extract post/reply ID and author info from the surrounding context
        var onclickStr = btn.getAttribute('onclick') || '';
        var idMatch = onclickStr.match(/(?:forumVotePost|forumVoteReply)\('([^']+)'\)/);
        var itemId = idMatch ? idMatch[1] : '';
        var isReply = onclickStr.includes('forumVoteReply');

        // Try to find author name from nearby elements
        var card = btn.closest('div[style*="background"]') || btn.parentElement;
        var authorEl = card ? card.querySelector('span[style*="font-weight:700"], div[style*="font-weight:700"]') : null;
        var authorName = authorEl ? authorEl.textContent.trim() : 'this user';

        // Try to get author UID from onclick handlers in the card
        var authorUid = '';
        if (card) {
            var profileLink = card.querySelector('[onclick*="showUserProfile"]');
            if (profileLink) {
                var uidMatch = (profileLink.getAttribute('onclick') || '').match(/showUserProfile\('([^']+)'\)/);
                if (uidMatch) authorUid = uidMatch[1];
            }
        }

        var tipOpts = {
            recipientName: authorName,
            recipientUid: authorUid,
            context: isReply ? 'forum_reply' : 'forum_post',
            contextId: itemId,
            label: 'Tip ' + (isReply ? 'Reply' : 'Post'),
        };

        var tipEl = document.createElement('span');
        tipEl.innerHTML = tipBtn(tipOpts, '⚡ Tip');
        tipEl.style.display = 'inline';
        btn.parentElement.insertBefore(tipEl, btn.nextSibling);
    });
}

// =============================================
// 2. BITCOIN BEATS — Tip Tracks
// =============================================

function injectBeatsTips() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    // Find track rows — they have the beats-track-row class or the like/menu buttons
    var trackRows = fc.querySelectorAll('.beats-track-row, div[onclick*="beatsPlayTrack"]');
    trackRows.forEach(function(row) {
        if (row.querySelector('[data-tip-action]')) return; // Already injected

        // Extract track info
        var idx = '';
        var onclickStr = row.getAttribute('onclick') || '';
        var idxMatch = onclickStr.match(/beatsPlayTrack\((\d+)\)/);
        if (idxMatch) idx = idxMatch[1];

        // Get track data from the queue
        var trackData = null;
        if (window._beatsQueue && idx !== '') {
            trackData = window._beatsQueue[parseInt(idx)];
        }

        if (!trackData) return;

        var tipOpts = {
            recipientName: trackData.artist || trackData.authorName || 'Artist',
            recipientUid: trackData.authorId || '',
            context: 'beats_track',
            contextId: trackData.id || '',
            label: 'Tip Artist',
        };

        // Insert before the like button (🤍/❤️) or the last button
        var likeBtn = row.querySelector('button[onclick*="beatsToggleLike"]');
        var menuBtn = row.querySelector('button[onclick*="beatsTrackMenu"]');
        var insertBefore = likeBtn || menuBtn;

        var tipEl = document.createElement('button');
        tipEl.setAttribute('data-tip-action', JSON.stringify(tipOpts));
        tipEl.style.cssText = 'background:none;border:none;font-size:0.82rem;cursor:pointer;padding:4px;color:#eab308;flex-shrink:0;touch-action:manipulation;';
        tipEl.textContent = '⚡';
        tipEl.title = 'Tip artist';
        (function(opts) {
            tipEl.onclick = function(e) {
                e.stopPropagation();
                if (typeof showTipOverlay === 'function') showTipOverlay(opts);
            };
        })(tipOpts);

        if (insertBefore) {
            row.insertBefore(tipEl, insertBefore);
        } else {
            row.appendChild(tipEl);
        }
    });

    // Also inject into track detail overlay if open
    var detailOverlay = document.getElementById('beatsDetailOverlay');
    if (detailOverlay && !detailOverlay.querySelector('[data-tip-action]')) {
        var actionArea = detailOverlay.querySelector('div[style*="display:flex"][style*="gap"]');
        if (actionArea && window._beatsQueue && typeof window._beatsQueueIdx === 'number') {
            var track = window._beatsQueue[window._beatsQueueIdx];
            if (track) {
                var opts = {
                    recipientName: track.artist || track.authorName || 'Artist',
                    recipientUid: track.authorId || '',
                    context: 'beats_track',
                    contextId: track.id || '',
                    label: 'Tip Artist',
                };
                var tb = document.createElement('button');
                tb.setAttribute('data-tip-action', JSON.stringify(opts));
                tb.style.cssText = 'padding:14px 18px;background:rgba(234,179,8,0.1);border:1px solid rgba(234,179,8,0.3);border-radius:12px;font-size:1rem;cursor:pointer;font-family:inherit;color:#eab308;';
                tb.textContent = '⚡ Tip';
                (function(o) { tb.onclick = function(e) { e.stopPropagation(); if (typeof showTipOverlay === 'function') showTipOverlay(o); }; })(opts);
                actionArea.appendChild(tb);
            }
        }
    }
}

// =============================================
// 3. LIGHTNING MART — Pay for Listings
// =============================================

function injectMarketplaceTips() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    // Find "Contact Seller" buttons
    var contactBtns = fc.querySelectorAll('button[onclick*="contactSeller"]');
    contactBtns.forEach(function(btn) {
        if (btn.parentElement && btn.parentElement.querySelector('[data-tip-action]')) return;

        // Extract listing info from the onclick
        var onclickStr = btn.getAttribute('onclick') || '';
        var idMatch = onclickStr.match(/contactSeller\('([^']+)','([^']*)'\)/);
        var listingId = idMatch ? idMatch[1] : '';
        var sellerName = idMatch ? idMatch[2] : '';

        // Try to get price from nearby elements
        var priceEl = btn.closest('div[style*="max-width"]');
        var price = 0;
        if (priceEl) {
            var priceText = priceEl.querySelector('div[style*="color:var(--accent)"][style*="font-weight:900"]');
            if (priceText) {
                var pMatch = priceText.textContent.match(/([\d,]+)\s*sats/i);
                if (pMatch) price = parseInt(pMatch[1].replace(/,/g, ''));
                var mMatch = priceText.textContent.match(/([\d.]+)M\s*sats/i);
                if (mMatch) price = Math.round(parseFloat(mMatch[1]) * 1000000);
                var kMatch = priceText.textContent.match(/([\d.]+)K\s*sats/i);
                if (kMatch) price = Math.round(parseFloat(kMatch[1]) * 1000);
            }
        }

        // Get seller UID from profile link if available
        var sellerUid = '';
        if (priceEl) {
            var profileEl = priceEl.querySelector('[onclick*="showUserProfile"]');
            if (profileEl) {
                var uidMatch = (profileEl.getAttribute('onclick') || '').match(/showUserProfile\('([^']+)'\)/);
                if (uidMatch) sellerUid = uidMatch[1];
            }
        }

        var tipOpts = {
            recipientName: sellerName || 'Seller',
            recipientUid: sellerUid,
            context: 'marketplace',
            contextId: listingId,
            suggestedAmount: price || null,
            fixedAmount: !!price,
            label: 'Pay with Lightning',
        };

        // Create pay button next to contact button
        var payBtn = document.createElement('button');
        payBtn.setAttribute('data-tip-action', JSON.stringify(tipOpts));
        payBtn.style.cssText = 'flex:1;padding:14px;background:rgba(234,179,8,0.1);border:1px solid #eab308;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;color:#eab308;touch-action:manipulation;';
        payBtn.textContent = '⚡ Pay ' + (price ? (price >= 1000 ? Math.round(price / 1000) + 'K' : price) + ' sats' : 'with Lightning');
        (function(o) { payBtn.onclick = function(e) { e.stopPropagation(); if (typeof showTipOverlay === 'function') showTipOverlay(o); }; })(tipOpts);

        btn.parentElement.insertBefore(payBtn, btn);
    });

    // Also inject quick-pay on listing cards in the grid
    var listingCards = fc.querySelectorAll('div[onclick*="viewListing"]');
    listingCards.forEach(function(card) {
        if (card.querySelector('[data-market-tip]')) return;

        var priceEl = card.querySelector('div[style*="color:var(--accent)"][style*="font-weight"]');
        if (!priceEl) return;

        var marker = document.createElement('div');
        marker.setAttribute('data-market-tip', '1');
        marker.style.cssText = 'padding:4px 0 0;';
        marker.innerHTML = '<span style="font-size:0.65rem;color:rgba(234,179,8,0.6);">⚡ Tap to pay with Lightning</span>';
        priceEl.parentElement.appendChild(marker);
    });
}

// =============================================
// 4. IRL SYNC — Buy Event Tickets
// =============================================

function injectIRLTips() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    // Find RSVP buttons
    var rsvpBtns = fc.querySelectorAll('button[onclick*="toggleRSVP"]');
    rsvpBtns.forEach(function(btn) {
        if (btn.parentElement && btn.parentElement.querySelector('[data-irl-tip]')) return;

        var onclickStr = btn.getAttribute('onclick') || '';
        var idMatch = onclickStr.match(/toggleRSVP\('([^']+)'\)/);
        var eventId = idMatch ? idMatch[1] : '';

        // Get event title from nearby elements
        var card = btn.closest('.event-card, div[style*="border-radius:16px"]');
        var titleEl = card ? card.querySelector('h3') : null;
        var title = titleEl ? titleEl.textContent.trim() : 'this event';

        // Get host info if available
        var hostName = '';
        var hostUid = '';

        var tipOpts = {
            recipientName: 'Event: ' + title,
            recipientUid: hostUid,
            context: 'irl_ticket',
            contextId: eventId,
            label: 'Buy Ticket',
        };

        var ticketBtn = document.createElement('button');
        ticketBtn.setAttribute('data-irl-tip', '1');
        ticketBtn.setAttribute('data-tip-action', JSON.stringify(tipOpts));
        ticketBtn.style.cssText = 'background:rgba(234,179,8,0.08);color:#eab308;border:1px solid rgba(234,179,8,0.25);padding:6px 12px;border-radius:8px;font-size:0.78rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;margin-left:6px;';
        ticketBtn.textContent = '⚡ Buy Ticket';
        (function(o) { ticketBtn.onclick = function(e) { e.stopPropagation(); if (typeof showTipOverlay === 'function') showTipOverlay(o); }; })(tipOpts);

        btn.parentElement.appendChild(ticketBtn);
    });
}

// =============================================
// 5. LEADERBOARD — Tip Users by Name
// =============================================

function injectLeaderboardTips() {
    var lb = document.getElementById('leaderboard');
    if (!lb) return;

    var rows = lb.querySelectorAll('.lb-row');
    rows.forEach(function(row) {
        if (row.querySelector('[data-lb-tip]')) return;

        // Get user info from the row
        var nameEl = row.querySelector('.lb-name');
        var scoreEl = row.querySelector('.lb-score');
        if (!nameEl) return;

        var userName = nameEl.textContent.trim()
            .replace(/🟢|🔵|🟠|⚡|💎|🔥|🛡️|🐋|👑|🎓|🛠️/g, '').trim(); // Strip level emojis
        
        // Get UID from onclick
        var onclickStr = row.getAttribute('onclick') || '';
        var uidMatch = onclickStr.match(/showUserProfile\('([^']+)'\)/);
        var uid = uidMatch ? uidMatch[1] : '';

        // Don't add tip to own row
        if (row.classList.contains('lb-me')) return;

        var tipOpts = {
            recipientName: userName || 'this user',
            recipientUid: uid,
            context: 'leaderboard',
            label: 'Tip User',
        };

        var tipEl = document.createElement('span');
        tipEl.setAttribute('data-lb-tip', '1');
        tipEl.setAttribute('data-tip-action', JSON.stringify(tipOpts));
        tipEl.style.cssText = 'cursor:pointer;font-size:0.75rem;color:#eab308;margin-left:6px;transition:0.15s;flex-shrink:0;';
        tipEl.textContent = '⚡';
        tipEl.title = 'Tip ' + userName;
        (function(o) { tipEl.onclick = function(e) { e.stopPropagation(); if (typeof showTipOverlay === 'function') showTipOverlay(o); }; })(tipOpts);

        // Insert after the score
        if (scoreEl) {
            scoreEl.parentElement.insertBefore(tipEl, scoreEl.nextSibling);
        } else {
            row.appendChild(tipEl);
        }
    });
}

// =============================================
// MUTATION OBSERVER — Auto-inject on DOM changes
// =============================================
// This watches for content changes and injects tip buttons
// whenever new content is rendered, without modifying original files.

var _tipInjectionTimer = null;

function runAllInjections() {
    try { injectForumTips(); } catch(e) {}
    try { injectBeatsTips(); } catch(e) {}
    try { injectMarketplaceTips(); } catch(e) {}
    try { injectIRLTips(); } catch(e) {}
    try { injectLeaderboardTips(); } catch(e) {}
}

// Debounced injection runner
function scheduleInjection() {
    if (_tipInjectionTimer) clearTimeout(_tipInjectionTimer);
    _tipInjectionTimer = setTimeout(runAllInjections, 300);
}

// Watch for DOM changes in the forumContainer and leaderboard
var observer = new MutationObserver(function(mutations) {
    var shouldInject = false;
    for (var i = 0; i < mutations.length; i++) {
        if (mutations[i].addedNodes.length > 0) {
            shouldInject = true;
            break;
        }
    }
    if (shouldInject) scheduleInjection();
});

// Start observing
function startObserving() {
    var fc = document.getElementById('forumContainer');
    var lb = document.getElementById('leaderboard');
    if (fc) observer.observe(fc, { childList: true, subtree: true });
    if (lb) observer.observe(lb, { childList: true, subtree: true });
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() { setTimeout(startObserving, 1000); });
} else {
    setTimeout(startObserving, 1000);
}

// Also run on initial page load and hash changes
window.addEventListener('hashchange', function() { setTimeout(scheduleInjection, 500); });
setTimeout(runAllInjections, 2000);

console.log('[TIP] Feature integrations loaded — Forum, Beats, Market, IRL, Leaderboard');
})();
