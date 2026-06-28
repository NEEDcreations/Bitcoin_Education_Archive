// hot-topics.js — Bitcoin Hot Topics sidebar section
// Lazy-loaded. Fetches cached data from Firestore (populated weekly by Firebase Function).
// Version: 20260628

(function () {
    'use strict';

    var HT_COLLECTION = 'hotTopics';
    var HT_DOC = 'latest';
    var HT_CONTAINER_ID = 'hotTopicsSection';

    // ── Source icons/labels ───────────────────────────────────────────────────
    var SOURCE_META = {
        x:          { icon: '𝕏', label: 'X (Twitter)', color: '#1d9bf0' },
        reddit:     { icon: '🟠', label: 'Reddit',      color: '#ff4500' },
        bitcointalk:{ icon: '🟡', label: 'BitcoinTalk', color: '#f7931a' },
        web:        { icon: '🌐', label: 'Web',         color: '#888' },
    };

    // ── Render ────────────────────────────────────────────────────────────────
    function renderHotTopics(data) {
        var container = document.getElementById(HT_CONTAINER_ID);
        if (!container) return;

        if (!data || !data.topics || !data.topics.length) {
            container.innerHTML = '<div style="padding:10px 14px;color:var(--text-muted);font-size:0.78rem;">No hot topics yet — check back Friday.</div>';
            return;
        }

        var updatedStr = '';
        if (data.updatedAt) {
            var d = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt);
            updatedStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        }

        var html = '';
        data.topics.forEach(function (topic, idx) {
            var gradients = [
                'linear-gradient(135deg,#f7931a22 0%,#ff6b0022 100%)',
                'linear-gradient(135deg,#1d9bf022 0%,#7b2fff22 100%)',
                'linear-gradient(135deg,#ff450022 0%,#ff9f4322 100%)',
            ];
            var accents = ['#f7931a', '#1d9bf0', '#ff4500'];
            var gradient = gradients[idx % gradients.length];
            var accent   = accents[idx % accents.length];

            var fireEmoji = topic.heatScore >= 80 ? '🔥🔥' : topic.heatScore >= 50 ? '🔥' : '⚡';

            // Build posts list
            var postsHtml = '';
            if (topic.posts && topic.posts.length) {
                topic.posts.forEach(function (post) {
                    var meta = SOURCE_META[post.source] || SOURCE_META.web;
                    postsHtml += '<a href="' + escHtml(post.url) + '" target="_blank" rel="noopener noreferrer" class="ht-post-link">' +
                        '<span class="ht-source-badge" style="background:' + meta.color + '22;color:' + meta.color + ';border:1px solid ' + meta.color + '44;">' +
                        meta.icon + ' ' + meta.label + '</span>' +
                        '<span class="ht-post-title">' + escHtml(post.title) + '</span>' +
                        '</a>';
                });
            }

            // Build sides
            var sidesHtml = '';
            if (topic.sides && topic.sides.length) {
                topic.sides.forEach(function (side) {
                    var sideIcon = side.stance === 'for' ? '✅' : side.stance === 'against' ? '❌' : '🤔';
                    var sideColor = side.stance === 'for' ? '#22c55e' : side.stance === 'against' ? '#ef4444' : '#f59e0b';
                    sidesHtml += '<div class="ht-side" style="border-left:3px solid ' + sideColor + ';">' +
                        '<div class="ht-side-label" style="color:' + sideColor + ';">' + sideIcon + ' ' + escHtml(side.label) + '</div>' +
                        '<div class="ht-side-text">' + escHtml(side.summary) + '</div>' +
                        '</div>';
                });
            }

            html += '<div class="ht-topic" style="background:' + gradient + ';border-left:3px solid ' + accent + ';">' +
                '<div class="ht-topic-header" onclick="window._htToggle(this)" data-idx="' + idx + '">' +
                    '<div class="ht-topic-title">' +
                        '<span class="ht-fire">' + fireEmoji + '</span>' +
                        '<span class="ht-topic-name">' + escHtml(topic.title) + '</span>' +
                    '</div>' +
                    '<span class="ht-chevron">▼</span>' +
                '</div>' +
                '<div class="ht-topic-body" id="ht-body-' + idx + '" style="display:none;">' +
                    '<div class="ht-summary-label">📋 What\'s the debate?</div>' +
                    '<div class="ht-summary">' + escHtml(topic.summary) + '</div>' +
                    (sidesHtml ? '<div class="ht-sides-label">⚖️ Both sides</div>' + sidesHtml : '') +
                    (postsHtml ? '<div class="ht-posts-label">🔗 From the community</div>' + postsHtml : '') +
                '</div>' +
            '</div>';
        });

        var footer = updatedStr ? '<div class="ht-footer">Last updated: ' + updatedStr + ' · Refreshes every Friday</div>' : '';
        container.innerHTML = html + footer;
    }

    // ── Toggle expand/collapse ────────────────────────────────────────────────
    window._htToggle = function (headerEl) {
        var idx = headerEl.getAttribute('data-idx');
        var body = document.getElementById('ht-body-' + idx);
        var chevron = headerEl.querySelector('.ht-chevron');
        if (!body) return;
        var open = body.style.display !== 'none';
        body.style.display = open ? 'none' : 'block';
        if (chevron) chevron.style.transform = open ? 'rotate(0deg)' : 'rotate(180deg)';
    };

    // ── Load from Firestore ───────────────────────────────────────────────────
    function loadHotTopics() {
        var container = document.getElementById(HT_CONTAINER_ID);
        if (!container) return;

        // Show skeleton
        container.innerHTML = '<div class="ht-loading">' +
            '<div class="ht-skeleton"></div><div class="ht-skeleton" style="width:80%"></div><div class="ht-skeleton" style="width:90%"></div>' +
        '</div>';

        if (typeof db === 'undefined' || !db) {
            // Firestore not ready — retry once after a short wait
            setTimeout(loadHotTopics, 2000);
            return;
        }

        db.collection(HT_COLLECTION).doc(HT_DOC).get().then(function (doc) {
            if (doc.exists) {
                renderHotTopics(doc.data());
            } else {
                renderHotTopics(null);
            }
        }).catch(function (err) {
            console.warn('[HotTopics] Firestore error:', err);
            renderHotTopics(null);
        });
    }

    // ── Inject sidebar HTML + CSS ─────────────────────────────────────────────
    function injectSidebarSection() {
        var channelList = document.getElementById('channelList');
        if (!channelList) return;

        // Don't double-inject
        if (document.getElementById(HT_CONTAINER_ID + 'Wrapper')) return;

        // CSS
        var style = document.createElement('style');
        style.textContent = `
            #hotTopicsSectionWrapper {
                border-bottom: 1px solid var(--border);
                margin-bottom: 4px;
            }
            .ht-header-bar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 10px 14px 6px;
                cursor: pointer;
                user-select: none;
            }
            .ht-header-bar:hover { background: var(--accent-bg); }
            .ht-header-title {
                display: flex;
                align-items: center;
                gap: 7px;
                font-size: 0.72rem;
                font-weight: 900;
                text-transform: uppercase;
                letter-spacing: 1.2px;
                color: var(--accent);
            }
            .ht-pulse {
                width: 8px; height: 8px;
                background: #f7931a;
                border-radius: 50%;
                animation: htPulse 2s infinite;
                flex-shrink: 0;
            }
            @keyframes htPulse {
                0%,100% { opacity:1; transform:scale(1); box-shadow:0 0 0 0 #f7931a66; }
                50% { opacity:0.8; transform:scale(1.2); box-shadow:0 0 0 4px #f7931a00; }
            }
            .ht-header-chevron { color: var(--text-dim); font-size: 0.7rem; transition: transform 0.2s; }
            #hotTopicsSection { padding: 0 8px 8px; }
            .ht-topic {
                border-radius: 10px;
                margin-bottom: 8px;
                overflow: hidden;
                border: 1px solid var(--border);
            }
            .ht-topic-header {
                display: flex;
                align-items: center;
                justify-content: space-between;
                padding: 9px 12px;
                cursor: pointer;
                user-select: none;
                gap: 6px;
            }
            .ht-topic-header:hover { filter: brightness(1.1); }
            .ht-topic-title {
                display: flex;
                align-items: center;
                gap: 7px;
                flex: 1;
                min-width: 0;
            }
            .ht-fire { font-size: 1rem; flex-shrink: 0; }
            .ht-topic-name {
                font-size: 0.8rem;
                font-weight: 700;
                color: var(--text);
                line-height: 1.3;
                white-space: normal;
            }
            .ht-chevron {
                color: var(--text-dim);
                font-size: 0.65rem;
                transition: transform 0.2s;
                flex-shrink: 0;
            }
            .ht-topic-body { padding: 0 12px 12px; }
            .ht-summary-label, .ht-sides-label, .ht-posts-label {
                font-size: 0.68rem;
                font-weight: 800;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: var(--text-dim);
                margin: 10px 0 5px;
            }
            .ht-summary {
                font-size: 0.79rem;
                color: var(--text);
                line-height: 1.55;
            }
            .ht-side {
                padding: 7px 10px;
                border-radius: 8px;
                background: var(--card-bg);
                margin-bottom: 6px;
            }
            .ht-side-label {
                font-size: 0.7rem;
                font-weight: 700;
                margin-bottom: 3px;
            }
            .ht-side-text {
                font-size: 0.77rem;
                color: var(--text-muted);
                line-height: 1.5;
            }
            .ht-post-link {
                display: flex;
                align-items: flex-start;
                gap: 7px;
                padding: 6px 8px;
                border-radius: 8px;
                background: var(--card-bg);
                margin-bottom: 5px;
                text-decoration: none;
                border: 1px solid var(--border);
                transition: background 0.15s;
                flex-wrap: wrap;
            }
            .ht-post-link:hover { background: var(--accent-bg); }
            .ht-source-badge {
                font-size: 0.63rem;
                font-weight: 700;
                padding: 2px 6px;
                border-radius: 999px;
                white-space: nowrap;
                flex-shrink: 0;
            }
            .ht-post-title {
                font-size: 0.75rem;
                color: var(--text);
                line-height: 1.4;
                word-break: break-word;
            }
            .ht-footer {
                font-size: 0.65rem;
                color: var(--text-faint);
                padding: 2px 14px 8px;
                text-align: center;
            }
            .ht-loading { padding: 12px 14px; }
            .ht-skeleton {
                height: 12px;
                border-radius: 6px;
                background: var(--border);
                margin-bottom: 8px;
                animation: htShimmer 1.5s infinite;
            }
            @keyframes htShimmer {
                0%,100% { opacity: 0.4; }
                50% { opacity: 0.8; }
            }
        `;
        document.head.appendChild(style);

        // HTML wrapper — injected before channelList content
        var wrapper = document.createElement('div');
        wrapper.id = HT_CONTAINER_ID + 'Wrapper';
        wrapper.innerHTML =
            '<div class="ht-header-bar" onclick="window._htSectionToggle(this)">' +
                '<div class="ht-header-title">' +
                    '<div class="ht-pulse"></div>' +
                    '🔥 Hot Topics' +
                '</div>' +
                '<span class="ht-header-chevron" id="htSectionChevron">▼</span>' +
            '</div>' +
            '<div id="' + HT_CONTAINER_ID + '"></div>';

        channelList.insertBefore(wrapper, channelList.firstChild);
    }

    // ── Section-level collapse ────────────────────────────────────────────────
    window._htSectionToggle = function (headerEl) {
        var section = document.getElementById(HT_CONTAINER_ID);
        var chevron = document.getElementById('htSectionChevron');
        if (!section) return;
        var open = section.style.display !== 'none';
        section.style.display = open ? 'none' : 'block';
        try { localStorage.setItem('ht-section-collapsed', open ? '1' : '0'); } catch (e) {}
        if (chevron) chevron.style.transform = open ? 'rotate(-90deg)' : 'rotate(0deg)';
    };

    // ── Init ──────────────────────────────────────────────────────────────────
    function init() {
        injectSidebarSection();

        // Restore collapsed state
        try {
            if (localStorage.getItem('ht-section-collapsed') === '1') {
                var section = document.getElementById(HT_CONTAINER_ID);
                var chevron = document.getElementById('htSectionChevron');
                if (section) section.style.display = 'none';
                if (chevron) chevron.style.transform = 'rotate(-90deg)';
            }
        } catch (e) {}

        loadHotTopics();
    }

    // ── Util ──────────────────────────────────────────────────────────────────
    function escHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Run when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
