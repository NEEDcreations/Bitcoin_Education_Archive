'use strict';

// Instant email when a user report, a Beats track report, or a topic-comment
// report is created. The Firestore docs are already stored by the client or
// by reportTopicComment. This module only sends mail.
//
// SMTP auth is injected by index.js from Secret Manager
// (REPORT_MAIL_USER / REPORT_MAIL_PASS). The message never includes an
// account email or an IP address.

const HOUR_MS = 60 * 60 * 1000;
const MAX_PER_HOUR = 10;
const EXCERPT_MAX = 300;
const HELD_MAX = 25;
const SUBJECT_PART = 80;
const MAIL_TO = 'info.603btc@gmail.com';
const SITE = 'https://bitcoineducation.quest/';

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
const IPV4_RE = /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g;
const IPV6_RE = /\b(?:[A-Fa-f0-9]{1,4}:){2,7}[A-Fa-f0-9]{1,4}\b/g;

function escHtml(value) {
    return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function redact(value) {
    return String(value == null ? '' : value)
        .replace(EMAIL_RE, '[redacted]')
        .replace(IPV4_RE, '[redacted]')
        .replace(IPV6_RE, '[redacted]');
}

function clip(value, max) {
    const clean = redact(value)
        .replace(/[\u0000-\u001F]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (clean.length <= max) return clean;
    return clean.slice(0, max);
}

function oneLine(value) {
    return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function shortUid(uid) {
    const s = String(uid || '');
    if (!s) return '';
    return s.slice(0, 6);
}

function safeDocId(id) {
    const s = String(id || '');
    if (!s || s.length > 700 || s.indexOf('/') !== -1) return '';
    return s;
}

function reporterKey(uid) {
    const s = String(uid || '').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 128);
    return s || 'unknown';
}

function stateDocId(path) {
    const s = String(path || 'report').replace(/[^A-Za-z0-9_-]/g, '_');
    return s.slice(0, 500) || 'report';
}

function safeLink(value) {
    const url = String(value || '');
    if (url.indexOf(SITE) !== 0) return '';
    if (/[\s<>"']/.test(url)) return '';
    return url;
}

function formatEt(ms) {
    const when = new Date(ms);
    if (!Number.isFinite(when.getTime())) return '';
    const formatted = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
    }).format(when);
    return formatted.replace(/\u202f/g, ' ').replace(/\u00a0/g, ' ') + ' ET';
}

function timeMs(value, fallback) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (value && typeof value.toMillis === 'function') {
        const ms = value.toMillis();
        if (Number.isFinite(ms)) return ms;
    }
    if (value && typeof value.seconds === 'number') return value.seconds * 1000;
    if (value && typeof value._seconds === 'number') return value._seconds * 1000;
    return fallback;
}

function beatsLink(trackId) {
    const id = safeDocId(trackId);
    if (!id) return '';
    return SITE + '#beats/' + encodeURIComponent(id);
}

function topicLink(channelId, postId) {
    const channel = safeDocId(channelId);
    const post = safeDocId(postId);
    if (!channel || !post) return '';
    return SITE + '#topic=' + encodeURIComponent(channel) + '&post=' + encodeURIComponent(post);
}

function summarize(report) {
    return {
        source: clip(report.source, 120),
        reason: clip(report.reason, EXCERPT_MAX) || 'report',
        reporterName: clip(report.reporterName, 64),
        reportedName: clip(report.reportedName, 64),
        reporterUid: shortUid(report.reporterUid),
        reportedUid: shortUid(report.reportedUid),
        target: clip(report.target, SUBJECT_PART),
        excerpt: clip(report.excerpt, EXCERPT_MAX),
        link: safeLink(report.link),
        atEt: formatEt(report.atMs),
    };
}

// Pure rate-limit step. `limit` is the counter doc. Held rows are reports
// that were stored but not mailed; the next send carries them.
function applyLimit(limit, report, nowMs) {
    const src = limit || {};
    let windowStartMs = Number(src.windowStartMs) || 0;
    let sent = Number(src.sent) || 0;
    const held = Array.isArray(src.held) ? src.held.slice() : [];
    let heldOverflow = Number(src.heldOverflow) || 0;
    if (!windowStartMs || nowMs - windowStartMs >= HOUR_MS) {
        windowStartMs = nowMs;
        sent = 0;
    }
    const summary = summarize(report);
    if (sent >= MAX_PER_HOUR) {
        if (held.length >= HELD_MAX) heldOverflow += 1;
        else held.push(summary);
        return {
            send: false,
            limit: { windowStartMs: windowStartMs, sent: sent, held: held, heldOverflow: heldOverflow },
            prior: [],
            overflow: 0,
        };
    }
    const prior = held;
    const overflow = heldOverflow;
    return {
        send: true,
        limit: { windowStartMs: windowStartMs, sent: sent + 1, held: [], heldOverflow: 0 },
        prior: prior,
        overflow: overflow,
    };
}

function person(name, uid) {
    const shown = clip(name, 64) || 'unknown';
    const id = shortUid(uid);
    return id ? shown + ' (' + id + ')' : shown;
}

function priorLine(item) {
    const row = item || {};
    const bits = [
        'From: ' + (clip(row.source, 120) || 'report'),
        'Reason: ' + (clip(row.reason, EXCERPT_MAX) || 'report'),
        'Reporter: ' + person(row.reporterName, row.reporterUid),
        'Reported: ' + person(row.reportedName, row.reportedUid),
    ];
    if (row.atEt) bits.push('When: ' + clip(row.atEt, 80));
    const excerpt = clip(row.excerpt, EXCERPT_MAX);
    const reason = clip(row.reason, EXCERPT_MAX);
    if (excerpt && excerpt !== reason) bits.push('Excerpt: ' + excerpt);
    const link = safeLink(row.link);
    if (link) bits.push('Admin link: ' + link);
    return bits.join(' · ');
}

function buildEmail(report, prior, overflow) {
    const reason = clip(report.reason, EXCERPT_MAX) || 'report';
    const target = clip(report.target, SUBJECT_PART) || 'unknown';
    const subject = '[BQ] Report: ' + (oneLine(reason).slice(0, SUBJECT_PART) || 'report')
        + ' on ' + (oneLine(target).slice(0, SUBJECT_PART) || 'unknown');
    const lines = [
        'From: ' + (clip(report.source, 120) || 'report'),
        'Reason: ' + reason,
        'Reporter: ' + person(report.reporterName, report.reporterUid),
        'Reported: ' + person(report.reportedName, report.reportedUid),
        'When: ' + (formatEt(report.atMs) || 'unknown'),
    ];
    const excerpt = clip(report.excerpt, EXCERPT_MAX);
    if (excerpt && excerpt !== reason) lines.push('Excerpt: ' + excerpt);
    const link = safeLink(report.link);
    if (link) lines.push('Admin link: ' + link);

    const held = Array.isArray(prior) ? prior : [];
    const extra = Number(overflow) || 0;
    const textLines = lines.slice();
    if (held.length || extra) {
        textLines.push('');
        textLines.push('Also stored since the last email:');
        held.forEach(function(item) { textLines.push('- ' + priorLine(item)); });
        if (extra === 1) textLines.push('1 more report was stored and is not listed.');
        else if (extra > 1) textLines.push(extra + ' more reports were stored and are not listed.');
    }

    const html = [];
    html.push('<div style="font-family:sans-serif;max-width:640px;margin:0 auto;padding:20px;">');
    html.push('<h2 style="color:#f7931a;margin:0 0 12px;">[BQ] Report</h2>');
    lines.forEach(function(line) {
        const splitAt = line.indexOf(': ');
        const label = splitAt === -1 ? '' : line.slice(0, splitAt);
        const rest = splitAt === -1 ? line : line.slice(splitAt + 2);
        if (label === 'Admin link') {
            const href = escHtml(rest);
            html.push('<p><strong>Admin link:</strong> <a href="' + href + '">' + href + '</a></p>');
        } else if (label) {
            html.push('<p><strong>' + escHtml(label) + ':</strong> ' + escHtml(rest) + '</p>');
        } else {
            html.push('<p>' + escHtml(line) + '</p>');
        }
    });
    if (held.length || extra) {
        html.push('<h3>Also stored since the last email</h3><ul>');
        held.forEach(function(item) {
            html.push('<li>' + escHtml(priorLine(item)) + '</li>');
        });
        html.push('</ul>');
        if (extra === 1) html.push('<p>1 more report was stored and is not listed.</p>');
        else if (extra > 1) html.push('<p>' + extra + ' more reports were stored and are not listed.</p>');
    }
    html.push('</div>');

    return {
        to: MAIL_TO,
        subject: subject,
        html: html.join(''),
        text: textLines.join('\n'),
    };
}

function createReportHandlers(deps) {
    if (!deps || !deps.db || typeof deps.sendMail !== 'function') {
        throw new Error('report mail deps missing');
    }
    const nowFn = typeof deps.now === 'function' ? deps.now : function() { return Date.now(); };

    async function usernameOnly(uid) {
        const id = safeDocId(uid);
        if (!id) return '';
        try {
            const snap = await deps.db.collection('users').doc(id).get();
            if (!snap || !snap.exists) return '';
            const data = snap.data() || {};
            return typeof data.username === 'string' ? data.username : '';
        } catch (err) {
            console.error('[reportMail] username lookup failed');
            throw err;
        }
    }

    async function readDoc(ref) {
        const snap = await ref.get();
        if (!snap || !snap.exists) return null;
        return snap.data() || {};
    }

    function baseReport(event, path, source) {
        if (!event || !event.data || typeof event.data.data !== 'function') return null;
        const raw = event.data.data() || {};
        return { raw: raw, path: path, source: source, atMs: nowFn() };
    }

    async function loadUser(event) {
        const params = (event && event.params) || {};
        const id = safeDocId(params.reportId) || 'unknown';
        const loaded = baseReport(event, 'reports/' + id, 'User report (profiles, DMs, marketplace, or Buddy)');
        if (!loaded) return null;
        const raw = loaded.raw;
        const reportedName = typeof raw.reportedName === 'string' ? raw.reportedName : '';
        let reporterName = typeof raw.reporterName === 'string' ? raw.reporterName : '';
        const reporterUid = typeof raw.reporterUid === 'string' ? raw.reporterUid : '';
        if (!reporterName) reporterName = await usernameOnly(reporterUid);
        return {
            path: loaded.path,
            source: loaded.source,
            reason: typeof raw.reason === 'string' ? raw.reason : '',
            reporterName: reporterName,
            reportedName: reportedName,
            reporterUid: reporterUid,
            reportedUid: typeof raw.reportedUid === 'string' ? raw.reportedUid : '',
            target: reportedName || 'user',
            excerpt: '',
            link: '',
            atMs: timeMs(raw.createdAt, loaded.atMs),
        };
    }

    async function loadBeats(event) {
        const params = (event && event.params) || {};
        const id = safeDocId(params.reportId) || 'unknown';
        const loaded = baseReport(event, 'beats_reports/' + id, 'Beats track');
        if (!loaded) return null;
        const raw = loaded.raw;
        const trackId = typeof raw.trackId === 'string' ? raw.trackId : '';
        let title = '';
        let reportedName = '';
        let reportedUid = '';
        const trackDocId = safeDocId(trackId);
        if (trackDocId) {
            const track = await readDoc(deps.db.collection('beats_tracks').doc(trackDocId));
            if (track) {
                title = typeof track.title === 'string' ? track.title : '';
                reportedName = typeof track.artist === 'string' && track.artist
                    ? track.artist
                    : (typeof track.authorName === 'string' ? track.authorName : '');
                reportedUid = typeof track.authorId === 'string' ? track.authorId : '';
            }
        }
        if (!reportedName && reportedUid) reportedName = await usernameOnly(reportedUid);
        const reporterUid = typeof raw.reporterId === 'string' ? raw.reporterId : '';
        const reporterName = await usernameOnly(reporterUid);
        const reason = typeof raw.reason === 'string' ? raw.reason : '';
        return {
            path: loaded.path,
            source: loaded.source,
            reason: reason,
            reporterName: reporterName,
            reportedName: reportedName,
            reporterUid: reporterUid,
            reportedUid: reportedUid,
            target: title || trackId || 'track',
            excerpt: '',
            link: beatsLink(trackId),
            atMs: timeMs(raw.createdAt, loaded.atMs),
        };
    }

    async function loadTopic(event) {
        const params = (event && event.params) || {};
        const channelId = typeof params.channelId === 'string' ? params.channelId : '';
        const postId = typeof params.postId === 'string' ? params.postId : '';
        const reportId = safeDocId(params.reportId) || 'unknown';
        const loaded = baseReport(
            event,
            'topic_discussions/' + channelId + '/posts/' + postId + '/reports/' + reportId,
            'Topic comment'
        );
        if (!loaded) return null;
        const raw = loaded.raw;
        let reportedName = '';
        let reportedUid = '';
        let excerpt = '';
        const channelDoc = safeDocId(channelId);
        const postDoc = safeDocId(postId);
        if (channelDoc && postDoc) {
            const post = await readDoc(
                deps.db.collection('topic_discussions').doc(channelDoc).collection('posts').doc(postDoc)
            );
            if (post) {
                reportedName = typeof post.name === 'string' ? post.name : '';
                reportedUid = typeof post.uid === 'string' ? post.uid : '';
                excerpt = typeof post.text === 'string' ? post.text : '';
            }
        }
        const reporterUid = typeof raw.uid === 'string' && raw.uid ? raw.uid : (params.reportId || '');
        const reporterName = await usernameOnly(reporterUid);
        const reason = typeof raw.reason === 'string' && raw.reason ? raw.reason : 'comment';
        return {
            path: loaded.path,
            source: loaded.source,
            reason: reason,
            reporterName: reporterName,
            reportedName: reportedName,
            reporterUid: reporterUid,
            reportedUid: reportedUid,
            target: excerpt || reportedName || postId || 'post',
            excerpt: excerpt,
            link: topicLink(channelId, postId),
            atMs: timeMs(raw.createdAtMs, loaded.atMs),
        };
    }

    async function deliver(report) {
        if (!report || !report.path) return null;
        const stateRef = deps.db.collection('report_mail_state').doc(stateDocId(report.path));
        const limitRef = deps.db.collection('report_mail_limits').doc(reporterKey(report.reporterUid));
        const decision = await deps.db.runTransaction(async function(tx) {
            const stateSnap = await tx.get(stateRef);
            const state = stateSnap && stateSnap.exists ? (stateSnap.data() || {}) : null;
            if (state && (state.status === 'sent' || state.status === 'held')) return { action: 'done' };
            if (state && state.status === 'reserved' && state.subject && state.html) {
                return { action: 'send', subject: state.subject, html: state.html, text: state.text || '' };
            }
            const limitSnap = await tx.get(limitRef);
            const applied = applyLimit(limitSnap && limitSnap.exists ? (limitSnap.data() || {}) : null, report, nowFn());
            const nowMs = nowFn();
            if (!applied.send) {
                tx.set(limitRef, {
                    windowStartMs: applied.limit.windowStartMs,
                    sent: applied.limit.sent,
                    held: applied.limit.held,
                    heldOverflow: applied.limit.heldOverflow,
                    updatedAtMs: nowMs,
                });
                tx.set(stateRef, { status: 'held', updatedAtMs: nowMs });
                return { action: 'held' };
            }
            const mail = buildEmail(report, applied.prior, applied.overflow);
            tx.set(limitRef, {
                windowStartMs: applied.limit.windowStartMs,
                sent: applied.limit.sent,
                held: [],
                heldOverflow: 0,
                updatedAtMs: nowMs,
            });
            tx.set(stateRef, {
                status: 'reserved',
                subject: mail.subject,
                html: mail.html,
                text: mail.text,
                updatedAtMs: nowMs,
            });
            return { action: 'send', subject: mail.subject, html: mail.html, text: mail.text };
        });
        if (!decision || decision.action === 'done') return null;
        if (decision.action === 'held') {
            console.log('[reportMail] held', clip(report.source, 40), shortUid(report.reporterUid));
            return null;
        }
        try {
            await deps.sendMail({
                to: MAIL_TO,
                subject: decision.subject,
                html: decision.html,
                text: decision.text,
            });
        } catch (err) {
            console.error('[reportMail] send failed', err && err.message ? err.message : '');
            throw err;
        }
        await stateRef.set({ status: 'sent', updatedAtMs: nowFn() });
        console.log('[reportMail] sent', clip(report.source, 40), shortUid(report.reporterUid));
        return null;
    }

    return {
        onUserReport: function(event) { return loadUser(event).then(deliver); },
        onBeatsReport: function(event) { return loadBeats(event).then(deliver); },
        onTopicReport: function(event) { return loadTopic(event).then(deliver); },
    };
}

module.exports = {
    HOUR_MS: HOUR_MS,
    MAX_PER_HOUR: MAX_PER_HOUR,
    EXCERPT_MAX: EXCERPT_MAX,
    HELD_MAX: HELD_MAX,
    MAIL_TO: MAIL_TO,
    escHtml: escHtml,
    clip: clip,
    shortUid: shortUid,
    formatEt: formatEt,
    buildEmail: buildEmail,
    applyLimit: applyLimit,
    createReportHandlers: createReportHandlers,
};
