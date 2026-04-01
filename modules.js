// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// 🦌 Nacho's Trails — Guided Learning Modules
// The Meadow (Intro) → The Mountain (Intermediate) → The Summit (Advanced)
// =============================================

(function() {
'use strict';

var MODULES = [
    {
        id: 'meadow',
        name: 'The Meadow',
        emoji: '🌿',
        subtitle: 'Where every Bitcoiner begins',
        desc: 'Learn the fundamentals: what Bitcoin is, why it matters, and what makes it different from everything before it.',
        color: '#22c55e',
        passingScore: 80,
        questionsNeeded: 25,
        pointsReward: 200,
        ticketReward: 25,
        badgeId: 'trail_meadow',
        badgeName: '🌿 Meadow Walker',
        channels: [
            { id: 'one-stop-shop', name: 'One-Stop Shop', why: 'The big picture — everything you need in one place' },
            { id: 'whitepaper', name: 'Whitepaper', why: 'The 9 pages that started it all' },
            { id: 'money', name: 'Money', why: 'What money actually IS and why Bitcoin does it better' },
            { id: 'scarce', name: 'Scarce', why: 'Why 21 million matters — the scarcest asset ever created' },
            { id: 'decentralized', name: 'Decentralized', why: 'No CEO, no company, no single point of failure' },
            { id: 'secure', name: 'Secure', why: 'Protected by more computing power than anything on Earth' },
            { id: 'use-cases', name: 'Use Cases', why: 'Real-world uses: savings, payments, remittances, and more' },
        ]
    },
    {
        id: 'mountain',
        name: 'The Mountain',
        emoji: '⛰️',
        subtitle: 'The climb gets real',
        desc: 'Go deeper: mining, Lightning, self-custody, privacy, and the broken system Bitcoin is replacing.',
        color: '#f97316',
        passingScore: 80,
        questionsNeeded: 25,
        pointsReward: 400,
        ticketReward: 50,
        badgeId: 'trail_mountain',
        badgeName: '⛰️ Mountain Climber',
        requires: 'meadow',
        channels: [
            { id: 'mining', name: 'Mining', why: 'How SHA-256 hashing secures the network' },
            { id: 'layer-2-lightning', name: 'Lightning Network', why: 'Instant, nearly-free payments at scale' },
            { id: 'self-custody', name: 'Self Custody', why: 'Not your keys, not your coins' },
            { id: 'problems-of-money', name: 'Problems of Money', why: 'The broken fiat system Bitcoin is fixing' },
            { id: 'investment-strategy', name: 'Investment Strategy', why: 'DCA, HODL, and thinking long-term' },
            { id: 'blockchain-timechain', name: 'Blockchain & Timechain', why: 'How the immutable ledger works' },
            { id: 'privacy-nonkyc', name: 'Privacy & KYC', why: 'Financial privacy as a human right' },
            { id: 'energy', name: 'Energy', why: 'The truth about Bitcoin and energy' },
        ]
    },
    {
        id: 'summit',
        name: 'The Summit',
        emoji: '🏔️',
        subtitle: 'Only for the committed',
        desc: 'Master-level topics: cryptography, nodes, proof of work, protocol upgrades, and the maximalist case.',
        color: '#a855f7',
        passingScore: 80,
        questionsNeeded: 25,
        pointsReward: 750,
        ticketReward: 100,
        badgeId: 'trail_summit',
        badgeName: '🏔️ Summit Conqueror',
        requires: 'mountain',
        channels: [
            { id: 'cryptography', name: 'Cryptography', why: 'SHA-256, elliptic curves, and the cypherpunk legacy' },
            { id: 'nodes', name: 'Nodes', why: 'Don\'t trust, verify — run your own node' },
            { id: 'pow-vs-pos', name: 'Proof of Work vs Stake', why: 'Why PoW is fundamentally superior' },
            { id: 'difficulty-adjustment', name: 'Difficulty Adjustment', why: 'The most elegant part of Bitcoin\'s design' },
            { id: 'taproot', name: 'Taproot', why: 'Schnorr signatures and protocol upgrades' },
            { id: 'maximalism', name: 'Maximalism', why: 'The case for Bitcoin-only' },
            { id: 'evidence-against-alts', name: 'Evidence Against Alts', why: 'Why every altcoin fails' },
            { id: 'core-source-code', name: 'Core Source Code', why: 'Bitcoin Core development and forks' },
        ]
    }
];

var STORAGE_KEY = 'btc_trail_progress';
var STORAGE_PASSED = 'btc_trail_passed';

function getProgress() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); } catch(e) { return {}; }
}
function saveProgress(p) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
    // Sync to Firestore
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ trailProgress: p }).catch(function(){});
    }
}
function getPassed() {
    try { return JSON.parse(localStorage.getItem(STORAGE_PASSED) || '[]'); } catch(e) { return []; }
}
function savePassed(arr) {
    localStorage.setItem(STORAGE_PASSED, JSON.stringify(arr));
    if (typeof db !== 'undefined' && typeof auth !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ trailsPassed: arr }).catch(function(){});
    }
}

// Mark a channel as visited for a module
function markChannelVisited(channelId) {
    var progress = getProgress();
    MODULES.forEach(function(mod) {
        mod.channels.forEach(function(ch) {
            if (ch.id === channelId) {
                if (!progress[mod.id]) progress[mod.id] = [];
                if (progress[mod.id].indexOf(channelId) === -1) {
                    progress[mod.id].push(channelId);
                    saveProgress(progress);
                }
            }
        });
    });
}

// Hook into go() to track visits
var _origGoForModules = window.go;
if (_origGoForModules) {
    var _realGoMod = window.go;
    window.go = async function(id) {
        var result = await _realGoMod.apply(this, arguments);
        if (id) markChannelVisited(id);
        return result;
    };
}

function getModuleStatus(mod) {
    var progress = getProgress();
    var passed = getPassed();
    var visited = progress[mod.id] || [];
    var totalChannels = mod.channels.length;
    var visitedCount = mod.channels.filter(function(ch) { return visited.indexOf(ch.id) !== -1; }).length;
    var isComplete = visitedCount >= totalChannels;
    var isPassed = passed.indexOf(mod.id) !== -1;
    var isLocked = mod.requires && passed.indexOf(mod.requires) === -1;
    return { visited: visited, visitedCount: visitedCount, totalChannels: totalChannels, isComplete: isComplete, isPassed: isPassed, isLocked: isLocked };
}

// ---- RENDER MODULE HUB ----
window.renderModules = function(container) {
    var fc = container || document.getElementById('forumContainer');
    if (!fc) return;

    var html = '<div onclick="if(event.target===this)goHome()" style="min-height:100vh;padding:20px 0;cursor:default;">' +
        '<div style="max-width:600px;margin:0 auto;padding:20px 16px 120px;cursor:auto;" onclick="event.stopPropagation()">';

    // Header
    html += '<div style="text-align:center;margin-bottom:24px;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div onclick="goHome()" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--text-muted);font-size:0.8rem;">← Back to Archive</div>' +
        '<div style="font-size:2.5rem;margin-bottom:6px;">🦌🗺️</div>' +
        '<h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0 0 4px;">Nacho\'s Trails</h2>' +
        '<p style="color:var(--text-muted);font-size:0.82rem;margin:0;">Guided learning paths through Bitcoin · Complete channels · Pass the exam</p>' +
    '</div>';

    // Overall progress
    var totalPassed = getPassed().length;
    html += '<div style="display:flex;align-items:center;gap:12px;padding:14px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:20px;">' +
        '<div style="font-size:1.5rem;">' + (totalPassed === 3 ? '👑' : totalPassed >= 2 ? '🏔️' : totalPassed >= 1 ? '⛰️' : '🌱') + '</div>' +
        '<div style="flex:1;">' +
            '<div style="color:var(--heading);font-weight:700;font-size:0.9rem;">' + totalPassed + ' of 3 Trails Complete</div>' +
            '<div style="background:rgba(255,255,255,0.1);border-radius:4px;height:6px;margin-top:4px;overflow:hidden;">' +
                '<div style="background:var(--accent);height:100%;width:' + Math.round(totalPassed / 3 * 100) + '%;border-radius:4px;transition:0.3s;"></div>' +
            '</div>' +
        '</div>' +
    '</div>';

    // Module cards
    MODULES.forEach(function(mod, idx) {
        var status = getModuleStatus(mod);
        var pct = Math.round(status.visitedCount / status.totalChannels * 100);

        html += '<div style="background:var(--card-bg);border:1px solid ' + (status.isPassed ? mod.color : 'var(--border)') + ';border-radius:18px;padding:20px;margin-bottom:16px;' +
            (status.isLocked ? 'opacity:0.5;' : '') +
            'animation:fadeSlideIn ' + (0.3 + idx * 0.15) + 's ease-out;">';

        // Module header
        html += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">' +
            '<div style="width:48px;height:48px;background:' + (status.isPassed ? mod.color : 'rgba(255,255,255,0.05)') + ';border-radius:14px;display:flex;align-items:center;justify-content:center;font-size:1.5rem;flex-shrink:0;">' +
                (status.isPassed ? '✅' : (status.isLocked ? '🔒' : mod.emoji)) +
            '</div>' +
            '<div style="flex:1;">' +
                '<div style="color:var(--heading);font-weight:800;font-size:1.05rem;">' + mod.name + '</div>' +
                '<div style="color:var(--text-muted);font-size:0.75rem;">' + mod.subtitle + '</div>' +
            '</div>' +
            (status.isPassed ? '<span style="color:' + mod.color + ';font-size:0.7rem;font-weight:700;padding:4px 10px;border:1px solid ' + mod.color + ';border-radius:8px;">PASSED ✅</span>' : '') +
        '</div>';

        // Description
        html += '<p style="color:var(--text-muted);font-size:0.82rem;line-height:1.5;margin:0 0 12px;">' + mod.desc + '</p>';

        if (status.isLocked) {
            var reqMod = MODULES.find(function(m) { return m.id === mod.requires; });
            html += '<div style="text-align:center;padding:12px;background:rgba(255,255,255,0.03);border-radius:10px;color:var(--text-faint);font-size:0.82rem;">' +
                '🔒 Complete <strong>' + (reqMod ? reqMod.name : 'previous trail') + '</strong> to unlock this trail</div>';
        } else {
            // Progress bar
            html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">' +
                '<div style="flex:1;background:rgba(255,255,255,0.1);border-radius:4px;height:8px;overflow:hidden;">' +
                    '<div style="background:' + mod.color + ';height:100%;width:' + pct + '%;border-radius:4px;transition:0.3s;"></div>' +
                '</div>' +
                '<span style="color:var(--text-muted);font-size:0.75rem;font-weight:700;flex-shrink:0;">' + status.visitedCount + '/' + status.totalChannels + '</span>' +
            '</div>';

            // Channel list
            html += '<div style="margin-bottom:12px;">';
            mod.channels.forEach(function(ch) {
                var done = status.visited.indexOf(ch.id) !== -1;
                html += '<div onclick="window._fromTrails=true;go(\'' + ch.id + '\')" style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;border-radius:10px;cursor:pointer;transition:0.2s;border:1px solid transparent;" ' +
                    'onmouseover="this.style.background=\'rgba(255,255,255,0.03)\';this.style.borderColor=\'var(--border)\'" ' +
                    'onmouseout="this.style.background=\'none\';this.style.borderColor=\'transparent\'">' +
                    '<span style="font-size:1rem;flex-shrink:0;">' + (done ? '✅' : '⬜') + '</span>' +
                    '<div style="flex:1;min-width:0;">' +
                        '<div style="color:' + (done ? 'var(--text-faint)' : 'var(--text)') + ';font-size:0.85rem;font-weight:600;' + (done ? 'text-decoration:line-through;' : '') + '">' + ch.name + '</div>' +
                        '<div style="color:var(--text-faint);font-size:0.7rem;">' + ch.why + '</div>' +
                    '</div>' +
                '</div>';
            });
            html += '</div>';

            // Action button
            if (status.isPassed) {
                html += '<button onclick="startTrailExam(\'' + mod.id + '\')" style="width:100%;padding:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);border-radius:12px;color:var(--text-muted);font-size:0.85rem;font-weight:600;cursor:pointer;font-family:inherit;">🔄 Retake Exam</button>';
            } else if (status.isComplete) {
                html += '<button onclick="startTrailExam(\'' + mod.id + '\')" style="width:100%;padding:14px;background:' + mod.color + ';border:none;border-radius:12px;color:#fff;font-size:0.95rem;font-weight:800;cursor:pointer;font-family:inherit;box-shadow:0 4px 15px ' + mod.color + '40;">⚡ Take the ' + mod.name + ' Exam (25 Questions)</button>';
            } else {
                var nextChannel = mod.channels.find(function(ch) { return status.visited.indexOf(ch.id) === -1; });
                html += '<button onclick="window._fromTrails=true;go(\'' + (nextChannel ? nextChannel.id : mod.channels[0].id) + '\')" style="width:100%;padding:14px;background:var(--accent);border:none;border-radius:12px;color:#fff;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">📖 Continue: ' + (nextChannel ? nextChannel.name : mod.channels[0].name) + ' →</button>';
            }
        }

        html += '</div>';
    });

    // Footer tip
    html += '<div style="text-align:center;padding:16px;color:var(--text-faint);font-size:0.75rem;line-height:1.6;">' +
        '🦌 <strong>Tip:</strong> Read each channel thoroughly before taking the exam.<br>' +
        'You need 80% (20/25) to pass. Questions are pulled from the channels you studied.' +
    '</div>';

    html += '</div></div>';
    fc.innerHTML = html;
};

// ---- TRAIL EXAM ----
window.startTrailExam = function(moduleId) {
    var mod = MODULES.find(function(m) { return m.id === moduleId; });
    if (!mod) return;

    var status = getModuleStatus(mod);
    if (status.isLocked) {
        if (typeof showToast === 'function') showToast('🔒 Complete ' + (MODULES.find(function(m) { return m.id === mod.requires; }) || {}).name + ' first!');
        return;
    }
    if (!status.isComplete && !status.isPassed) {
        if (typeof showToast === 'function') showToast('📖 Read all ' + mod.channels.length + ' channels first!');
        return;
    }

    // Collect questions from QUESTION_BANK for this module's channels
    var pool = [];
    var QB = typeof QUESTION_BANK !== 'undefined' ? QUESTION_BANK : null;
    if (QB) {
        mod.channels.forEach(function(ch) {
            var questions = QB[ch.id];
            if (questions && Array.isArray(questions)) {
                questions.forEach(function(q) {
                    pool.push({ q: q.q, a: q.a, wrong: q.wrong || q.w || [], category: ch.id });
                });
            }
        });
    }

    // If not enough questions, pull from general pool
    if (pool.length < mod.questionsNeeded && QB && QB['_general']) {
        QB['_general'].forEach(function(q) {
            pool.push({ q: q.q, a: q.a, wrong: q.wrong || q.w || [], category: '_general' });
        });
    }

    // Shuffle and pick
    pool = fisherYatesFull(pool);
    var examQuestions = pool.slice(0, mod.questionsNeeded);

    if (examQuestions.length < 10) {
        if (typeof showToast === 'function') showToast('⚠️ Not enough questions available for this exam. Keep exploring!');
        return;
    }

    // Shuffle options for each question once
    examQuestions.forEach(function(q) {
        q._options = fisherYatesFull([q.a].concat(q.wrong || []).slice(0, 4));
        q._answered = false;
        q._correct = null; // null = unanswered, true/false
        q._selected = null;
    });

    // Store exam state
    window._trailExam = {
        moduleId: moduleId,
        questions: examQuestions,
        current: 0,
        score: 0,
        answered: 0,
        total: examQuestions.length,
    };

    renderTrailExamQuestion();
};

function fisherYatesFull(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
    return a;
}

window.trailExamNav = function(dir) {
    var exam = window._trailExam;
    if (!exam) return;
    var next = exam.current + dir;
    if (next < 0 || next >= exam.total) return;
    exam.current = next;
    renderTrailExamQuestion();
};

window.trailExamSubmit = function() {
    var exam = window._trailExam;
    if (!exam) return;
    var unanswered = exam.total - exam.answered;
    if (unanswered > 0 && !confirm('You have ' + unanswered + ' unanswered question' + (unanswered > 1 ? 's' : '') + '. Submit anyway?')) return;
    renderTrailExamResults();
};

function renderTrailExamQuestion() {
    var exam = window._trailExam;
    if (!exam) return;
    var mod = MODULES.find(function(m) { return m.id === exam.moduleId; });
    if (!mod) return;

    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    var q = exam.questions[exam.current];
    var options = q._options;
    var isAnswered = q._answered;
    var pct = Math.round(((exam.current + 1) / exam.total) * 100);

    // Anti-cheat protection
    if (typeof _injectExamProtection === 'function') _injectExamProtection();
    window._scholarExamActive = true;

    var html = '<div style="max-width:500px;margin:0 auto;padding:20px 16px 120px;">';

    // Header
    html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
        '<span style="font-size:1.3rem;">' + mod.emoji + '</span>' +
        '<div style="flex:1;">' +
            '<div style="color:var(--heading);font-weight:800;font-size:0.9rem;">' + mod.name + ' Exam</div>' +
            '<div style="color:var(--text-faint);font-size:0.7rem;">Question ' + (exam.current + 1) + ' of ' + exam.total + '</div>' +
        '</div>' +
        '<span style="color:' + mod.color + ';font-weight:700;font-size:0.8rem;">' + exam.score + ' correct / ' + exam.answered + ' answered</span>' +
    '</div>';

    // Progress bar
    html += '<div style="background:rgba(255,255,255,0.1);border-radius:4px;height:6px;margin-bottom:20px;overflow:hidden;">' +
        '<div style="background:' + mod.color + ';height:100%;width:' + pct + '%;border-radius:4px;transition:0.3s;"></div></div>';

    // Question (rendered as canvas for anti-copy)
    html += '<canvas id="trailQCanvas" width="500" height="80" style="width:100%;max-width:500px;height:auto;margin-bottom:16px;-webkit-user-select:none;user-select:none;"></canvas>';

    // Options
    options.forEach(function(opt) {
        var isCorrect = opt === q.a;
        var wasSelected = q._selected === opt;
        var bg = 'var(--card-bg)', color = 'var(--text)', border = 'var(--border)', opacity = '1', cursor = 'pointer';

        if (isAnswered) {
            cursor = 'default';
            opacity = '0.6';
            if (wasSelected && q._correct) { bg = '#22c55e'; color = '#fff'; border = '#22c55e'; opacity = '1'; }
            else if (wasSelected && !q._correct) { bg = '#ef4444'; color = '#fff'; border = '#ef4444'; opacity = '1'; }
            else if (isCorrect) { border = '#22c55e'; color = '#22c55e'; opacity = '1'; }
        }

        html += '<button data-trail-correct="' + (isCorrect ? '1' : '0') + '" ' +
            (isAnswered ? 'disabled ' : 'onclick="trailExamAnswer(this,' + isCorrect + ')" ') +
            'style="display:block;width:100%;padding:14px 16px;margin-bottom:8px;background:' + bg + ';border:1px solid ' + border + ';border-radius:12px;color:' + color + ';font-size:0.88rem;cursor:' + cursor + ';font-family:inherit;text-align:left;transition:0.2s;line-height:1.4;touch-action:manipulation;opacity:' + opacity + ';" ' +
            (!isAnswered ? 'onmouseover="this.style.borderColor=\'' + mod.color + '\'" onmouseout="this.style.borderColor=\'var(--border)\'"' : '') + '>' +
            (typeof escapeHtml === 'function' ? escapeHtml(opt) : opt) +
        '</button>';
    });

    // Result indicator for answered questions
    if (isAnswered) {
        html += '<div style="text-align:center;padding:6px;margin-bottom:8px;border-radius:8px;font-size:0.85rem;font-weight:700;' +
            (q._correct ? 'background:rgba(34,197,94,0.1);border:1px solid #22c55e;color:#22c55e;">✅ Correct!' : 'background:rgba(239,68,68,0.1);border:1px solid #ef4444;color:#ef4444;">❌ Incorrect') +
            '</div>';
    }

    // Navigation buttons
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-top:16px;gap:10px;">';
    html += '<button onclick="trailExamNav(-1)" style="padding:10px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;font-size:0.85rem;' + (exam.current === 0 ? 'opacity:0.3;pointer-events:none;' : '') + '">← Prev</button>';
    html += '<span style="color:var(--text-faint);font-size:0.75rem;">' + (exam.current + 1) + ' / ' + exam.total + '</span>';
    if (exam.answered >= exam.total) {
        html += '<button onclick="trailExamSubmit()" style="padding:10px 20px;background:' + mod.color + ';border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;font-size:0.85rem;font-weight:700;">Submit Exam ✅</button>';
    } else if (exam.current < exam.total - 1) {
        html += '<button onclick="trailExamNav(1)" style="padding:10px 20px;background:var(--accent);border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;font-size:0.85rem;font-weight:700;">Next →</button>';
    } else {
        html += '<button onclick="trailExamSubmit()" style="padding:10px 20px;background:' + mod.color + ';border:none;border-radius:10px;color:#fff;cursor:pointer;font-family:inherit;font-size:0.85rem;font-weight:700;">Submit Exam ✅</button>';
    }
    html += '</div>';

    html += '</div>';
    fc.innerHTML = html;
    fc.scrollTop = 0;

    // Render question text as canvas
    var tCanvas = document.getElementById('trailQCanvas');
    if (tCanvas && q) {
        var tCtx = tCanvas.getContext('2d');
        var tDark = document.body.getAttribute('data-theme') !== 'light';
        var tColor = tDark ? '#e2e8f0' : '#1a1a2e';
        var tDpr = window.devicePixelRatio || 1;
        var tMaxW = Math.min(500, fc.clientWidth - 40);
        tCanvas.style.width = tMaxW + 'px';
        tCanvas.width = tMaxW * tDpr;
        tCtx.scale(tDpr, tDpr);
        tCtx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        tCtx.fillStyle = tColor;
        tCtx.textBaseline = 'top';
        var tWords = q.q.split(' '), tLines = [], tCur = '';
        for (var twi = 0; twi < tWords.length; twi++) {
            var tTest = tCur ? tCur + ' ' + tWords[twi] : tWords[twi];
            if (tCtx.measureText(tTest).width > tMaxW - 10) { if (tCur) tLines.push(tCur); tCur = tWords[twi]; }
            else tCur = tTest;
        }
        if (tCur) tLines.push(tCur);
        var tLH = 24, tTH = tLines.length * tLH + 10;
        tCanvas.height = tTH * tDpr;
        tCanvas.style.height = tTH + 'px';
        tCtx.scale(tDpr, tDpr);
        tCtx.font = '700 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        tCtx.fillStyle = tColor;
        tCtx.textBaseline = 'top';
        for (var tli = 0; tli < tLines.length; tli++) tCtx.fillText(tLines[tli], 0, tli * tLH + 5);
    }
}

window.trailExamAnswer = function(btn, correct) {
    var exam = window._trailExam;
    if (!exam) return;
    var q = exam.questions[exam.current];
    if (q._answered) return; // Already answered

    q._answered = true;
    q._correct = correct;
    q._selected = btn.textContent.trim();
    if (correct) exam.score++;
    exam.answered++;

    // Re-render to show the answered state
    renderTrailExamQuestion();

    // Auto-advance to next unanswered question after delay
    if (exam.current < exam.total - 1) {
        setTimeout(function() {
            exam.current++;
            renderTrailExamQuestion();
        }, correct ? 1500 : 3500);
    }
};

function renderTrailExamResults() {
    window._scholarExamActive = false;
    var _g = document.getElementById('examScreenGuard'); if (_g) _g.remove();
    var exam = window._trailExam;
    if (!exam) return;
    var mod = MODULES.find(function(m) { return m.id === exam.moduleId; });
    if (!mod) return;

    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    var pct = Math.round((exam.score / exam.total) * 100);
    var passed = pct >= mod.passingScore;

    if (passed) {
        var passedList = getPassed();
        if (passedList.indexOf(mod.id) === -1) {
            passedList.push(mod.id);
            savePassed(passedList);

            // Award points & tickets
            if (typeof awardPoints === 'function') awardPoints(mod.pointsReward, mod.emoji + ' ' + mod.name + ' Trail Complete!');
            if (typeof awardOrangeTickets === 'function') awardOrangeTickets(mod.ticketReward, mod.emoji + ' ' + mod.name + ' Trail');

            // Award badge
            if (typeof awardHiddenBadge === 'function') awardHiddenBadge(mod.badgeId, mod.badgeName + ' — Completed ' + mod.name + '!');

            // Confetti!
            if (typeof launchConfetti === 'function') launchConfetti();
            if (typeof showToast === 'function') showToast(mod.emoji + ' ' + mod.name + ' COMPLETE! +' + mod.pointsReward + ' pts + 🎟️' + mod.ticketReward + ' tickets!');
        }
    }

    var html = '<div style="max-width:500px;margin:0 auto;padding:40px 16px 120px;text-align:center;">';

    html += '<div style="font-size:4rem;margin-bottom:16px;">' + (passed ? '🎉' : '📚') + '</div>';
    html += '<h2 style="color:var(--heading);font-size:1.5rem;font-weight:900;margin:0 0 8px;">' +
        (passed ? mod.name + ' Complete!' : 'Not quite there yet') + '</h2>';

    html += '<div style="font-size:2rem;font-weight:900;color:' + (passed ? '#22c55e' : '#ef4444') + ';margin-bottom:8px;">' +
        exam.score + ' / ' + exam.total + ' (' + pct + '%)</div>';

    html += '<p style="color:var(--text-muted);font-size:0.9rem;margin-bottom:24px;line-height:1.6;">';
    if (passed) {
        html += 'You\'ve earned the <strong style="color:' + mod.color + ';">' + mod.badgeName + '</strong> badge!<br>' +
            '+' + mod.pointsReward + ' points · +🎟️ ' + mod.ticketReward + ' tickets';
    } else {
        html += 'You need ' + mod.passingScore + '% to pass. Re-read the channels and try again!<br>' +
            'You got ' + pct + '% — so close! Review what you missed.';
    }
    html += '</p>';

    // Buttons
    html += '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">';
    if (!passed) {
        html += '<button onclick="startTrailExam(\'' + mod.id + '\')" style="padding:14px 28px;background:' + mod.color + ';color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;">🔄 Retry Exam</button>';
    }
    html += '<button onclick="renderModules()" style="padding:14px 28px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;">🗺️ Back to Trails</button>';

    // Next trail button if passed
    if (passed) {
        var nextMod = MODULES.find(function(m) { return m.requires === mod.id; });
        if (nextMod) {
            html += '<button onclick="renderModules()" style="padding:14px 28px;background:' + nextMod.color + ';color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;">' + nextMod.emoji + ' Start ' + nextMod.name + '</button>';
        }
    }
    html += '</div></div>';

    fc.innerHTML = html;
    fc.scrollTop = 0;
}

// ---- EXPOSE MODULES DATA for Nacho integration ----
window.NACHO_TRAILS = MODULES;
window.getTrailProgress = getModuleStatus;
window.getTrailsPassed = getPassed;

// ---- ROUTE: go('trails') ----
// Patch go() to handle 'trails' as a special route
var _realGoTrails = window.go;
if (_realGoTrails) {
    window.go = async function(id) {
        if (id === 'trails') {
            if (window._nachoMode && typeof exitNachoMode === 'function') exitNachoMode(true);
            document.getElementById('home').classList.add('hidden');
            document.getElementById('hero').innerHTML = '';
            document.getElementById('hero').style.display = 'none';
            document.getElementById('msgs').innerHTML = '';
            document.getElementById('msgs').style.display = 'none';
            var fc = document.getElementById('forumContainer');
            if (fc) fc.style.display = 'block';
            history.pushState({ channel: 'trails' }, '', '#trails');
            if (typeof isMobile === 'function' && isMobile()) document.getElementById('sidebar').classList.remove('open');
            renderModules(fc);
            document.getElementById('main').scrollTop = 0;
            return;
        }
        return _realGoTrails.apply(this, arguments);
    };
}

// Handle back navigation to return to Trails
window.addEventListener('popstate', function(e) {
    var state = e.state || {};
    var hash = location.hash.slice(1);
    if (hash === 'trails' || state.channel === 'trails') {
        go('trails');
        return;
    }
    // If user came from trails and pressed back, go back to trails
    if (window._fromTrails && !hash) {
        window._fromTrails = false;
        e.preventDefault && e.preventDefault();
        go('trails');
        return;
    }
});

// When navigating from trails to a channel, set up proper history
var _realGoTrailsNav = window.go;
if (_realGoTrailsNav) {
    window.go = async function(id) {
        // If navigating from trails to a channel, push trails state first
        if (window._fromTrails && id !== 'trails') {
            window._fromTrails = false;
            // Push trails into history stack so back button returns there
            history.pushState({ channel: 'trails' }, '', '#trails');
            var result = await _realGoTrailsNav.apply(this, arguments);
            return result;
        }
        return _realGoTrailsNav.apply(this, arguments);
    };
}

console.log('[MODULES] Nacho\'s Trails loaded — 3 learning modules with ' + MODULES.reduce(function(s,m){return s+m.channels.length},0) + ' curated channels');
})();
