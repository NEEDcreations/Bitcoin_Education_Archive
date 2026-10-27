// © 2024-2026 603BTC LLC. All rights reserved.
// This code is proprietary. See LICENSE file. Do not copy or redistribute.
// =============================================
// Bitcoin Education Archive - Scholar Quests
// Two separate certifications: Properties vs Technical
// =============================================
// Separated pools
// The Scholar and Protocol Expert question banks, including the correct
// answers, stay on the server. This file asks startScholarExam for the 25
// questions and grades by the option id the server issued.

// Scholar state

// Scholar state
let scholarType = 'properties';
let scholarAttemptDate = { properties: '', technical: '' };
let scholarPassed = { properties: false, technical: false };

// Pass and attempt state come from the signed-in profile. gradeScholarExam
// is the only writer of certPassed_* and lastExamAttempt_*. This file does
// not write those fields.
function scholarServerProfile(profile) {
    if (profile && typeof profile === 'object') return profile;
    if (typeof currentUser !== 'undefined' && currentUser && !currentUser._isLocal) return currentUser;
    return null;
}

function applyScholarProfile(profile) {
    var u = scholarServerProfile(profile);
    if (!u) {
        scholarPassed.properties = false;
        scholarPassed.technical = false;
        scholarAttemptDate.properties = '';
        scholarAttemptDate.technical = '';
        return;
    }
    scholarPassed.properties = u.certPassed_prop === true;
    scholarPassed.technical = u.certPassed_tech === true;
    scholarAttemptDate.properties = typeof u.lastExamAttempt_prop === 'string' ? u.lastExamAttempt_prop : '';
    scholarAttemptDate.technical = typeof u.lastExamAttempt_tech === 'string' ? u.lastExamAttempt_tech : '';
}

function scholarLocalAttempt(type) {
    var key = type === 'technical' ? 'btc_scholar_tech_attempt_date' : 'btc_scholar_prop_attempt_date';
    try { return localStorage.getItem(key) || ''; } catch (e) { return ''; }
}

window.refreshScholarFromProfile = applyScholarProfile;
applyScholarProfile();
let scholarTimer = null;
let scholarTimeLeft = 600; 
let scholarAnswers = [];
let scholarQuestions = [];

function scholarEscape(value) {
    if (typeof escapeHtml === 'function') return escapeHtml(value);
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
        return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
}

function scholarFail(inner, message) {
    if (!inner) return;
    while (inner.firstChild) inner.removeChild(inner.firstChild);
    var div = document.createElement('div');
    div.style.cssText = 'padding:40px 20px;text-align:center;color:#ef4444;';
    div.textContent = message || 'Something went wrong.';
    inner.appendChild(div);
}

function scholarSessionKey() {
    return 'btc_scholar_session_' + (scholarType === 'technical' ? 'tech' : 'prop');
}

function scholarSaveSession(index) {
    try {
        sessionStorage.setItem(scholarSessionKey(), JSON.stringify({
            examId: window._scholarExamId || '',
            answers: scholarAnswers,
            currentIndex: index || 0,
            startedAtMs: window._scholarStartedAtMs || 0
        }));
    } catch (e) {}
}

function scholarQuestionsOk(list) {
    if (!Array.isArray(list) || list.length !== 25) return false;
    for (var i = 0; i < list.length; i++) {
        var q = list[i];
        if (!q || typeof q.id !== 'string' || typeof q.q !== 'string') return false;
        if (!Array.isArray(q.options) || q.options.length < 2) return false;
        if (Object.prototype.hasOwnProperty.call(q, 'a') || Object.prototype.hasOwnProperty.call(q, 'w')) return false;
    }
    return true;
}

// Players see this 10-minute timer. The server keeps the attempt open for
// the same 10 minutes after its own start time, plus a short grace period
// that is not added to the clock on screen.
function scholarVisibleSeconds(startedAtMs, resumed) {
    if (!resumed) return 600;
    var elapsed = Math.floor((Date.now() - Number(startedAtMs)) / 1000);
    if (!isFinite(elapsed) || elapsed < 0) elapsed = 0;
    return Math.max(0, 600 - elapsed);
}

function startScholarQuest(type) {
    scholarType = type || 'properties';
    var keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';

    if (typeof auth === 'undefined' || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('📝 You must sign in to take the ' + (scholarType === 'technical' ? 'Technical' : 'Scholar') + ' Certification.');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    applyScholarProfile();
    if (scholarPassed[scholarType]) {
        showScholarCertificate(scholarType);
        return;
    }

    var modal = document.getElementById('questModal');
    var inner = document.getElementById('questInner');
    if (!modal || !inner) return;

    scholarAnswers = new Array(25).fill(null);
    scholarQuestions = [];
    scholarTimeLeft = 600;
    window._scholarExamId = null;
    window._scholarStartedAtMs = 0;
    inner.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-muted);font-size:0.95rem;">⌛ Preparing your exam…</div>';
    modal.classList.add('open');

    if (typeof firebase === 'undefined' || !firebase.functions) {
        scholarFail(inner, 'Exam system unavailable. Please refresh and try again.');
        return;
    }

    firebase.functions().httpsCallable('startScholarExam')({
        type: scholarType
    }).then(function (res) {
        var data = res && res.data ? res.data : {};
        var questions = data.questions;
        if (!data.examId || !scholarQuestionsOk(questions)) {
            scholarFail(inner, 'Failed to start exam. Please refresh and try again.');
            return;
        }
        window._scholarExamId = data.examId;
        window._scholarStartedAtMs = Number(data.startedAtMs) || Date.now();
        scholarQuestions = questions;
        scholarTimeLeft = scholarVisibleSeconds(window._scholarStartedAtMs, data.resumed === true);
        if (scholarTimeLeft === 0 && data.resumed === true) {
            scholarTimeLeft = 0;
        }
        try {
            var saved = JSON.parse(sessionStorage.getItem(scholarSessionKey()) || 'null');
            if (saved && saved.examId === data.examId && Array.isArray(saved.answers)) {
                for (var i = 0; i < 25; i++) {
                    if (typeof saved.answers[i] === 'string') scholarAnswers[i] = saved.answers[i];
                }
            }
        } catch (e) {}
        var today = new Date().toISOString().split('T')[0];
        try { localStorage.setItem('btc_scholar_' + keyPrefix + '_attempt_date', today); } catch (e) {}
        window._scholarExamActive = true;
        renderScholarQuestion(0);
        startScholarTimer();
    }).catch(function (e) {
        console.warn('Scholar exam start failed:', e);
        var msg = (e && e.message) ? e.message : 'Please try again.';
        scholarFail(inner, msg);
    });
}

function startScholarTimer() {
    if (scholarTimer) clearInterval(scholarTimer);
    scholarTimer = setInterval(function () {
        scholarTimeLeft--;
        var min = Math.floor(Math.max(0, scholarTimeLeft) / 60);
        var sec = Math.max(0, scholarTimeLeft) % 60;
        var timerEl = document.getElementById('scholarTimer');
        if (timerEl) timerEl.textContent = min + ':' + (sec < 10 ? '0' : '') + sec;
        if (scholarTimeLeft <= 0) {
            clearInterval(scholarTimer);
            submitScholarQuest();
        }
    }, 1000);
}

function _injectExamProtection() {
    if (document.getElementById('examProtectStyles')) return;
    var style = document.createElement('style');
    style.id = 'examProtectStyles';
    style.textContent = [
        '#questInner { -webkit-user-select: none; -moz-user-select: none; -ms-user-select: none; user-select: none; }',
        '#questInner h3, #questInner button, #questInner div { -webkit-user-select: none; user-select: none; }',
        '#examScreenGuard { position: fixed; inset: 0; z-index: 99998; pointer-events: none; mix-blend-mode: difference; background: #fff; opacity: 0; transition: opacity 0.1s; }',
        '#examScreenGuard.active { opacity: 1; }',
        '@media print { #questInner { display: none !important; } body::after { content: "Exam content cannot be printed."; display: block; padding: 40px; font-size: 2rem; text-align: center; } }'
    ].join('\n');
    document.head.appendChild(style);
    document.addEventListener('contextmenu', function (e) {
        if (e.target.closest && e.target.closest('#questInner')) e.preventDefault();
    });
    document.addEventListener('copy', function (e) {
        if (e.target.closest && e.target.closest('#questInner')) {
            e.preventDefault();
            if (e.clipboardData) e.clipboardData.setData('text/plain', 'Exam content is protected.');
        }
    });
    document.addEventListener('cut', function (e) {
        if (e.target.closest && e.target.closest('#questInner')) e.preventDefault();
    });
    document.addEventListener('keyup', function (e) {
        if (window._scholarExamActive && (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p'))) {
            e.preventDefault();
            var guard = document.getElementById('examScreenGuard');
            if (guard) {
                guard.classList.add('active');
                setTimeout(function () { guard.classList.remove('active'); }, 600);
            }
            if (typeof showToast === 'function') showToast('📸 Screenshots are disabled during the exam');
        }
    });
    document.addEventListener('visibilitychange', function () {
        if (window._scholarExamActive && document.hidden) {
            window._scholarTabSwitches = (window._scholarTabSwitches || 0) + 1;
            if (window._scholarTabSwitches >= 3 && typeof showToast === 'function') {
                showToast('⚠️ Multiple tab switches detected during exam');
            }
        }
    });
}

function renderScholarQuestion(idx) {
    _injectExamProtection();
    window._scholarExamActive = true;
    window._scholarQuestionIndex = idx;
    if (!document.getElementById('examScreenGuard')) {
        var guard = document.createElement('div');
        guard.id = 'examScreenGuard';
        document.body.appendChild(guard);
    }
    var q = scholarQuestions[idx];
    var inner = document.getElementById('questInner');
    if (!q || !inner) return;
    scholarSaveSession(idx);
    var choices = q.options;
    var min = Math.floor(Math.max(0, scholarTimeLeft) / 60);
    var sec = Math.max(0, scholarTimeLeft) % 60;
    var timeStr = min + ':' + (sec < 10 ? '0' : '') + sec;
    var html = '<div style="padding:20px;">' +
        '<div style="display:flex;justify-content:space-between;margin-bottom:20px;font-weight:bold;color:var(--accent);">' +
            '<span>' + (scholarType === 'technical' ? '🛠️ Protocol Expert' : '🎓 Bitcoin Scholar') + '</span>' +
            '<span id="scholarTimer">' + timeStr + '</span>' +
        '</div>' +
        '<div style="margin-bottom:10px;color:var(--text-muted);font-size:0.8rem;">Question ' + (idx + 1) + ' of 25</div>' +
        '<canvas id="examQCanvas" width="600" height="120" style="width:100%;max-width:600px;height:auto;margin-bottom:20px;"></canvas>' +
        '<div style="display:flex;flex-direction:column;gap:10px;">';
    choices.forEach(function (opt, ci) {
        var selected = scholarAnswers[idx] === opt.id;
        html += '<button data-ci="' + ci + '" onclick="selectScholarAnswer(' + idx + ', ' + ci + ')" style="text-align:left;padding:15px;background:' + (selected ? 'var(--accent)' : 'var(--bg-side)') + ';color:' + (selected ? '#fff' : 'var(--text)') + ';border:1px solid ' + (selected ? 'var(--accent)' : 'var(--border)') + ';border-radius:10px;cursor:pointer;font-family:inherit;font-size:0.95rem;">' + scholarEscape(opt.text) + '</button>';
    });
    html += '</div>' +
        '<div style="margin-top:30px;display:flex;justify-content:space-between;">' +
            '<button onclick="' + (idx === 0 ? 'cancelScholar()' : 'renderScholarQuestion(' + (idx - 1) + ')') + '" style="padding:10px 20px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;">' + (idx === 0 ? 'Exit Quest' : 'Previous') + '</button>' +
            '<button onclick="' + (idx === 24 ? 'submitScholarQuest()' : 'renderScholarQuestion(' + (idx + 1) + ')') + '" style="padding:10px 30px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:bold;cursor:pointer;">' + (idx === 24 ? 'Submit Exam' : 'Next') + '</button>' +
        '</div>' +
    '</div>';
    inner.innerHTML = html;
    var canvas = document.getElementById('examQCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var isDark = document.body.getAttribute('data-theme') !== 'light';
    var textColor = isDark ? '#e2e8f0' : '#1a1a2e';
    var dpr = window.devicePixelRatio || 1;
    var maxW = Math.min(600, inner.clientWidth - 40);
    canvas.style.width = maxW + 'px';
    canvas.width = maxW * dpr;
    ctx.scale(dpr, dpr);
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    var words = String(q.q || '').split(' ');
    var lines = [];
    var currentLine = '';
    for (var wi = 0; wi < words.length; wi++) {
        var testLine = currentLine ? currentLine + ' ' + words[wi] : words[wi];
        if (ctx.measureText(testLine).width > maxW - 10) {
            if (currentLine) lines.push(currentLine);
            currentLine = words[wi];
        } else {
            currentLine = testLine;
        }
    }
    if (currentLine) lines.push(currentLine);
    var lineHeight = 24;
    var totalHeight = lines.length * lineHeight + 10;
    canvas.height = totalHeight * dpr;
    canvas.style.height = totalHeight + 'px';
    ctx.scale(dpr, dpr);
    ctx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    for (var li = 0; li < lines.length; li++) ctx.fillText(lines[li], 0, li * lineHeight + 5);
}

function selectScholarAnswer(idx, choiceIndex) {
    var q = scholarQuestions[idx];
    if (!q || !q.options || !q.options[choiceIndex]) return;
    scholarAnswers[idx] = q.options[choiceIndex].id;
    scholarSaveSession(idx);
    renderScholarQuestion(idx);
}

async function submitScholarQuest() {
    window._scholarExamActive = false;
    var guard = document.getElementById('examScreenGuard');
    if (guard) guard.remove();
    if (scholarTimer) clearInterval(scholarTimer);
    var keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';
    var inner = document.getElementById('questInner');
    if (!window._scholarExamId || typeof firebase === 'undefined' || !firebase.functions) {
        scholarFail(inner, 'Exam system unavailable. Please refresh and try again.');
        return;
    }
    var payload = scholarQuestions.map(function (q, i) {
        return { questionId: q.id, optionId: scholarAnswers[i] || '' };
    });
    var gradeResult;
    try {
        gradeResult = await firebase.functions().httpsCallable('gradeScholarExam')({
            examId: window._scholarExamId,
            answers: payload
        });
    } catch (e) {
        console.error('Server grading failed:', e);
        scholarFail(inner, (e && e.message) ? e.message : 'Grading failed. Please try again.');
        var back = document.createElement('button');
        back.textContent = 'Back to the exam';
        back.style.cssText = 'display:block;margin:12px auto;padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;cursor:pointer;';
        back.addEventListener('click', function () {
            window._scholarExamActive = true;
            renderScholarQuestion(window._scholarQuestionIndex || 0);
            startScholarTimer();
        });
        if (inner) inner.appendChild(back);
        return;
    }
    try { sessionStorage.removeItem(scholarSessionKey()); } catch (e) {}
    // The server grades the exam. A local score is not a pass.
    var data = gradeResult.data || {};
    var score = data.score;
    var passed = data.passed === true;
    var blocked = data.blocked || null;
    var pointsAwarded = data.pointsAwarded || 0;
    var today = new Date().toISOString().split('T')[0];
    try { localStorage.setItem('btc_scholar_' + keyPrefix + '_attempt_date', today); } catch (e) {}
    if (typeof currentUser === 'object' && currentUser) {
        currentUser['lastExamAttempt_' + keyPrefix] = today;
        if (passed || blocked === 'already_certified') currentUser['certPassed_' + keyPrefix] = true;
        applyScholarProfile(currentUser);
    } else {
        scholarAttemptDate[scholarType] = today;
    }
    if (passed && pointsAwarded > 0 && typeof notifySelfPoints === 'function') {
        notifySelfPoints(pointsAwarded, (scholarType === 'technical' ? '🛠️ Protocol Expert' : '🎓 Bitcoin Scholar') + ' Certification Passed!');
    }
    if (passed && data.cert && data.cert.certId) offerCertShare(data.cert);
    var certTitle = scholarType === 'technical' ? 'Protocol Expert' : 'Bitcoin Scholar';
    var headline = passed ? 'Congratulations!' : (blocked === 'already_certified' ? 'Already certified' : 'Not quite there yet');
    var rewardText = '';
    if (passed && pointsAwarded > 0) rewardText = '+' + formatCertXp(pointsAwarded) + ' XP, not limited by the daily cap';
    var detail = passed
        ? ("You've earned the " + certTitle + ' certification.')
        : (blocked === 'already_certified'
            ? 'You already hold this certification. No extra XP was awarded.'
            : 'You needed 20 correct picks to pass. You get one try per day (resets at midnight UTC).');
    var viewCert = passed || blocked === 'already_certified';
    renderScholarGradeResult(inner, {
        passed: passed,
        headline: headline,
        score: score,
        detail: detail,
        rewardText: rewardText,
        buttonLabel: viewCert ? 'View Certificate' : 'Continue Learning',
        onButton: function () {
            closeQuest();
            if (viewCert) showScholarCertificate(scholarType);
            else if (typeof showSettingsPage === 'function') showSettingsPage('scholar');
        }
    });
}

function formatCertXp(amount) {
    var n = Math.max(0, Math.floor(Number(amount) || 0));
    return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function renderScholarGradeResult(inner, view) {
    var src = view || {};
    while (inner.firstChild) inner.removeChild(inner.firstChild);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;padding:40px 20px;';
    var emoji = document.createElement('div');
    emoji.style.cssText = 'font-size:4rem;margin-bottom:20px;';
    emoji.textContent = src.passed ? '🎉' : '📝';
    var heading = document.createElement('h2');
    heading.style.color = 'var(--heading)';
    heading.textContent = src.headline || '';
    var scoreEl = document.createElement('div');
    scoreEl.style.cssText = 'font-size:1.5rem;font-weight:800;margin:15px 0;color:' + (src.passed ? '#22c55e' : '#ef4444') + ';';
    scoreEl.textContent = String(src.score == null ? 0 : src.score) + ' / 25 Correct';
    var detail = document.createElement('p');
    detail.style.cssText = 'color:var(--text-muted);margin-bottom:12px;';
    detail.textContent = src.detail || '';
    wrap.appendChild(emoji);
    wrap.appendChild(heading);
    wrap.appendChild(scoreEl);
    wrap.appendChild(detail);
    if (src.rewardText) {
        var reward = document.createElement('p');
        reward.id = 'certBonusReward';
        reward.style.cssText = 'color:#22c55e;font-weight:800;margin:0 0 30px;';
        reward.textContent = src.rewardText;
        wrap.appendChild(reward);
    }
    var button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'padding:14px 40px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:bold;cursor:pointer;';
    button.textContent = src.buttonLabel || 'Continue';
    button.addEventListener('click', function () {
        if (typeof src.onButton === 'function') src.onButton();
    });
    wrap.appendChild(button);
    inner.appendChild(wrap);
}

function cancelScholar() {
    var confirmed = confirm('Are you sure you want to exit? This counts as your try for the day. You get one try per day (resets at midnight UTC).');
    if (!confirmed) return;
    window._scholarExamActive = false;
    var guard = document.getElementById('examScreenGuard');
    if (guard) guard.remove();
    if (scholarTimer) clearInterval(scholarTimer);
    var keyPrefix = scholarType === 'technical' ? 'tech' : 'prop';
    var today = new Date().toISOString().split('T')[0];
    localStorage.setItem('btc_scholar_' + keyPrefix + '_attempt_date', today);
    scholarAttemptDate[scholarType] = today;
    try { sessionStorage.removeItem(scholarSessionKey()); } catch (e) {}
    document.getElementById('questModal').classList.remove('open');
    if (typeof showSettingsPage === 'function') showSettingsPage('scholar');
}

function scholarCertRequestType(type) {
    return type === 'technical' ? 'technical' : 'scholar';
}

async function requestScholarCertificate(type) {
    if (typeof firebase === 'undefined' || !firebase.functions) throw new Error('Certificate system unavailable.');
    var result = await firebase.functions().httpsCallable('issueCertificate')({
        type: scholarCertRequestType(type)
    });
    var data = result && result.data;
    if (!data || !data.certId) throw new Error('Certificate unavailable.');
    return data;
}

function offerCertShare(record) {
    if (!record || !record.certId) return;
    var title = record.title || 'Certificate';
    var name = record.name || '';
    if (typeof window.showCertShare === 'function') window.showCertShare(record.certId, title, name);
    else window._pendingCertShare = { certId: record.certId, title: title, name: name };
}

function paintQrModules(ctx, rows, x, y, size) {
    if (!rows || !rows.length) return;
    var n = rows.length;
    var cell = size / n;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 6, y - 6, size + 12, size + 12);
    ctx.fillStyle = '#0f172a';
    for (var r = 0; r < n; r++) {
        var line = String(rows[r] || '');
        for (var c = 0; c < n; c++) {
            if (line.charAt(c) === '1') ctx.fillRect(x + c * cell, y + r * cell, cell + 0.4, cell + 0.4);
        }
    }
}

function paintCertificateCanvas(record) {
    var src = record || {};
    var technical = src.type === 'technical' || src.quest === 'protocol-expert';
    var accent = technical ? '#3b82f6' : '#f7931a';
    var canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 850;
    var ctx = canvas.getContext('2d');
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, 1200, 850);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.strokeRect(30, 30, 1140, 790);
    ctx.strokeStyle = technical ? 'rgba(59, 130, 246, 0.3)' : 'rgba(247, 147, 26, 0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(40, 40, 1120, 770);
    [[50, 50], [1150, 50], [50, 800], [1150, 800]].forEach(function (pt) {
        ctx.fillStyle = accent;
        ctx.beginPath();
        ctx.arc(pt[0], pt[1], 6, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(600, 110, 35, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('₿', 600, 124);
    ctx.fillStyle = accent;
    ctx.font = '14px Arial';
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', 600, 180);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 48px Georgia, serif';
    ctx.fillText(src.title || (technical ? 'Bitcoin Protocol Expert' : 'Bitcoin Scholar'), 600, 250);
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(400, 280);
    ctx.lineTo(800, 280);
    ctx.stroke();
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 20px Arial';
    ctx.fillText('is hereby awarded to', 600, 330);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 56px Georgia, serif';
    ctx.fillText(src.name || 'Bitcoiner', 600, 400);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px Arial';
    ctx.fillText('for successfully passing the verified exam', 600, 460);
    if (src.score != null && src.score !== '') ctx.fillText('Score ' + src.score + ' / 25', 600, 492);
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(180, 640); ctx.lineTo(460, 640); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(500, 640); ctx.lineTo(860, 640); ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = '20px Georgia, serif';
    ctx.fillText(src.date || '', 320, 628);
    ctx.font = '16px Georgia, serif';
    ctx.fillText(src.certId || '', 680, 628);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('DATE', 320, 668);
    ctx.fillText('CERTIFICATE ID', 680, 668);
    ctx.font = '14px Arial';
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(src.verifyUrl || '', 560, 760);
    paintQrModules(ctx, src.qr, 980, 560, 140);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'italic 18px Georgia, serif';
    ctx.fillText('Signed, 603BTC LLC', 320, 740);
    ctx.font = '10px Arial';
    ctx.fillStyle = '#334155';
    ctx.fillText('BITCOIN EDUCATION ARCHIVE', 600, 810);
    return canvas;
}
window.paintCertificateCanvas = paintCertificateCanvas;

async function showScholarCertificate(type) {
    scholarType = type || 'properties';
    var modal = document.getElementById('questModal');
    var inner = document.getElementById('questInner');
    if (!modal || !inner) return;
    modal.classList.add('open');
    inner.innerHTML = '<div style="padding:40px 20px;text-align:center;color:var(--text-muted);">Preparing your certificate…</div>';
    var record;
    try {
        record = await requestScholarCertificate(scholarType);
    } catch (e) {
        scholarFail(inner, (e && e.message) ? e.message : 'Certificate unavailable.');
        return;
    }
    window._scholarCertRecord = record;
    var canvas = paintCertificateCanvas(record);
    while (inner.firstChild) inner.removeChild(inner.firstChild);
    var wrap = document.createElement('div');
    wrap.style.cssText = 'text-align:center;padding:24px 16px;';
    var img = document.createElement('img');
    img.id = 'certPreviewImg';
    img.alt = 'Certificate';
    img.src = canvas.toDataURL('image/png');
    img.style.cssText = 'width:100%;max-width:720px;height:auto;border-radius:12px;';
    var note = document.createElement('p');
    note.style.cssText = 'color:var(--text-muted);margin:16px 0;';
    note.textContent = 'The name on this certificate is your username. Anyone can open the verification link.';
    var button = document.createElement('button');
    button.type = 'button';
    button.style.cssText = 'padding:14px 30px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-weight:bold;cursor:pointer;font-family:inherit;';
    button.textContent = 'Download Certificate';
    button.addEventListener('click', function () { downloadCertificate(scholarType); });
    var close = document.createElement('button');
    close.type = 'button';
    close.style.cssText = 'display:block;margin:12px auto 0;padding:10px 20px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;';
    close.textContent = 'Close';
    close.addEventListener('click', function () { if (typeof closeQuest === 'function') closeQuest(); });
    wrap.appendChild(img);
    wrap.appendChild(note);
    wrap.appendChild(button);
    wrap.appendChild(close);
    inner.appendChild(wrap);
}

async function downloadCertificate(type) {
    var record = window._scholarCertRecord;
    try {
        record = await requestScholarCertificate(type || scholarType);
        window._scholarCertRecord = record;
    } catch (e) {
        if (typeof showToast === 'function') showToast((e && e.message) ? e.message : 'Certificate unavailable.');
        return;
    }
    var canvas = paintCertificateCanvas(record);
    var technical = (type || scholarType) === 'technical';
    try {
        var link = document.createElement('a');
        link.download = 'Bitcoin-' + (technical ? 'Technical' : 'Scholar') + '-Certificate.png';
        link.href = canvas.toDataURL('image/png');
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        setTimeout(function () { document.body.removeChild(link); }, 100);
    } catch (e) {
        if (typeof showToast === 'function') showToast('Download blocked. Try again in a moment.');
    }
    offerCertShare(record);
}

// --- FLASHCARDS SYSTEM ---
window.startFlashcards = function(topic) {
    const modal = document.getElementById('questModal');
    const inner = document.getElementById('questInner');
    if (!modal || !inner) return;

    const flashData = {
    'Bitcoin Basics': [
        { q: "What is the total supply cap of Bitcoin?", a: "21 Million. This limit is hardcoded and cannot be changed without near-universal consensus." },
        { q: "Who created Bitcoin?", a: "Satoshi Nakamoto. The pseudonymous creator who published the whitepaper in 2008 and disappeared in 2011." },
        { q: "What is a 'Sat' or 'Satoshi'?", a: "The smallest unit of Bitcoin. 1 Bitcoin = 100,000,000 sats." },
        { q: "What is the Genesis Block?", a: "The very first block in the Bitcoin blockchain, mined by Satoshi on Jan 3, 2009." },
        { q: "What is the block time target?", a: "10 minutes. The difficulty adjustment ensures blocks are found at this average interval regardless of hash rate." },
        { q: "What is a Halving?", a: "An event every 4 years (210,000 blocks) where the reward for mining new blocks is cut in half." },
        { q: "What is the current block reward?", a: "3.125 BTC (as of the 2024 halving). It started at 50 BTC in 2009." },
        { q: "What is a transaction fee?", a: "Sats paid to miners to prioritize your transaction in the next block. It is based on transaction size, not amount." },
        { q: "What is a block?", a: "A container for transactions. In Bitcoin, blocks are linked cryptographically into a chain." },
        { q: "What is the mempool?", a: "A 'waiting room' for unconfirmed transactions before a miner picks them up for a block." }
    ],
    'Security & Storage': [
        { q: "What is a seed phrase?", a: "A list of 12 or 24 words that serves as the master key to your entire wallet. Never share it!" },
        { q: "What is the golden rule of custody?", a: "\"Not your keys, not your coins.\" If you don't hold the private keys, you don't truly own the money." },
        { q: "What is a hardware wallet?", a: "A physical device that keeps your private keys offline, protecting them from hackers and malware." },
        { q: "What is 2FA?", a: "Two-Factor Authentication. An extra layer of security beyond just your password, though not a replacement for self-custody." },
        { q: "What is a passphrase?", a: "An optional '13th' or '25th' word added to a seed phrase. It creates a completely different wallet from the same seed." },
        { q: "What is an Air-gapped wallet?", a: "A device that never connects to the internet. Transactions are moved via QR codes or microSD cards." },
        { q: "What is Multi-sig?", a: "A setup requiring multiple keys to authorize a spend (e.g., 2-of-3). It eliminates single points of failure." },
        { q: "What is a cold wallet?", a: "Any wallet where the private keys were generated and are stored offline." },
        { q: "What is a hot wallet?", a: "A wallet connected to the internet, like a phone app or exchange account. Higher risk for long-term storage." },
        { q: "What is key derivation?", a: "The process of generating unlimited addresses from a single seed phrase using a mathematical standard (BIP 32)." }
    ],
    'Lightning Network': [
        { q: "What is the Lightning Network?", a: "A 'Layer 2' scaling solution for Bitcoin that allows for instant, near-free micro-payments." },
        { q: "What is a payment channel?", a: "A direct link between two users on the Lightning Network where they can transact instantly off-chain." },
        { q: "What is an HTLC?", a: "Hashed Time-Locked Contract. A smart contract that ensures payments are either delivered or returned safely." },
        { q: "What is Inbound Liquidity?", a: "The ability to receive payments on Lightning. Someone else must have a channel balanced toward you." },
        { q: "What is a sat/byte?", a: "A measure of the fee density you pay to miners for on-chain settlement." },
        { q: "What is a Lightning invoice?", a: "A one-time-use request for payment on the Lightning Network, usually a QR code." },
        { q: "What is a BOLT?", a: "Basics of Lightning Technology. These are the technical specifications (BIP-equivalent) for the Lightning Network." },
        { q: "What is a Watchtower?", a: "A service that monitors the blockchain to prevent channel partners from attempting to cheat while you are offline." },
        { q: "What is routing?", a: "The process of moving a payment through multiple nodes to reach a recipient you don't have a direct channel with." },
        { q: "What is LNURL?", a: "A protocol that makes Lightning more user-friendly, supporting static QR codes and withdrawal links." }
    ],
    'Mining & Energy': [
        { q: "What is Bitcoin mining?", a: "The process where computers compete to find blocks, securing the network and earning rewards." },
        { q: "What is Proof of Work?", a: "The consensus mechanism that requires miners to spend real-world energy to secure the network." },
        { q: "What is the Hash Rate?", a: "A measure of the total computational power being used to secure the Bitcoin network at any given time." },
        { q: "How often are new blocks found?", a: "On average, every 10 minutes. The difficulty adjustment ensures this remains consistent." },
        { q: "What is an ASIC?", a: "Application-Specific Integrated Circuit. Specialized hardware designed solely for mining Bitcoin efficiently." },
        { q: "What is a mining pool?", a: "A group of miners who share their hash power and split the rewards based on their contribution." },
        { q: "What is the block subsidy?", a: "The fixed amount of new Bitcoin created in each block. It is currently 3.125 BTC." },
        { q: "What is Stranded Energy?", a: "Energy produced in remote locations with no local buyers (like hydro or flare gas). Bitcoin miners capture this wasted value." },
        { q: "What is the Difficulty Adjustment?", a: "A rule every 2016 blocks (~2 weeks) that recalibrates how hard it is to mine to maintain the 10-minute target." },
        { q: "Is mining solving 'complex math puzzles'?", a: "No. It is a brute-force lottery of guessing random numbers (nonces) until a valid hash is found." }
    ],
    'Economics & Money': [
        { q: "What is Sound Money?", a: "Money that cannot be easily debased or manipulated by any authority. It must be scarce and durable." },
        { q: "What is Fiat money?", a: "Currency backed only by government decree, with no physical backing and an unlimited supply." },
        { q: "What is Time Preference?", a: "The ratio at which you value present goods over future goods. Bitcoin encourages lower time preference (saving)." },
        { q: "What is the Stock-to-Flow ratio?", a: "A measure of scarcity: existing supply divided by current annual production." },
        { q: "What is the Cantillon Effect?", a: "The phenomenon where those closest to money printing benefit first, while others suffer from rising prices later." },
        { q: "What is Hyper-bitcoinization?", a: "The theoretical process where Bitcoin becomes the world's dominant form of money and unit of account." },
        { q: "What is an inflationary currency?", a: "Currency that loses purchasing power over time because the supply is constantly increasing." },
        { q: "What is a Store of Value?", a: "An asset that can be saved, retrieved, and exchanged in the future without losing significant value." },
        { q: "What is the 'Double Coincidence of Wants'?", a: "The problem in barter where two people must want exactly what the other has. Money solves this as an intermediary." },
        { q: "What is Gresham's Law?", a: "The observation that 'bad money drives out good.' People spend devaluing fiat and hoard scarce Bitcoin." }
    ],
    'History & Culture': [
        { q: "What was the first real-world Bitcoin purchase?", a: "Two pizzas for 10,000 BTC in 2010—now celebrated every May 22nd as Bitcoin Pizza Day." },
        { q: "Who is Hal Finney?", a: "A legendary cryptographer, the first person to receive a transaction from Satoshi, and author of the first Bitcoin tweet." },
        { q: "What is 'HODL'?", a: "A misspelling of 'hold' that became a mantra for long-term conviction during volatile market cycles." },
        { q: "What is the Whitepaper?", a: "The original 9-page document by Satoshi Nakamoto that first described how Bitcoin works." },
        { q: "What were the 'Blocksize Wars'?", a: "A 2015-2017 battle where users successfully fought to keep Bitcoin decentralized against corporate big-block interests." },
        { q: "What is a Cypherpunk?", a: "A member of the movement that believes privacy and individual liberty can be protected through cryptography." },
        { q: "What is the message in the Genesis Block?", a: "\"The Times 03/Jan/2009 Chancellor on brink of second bailout for banks.\"" },
        { q: "Who is Adam Back?", a: "The inventor of Hashcash (Bitcoin's PoW ancestor) and a prominent Bitcoin developer." },
        { q: "What is a 'Pleb'?", a: "A term used by Bitcoiners to describe everyday, committed users who are not part of the elite financial class." },
        { q: "What is the 'Orange Pill'?", a: "A reference to The Matrix, describing the moment someone truly understands why Bitcoin is necessary." }
    ],
    'Privacy & Sovereignty': [
        { q: "What is a CoinJoin?", a: "A collaborative transaction that mixes Bitcoin from multiple users to break the link between inputs and outputs." },
        { q: "What is KYC?", a: "Know Your Customer. Regulations that force exchanges to collect your ID, linking your identity to your coins." },
        { q: "Why use a VPN or Tor?", a: "To hide your IP address from nodes and trackers, protecting your physical location from being linked to your wallet." },
        { q: "What is a PayJoin?", a: "A privacy technique where a sender and receiver both contribute inputs, defeating common chain analysis heuristics." },
        { q: "What is a 'Dusting Attack'?", a: "Tiny amounts of BTC sent to addresses to track the owner's movement and attempt deanonymization." },
        { q: "What is an xpub?", a: "An Extended Public Key. It allows a wallet to generate all your future addresses for viewing, but has no spending power." },
        { q: "What is a change address?", a: "An address used to receive the leftover Bitcoin from a transaction you sent. Good wallets use a new one every time." },
        { q: "What is self-sovereignty?", a: "Having absolute control over your own property and data without depending on any third party or institution." },
        { q: "What is a Non-KYC Bitcoin?", a: "Bitcoin acquired through P2P markets, mining, or trade without ever providing a government identity." },
        { q: "Is Bitcoin 'anonymous'?", a: "No. It is pseudonymous. Every transaction is public on the ledger, but not necessarily linked to a name." }
    ],
    'Nodes & P2P': [
        { q: "What is a full node?", a: "A computer that stores the entire blockchain and independently verifies every single transaction and rule." },
        { q: "Why run your own node?", a: "To enforce the rules of the network for yourself and ensure you aren't being lied to by a third party." },
        { q: "What is Initial Block Download (IBD)?", a: "The process where a new node downloads and validates the entire history of Bitcoin from block zero." },
        { q: "What is a pruned node?", a: "A node that validates the full chain but deletes old block data to save disk space, keeping only the most recent blocks." },
        { q: "How many nodes are on the Bitcoin network?", a: "Estimated between 15,000 and 50,000 publicly reachable nodes, and many more private ones." },
        { q: "What is a peer-to-peer network?", a: "A network where participants communicate directly with each other without a central server." },
        { q: "What is BIP 324?", a: "A protocol upgrade that provides encryption between Bitcoin nodes to prevent ISP surveillance." },
        { q: "What is an Inventory (inv) message?", a: "A P2P message used by nodes to tell their peers about new blocks or transactions they've seen." },
        { q: "Does a miner need a node?", a: "Yes. Every miner needs a node to construct block templates and listen for the latest chain updates." },
        { q: "What is the 'Nakamoto Consensus'?", a: "The combination of Proof-of-Work and the 'Longest Chain Rule' to achieve global agreement on history." }
    ],
    'Wallets & Tools': [
        { q: "What is a Coldcard?", a: "A security-focused, air-gapped hardware signer that uses a microSD card to sign transactions. ⚠️ Note: In August 2026, a critical bug in Coldcard's code led to the loss of thousands of Bitcoin. Always verify firmware and be cautious with closed-source products from Coinkite. Don't trust — verify." },
        { q: "What is Sparrow Wallet?", a: "A professional-grade Bitcoin desktop wallet optimized for UTXO management and node connectivity." },
        { q: "What is a Block Explorer?", a: "A website (like Mempool.space) that allows you to view transactions, blocks, and network statistics." },
        { q: "What is a seed plate?", a: "A piece of stainless steel or titanium used to engrave your seed phrase for permanent, fireproof backup." },
        { q: "What is a multisig 'Vault'?", a: "A high-security setup using separate devices (e.g., Coldcard + Trezor) to protect large amounts of Bitcoin." },
        { q: "What is a BIP?", a: "Bitcoin Improvement Proposal. A formal document used to propose and discuss changes to the Bitcoin protocol." },
        { q: "What is a hardware signer?", a: "A term often used for hardware wallets to emphasize that they ONLY sign transactions and do not actually 'store' coins." },
        { q: "What is a watch-only wallet?", a: "A wallet (often on a phone) that tracks your balance and addresses but cannot spend because it has no private keys." },
        { q: "What is an LNURL-withdraw?", a: "A QR code that, when scanned, triggers a node to send Lightning sats to the person who scanned it." },
        { q: "What is MuSig2?", a: "A standard for creating aggregated Schnorr signatures, improving the privacy and efficiency of multisig." }
    ],
    'Austrian Economics': [
        { q: "Who is Ludwig von Mises?", a: "A famous Austrian economist who wrote 'Human Action' and theorized that markets are processes, not static models." },
        { q: "What is the Regression Theorem?", a: "Mises' theory that a medium of exchange must have had value as a non-monetary commodity first (challenged by Bitcoin)." },
        { q: "What is Sound Money according to Hayek?", a: "Money that is subject to market competition rather than state monopoly, as argued in 'The Denationalization of Money'." },
        { q: "What is inflation in the Austrian view?", a: "An increase in the total supply of money, not just an increase in prices." },
        { q: "Why is decentralized market pricing important?", a: "It provides the 'knowledge bits' necessary for entrepreneurs to calculate and allocate resources efficiently." },
        { q: "What is malinvestment?", a: "Poor allocation of capital caused by artificially low interest rates and money printing, leading to economic bubbles." },
        { q: "What is 'Hard Money'?", a: "Money with an supply that is difficult to increase, like gold or Bitcoin. It preserves purchasing power over time." },
        { q: "What is the 'Subjective Theory of Value'?", a: "The economic principle that the value of a good is not inherent, but assigned by individuals based on their needs." },
        { q: "How does Bitcoin encourage savings?", a: "By being non-inflationary, users know their money will likely buy more in the future, rewarding patience." },
        { q: "What is 'Sound Money'?", a: "Money that has its value determined by the market, free from government or central bank manipulation." }
    ],
    'Cypherpunk History': [
        { q: "What is the Cypherpunk Manifesto?", a: "A 1993 document by Eric Hughes stating that 'Privacy is necessary for an open society in the electronic age'." },
        { q: "Who is David Chaum?", a: "A cryptography pioneer who created E-cash in the 1980s, the first attempt at private digital money." },
        { q: "What was 'Bit Gold'?", a: "A 1998 proposal by Nick Szabo that featured Proof-of-Work and fixed supply, very similar to Bitcoin." },
        { q: "Who were the 'Cypherpunks'?", a: "A group of activists and programmers who advocated for social change through cryptography and privacy-enhancing tech." },
        { q: "What was 'B-money'?", a: "A 1998 proposal by Wei Dai for an anonymous, distributed electronic cash system cited in the Bitcoin whitepaper." },
        { q: "What happened in the 90s 'Crypto Wars'?", a: "A battle between the US government and privacy advocates over whether civilian use of strong encryption should be legal." },
        { q: "Who is Julian Assange?", a: "A cypherpunk and founder of WikiLeaks who used Bitcoin early on when banks blocked their donations." },
        { q: "What is 'Cypherspace'?", a: "The theoretical realm where individuals can interact and transact with absolute privacy using cryptography." },
        { q: "Was the Bitcoin whitepaper published on a blog?", a: "No. It was posted to the Cryptography Mailing List on Halloween, 2008." },
        { q: "What is PGP?", a: "Pretty Good Privacy. An early encryption program that started a major legal battle for digital freedom." }
    ],
    'Bitcoin Governance': [
        { q: "Who controls Bitcoin's rules?", a: "The users. By running their own nodes, individuals decide which rules they will follow." },
        { q: "What is a soft fork?", a: "A backward-compatible protocol upgrade where old nodes still consider new blocks valid." },
        { q: "What is a hard fork?", a: "A protocol change that is not backward-compatible. Nodes that don't upgrade will split onto a different chain." },
        { q: "What is rough consensus?", a: "The process of moving forward with changes only when a massive majority of the community agrees." },
        { q: "What is a BIP?", a: "Bitcoin Improvement Proposal. A formal document for suggesting and discussing protocol changes." },
        { q: "What was BIP 148?", a: "The User-Activated Soft Fork (UASF) that forced the activation of SegWit in 2017." },
        { q: "Do developers have 'admin access' to Bitcoin?", a: "No. They can write code, but they cannot force anyone to run it. Every node operator chooses their own software." },
        { q: "What is the 'No2X' movement?", a: "The community campaign that successfully rejected a corporate attempt to hard-fork Bitcoin in 2017." },
        { q: "How is a BIP activated?", a: "Usually through a period of miner signaling or a specific block height trigger once consensus is reached." },
        { q: "Is Bitcoin a democracy?", a: "No. It is more like a voluntary system of rules. You choose the rules you follow by choosing your node software." }
    ],
    'Satoshi Nakamoto': [
        { q: "When did Satoshi vanish?", a: "His last known private email was in April 2011, saying he had 'moved on to other things'." },
        { q: "Why did Satoshi disappear?", a: "Likely to ensure Bitcoin had no 'head' to be attacked or co-opted, making it truly decentralized." },
        { q: "How much Bitcoin did Satoshi mine?", a: "Estimated at around 1.1 million BTC, all of which has never been moved from its original addresses." },
        { q: "Did Satoshi invent everything?", a: "No. He masterfully combined existing technologies like Hashcash, B-money, and public-key cryptography into a working system." },
        { q: "What was Satoshi's P2P Foundation quote?", a: "\"The root problem with conventional currency is all the trust that's required to make it work.\"" },
        { q: "What email provider did Satoshi use?", a: "gmx.com (satoshi@gmx.com)." },
        { q: "Where was the Bitcoin whitepaper published?", a: "A cryptography mailing list at metzdowd.com." },
        { q: "Who mined the Genesis Block?", a: "Satoshi Nakamoto. He included a headline from the London Times in the coinsbase." },
        { q: "Did Satoshi use a Japanese name?", a: "Yes, but many believe his writing style suggests he was likely a native English speaker." },
        { q: "Is Satoshi a group of people?", a: "It is possible. The identity remains one of the greatest mysteries of the digital age." }
    ],
    'Common Myths': [
        { q: "Is Bitcoin 'Too slow' for payments?", a: "No. The base layer is for settlement; the Lightning Network allows for millions of instant transactions per second." },
        { q: "Can Bitcoin be hacked?", a: "The protocol itself has never been successfully hacked. Individual wallets or exchanges are hacked due to poor security." },
        { q: "Does Bitcoin 'waste' electricity?", a: "No. It uses energy to secure a global, neutral financial system, often using energy that would otherwise be wasted." },
        { q: "Is Bitcoin 'only for criminals'?", a: "False. Cash is the preferred tool for crime. Bitcoin's transparent ledger is actually a nightmare for criminals." },
        { q: "Is Bitcoin 'backed by nothing'?", a: "It is backed by the most secure computer network on Earth, the laws of physics, and mathematical proof." },
        { q: "Will the 21 million limit be changed?", a: "No rational participant would vote to devalue their own holdings. Scarcity is Bitcoin's value." },
        { q: "Is Bitcoin a bubble?", a: "A bubble is a temporary spike; Bitcoin has grown in value and adoption over 15 years, surviving many 80% drops." },
        { q: "Is Bitcoin bad for the environment?", a: "Bitcoin mining incentivizes renewable energy builds and captures methane gas, which is many times worse than CO2." },
        { q: "Can Bitcoin be shut down by the government?", a: "No. It is a decentralized protocol. As long as two people can communicate, the network exists." },
        { q: "Are altcoins 'the next Bitcoin'?", a: "None have achieved Bitcoin's level of security, decentralization, or fair distribution. There is no second best." }
    ],
    'Global Impact': [
        { q: "What is the unbanked population?", a: "Billions of people worldwide who lack access to traditional financial services. Bitcoin provides them a bank in their pocket." },
        { q: "How does Bitcoin aid remittances?", a: "By allowing workers to send money home instantly and for nearly zero cost, bypassing expensive middlemen like Western Union." },
        { q: "What is monetary colonialism?", a: "The control of a nation's currency by a foreign power (e.g., the CFA franc). Bitcoin offers an escape to monetary sovereignty." },
        { q: "Why is Bitcoin important for human rights?", a: "It provides a censorship-resistant tool for activists and journalists under authoritarian regimes to receive funding." },
        { q: "What is an 'Orange Party'?", a: "A community gathering focused on Bitcoin education and circular economy adoption." },
        { q: "What is legal tender?", a: "Currency that must be accepted for debts and payments. El Salvador was the first to make Bitcoin legal tender." },
        { q: "How does Bitcoin promote peace?", a: "By making it harder for governments to fund wars through hidden taxation (inflation) since they cannot print Bitcoin." },
        { q: "What is a circular economy?", a: "An ecosystem where people earn, save, and spend Bitcoin directly without ever converting back to fiat." },
        { q: "Can Bitcoin help the environment?", a: "Yes, by providing an incentive to develop renewable energy near remote sources and reducing methane flaring." },
        { q: "What is the 'Great Definancialization'?", a: "The process of moving away from complex, debt-based financial instruments back to a simple, hard money standard." }
    ],
    'El Salvador & Adoption': [
        { q: "When did El Salvador adopt Bitcoin as legal tender?", a: "September 7, 2021 — the first country in the world to do so under President Nayib Bukele." },
        { q: "What is the Chivo Wallet?", a: "El Salvador's government-issued Bitcoin wallet. Each citizen who downloaded it received $30 in BTC." },
        { q: "What is Bitcoin Beach?", a: "A community in El Zonte, El Salvador that became a circular Bitcoin economy before the national adoption." },
        { q: "How does Bitcoin help El Salvador's remittances?", a: "70% of Salvadorans receive remittances. Bitcoin cuts transfer fees from 10-30% to nearly zero." },
        { q: "Did El Salvador buy Bitcoin?", a: "Yes. The government has been buying BTC regularly, holding over 5,000 BTC in its national treasury." },
        { q: "What is Bitcoin City?", a: "A planned city at the base of Conchagua volcano, powered by geothermal energy and funded by Bitcoin bonds." },
        { q: "What is the 'Volcano Bond'?", a: "A $1 billion government bond (half invested in BTC, half for Bitcoin City infrastructure) backed by Bitcoin." },
        { q: "Which other countries are considering Bitcoin?", a: "Bhutan mines BTC with hydropower, the Central African Republic adopted it, and several nations are exploring it." },
        { q: "What is a Bitcoin ATM?", a: "A physical machine where you can buy or sell Bitcoin with cash. El Salvador deployed 200+ nationwide." },
        { q: "What is 'Mi Primer Bitcoin'?", a: "A Salvadoran nonprofit providing free Bitcoin education to public school students — now expanding globally." }
    ],
    'Technical Deep Dives': [
        { q: "What is SHA-256?", a: "The cryptographic hash function that Bitcoin uses. It takes any input and produces a unique, fixed 256-bit output." },
        { q: "What is a Merkle Tree?", a: "A binary tree of transaction hashes used to efficiently summarize all transactions in a block." },
        { q: "What is a nonce?", a: "A random number miners change to produce a hash below the target. It's the 'guess' in the mining lottery." },
        { q: "What is SegWit?", a: "Segregated Witness. A 2017 upgrade that separates signature data from transaction data, increasing capacity." },
        { q: "What is Taproot?", a: "A 2021 upgrade enabling Schnorr signatures and MAST, improving privacy and efficiency of complex transactions." },
        { q: "What is a UTXO?", a: "Unspent Transaction Output. Bitcoin doesn't use 'accounts' — it tracks individual coins (UTXOs) you can spend." },
        { q: "What is Script?", a: "Bitcoin's simple programming language used to define spending conditions for each UTXO." },
        { q: "What is the target?", a: "A 256-bit number. To mine a valid block, the block header hash must be numerically less than this target." },
        { q: "What is an OP_CODE?", a: "An operation in Bitcoin's Script language. Examples: OP_CHECKSIG (verify signature), OP_RETURN (store data)." },
        { q: "What is a Compact Block?", a: "A bandwidth optimization (BIP 152) where nodes send only short transaction IDs instead of full blocks." }
    ]
};


    const cards = flashData[topic] || flashData['Bitcoin Basics'];
    let index = 0;
    let isFlipped = false;

    const renderCard = () => {
        inner.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;padding:10px;height:100%;min-height:400px;justify-content:center;">
            <div style="width:100%;display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;">
                <button id="closeFlash" style="background:none;border:none;color:var(--text-muted);font-size:1rem;cursor:pointer;padding:8px;font-family:inherit;">✕</button>
                <div style="font-size:0.8rem;color:var(--accent);text-transform:uppercase;letter-spacing:1px;font-weight:700;">${topic}</div>
                <div style="color:var(--text-faint);font-weight:700;font-size:0.8rem;">${index + 1} / ${cards.length}</div>
            </div>

            <div id="cardFlip" style="perspective:1000px;width:100%;max-width:350px;height:240px;cursor:pointer;margin-bottom:30px;">
                <div id="cardInner" style="position:relative;width:100%;height:100%;transition:transform 0.6s;transform-style:preserve-3d;">
                    <!-- Front -->
                    <div style="position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:var(--card-bg);border:2px solid var(--border);border-radius:24px;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;box-shadow:0 8px 32px rgba(0,0,0,0.2);">
                        <div>
                            <div style="font-size:3rem;margin-bottom:12px;opacity:0.3;">❓</div>
                            <div style="color:var(--heading);font-weight:700;font-size:1.15rem;line-height:1.4;">${cards[index].q}</div>
                        </div>
                        <div style="position:absolute;bottom:15px;color:var(--accent);font-size:0.75rem;font-weight:800;letter-spacing:1px;">TAP TO REVEAL ↺</div>
                    </div>
                    <!-- Back -->
                    <div style="position:absolute;width:100%;height:100%;backface-visibility:hidden;-webkit-backface-visibility:hidden;background:linear-gradient(135deg, var(--bg-side), var(--card-bg));border:2px solid var(--accent);border-radius:24px;display:flex;align-items:center;justify-content:center;padding:30px;text-align:center;transform:rotateY(180deg);box-shadow:0 8px 32px rgba(247,147,26,0.15);">
                        <div>
                            <div style="font-size:2rem;margin-bottom:12px;">🦌</div>
                            <div style="color:var(--text);font-size:1rem;line-height:1.6;font-weight:500;">${cards[index].a}</div>
                        </div>
                        <div style="position:absolute;bottom:15px;color:var(--accent);font-size:0.75rem;font-weight:800;letter-spacing:1px;">GOT IT! 🎯</div>
                    </div>
                </div>
            </div>

            <div style="display:flex;gap:12px;width:100%;max-width:350px;">
                <button id="prevBtn" style="flex:1;padding:16px;background:var(--bg-side);border:1px solid var(--border);border-radius:14px;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;${index === 0 ? 'opacity:0.3;pointer-events:none;' : ''}">PREV</button>
                <button id="nextBtn" style="flex:2;padding:16px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(247,147,26,0.3);">${index === cards.length - 1 ? 'FINISH ✓' : 'NEXT'}</button>
            </div>
        </div>`;

        document.getElementById('closeFlash').onclick = () => { modal.classList.remove('open'); };
        document.getElementById('cardFlip').onclick = () => {
            isFlipped = !isFlipped;
            document.getElementById('cardInner').style.transform = isFlipped ? 'rotateY(180deg)' : 'none';
        };
        document.getElementById('nextBtn').onclick = () => {
            if (index === cards.length - 1) {
                inner.innerHTML = `<div style="text-align:center;padding:50px 20px;">
                    <div style="font-size:5rem;margin-bottom:20px;">🎓</div>
                    <h2 style="color:var(--heading);margin-bottom:10px;">Great job, ${typeof nachoUserName === 'function' ? nachoUserName() : 'Scholar'}!</h2>
                    <p style="color:var(--text-muted);margin-bottom:30px;">You've mastered the <strong>${topic}</strong> deck.</p>
                    <button id="finishDeck" style="padding:16px 40px;background:var(--accent);color:#fff;border:none;border-radius:14px;font-weight:800;font-size:1rem;cursor:pointer;font-family:inherit;box-shadow:0 6px 16px rgba(247,147,26,0.3);">Back to Scholar Tab</button>
                </div>`;
                document.getElementById('finishDeck').onclick = () => {
                    var _fcKey = 'btc_fc_done_' + topic.replace(/\s+/g,'_') + '_' + new Date().toISOString().split('T')[0];
                    if (!localStorage.getItem(_fcKey)) {
                        localStorage.setItem(_fcKey, '1');
                        if (typeof awardPoints === 'function') awardPoints(15, '📚 Completed ' + topic + ' deck');
                        if (typeof awardTickets === 'function') awardTickets(5, 'Flashcard deck complete');
                        // Raid Boss: flashcard completion
                        if (typeof window._raidOnFlashcardComplete === 'function') window._raidOnFlashcardComplete(topic);
                        if (typeof window._raidOnXPEarned === 'function') window._raidOnXPEarned(15);
                    } else {
                        if (typeof showToast === 'function') showToast('📚 Already completed this deck today!');
                    }
                    sessionStorage.setItem('_ch_flashcard', '1');
                    closeQuest(); 
                    if (typeof showSettingsPage === 'function') showSettingsPage('scholar'); 
                };
            } else {
                index++;
                isFlipped = false;
                renderCard();
            }
        };
        document.getElementById('prevBtn').onclick = () => {
            if (index > 0) {
                index--;
                isFlipped = false;
                renderCard();
            }
        };
    };

    renderCard();
    modal.classList.add('open');
};


// ---- OPENCLAW EXPORTS ----
if (typeof startScholarQuest !== "undefined") window.startScholarQuest = startScholarQuest;
if (typeof startFlashcards !== "undefined") window.startFlashcards = startFlashcards;