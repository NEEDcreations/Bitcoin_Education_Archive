// ============================================================
// Bitcoin Education Archive — Shared Utilities
// [AUDIT FIX] Extracted from duplicate definitions across files.
// Load BEFORE all other local scripts in index.html.
// ============================================================

// ---- Safe JSON parse from localStorage ----
// [AUDIT FIX #16] Prevents uncaught exceptions from corrupted localStorage
function safeJSON(key, fallback) {
    try {
        var raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return JSON.parse(raw);
    } catch (e) {
        console.warn('safeJSON: corrupted data for key "' + key + '", resetting.', e);
        try { localStorage.removeItem(key); } catch (e2) {}
        return fallback;
    }
}

// ---- HTML Escape ----
// Prevents XSS in user-generated content rendered as innerHTML
function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

// ---- Time Ago ----
// Converts a Firestore timestamp or Date to human-readable relative time
function timeAgo(ts) {
    if (!ts) return '';
    var date;
    if (ts.toDate) {
        date = ts.toDate();
    } else if (ts instanceof Date) {
        date = ts;
    } else {
        date = new Date(ts);
    }
    var diff = Math.floor((Date.now() - date.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
    if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
    if (diff < 604800) return Math.floor(diff / 86400) + 'd ago';
    return date.toLocaleDateString();
}

// ---- Page Visibility: pause/resume intervals when tab is hidden ----
// Prevents wasted CPU and API calls in background tabs
(function() {
    var _registeredIntervals = [];
    var _pausedIntervals = [];

    window.registerInterval = function(fn, ms, name) {
        var id = setInterval(fn, ms);
        _registeredIntervals.push({ id: id, fn: fn, ms: ms, name: name || 'unnamed' });
        return id;
    };

    document.addEventListener('visibilitychange', function() {
        if (document.hidden) {
            // Tab hidden — pause all registered intervals
            _registeredIntervals.forEach(function(entry) {
                clearInterval(entry.id);
            });
            _pausedIntervals = _registeredIntervals.slice();
            _registeredIntervals = [];
        } else {
            // Tab visible — resume all paused intervals
            _pausedIntervals.forEach(function(entry) {
                entry.fn(); // Run immediately on resume
                entry.id = setInterval(entry.fn, entry.ms);
                _registeredIntervals.push(entry);
            });
            _pausedIntervals = [];
        }
    });
})();
