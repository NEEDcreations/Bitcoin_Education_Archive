// © 2024-2026 603BTC LLC. All rights reserved.
// meetup-builder.js — Meetup Builder for IRL Sync (standalone module)
// Injects itself into #irl-sync-view after render

(function() {
'use strict';

// Wait for IRL Sync to render, then inject Meetup Builder section
var _origRenderIRL = window.renderIRLSync;
if (_origRenderIRL) {
    window.renderIRLSync = function(opts) {
        _origRenderIRL(opts);
        setTimeout(injectMeetupBuilder, 300);
    };
}

function injectMeetupBuilder() {
    var view = document.getElementById('irl-sync-view');
    if (!view || document.getElementById('meetupBuilderSection')) return;

    var section = document.createElement('div');
    section.id = 'meetupBuilderSection';
    section.style.cssText = 'margin-top:50px;border-top:1px solid var(--border);padding-top:40px;';
    section.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">' +
            '<div style="width:48px;height:48px;background:linear-gradient(135deg,#f7931a,#ea580c);border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">🏗️</div>' +
            '<div>' +
                '<h2 style="font-size:1.3rem;color:var(--heading);margin:0;">Meetup Builder</h2>' +
                '<p style="color:var(--text-muted);font-size:0.82rem;margin:2px 0 0;">Learn from experienced hosts · Start your own Bitcoin meetup</p>' +
            '</div>' +
        '</div>' +
        '<p style="color:var(--text-muted);font-size:0.88rem;line-height:1.6;margin-bottom:24px;">Want to start a Bitcoin meetup in your area? Learn from hosts who have done it. Browse slides, presentations, write-ups, and advice from experienced organizers.</p>' +
        '<div id="meetupBuilderGrid" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(280px, 1fr));gap:16px;margin-bottom:20px;">' +
            '<div style="text-align:center;padding:40px;opacity:0.5;grid-column:1/-1;"><span style="font-size:2rem;">📡</span><br>Loading community resources...</div>' +
        '</div>' +
        '<button onclick="showMeetupBuilderSubmit()" style="width:100%;padding:14px;background:none;border:2px dashed var(--accent);color:var(--accent);border-radius:14px;font-weight:700;font-size:0.9rem;cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.background=\'rgba(247,147,26,0.08)\'" onmouseout="this.style.background=\'none\'">📤 Share Your Meetup Experience</button>';

    view.appendChild(section);
    loadMeetupBuilderPosts();
}

function loadMeetupBuilderPosts() {
    var grid = document.getElementById('meetupBuilderGrid');
    if (!grid) return;
    if (typeof firebase === 'undefined' || !firebase.firestore) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-faint);">Loading...</div>';
        return;
    }
    var db = firebase.firestore();
    db.collection('meetup_builder').orderBy('createdAt', 'desc').limit(20).get().then(function(snap) {
        if (snap.empty) {
            grid.innerHTML =
                '<div style="grid-column:1/-1;text-align:center;background:var(--card-bg);padding:40px;border-radius:16px;border:1px dashed var(--border);">' +
                    '<div style="font-size:2.5rem;margin-bottom:12px;">🏗️</div>' +
                    '<h3 style="color:var(--heading);margin-bottom:8px;font-size:1rem;">No resources shared yet</h3>' +
                    '<p style="color:var(--text-muted);font-size:0.85rem;">Be the first to share how you built your meetup!</p>' +
                '</div>';
            return;
        }
        var html = '';
        snap.forEach(function(doc) {
            var d = doc.data();
            var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };
            html += '<div onclick="viewMeetupBuilderPost(\'' + doc.id + '\')" style="background:var(--card-bg);border:1px solid var(--border);border-radius:16px;padding:20px;cursor:pointer;transition:0.3s;" ' +
                'onmouseover="this.style.borderColor=\'var(--accent)\';this.style.transform=\'translateY(-3px)\'" ' +
                'onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\'">' +
                '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
                    '<span style="font-size:1.3rem;">' + (d.emoji || '📋') + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="color:var(--heading);font-weight:700;font-size:0.95rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + esc(d.title || 'Untitled') + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;">by ' + esc(d.authorName || 'Anonymous') + (d.meetupName ? ' · ' + esc(d.meetupName) : '') + '</div>' +
                    '</div>' +
                '</div>' +
                (d.description ? '<div style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;">' + esc(d.description) + '</div>' : '') +
                '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:10px;">' +
                    (d.hasSlides ? '<span style="padding:3px 8px;background:rgba(99,102,241,0.1);border:1px solid rgba(99,102,241,0.2);border-radius:6px;font-size:0.65rem;color:#818cf8;font-weight:700;">📊 Slides</span>' : '') +
                    (d.hasWriteup ? '<span style="padding:3px 8px;background:rgba(34,197,94,0.1);border:1px solid rgba(34,197,94,0.2);border-radius:6px;font-size:0.65rem;color:#22c55e;font-weight:700;">📝 Write-up</span>' : '') +
                    (d.topics && d.topics.length ? '<span style="padding:3px 8px;background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.2);border-radius:6px;font-size:0.65rem;color:var(--accent);font-weight:700;">🎯 ' + d.topics.length + ' topics</span>' : '') +
                    '<span style="padding:3px 8px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:6px;font-size:0.65rem;color:var(--text-faint);">👁️ ' + (d.views || 0) + '</span>' +
                '</div>' +
            '</div>';
        });
        grid.innerHTML = html;
    }).catch(function() {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:30px;color:var(--text-faint);">Could not load resources</div>';
    });
}

window.viewMeetupBuilderPost = async function(id) {
    var db = firebase.firestore();
    try {
        var doc = await db.collection('meetup_builder').doc(id).get();
        if (!doc.exists) return;
        var d = doc.data();
        var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };
        db.collection('meetup_builder').doc(id).update({ views: firebase.firestore.FieldValue.increment(1) }).catch(function() {});

        var overlay = document.createElement('div');
        overlay.id = 'meetupBuilderOverlay';
        overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
        overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

        var html = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:20px;max-width:600px;width:100%;margin:40px auto;padding:28px;">';
        html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">' +
            '<div><div style="font-size:0.7rem;color:var(--accent);font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">MEETUP BUILDER</div>' +
            '<h2 style="color:var(--heading);font-size:1.3rem;margin:0;line-height:1.3;">' + esc(d.title) + '</h2></div>' +
            '<button onclick="document.getElementById(\'meetupBuilderOverlay\').remove()" style="background:none;border:none;color:var(--text-faint);font-size:1.3rem;cursor:pointer;padding:4px;">✕</button></div>';

        html += '<div style="color:var(--text-faint);font-size:0.8rem;margin-bottom:16px;">by <strong style="color:var(--text);">' + esc(d.authorName || 'Anonymous') + '</strong>' +
            (d.meetupName ? ' · ' + esc(d.meetupName) : '') +
            (d.location ? ' · 📍 ' + esc(d.location) : '') +
            (d.attendeeRange ? ' · 👥 ' + esc(d.attendeeRange) + ' typical attendees' : '') + '</div>';

        if (d.description) html += '<div style="color:var(--text);font-size:0.9rem;line-height:1.7;margin-bottom:20px;white-space:pre-wrap;">' + esc(d.description) + '</div>';

        if (d.topics && d.topics.length) {
            html += '<div style="margin-bottom:20px;"><div style="font-size:0.75rem;color:var(--accent);font-weight:700;margin-bottom:8px;">🎯 TOPICS COVERED</div><div style="display:flex;flex-wrap:wrap;gap:6px;">';
            d.topics.forEach(function(t) { html += '<span style="padding:5px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.8rem;color:var(--text);">' + esc(t) + '</span>'; });
            html += '</div></div>';
        }

        if (d.tips) html += '<div style="margin-bottom:20px;padding:16px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:12px;">' +
            '<div style="font-size:0.75rem;color:var(--accent);font-weight:700;margin-bottom:6px;">💡 TIPS FOR NEW HOSTS</div>' +
            '<div style="color:var(--text);font-size:0.85rem;line-height:1.6;white-space:pre-wrap;">' + esc(d.tips) + '</div></div>';

        if (d.slideUrl) html += '<a href="' + esc(d.slideUrl) + '" target="_blank" rel="noopener" style="display:block;padding:14px;background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);border-radius:12px;color:#818cf8;font-weight:700;font-size:0.9rem;text-decoration:none;text-align:center;margin-bottom:12px;">📊 View Slides / Presentation ↗</a>';
        if (d.resourceUrl) html += '<a href="' + esc(d.resourceUrl) + '" target="_blank" rel="noopener" style="display:block;padding:14px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:12px;color:#22c55e;font-weight:700;font-size:0.9rem;text-decoration:none;text-align:center;margin-bottom:12px;">📎 Additional Resources ↗</a>';

        html += '<button onclick="document.getElementById(\'meetupBuilderOverlay\').remove()" style="width:100%;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);cursor:pointer;font-family:inherit;margin-top:8px;">Close</button>';
        html += '</div>';
        overlay.innerHTML = html;
        document.body.appendChild(overlay);
    } catch(e) {
        if (typeof showToast === 'function') showToast('Error loading resource');
    }
};

window.showMeetupBuilderSubmit = function() {
    var auth = typeof firebase !== 'undefined' ? firebase.auth() : null;
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to share your meetup experience');
        return;
    }

    var overlay = document.createElement('div');
    overlay.id = 'meetupBuilderSubmitOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var s = 'width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:10px;color:var(--text);outline:none;box-sizing:border-box;font-family:inherit;margin-bottom:12px;';
    var html = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid var(--accent);border-radius:20px;max-width:500px;width:100%;margin:40px auto;padding:28px;">';
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;"><h2 style="color:var(--heading);margin:0;font-size:1.2rem;">📤 Share Your Meetup</h2>' +
        '<button onclick="document.getElementById(\'meetupBuilderSubmitOverlay\').remove()" style="background:none;border:none;color:var(--text-faint);font-size:1.3rem;cursor:pointer;">✕</button></div>';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Title *</label>';
    html += '<input type="text" id="mbTitle" placeholder="e.g. How I Built Austin Bitcoin Club" maxlength="120" style="' + s + '">';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Your Meetup Name</label>';
    html += '<input type="text" id="mbMeetupName" placeholder="e.g. Austin Bitcoin Club" maxlength="80" style="' + s + '">';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Location</label>';
    html += '<input type="text" id="mbLocation" placeholder="e.g. Austin, TX" maxlength="80" style="' + s + '">';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Typical Attendees</label>';
    html += '<input type="text" id="mbAttendees" placeholder="e.g. 15-30 people" maxlength="40" style="' + s + '">';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Description / Your Story *</label>';
    html += '<textarea id="mbDesc" placeholder="How did you start your meetup? What worked? What didn\'t?" rows="5" maxlength="3000" style="' + s + 'resize:vertical;font-size:0.88rem;line-height:1.5;"></textarea>';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Tips for New Hosts</label>';
    html += '<textarea id="mbTips" placeholder="What advice would you give someone starting their first meetup?" rows="3" maxlength="2000" style="' + s + 'resize:vertical;font-size:0.88rem;line-height:1.5;"></textarea>';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Topics Covered (comma-separated)</label>';
    html += '<input type="text" id="mbTopics" placeholder="e.g. Self-custody, Lightning, Privacy, Mining" style="' + s + '">';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Slides / Presentation Link</label>';
    html += '<input type="url" id="mbSlideUrl" placeholder="https://docs.google.com/presentation/..." style="' + s + '">';

    html += '<label style="display:block;font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;text-transform:uppercase;">Additional Resource Link</label>';
    html += '<input type="url" id="mbResourceUrl" placeholder="https://..." style="' + s + '">';

    html += '<button onclick="submitMeetupBuilder()" id="mbSubmitBtn" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:800;font-size:1rem;cursor:pointer;font-family:inherit;margin-top:4px;">📤 Share with Community</button>';
    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);
};

window.submitMeetupBuilder = async function() {
    var btn = document.getElementById('mbSubmitBtn');
    var title = (document.getElementById('mbTitle').value || '').trim();
    var desc = (document.getElementById('mbDesc').value || '').trim();
    if (!title || !desc) { if (typeof showToast === 'function') showToast('Title and description are required'); return; }
    btn.disabled = true; btn.textContent = 'Submitting...';
    try {
        var auth = firebase.auth();
        var db = firebase.firestore();
        var topics = (document.getElementById('mbTopics').value || '').split(',').map(function(t) { return t.trim(); }).filter(function(t) { return t.length > 0; });
        var slideUrl = (document.getElementById('mbSlideUrl').value || '').trim();
        var resourceUrl = (document.getElementById('mbResourceUrl').value || '').trim();
        var tips = (document.getElementById('mbTips').value || '').trim();

        var data = {
            title: title.substring(0, 120),
            description: desc.substring(0, 3000),
            meetupName: (document.getElementById('mbMeetupName').value || '').trim().substring(0, 80),
            location: (document.getElementById('mbLocation').value || '').trim().substring(0, 80),
            attendeeRange: (document.getElementById('mbAttendees').value || '').trim().substring(0, 40),
            authorId: auth.currentUser.uid,
            authorName: (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : (auth.currentUser.displayName || 'Anonymous'),
            topics: topics.slice(0, 10),
            hasSlides: !!slideUrl,
            hasWriteup: desc.length > 200,
            views: 0,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        if (slideUrl) data.slideUrl = slideUrl.substring(0, 500);
        if (resourceUrl) data.resourceUrl = resourceUrl.substring(0, 500);
        if (tips) data.tips = tips.substring(0, 2000);
        data.emoji = slideUrl ? '📊' : tips ? '💡' : '📋';

        await db.collection('meetup_builder').add(data);
        document.getElementById('meetupBuilderSubmitOverlay').remove();
        if (typeof showToast === 'function') showToast('✅ Meetup experience shared! Thank you!');
        if (typeof awardPoints === 'function') awardPoints(25, '🏗️ Meetup Builder contribution');
        loadMeetupBuilderPosts();
    } catch(e) {
        if (typeof showToast === 'function') showToast('Error: ' + (e.message || 'Unknown'));
        btn.disabled = false; btn.textContent = '📤 Share with Community';
    }
};

console.log('[MEETUP BUILDER] Module loaded');
})();
