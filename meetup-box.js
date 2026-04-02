// © 2024-2026 603BTC LLC. All rights reserved.
// meetup-box.js — Meetup-in-a-Box: Ready-made templates for organizers
// Injects into Meetup Builder section

(function() {
'use strict';

var TEMPLATES = [
    {
        emoji: '📘',
        title: 'Your First Meetup',
        desc: 'Complete agenda for a 1-hour beginner-friendly Bitcoin meetup. Icebreakers, key talking points, and Q&A structure.',
        duration: '1 hour',
        level: 'Beginner',
        color: '#22c55e',
        agenda: [
            { time: '0:00', item: '👋 Welcome & Icebreaker', detail: 'Introduce yourself. Ask: "What made you curious about Bitcoin?" Go around the room. No wrong answers.' },
            { time: '0:10', item: '📖 What is Bitcoin? (10 min)', detail: 'Cover the basics: digital money, 21 million cap, no company controls it, runs 24/7. Use the One-Stop-Shop channel as a guide.' },
            { time: '0:20', item: '💡 Why Bitcoin Matters (10 min)', detail: 'Inflation, broken money, financial freedom. Use the Money and Problems of Money channels.' },
            { time: '0:30', item: '📱 Live Demo: Buy $5 of Bitcoin (10 min)', detail: 'Open Strike/Cash App on your phone. Buy $5 live. Show how fast and easy it is. This is the most powerful moment.' },
            { time: '0:40', item: '⚡ Lightning Demo (5 min)', detail: 'Send sats between phones. Have everyone download Wallet of Satoshi. Send 100 sats to each attendee.' },
            { time: '0:45', item: '❓ Open Q&A (15 min)', detail: 'Let people ask anything. Common questions: Is it too late? Is it safe? What about scams? Use Nacho for instant answers.' },
        ],
        tips: '• Keep it conversational, not a lecture\n• Have a sign with the Wi-Fi password\n• Bring a portable phone charger\n• Take a group photo (with consent)\n• Share the archive link: btcedu.quest',
        channels: ['one-stop-shop', 'money', 'problems-of-money', 'use-cases']
    },
    {
        emoji: '⚡',
        title: 'Lightning Workshop',
        desc: 'Hands-on workshop where attendees set up Lightning wallets and send their first payments.',
        duration: '1.5 hours',
        level: 'Beginner-Intermediate',
        color: '#f7931a',
        agenda: [
            { time: '0:00', item: '👋 Welcome & Check-in', detail: 'Ask who has a Lightning wallet already. Split into groups: complete beginners vs. some experience.' },
            { time: '0:10', item: '⚡ What is Lightning? (15 min)', detail: 'Explain: Layer 2, instant payments, near-zero fees. Use the Lightning channel as your guide.' },
            { time: '0:25', item: '📱 Wallet Setup (20 min)', detail: 'Everyone downloads Wallet of Satoshi (easiest) or Phoenix (self-custodial). Walk through setup step by step.' },
            { time: '0:45', item: '💸 Send Sats! (15 min)', detail: 'Pair up. Person A creates an invoice, Person B pays it. Then swap. Everyone sends and receives.' },
            { time: '1:00', item: '🛒 Real Purchase Demo (10 min)', detail: 'Show how to pay at a Bitcoin-accepting business. Use Bitrefill to buy a gift card live.' },
            { time: '1:10', item: '🔑 Self-Custody Talk (10 min)', detail: 'Explain why Wallet of Satoshi is custodial. Introduce Phoenix, Zeus for self-custody. Plant the seed.' },
            { time: '1:20', item: '❓ Q&A + Resources', detail: 'Answer questions. Share btcedu.quest/#lightning for more learning.' },
        ],
        tips: '• Pre-fund 10,000 sats to distribute (costs ~$1)\n• Have QR codes printed for the archive Lightning channel\n• Some phones struggle with NFC — use QR codes\n• Celebrate first payments loudly!',
        channels: ['layer-2-lightning', 'self-custody', 'investment-strategy']
    },
    {
        emoji: '🔐',
        title: 'Self-Custody Workshop',
        desc: 'Teach attendees how to take control of their Bitcoin with proper wallet setup and seed phrase security.',
        duration: '1.5 hours',
        level: 'Intermediate',
        color: '#a855f7',
        agenda: [
            { time: '0:00', item: '⚠️ Why Self-Custody? (15 min)', detail: 'FTX collapse story. "Not your keys, not your coins." Show the list of exchange hacks.' },
            { time: '0:15', item: '📱 Software Wallet Setup (20 min)', detail: 'Walk through Blue Wallet or Blockstream Green setup. Generate seed phrase. Write it down on PAPER.' },
            { time: '0:35', item: '📝 Seed Phrase Security (15 min)', detail: 'NEVER digital photos. NEVER cloud storage. Metal backup options. Where to store it. Multi-location.' },
            { time: '0:50', item: '💸 Transfer from Exchange (15 min)', detail: 'Live demo: withdraw Bitcoin from an exchange to your own wallet. Show the transaction on mempool.space.' },
            { time: '1:05', item: '🔐 Hardware Wallets (15 min)', detail: 'Show a Coldcard or Trezor. Explain air-gapped signing. When to upgrade from software to hardware.' },
            { time: '1:20', item: '❓ Q&A + Next Steps', detail: 'Common fears: "What if I lose my seed phrase?" Multisig intro. Resources: btcedu.quest/#self-custody' },
        ],
        tips: '• Bring a Coldcard or Trezor to pass around\n• Have blank seed phrase cards printed\n• NEVER let anyone photograph their seed phrase\n• Emphasize: practice with small amounts first',
        channels: ['self-custody', 'cryptography', 'public_key_vs_private_key']
    },
    {
        emoji: '🌍',
        title: 'Bitcoin vs. The System',
        desc: 'Discussion-focused meetup about why Bitcoin exists: broken money, inflation, financial freedom.',
        duration: '1.5 hours',
        level: 'All Levels',
        color: '#ef4444',
        agenda: [
            { time: '0:00', item: '🍕 Social Time + Food (15 min)', detail: 'Let people arrive, grab drinks, chat. Put on some Bitcoin music from the archive.' },
            { time: '0:15', item: '📉 The Problem (20 min)', detail: 'Fiat money: inflation timeline, purchasing power loss, Cantillon Effect. Use Problems of Money channel.' },
            { time: '0:35', item: '🏛️ Real-World Examples (15 min)', detail: 'Lebanon, Argentina, Nigeria — people who NEED Bitcoin. Human rights angle.' },
            { time: '0:50', item: '₿ Bitcoin as the Fix (15 min)', detail: '21 million cap, no CEO, censorship-resistant. Use the Decentralized and Scarce channels.' },
            { time: '1:05', item: '💬 Open Discussion (20 min)', detail: 'Facilitate debate. Common objections: "government will ban it," "too volatile," "only for criminals."' },
            { time: '1:25', item: '📚 Resources + Next Meetup', detail: 'Share btcedu.quest. Encourage everyone to explore 3 channels before next meetup.' },
        ],
        tips: '• This format works great at bars/pubs\n• Print some stats on cards to pass around\n• Invite a local business owner who accepts Bitcoin\n• Record key insights (with consent) for your social media',
        channels: ['problems-of-money', 'decentralized', 'scarce', 'human_rights__social_justice_and_freedo']
    },
    {
        emoji: '⛏️',
        title: 'Mining & Energy Deep Dive',
        desc: 'Technical meetup exploring how Bitcoin mining works, energy usage facts, and home mining options.',
        duration: '1.5 hours',
        level: 'Intermediate-Advanced',
        color: '#3b82f6',
        agenda: [
            { time: '0:00', item: '⛏️ How Mining Actually Works (20 min)', detail: 'SHA-256 hashing, nonce guessing, difficulty adjustment. It is NOT "solving math problems." Use Mining channel.' },
            { time: '0:20', item: '⚡ Energy FUD Debunked (15 min)', detail: '50%+ renewable. Stranded energy. Methane capture. Grid stabilization. Use Energy channel.' },
            { time: '0:35', item: '🏠 Home Mining Options (20 min)', detail: 'Bitaxe (open source), Antminer S9 (cheap), S21 (modern). Costs, noise, heat, ROI expectations.' },
            { time: '0:55', item: '📊 Live Dashboard (10 min)', detail: 'Show mempool.space, hashrate charts, difficulty adjustments. Use the archive Bitcoin Dashboard.' },
            { time: '1:05', item: '🔧 Hardware Demo (15 min)', detail: 'If someone has a miner, bring it! Let people see/hear a real ASIC. Show a Bitaxe running.' },
            { time: '1:20', item: '❓ Q&A', detail: 'Common questions: "Is it profitable?" "Can I mine at home?" "What about noise?"' },
        ],
        tips: '• Bring a Bitaxe if possible — seeing a miner changes everything\n• Have mempool.space on a big screen\n• Calculate mining profitability live using whattomine.com\n• Mention pool options: Ocean, Braiins',
        channels: ['mining', 'energy', 'difficulty-adjustment', 'pow-vs-pos']
    }
];

function injectMeetupBox() {
    var mbSection = document.getElementById('meetupBuilderSection');
    if (!mbSection || document.getElementById('meetupBoxSection')) return;

    var section = document.createElement('div');
    section.id = 'meetupBoxSection';
    section.style.cssText = 'margin-top:30px;';

    var html = '<div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">' +
        '<span style="font-size:1.3rem;">📦</span>' +
        '<div><div style="color:var(--heading);font-weight:800;font-size:1.05rem;">Meetup-in-a-Box</div>' +
        '<div style="color:var(--text-muted);font-size:0.78rem;">Ready-made agendas · Just pick a topic and go</div></div></div>';

    html += '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;">';
    TEMPLATES.forEach(function(t, i) {
        html += '<div onclick="showMeetupTemplate(' + i + ')" style="background:var(--card-bg);border:1px solid var(--border);border-radius:14px;padding:16px;cursor:pointer;transition:0.2s;" ' +
            'onmouseover="this.style.borderColor=\'' + t.color + '\';this.style.transform=\'translateY(-2px)\'" ' +
            'onmouseout="this.style.borderColor=\'var(--border)\';this.style.transform=\'none\'">' +
            '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
                '<span style="font-size:1.3rem;">' + t.emoji + '</span>' +
                '<div style="flex:1;"><div style="color:var(--heading);font-weight:700;font-size:0.9rem;">' + t.title + '</div>' +
                '<div style="color:var(--text-faint);font-size:0.65rem;">' + t.duration + ' · ' + t.level + '</div></div>' +
            '</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;">' + t.desc + '</div>' +
        '</div>';
    });
    html += '</div>';

    section.innerHTML = html;

    // Insert before the "Share Your Meetup" button
    var shareBtn = mbSection.querySelector('button[onclick*="showMeetupBuilderSubmit"]');
    if (shareBtn) mbSection.insertBefore(section, shareBtn);
    else mbSection.appendChild(section);
}

window.showMeetupTemplate = function(idx) {
    var t = TEMPLATES[idx];
    if (!t) return;
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };

    var overlay = document.createElement('div');
    overlay.id = 'meetupTemplateOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:100010;background:rgba(0,0,0,0.92);display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow-y:auto;-webkit-overflow-scrolling:touch;';
    overlay.onclick = function(e) { if (e.target === overlay) overlay.remove(); };

    var html = '<div style="background:var(--bg-side,#1a1a2e);border:1px solid ' + t.color + ';border-radius:20px;max-width:580px;width:100%;margin:40px auto;padding:28px;">';

    // Header
    html += '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">' +
        '<div><div style="font-size:0.7rem;color:' + t.color + ';font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">MEETUP-IN-A-BOX</div>' +
        '<h2 style="color:var(--heading);font-size:1.3rem;margin:0;line-height:1.3;">' + t.emoji + ' ' + esc(t.title) + '</h2>' +
        '<div style="color:var(--text-faint);font-size:0.75rem;margin-top:4px;">' + t.duration + ' · ' + t.level + '</div></div>' +
        '<button onclick="document.getElementById(\'meetupTemplateOverlay\').remove()" style="background:none;border:none;color:var(--text-faint);font-size:1.3rem;cursor:pointer;padding:4px;">✕</button></div>';

    html += '<p style="color:var(--text-muted);font-size:0.85rem;line-height:1.5;margin-bottom:20px;">' + esc(t.desc) + '</p>';

    // Agenda
    html += '<div style="font-size:0.72rem;color:' + t.color + ';font-weight:700;text-transform:uppercase;letter-spacing:1px;margin-bottom:10px;">📋 AGENDA</div>';
    t.agenda.forEach(function(a) {
        html += '<div style="display:flex;gap:10px;margin-bottom:10px;padding:10px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;">' +
            '<div style="color:' + t.color + ';font-weight:800;font-size:0.75rem;flex-shrink:0;min-width:35px;">' + a.time + '</div>' +
            '<div><div style="color:var(--heading);font-weight:700;font-size:0.85rem;">' + a.item + '</div>' +
            '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.5;margin-top:2px;">' + a.detail + '</div></div></div>';
    });

    // Tips
    if (t.tips) {
        html += '<div style="margin-top:16px;padding:14px;background:rgba(247,147,26,0.06);border:1px solid rgba(247,147,26,0.2);border-radius:12px;">' +
            '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:6px;">💡 HOST TIPS</div>' +
            '<div style="color:var(--text);font-size:0.82rem;line-height:1.7;white-space:pre-wrap;">' + esc(t.tips) + '</div></div>';
    }

    // Related channels
    if (t.channels && t.channels.length) {
        html += '<div style="margin-top:16px;"><div style="font-size:0.72rem;color:' + t.color + ';font-weight:700;margin-bottom:8px;">📖 ARCHIVE CHANNELS TO PREPARE</div>' +
            '<div style="display:flex;flex-wrap:wrap;gap:6px;">';
        t.channels.forEach(function(ch) {
            var chData = typeof CHANNELS !== 'undefined' && CHANNELS[ch] ? CHANNELS[ch] : null;
            var chName = chData ? chData.title : ch;
            html += '<button onclick="document.getElementById(\'meetupTemplateOverlay\').remove();goHome();setTimeout(function(){go(\'' + ch + '\')},300)" style="padding:5px 12px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.75rem;color:var(--text);cursor:pointer;font-family:inherit;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' + esc(chName) + '</button>';
        });
        html += '</div></div>';
    }

    html += '<button onclick="document.getElementById(\'meetupTemplateOverlay\').remove()" style="width:100%;margin-top:16px;padding:10px;background:none;border:1px solid var(--border);border-radius:10px;color:var(--text-faint);cursor:pointer;font-family:inherit;">Close</button>';
    html += '</div>';

    overlay.innerHTML = html;
    document.body.appendChild(overlay);
};

// Hook into meetup builder render
var _origRenderIRL2 = window.renderIRLSync;
if (_origRenderIRL2) {
    window.renderIRLSync = function(opts) {
        _origRenderIRL2(opts);
        setTimeout(function() {
            // Wait for meetup builder to inject first
            var tries = 0;
            var int = setInterval(function() {
                if (document.getElementById('meetupBuilderSection') || tries > 20) {
                    clearInterval(int);
                    if (document.getElementById('meetupBuilderSection')) injectMeetupBox();
                }
                tries++;
            }, 300);
        }, 500);
    };
}

console.log('[MEETUP BOX] Templates loaded — ' + TEMPLATES.length + ' ready-made agendas');
})();
