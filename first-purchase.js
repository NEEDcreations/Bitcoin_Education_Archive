// © 2024-2026 603BTC LLC. All rights reserved.
// first-purchase.js — "Your First Purchase" guided flow
// Turns learners into holders with step-by-step buying guide

(function() {
'use strict';

var STORAGE_KEY = 'btc_first_purchase_step';

function getStep() {
    return parseInt(localStorage.getItem(STORAGE_KEY) || '0');
}
function saveStep(n) {
    localStorage.setItem(STORAGE_KEY, n.toString());
}

var STEPS = [
    {
        id: 'choose',
        emoji: '🌍',
        title: 'Choose Your Region',
        desc: 'Different apps work best in different countries. Select yours to see the best options.'
    },
    {
        id: 'app',
        emoji: '📱',
        title: 'Download a Bitcoin App',
        desc: 'Pick one of these trusted, beginner-friendly apps to buy your first Bitcoin.'
    },
    {
        id: 'buy',
        emoji: '🛒',
        title: 'Buy Your First Bitcoin',
        desc: "You don't need to buy a whole coin! Start with as little as $5. Every sat counts."
    },
    {
        id: 'wallet',
        emoji: '🔑',
        title: 'Move It to Your Own Wallet',
        desc: 'Not your keys, not your coins. Self-custody is the most important step.'
    },
    {
        id: 'tips',
        emoji: '🛡️',
        title: 'Pro Tips & Warnings',
        desc: 'Important advice to protect yourself and your stack. Read this before going further.'
    },
    {
        id: 'done',
        emoji: '🎉',
        title: "You're a Bitcoiner!",
        desc: 'Welcome to the hardest money ever created.'
    },
    {
        id: 'lightning',
        emoji: '⚡',
        title: 'Set Up Lightning',
        desc: 'Instant, nearly-free payments. The future of spending Bitcoin.'
    }
];

var APPS_BY_REGION = {
    us: [
        { name: 'Strike', icon: '⚡', url: 'https://strike.me', desc: 'Easiest for beginners. Free Lightning payments. No fees on recurring buys.', rec: true, referral: 'https://invite.strike.me/NKP150', referralBonus: 'Get $10 free' },
        { name: 'Cash App', icon: '💚', url: 'https://cash.app', desc: 'Already have it? Buy Bitcoin right inside. Auto-purchase available.', referral: 'https://cash.app/app/DRLRTNC', referralBonus: 'Get $5 free' },
        { name: 'River', icon: '🏔️', url: 'https://river.com', desc: 'Bitcoin-only. Great DCA (auto-buy). Excellent for long-term stacking.', referral: 'https://river.com/signup?r=H4FMHRUS', referralBonus: 'Free sats bonus' },
        { name: 'Swan Bitcoin', icon: '🦢', url: 'https://swanbitcoin.com', desc: 'Auto-DCA focused. Set it and forget it. Bitcoin-only company.' },
        { name: 'Amber', icon: '🟡', url: 'https://amber.app', desc: 'Auto-DCA with smart features like "Buy the Dip". Bitcoin-only.', referral: 'https://amber.app', referralCode: 'NEEDcreations', referralBonus: 'Get $10 free' },

    ],
    eu: [
        { name: 'Relai', icon: '🇨🇭', url: 'https://relai.app', desc: 'Swiss Bitcoin-only app. No KYC under limits. Auto-DCA. Best for Europe.', rec: true },
        { name: 'Pocket Bitcoin', icon: '🟠', url: 'https://pocketbitcoin.com', desc: 'Buy Bitcoin directly to your own wallet. Swiss, no account needed.' },
        { name: 'Bitcoin Well', icon: '🟧', url: 'https://bitcoinwell.com', desc: 'Non-custodial Bitcoin exchange. Lightning enabled. No holding your coins.', referral: 'https://app.bitcoinwell.com/ref/needcreations', referralBonus: 'Referral bonus' },
        { name: 'Bitvavo', icon: '🇳🇱', url: 'https://bitvavo.com', desc: 'Popular in Europe. Low fees. Easy bank transfers.' },
        { name: 'Kraken', icon: '🐙', url: 'https://kraken.com', desc: 'Major exchange. Available across Europe. Lightning withdrawals.' },
    ],
    uk: [
        { name: 'Strike', icon: '⚡', url: 'https://strike.me', desc: 'Now available in UK. Lightning-native. Very low fees.', rec: true, referral: 'https://invite.strike.me/NKP150', referralBonus: 'Get $10 free' },
        { name: 'CoinCorner', icon: '🇬🇧', url: 'https://coincorner.com', desc: 'UK Bitcoin-only company. Lightning support. Auto-buy available.' },
        { name: 'Kraken', icon: '🐙', url: 'https://kraken.com', desc: 'Major exchange with UK support. Good liquidity.' },
    ],
    ca: [
        { name: 'Bull Bitcoin', icon: '🐂', url: 'https://bullbitcoin.com', desc: 'Canadian Bitcoin-only exchange. Non-custodial. Sends directly to your wallet.', rec: true },
        { name: 'Shakepay', icon: '🤝', url: 'https://shakepay.com', desc: 'Easy Canadian app. Shake your phone daily for free sats. Very beginner-friendly.' },
        { name: 'Bitcoin Well', icon: '🟧', url: 'https://bitcoinwell.com', desc: 'Non-custodial exchange. Bitcoin ATMs across Canada. Lightning enabled.', referral: 'https://app.bitcoinwell.com/ref/needcreations', referralBonus: 'Referral bonus' },
        { name: 'Strike', icon: '⚡', url: 'https://strike.me', desc: 'Lightning-native. Low fees. Available in Canada.', referral: 'https://invite.strike.me/NKP150', referralBonus: 'Get $10 free' },
        { name: 'Kraken', icon: '🐙', url: 'https://kraken.com', desc: 'Major exchange with full Canadian support. Lightning withdrawals.' },
    ],
    au: [
        { name: 'Amber', icon: '🟡', url: 'https://amber.app', desc: 'Australian Bitcoin-only app. Auto-DCA, "Buy the Dip" feature. Founded in Melbourne.', rec: true, referral: 'https://amber.app', referralCode: 'NEEDcreations', referralBonus: 'Get $10 free' },
        { name: 'HardBlock', icon: '🧱', url: 'https://hardblock.com.au', desc: 'Australian Bitcoin-only exchange. Non-custodial option. Instant buy.' },
        { name: 'Independent Reserve', icon: '🦘', url: 'https://independentreserve.com', desc: 'Established Australian exchange since 2013. AUD deposits. Trusted.' },
        { name: 'Kraken', icon: '🐙', url: 'https://kraken.com', desc: 'Major global exchange. Available in Australia. Lightning withdrawals.' },
    ],
    latam: [
        { name: 'Blink', icon: '⚡', url: 'https://blink.sv', desc: 'Lightning-first wallet from El Salvador. Great for Latin America.', rec: true },
        { name: 'Bitso', icon: '🇲🇽', url: 'https://bitso.com', desc: 'Largest exchange in Latin America. Available in Mexico, Brazil, Argentina.' },
        { name: 'Strike', icon: '⚡', url: 'https://strike.me', desc: 'Available in El Salvador and expanding. Lightning-native.', referral: 'https://invite.strike.me/NKP150', referralBonus: 'Get $10 free' },
        { name: 'Mercado Bitcoin', icon: '🇧🇷', url: 'https://mercadobitcoin.com.br', desc: 'Largest Brazilian exchange. Easy BRL deposits. Trusted since 2013.' },
    ],
    africa: [
        { name: 'Bitnob', icon: '🌍', url: 'https://bitnob.com', desc: 'Bitcoin app for Africa. Lightning enabled. Send/receive across borders instantly.', rec: true },
        { name: 'Machankura', icon: '📱', url: 'https://8333.mobi', desc: 'Buy Bitcoin via USSD — no internet or smartphone needed. Works on any phone.', rec: true },
        { name: 'Paxful', icon: '🤝', url: 'https://paxful.com', desc: 'Peer-to-peer marketplace. 350+ payment methods. Very popular in Nigeria & Ghana.' },
        { name: 'Yellow Card', icon: '💛', url: 'https://yellowcard.io', desc: 'Buy Bitcoin across 20+ African countries. Mobile money, bank transfer supported.' },
        { name: 'Luno', icon: '🔵', url: 'https://luno.com', desc: 'Available in South Africa, Nigeria, and more. Easy on-ramp with local currency.' },
        { name: 'Bisq', icon: '🔒', url: 'https://bisq.network', desc: 'Decentralized P2P exchange. No KYC. Works everywhere with internet access.' },
    ],
    india: [
        { name: 'WazirX', icon: '🇮🇳', url: 'https://wazirx.com', desc: 'Largest Indian exchange. INR deposits via UPI and bank transfer.', rec: true },
        { name: 'CoinDCX', icon: '💎', url: 'https://coindcx.com', desc: 'Popular Indian exchange. Easy INR on-ramp. Beginner-friendly interface.' },
        { name: 'Giottus', icon: '🟢', url: 'https://giottus.com', desc: 'Indian exchange with low fees. Quick INR deposits. Good mobile app.' },
        { name: 'Bisq', icon: '🔒', url: 'https://bisq.network', desc: 'Decentralized P2P exchange. No KYC. UPI payment method available.' },
        { name: 'RoboSats', icon: '🤖', url: 'https://robosats.com', desc: 'Lightning-based P2P exchange. No KYC. Fast trades with UPI.' },
    ],
    mena: [
        { name: 'Rain', icon: '🌧️', url: 'https://rain.co', desc: 'Licensed exchange for Middle East. Available in UAE, Saudi Arabia, Bahrain, Oman, Kuwait.', rec: true },
        { name: 'BitOasis', icon: '🏜️', url: 'https://bitoasis.net', desc: 'Dubai-based exchange. AED deposits. Trusted across the Gulf region.' },
        { name: 'Bisq', icon: '🔒', url: 'https://bisq.network', desc: 'Decentralized P2P exchange. No KYC. Works everywhere.' },
        { name: 'RoboSats', icon: '🤖', url: 'https://robosats.com', desc: 'Lightning-based P2P. No KYC. Fast trades globally.' },
    ],
    asia: [
        { name: 'Bitflyer', icon: '🇯🇵', url: 'https://bitflyer.com', desc: 'Largest Japanese exchange. JPY deposits. Licensed and regulated.', rec: true },
        { name: 'Coins.ph', icon: '🇵🇭', url: 'https://coins.ph', desc: 'Popular in Philippines. Buy Bitcoin with local payment methods. Lightning enabled.' },
        { name: 'Luno', icon: '🔵', url: 'https://luno.com', desc: 'Available in Malaysia and Indonesia. Easy local currency on-ramp.' },
        { name: 'Kraken', icon: '🐙', url: 'https://kraken.com', desc: 'Global exchange available across Asia. Lightning withdrawals.' },
        { name: 'Bisq', icon: '🔒', url: 'https://bisq.network', desc: 'Decentralized P2P exchange. No KYC. Works everywhere.' },
    ],
    other: [
        { name: 'Bisq', icon: '🔒', url: 'https://bisq.network', desc: 'Decentralized exchange. No KYC. Peer-to-peer. Works everywhere.', rec: true },
        { name: 'RoboSats', icon: '🤖', url: 'https://robosats.com', desc: 'Lightning-based P2P exchange. No KYC. Fast trades.' },
        { name: 'Hodl Hodl', icon: '🤝', url: 'https://hodlhodl.com', desc: 'P2P trading platform. Non-custodial. Global.' },
        { name: 'Kraken', icon: '🐙', url: 'https://kraken.com', desc: 'Available in most countries. Established and trusted.' },
        { name: 'Machankura', icon: '📱', url: 'https://8333.mobi', desc: 'Buy Bitcoin via USSD on any phone. No internet needed. Great for developing regions.' },
    ]
};

var SELF_CUSTODY_WALLETS = [
    // Recommended (shown by default)
    { name: 'Blue Wallet', icon: '🔵', url: 'https://bluewallet.io', desc: 'Best beginner Bitcoin wallet. Open source. Beautiful UI. Mobile app for iOS & Android. Supports watch-only wallets.', rec: true, tier: 'rec', extra: 'watchonly' },
    { name: 'Aqua Wallet', icon: '💧', url: 'https://aquawallet.io', desc: 'Simple, beautiful Bitcoin & Lightning wallet. Also supports Liquid and Tether (USDt). Great for beginners. Mobile app for iOS & Android.', rec: true, tier: 'rec' },
    { name: 'Blockstream Green', icon: '🟢', url: 'https://blockstream.com/green/', desc: 'From the makers of Liquid. Multi-sig option. Very secure. Mobile app for iOS & Android.', tier: 'rec' },
    // Advanced (hidden by default)
    { name: 'Sparrow Wallet', icon: '🐦', url: 'https://sparrowwallet.com', desc: 'Desktop-only power-user wallet. Full coin control. Best for privacy. ⚠️ No mobile app — beware of scam apps claiming to be Sparrow.', tier: 'advanced', note: 'Desktop only — no mobile app' },
    // Hardware
    { name: 'Trezor', icon: '🔐', url: 'https://trezor.io', desc: 'Popular hardware wallet. Open source. User-friendly. Includes Bitcoin-only firmware.', hardware: true, rec: true },
    { name: 'Coldcard', icon: '❄️', url: 'https://coldcard.com', desc: 'Hardware wallet. Air-gapped signing. The gold standard for security.', hardware: true, note: 'Advanced setup' },
];

var LIGHTNING_WALLETS = [
    { name: 'Wallet of Satoshi', icon: '🟠', url: 'https://walletofsatoshi.com', desc: 'The easiest Lightning wallet. Download and go. Instant Lightning Address.', rec: true },
    { name: 'Phoenix', icon: '🔥', url: 'https://phoenix.acinq.co', desc: 'Self-custodial Lightning. Automated channels. Great balance of ease + sovereignty.' },
    { name: 'Muun Wallet', icon: '🌙', url: 'https://muun.com', desc: 'Self-custodial Bitcoin & Lightning. Clean design, easy backups. Mobile app.' },
    { name: 'Misty Breez', icon: '🌊', url: 'https://breez.technology', desc: 'Non-custodial Lightning wallet. Podcast streaming, point-of-sale mode. Mobile app.' },
    { name: 'Speed Wallet', icon: '⚡', url: 'https://speed.app', desc: 'Fast Lightning payments. Simple interface for everyday spending. Mobile app.' },
    { name: 'Alby', icon: '🐝', url: 'https://getalby.com', desc: 'Browser extension + mobile. WebLN support. Great for tipping online.' },
    { name: 'Zeus', icon: '⚡🔧', url: 'https://zeusln.com', desc: 'Connect your own Lightning node. Full control over channels and routing. Mobile app.', note: 'Advanced — connect your own node' },
];

window.renderFirstPurchase = function() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;

    var currentStep = getStep();
    var selectedRegion = localStorage.getItem('btc_fp_region') || '';
    var esc = typeof escapeHtml === 'function' ? escapeHtml : function(s) { return s; };

    var html = '<div style="min-height:100vh;padding:20px 0;cursor:default;">' +
        '<div style="max-width:580px;margin:0 auto;padding:20px 16px 120px;cursor:auto;">';

    // Header
    html += '<div style="text-align:center;margin-bottom:24px;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div onclick="goHome()" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--text-muted);font-size:0.8rem;">← Back to Archive</div>' +
        '<div style="font-size:2.5rem;margin-bottom:6px;">🛒₿</div>' +
        '<h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0 0 4px;">Your First Bitcoin Purchase</h2>' +
        '<p style="color:var(--text-muted);font-size:0.82rem;margin:0;">From zero to self-custody in 5 steps · No financial advice · Just practical how-to</p>' +
    '</div>';

    // Progress
    html += '<div style="display:flex;align-items:center;gap:4px;margin-bottom:24px;">';
    for (var i = 0; i < STEPS.length; i++) {
        var done = i < currentStep;
        var active = i === currentStep;
        html += '<div style="flex:1;height:6px;border-radius:3px;background:' + (done ? '#22c55e' : active ? 'var(--accent)' : 'rgba(255,255,255,0.1)') + ';transition:0.3s;"></div>';
    }
    html += '</div>';

    // Step content
    var step = STEPS[Math.min(currentStep, STEPS.length - 1)];

    // Step 0: Choose region
    if (currentStep === 0) {
        html += _stepHeader(step);
        var regions = [
            { id: 'us', emoji: '🇺🇸', name: 'United States' },
            { id: 'ca', emoji: '🇨🇦', name: 'Canada' },
            { id: 'uk', emoji: '🇬🇧', name: 'United Kingdom' },
            { id: 'eu', emoji: '🇪🇺', name: 'Europe' },
            { id: 'au', emoji: '🇦🇺', name: 'Australia' },
            { id: 'india', emoji: '🇮🇳', name: 'India' },
            { id: 'asia', emoji: '🌏', name: 'Asia Pacific' },
            { id: 'africa', emoji: '🌍', name: 'Africa' },
            { id: 'mena', emoji: '🕌', name: 'Middle East' },
            { id: 'latam', emoji: '🌎', name: 'Latin America' },
            { id: 'other', emoji: '🌐', name: 'Other / Global' },
        ];
        regions.forEach(function(r) {
            html += '<button onclick="localStorage.setItem(\'btc_fp_region\',\'' + r.id + '\');_fpNav(1)" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px 16px;margin-bottom:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;text-align:left;transition:0.2s;touch-action:manipulation;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                '<span style="font-size:1.5rem;">' + r.emoji + '</span>' + r.name + '</button>';
        });
    }

    // Step 1: Download app
    else if (currentStep === 1) {
        html += _stepHeader(step);
        var region = selectedRegion || 'us';
        var apps = APPS_BY_REGION[region] || APPS_BY_REGION['other'];
        html += '<div style="font-size:0.7rem;color:var(--text-faint);margin-bottom:12px;">Showing apps for: <strong style="color:var(--text);">' + region.toUpperCase() + '</strong> · <button onclick="event.preventDefault();event.stopPropagation();localStorage.setItem(\'btc_first_purchase_step\',\'0\');if(typeof renderFirstPurchase===\'function\')renderFirstPurchase();" style="background:none;border:none;color:var(--accent);cursor:pointer;font-family:inherit;font-size:0.7rem;padding:0;text-decoration:underline;">change region</button></div>';
        apps.forEach(function(app, ai) {
            var border = app.rec ? 'var(--accent)' : 'var(--border)';
            html += '<div style="margin-bottom:10px;background:var(--card-bg);border:1px solid ' + border + ';border-radius:12px;overflow:hidden;">';
            // Main app link
            html += '<a href="' + app.url + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:12px;padding:14px 16px;text-decoration:none;color:var(--text);transition:0.2s;">' +
                '<span style="font-size:1.5rem;">' + app.icon + '</span>' +
                '<div style="flex:1;"><div style="font-weight:700;font-size:0.9rem;">' + app.name + (app.rec ? ' <span style="color:var(--accent);font-size:0.65rem;">★ RECOMMENDED</span>' : '') + ' ↗</div>' +
                '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.4;margin-top:2px;">' + app.desc + '</div></div></a>';
            // Referral section
            if (app.referral || app.referralCode) {
                var copyVal = app.referralCode || app.referral;
                var copyId = '_fpRef' + ai;
                html += '<div style="padding:8px 16px 12px;border-top:1px solid rgba(255,255,255,0.06);display:flex;align-items:center;gap:8px;flex-wrap:wrap;">';
                html += '<span style="font-size:0.72rem;color:#22c55e;font-weight:700;">🎁 ' + (app.referralBonus || 'Referral') + '</span>';
                html += '<span id="' + copyId + '" style="font-size:0.72rem;color:var(--text-muted);background:rgba(255,255,255,0.05);padding:3px 8px;border-radius:6px;font-family:monospace;word-break:break-all;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + (typeof escapeHtml === 'function' ? escapeHtml(copyVal) : copyVal) + '</span>';
                html += '<button onclick="event.preventDefault();event.stopPropagation();var t=document.getElementById(\'' + copyId + '\').textContent;navigator.clipboard.writeText(t).then(function(){if(typeof showToast===\'function\')showToast(\'📋 Copied!\')}).catch(function(){var i=document.createElement(\'textarea\');i.value=t;document.body.appendChild(i);i.select();document.execCommand(\'copy\');document.body.removeChild(i);if(typeof showToast===\'function\')showToast(\'📋 Copied!\')})" style="padding:4px 10px;background:#22c55e;color:#000;border:none;border-radius:6px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;">Copy</button>';
                html += '</div>';
            }
            html += '</div>';
        });
        html += _navButtons(1);
    }

    // Step 2: Buy
    else if (currentStep === 2) {
        html += _stepHeader(step);
        html += '<div style="background:linear-gradient(135deg,rgba(247,147,26,0.08),rgba(234,88,12,0.04));border:1px solid rgba(247,147,26,0.25);border-radius:14px;padding:20px;margin-bottom:16px;">' +
            '<div style="font-size:1.5rem;text-align:center;margin-bottom:8px;">💡</div>' +
            '<div style="color:var(--text);font-size:0.88rem;line-height:1.6;text-align:center;">' +
                '<strong style="color:var(--accent);">You don\'t need to buy a whole Bitcoin.</strong><br><br>' +
                '1 Bitcoin = 100,000,000 satoshis (sats)<br>' +
                '$5 ≈ ~6,000 sats at current prices<br><br>' +
                'Start small. Buy $5-10. Get comfortable. Then set up auto-buy (DCA) to stack regularly.' +
            '</div>' +
        '</div>';
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
            '<div style="font-size:0.75rem;color:var(--accent);font-weight:700;margin-bottom:8px;">📋 STEPS</div>' +
            '<div style="color:var(--text);font-size:0.85rem;line-height:1.8;">' +
                '1. Open the app you downloaded<br>' +
                '2. Complete identity verification (required by law in most countries)<br>' +
                '3. Link your bank account or debit card<br>' +
                '4. Enter the amount you want to buy ($5 minimum on most apps)<br>' +
                '5. Confirm the purchase<br>' +
                '6. <strong>You now own Bitcoin!</strong> 🎉' +
            '</div>' +
        '</div>';
        html += '<div style="padding:12px;background:rgba(34,197,94,0.06);border:1px solid rgba(34,197,94,0.2);border-radius:10px;margin-bottom:12px;color:var(--text-muted);font-size:0.78rem;line-height:1.5;">' +
            '💡 <strong>Pro tip:</strong> Set up auto-buy / DCA (Dollar Cost Averaging). Buy a fixed amount every week or month automatically. This removes emotion from your purchases and builds your stack over time.' +
        '</div>';
        html += _navButtons(2);
    }

    // Step 3: Self-custody
    else if (currentStep === 3) {
        html += _stepHeader(step);
        html += '<div style="background:rgba(239,68,68,0.06);border:1px solid rgba(239,68,68,0.2);border-radius:12px;padding:14px;margin-bottom:16px;color:var(--text);font-size:0.85rem;line-height:1.6;">' +
            '⚠️ <strong>"Not your keys, not your coins."</strong> If you leave your Bitcoin on an exchange, you\'re trusting them to hold it for you. Exchanges get hacked, go bankrupt (FTX), or freeze accounts. Move it to a wallet <em>you</em> control.' +
        '</div>';
        html += '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:8px;">📱 SOFTWARE WALLETS (free, start here)</div>';
        // Recommended wallets (shown by default)
        SELF_CUSTODY_WALLETS.filter(function(w) { return w.tier === 'rec'; }).forEach(function(w) {
            html += _walletCard(w);
        });

        // Advanced wallets (collapsed)
        html += '<button onclick="var p=document.getElementById(\'advWallets\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.textContent=p.style.display===\'none\'?\'🔧 Advanced ▼\':\'🔧 Advanced ▲\'" style="width:100%;padding:10px;background:rgba(168,85,247,0.08);border:1px solid rgba(168,85,247,0.2);border-radius:10px;color:#a855f7;font-size:0.8rem;font-weight:700;cursor:pointer;font-family:inherit;margin:8px 0;transition:0.2s;">🔧 Advanced ▼</button>';
        html += '<div id="advWallets" style="display:none;">';
        SELF_CUSTODY_WALLETS.filter(function(w) { return w.tier === 'advanced'; }).forEach(function(w) {
            html += _walletCard(w);
        });
        html += '</div>';
        html += '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin:16px 0 8px;">🔐 HARDWARE WALLETS (for larger amounts)</div>';
        SELF_CUSTODY_WALLETS.filter(function(w) { return w.hardware; }).forEach(function(w) {
            html += _walletCard(w);
        });
        // ---- Keys & Addresses Education ----
        html += '<div style="margin-top:20px;border-top:1px solid var(--border);padding-top:16px;">' +
            '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:12px;">🔑 UNDERSTANDING KEYS & ADDRESSES</div>' +

            // Public address explanation
            '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:12px;">' +
                '<div style="font-weight:700;font-size:0.9rem;color:var(--heading);margin-bottom:8px;">📬 Public Address <span style="color:#22c55e;font-size:0.7rem;">SAFE TO SHARE</span></div>' +
                '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                    'A public address is like your email address — you give it to people so they can send you Bitcoin. You can also use your own address to send Bitcoin to yourself (e.g., moving from an exchange to your wallet). Anyone can see the balance, but <strong>nobody can spend from it</strong> without the private key.' +
                '</div>' +
                '<div style="padding:10px 12px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.2);border-radius:8px;margin-bottom:12px;font-size:0.78rem;color:var(--text);line-height:1.6;">' +
                    '🔄 <strong>Avoid address reuse.</strong> For privacy, use a fresh address for each transaction. All wallet apps will automatically generate new addresses for you — either on demand or each time you receive. This prevents others from tracking your full balance.' +
                '</div>' +
                '<div style="font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:4px;">EXAMPLE ADDRESSES:</div>' +
                '<div style="font-size:0.65rem;color:#ef4444;margin-bottom:8px;">⚠️ These are examples only — do NOT send Bitcoin to these addresses.</div>' +
                '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 12px;margin-bottom:6px;">' +
                    '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:4px;">Native SegWit (Bech32) — starts with bc1q <span style="color:#22c55e;">✓ Most common today</span></div>' +
                    '<div style="font-family:monospace;font-size:0.72rem;color:var(--text);word-break:break-all;line-height:1.5;">bc1q4c6f849cu67e3h03qudlh3a6yhcdlwk3ulrgug</div>' +
                '</div>' +
                '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 12px;margin-bottom:6px;">' +
                    '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:4px;">SegWit (P2SH) — starts with 3</div>' +
                    '<div style="font-family:monospace;font-size:0.72rem;color:var(--text);word-break:break-all;line-height:1.5;">3J98t1WpEZ73CNmQviecrnyiWrnqRhWNLy</div>' +
                '</div>' +
                '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 12px;">' +
                    '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:4px;">Legacy (P2PKH) — starts with 1</div>' +
                    '<div style="font-family:monospace;font-size:0.72rem;color:var(--text);word-break:break-all;line-height:1.5;">1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa</div>' +
                '</div>' +
            '</div>' +

            // Private key explanation
            '<div style="background:var(--card-bg);border:1px solid rgba(239,68,68,0.3);border-radius:12px;padding:16px;margin-bottom:12px;">' +
                '<div style="font-weight:700;font-size:0.9rem;color:var(--heading);margin-bottom:8px;">🔐 Private Key <span style="color:#ef4444;font-size:0.7rem;">⚠️ NEVER SHARE</span></div>' +
                '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                    'A private key is the <strong>password to your Bitcoin</strong>. Anyone who has it can spend your coins. It\'s a long random number, usually shown in one of these formats:' +
                '</div>' +
                '<div style="background:rgba(239,68,68,0.06);border-radius:8px;padding:10px 12px;margin-bottom:6px;">' +
                    '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:4px;">WIF Format (Wallet Import Format) — starts with 5, K, or L</div>' +
                    '<div style="font-family:monospace;font-size:0.72rem;color:var(--text);word-break:break-all;line-height:1.5;">5HueCGU8rMjxEXxiPuD5BDku4MkFqeZyd4dZ1jvhTVqvbTLvyTJ</div>' +
                '</div>' +
                '<div style="background:rgba(239,68,68,0.06);border-radius:8px;padding:10px 12px;">' +
                    '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:4px;">Hex Format (raw 256-bit number)</div>' +
                    '<div style="font-family:monospace;font-size:0.72rem;color:var(--text);word-break:break-all;line-height:1.5;">e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855</div>' +
                '</div>' +
                '<div style="margin-top:8px;padding:8px 10px;background:rgba(239,68,68,0.08);border-radius:8px;font-size:0.78rem;color:#ef4444;font-weight:600;">⚠️ These are <em>examples only</em> — never use a private key you found online!</div>' +
            '</div>' +

            // Seed phrase explanation
            '<div style="background:var(--card-bg);border:1px solid rgba(234,179,8,0.3);border-radius:12px;padding:16px;margin-bottom:12px;">' +
                '<div style="font-weight:700;font-size:0.9rem;color:var(--heading);margin-bottom:8px;">📝 Seed Phrase (Recovery Words) <span style="color:#eab308;font-size:0.7rem;">⚠️ NEVER SHARE</span></div>' +
                '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                    'Instead of remembering a long private key, wallets generate a <strong>seed phrase</strong> — 12 or 24 random English words that represent ALL your private keys. One seed phrase can generate unlimited addresses.' +
                '</div>' +
                '<div style="background:rgba(234,179,8,0.06);border-radius:8px;padding:12px;margin-bottom:10px;">' +
                    '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:8px;">EXAMPLE 12-WORD SEED (BIP-39):</div>' +
                    '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px 8px;">' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">1. abandon</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">2. ability</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">3. able</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">4. about</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">5. above</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">6. absent</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">7. absorb</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">8. abstract</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">9. absurd</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">10. abuse</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">11. access</span>' +
                        '<span style="font-family:monospace;font-size:0.75rem;color:var(--text);background:rgba(0,0,0,0.3);padding:4px 6px;border-radius:4px;text-align:center;">12. accident</span>' +
                    '</div>' +
                '</div>' +
                '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:8px;">' +
                    '<strong style="color:var(--accent);">How to protect your seed phrase:</strong>' +
                '</div>' +
                '<div style="color:var(--text);font-size:0.8rem;line-height:1.8;">' +
                    '✍️ Write it on <strong>paper</strong> (or stamp it on metal for fire/water protection)<br>' +
                    '🚫 <strong>Never</strong> type it into a website, screenshot it, or store it digitally<br>' +
                    '🏦 Store it in a <strong>safe, private location</strong> — not your phone, not the cloud<br>' +
                    '📋 Make a <strong>backup copy</strong> and store it in a separate physical location<br>' +
                    '🤐 <strong>Never share it</strong> with anyone — no wallet company will ever ask for it' +
                '</div>' +
                '<div style="margin-top:10px;padding:8px 10px;background:rgba(234,179,8,0.08);border-radius:8px;font-size:0.78rem;color:#eab308;font-weight:600;">⚠️ This is an example only! Your wallet will generate a unique seed phrase for you.</div>' +
            '</div>' +

        '</div>';

        // ---- Advanced: Passphrases & Multisig (collapsible) ----
        html += '<div style="margin-top:16px;">' +
            '<button id="fpAdvancedBtn" onclick="var c=document.getElementById(\'fpAdvancedContent\');var b=this;if(c.style.display===\'none\'){c.style.display=\'block\';b.innerHTML=\'🔬 Advanced Security ▲\'}else{c.style.display=\'none\';b.innerHTML=\'🔬 Advanced Security ▼\'}" style="width:100%;padding:12px 16px;background:linear-gradient(135deg,rgba(139,92,246,0.1),rgba(99,102,241,0.05));border:1px solid rgba(139,92,246,0.3);border-radius:12px;color:#a78bfa;font-weight:700;font-size:0.85rem;cursor:pointer;font-family:inherit;text-align:left;transition:0.2s;">🔬 Advanced Security ▼</button>' +
            '<div id="fpAdvancedContent" style="display:none;margin-top:10px;">' +

                // Passphrase (25th word)
                '<div style="background:var(--card-bg);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:16px;margin-bottom:12px;">' +
                    '<div style="font-weight:700;font-size:0.9rem;color:var(--heading);margin-bottom:8px;">🔤 Passphrase (25th Word)</div>' +
                    '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                        'A <strong>passphrase</strong> (sometimes called the "25th word") is an extra password you add on top of your seed phrase. The same 12 or 24 words with a different passphrase creates a <strong>completely different wallet</strong> with different keys and addresses.' +
                    '</div>' +
                    '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                        '<strong style="color:var(--accent);">Why use one?</strong>' +
                    '</div>' +
                    '<div style="color:var(--text);font-size:0.8rem;line-height:1.8;margin-bottom:12px;">' +
                        '🛡️ <strong>Plausible deniability</strong> — if someone forces you to reveal your seed, the default wallet (no passphrase) shows a small decoy balance. Your real funds are hidden behind the passphrase.<br>' +
                        '🔒 <strong>Extra protection</strong> — even if someone steals your seed phrase, they can\'t access your funds without the passphrase.<br>' +
                        '🧠 <strong>Multiple wallets</strong> — use different passphrases to create separate wallets from one seed (savings, spending, etc.).' +
                    '</div>' +
                    '<div style="background:rgba(139,92,246,0.06);border-radius:8px;padding:10px 12px;margin-bottom:8px;">' +
                        '<div style="color:var(--text-muted);font-size:0.65rem;font-weight:600;margin-bottom:4px;">EXAMPLE:</div>' +
                        '<div style="font-size:0.8rem;color:var(--text);line-height:1.6;">' +
                            '<strong>Seed:</strong> abandon ability able about above absent absorb abstract absurd abuse access accident<br>' +
                            '<strong>No passphrase →</strong> Wallet A (decoy, small balance)<br>' +
                            '<strong>Passphrase: "mySecret123" →</strong> Wallet B (real funds, completely different addresses)' +
                        '</div>' +
                    '</div>' +
                    '<div style="padding:8px 10px;background:rgba(239,68,68,0.06);border-radius:8px;font-size:0.78rem;color:#ef4444;line-height:1.5;">' +
                        '⚠️ <strong>Warning:</strong> If you forget your passphrase, your Bitcoin is gone forever. There is no recovery. Write it down separately from your seed phrase and store it securely.' +
                    '</div>' +
                '</div>' +

                // Multisig
                '<div style="background:var(--card-bg);border:1px solid rgba(139,92,246,0.25);border-radius:12px;padding:16px;margin-bottom:12px;">' +
                    '<div style="font-weight:700;font-size:0.9rem;color:var(--heading);margin-bottom:8px;">🗝️ Multisig (Multiple Keys)</div>' +
                    '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                        '<strong>Multisig</strong> (multi-signature) requires <strong>multiple private keys</strong> to authorize a transaction. Instead of one key controlling your Bitcoin, you need M-of-N keys to sign — like a safe that needs 2 of 3 different keys to open.' +
                    '</div>' +
                    '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                        '<strong style="color:var(--accent);">Common setups:</strong>' +
                    '</div>' +
                    '<div style="display:grid;gap:8px;margin-bottom:12px;">' +
                        '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 12px;">' +
                            '<div style="font-weight:700;font-size:0.82rem;color:var(--text);">2-of-3 <span style="color:#22c55e;font-size:0.7rem;">Most popular</span></div>' +
                            '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.5;">3 keys total, any 2 required to spend. Lose one key? You can still access your funds with the other two. Best balance of security and recovery.</div>' +
                        '</div>' +
                        '<div style="background:rgba(0,0,0,0.3);border-radius:8px;padding:10px 12px;">' +
                            '<div style="font-weight:700;font-size:0.82rem;color:var(--text);">3-of-5</div>' +
                            '<div style="color:var(--text-muted);font-size:0.78rem;line-height:1.5;">Maximum redundancy. Can lose 2 keys and still recover. Used by companies, family trusts, and large holdings.</div>' +
                        '</div>' +
                    '</div>' +
                    '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;margin-bottom:12px;">' +
                        '<strong style="color:var(--accent);">Why use multisig?</strong>' +
                    '</div>' +
                    '<div style="color:var(--text);font-size:0.8rem;line-height:1.8;margin-bottom:12px;">' +
                        '🏦 <strong>No single point of failure</strong> — one stolen or lost key doesn\'t mean lost funds<br>' +
                        '🌍 <strong>Geographic distribution</strong> — store keys in different physical locations<br>' +
                        '👥 <strong>Shared custody</strong> — family members, business partners, or inheritance planning<br>' +
                        '🛡️ <strong>Elimination of trust</strong> — no single person has complete control' +
                    '</div>' +
                    '<div style="font-size:0.7rem;color:var(--text-faint);font-weight:700;margin-bottom:6px;">MULTISIG TOOLS:</div>' +
                    '<div style="display:grid;gap:6px;">' +
                        '<a href="https://sparrowwallet.com" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;text-decoration:none;color:var(--text);font-size:0.8rem;"><span>🐦</span><div><strong>Sparrow Wallet</strong> — Free, open source. Best desktop multisig setup.</div></a>' +
                        '<a href="https://nunchuk.io" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;text-decoration:none;color:var(--text);font-size:0.8rem;"><span>🔐</span><div><strong>Nunchuk</strong> — Mobile-friendly multisig. Collaborative key management.</div></a>' +
                        '<a href="https://unchained.com" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:8px;padding:8px 10px;background:rgba(0,0,0,0.2);border-radius:8px;text-decoration:none;color:var(--text);font-size:0.8rem;"><span>⛓️</span><div><strong>Unchained Capital</strong> — Guided 2-of-3 multisig with concierge support.</div></a>' +
                    '</div>' +
                    '<div style="margin-top:10px;padding:8px 10px;background:rgba(234,179,8,0.06);border-radius:8px;font-size:0.78rem;color:#eab308;line-height:1.5;">' +
                        '💡 <strong>Start simple.</strong> Multisig is powerful but complex. Use a single-sig hardware wallet first. Graduate to multisig when your stack grows and you\'re comfortable with the basics.' +
                    '</div>' +
                '</div>' +

            '</div>' +
        '</div>';

        html += '<div style="margin-top:12px;"><a href="#" onclick="event.preventDefault();if(typeof go===\'function\'){goHome();setTimeout(function(){go(\'self-custody\')},300)}" style="color:var(--accent);font-size:0.82rem;font-weight:600;">📖 Read more about self-custody in the archive →</a></div>';
        html += _navButtons(3);
    }

    // Step 4: Pro Tips
    else if (currentStep === 4) {
        html += _stepHeader(step);
        var tips = [
            { emoji: '🚫', title: 'Avoid Altcoin Exchanges', text: 'Stay away from exchanges like Coinbase, Gemini, and Kraken that sell altcoins. They profit by promoting thousands of speculative tokens to newcomers. Stick to <strong>Bitcoin-only</strong> platforms like Strike, River, and Swan.' },
            { emoji: '⚠️', title: 'Never Use Leverage', text: 'Avoid leverage trading and Bitcoin-backed loans unless you are very experienced and fully understand the risks. Liquidation can wipe out your entire stack in minutes.' },
            { emoji: '📉', title: 'Don\'t Try to Trade', text: 'Avoid trading unless you are very experienced. The vast majority of traders lose money — despite what you see posted online. The winners are loud; the losers are silent.' },
            { emoji: '🎰', title: 'Never Risk What You Can\'t Lose', text: 'If you choose to get cute and try to outperform Bitcoin with risky strategies, <strong>never risk any amount of Bitcoin that you can\'t afford to lose.</strong>' },
            { emoji: '🧘', title: 'Don\'t Get Greedy', text: 'Simply buying and holding is one of the most successful strategies in Bitcoin\'s history. Dollar-cost averaging (DCA) + patience has outperformed almost every trading strategy. You really can\'t go wrong with it.' },
            { emoji: '🔒', title: 'Never Share Your Seed Phrase', text: 'No legitimate service, company, or person will ever ask for your 12 or 24-word seed phrase. Anyone who asks is trying to steal your Bitcoin. Period.' },
            { emoji: '🎣', title: 'Watch for Scams', text: 'If someone promises guaranteed returns, "free Bitcoin," or asks you to send Bitcoin to receive more back — it\'s a scam. 100% of the time. No exceptions.' },
            { emoji: '📵', title: 'Don\'t Talk About Your Stack', text: 'Keep your Bitcoin holdings private. Don\'t tell people how much you own. This protects you from social engineering, phishing, and even physical threats.' },
            { emoji: '🧠', title: 'Keep Learning', text: 'Bitcoin is deep. The more you learn, the more confident you\'ll feel holding through volatility. Read the <a href="#" onclick="event.preventDefault();_fpSaveStep(5);go(\'whitepaper\')" style="color:var(--accent);font-weight:600;">Whitepaper</a>, explore the archive, and ask Nacho anything.' },
            { emoji: '⏰', title: 'Think Long-Term', text: 'Bitcoin is volatile in the short term but has outperformed every asset class over any 4+ year period in its history. Zoom out. Think in years, not days.' }
        ];
        tips.forEach(function(tip) {
            html += '<div style="padding:14px;margin-bottom:8px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;">' +
                '<div style="display:flex;align-items:flex-start;gap:10px;">' +
                    '<span style="font-size:1.3rem;flex-shrink:0;margin-top:2px;">' + tip.emoji + '</span>' +
                    '<div><div style="font-weight:700;font-size:0.88rem;color:var(--heading);margin-bottom:4px;">' + tip.title + '</div>' +
                    '<div style="color:var(--text);font-size:0.82rem;line-height:1.6;">' + tip.text + '</div></div>' +
                '</div></div>';
        });
        html += _navButtons(4);
    }

    // Step 5: You're a Bitcoiner!
    else if (currentStep === 5) {
        // Award Bitcoiner badge + 100 pts (once)
        if (localStorage.getItem('btc_fp_completed') !== 'true') {
            localStorage.setItem('btc_fp_completed', 'true');
            if (typeof awardPoints === 'function') awardPoints(100, '🛒 First Bitcoin Purchase guide complete!');
            if (typeof showToast === 'function') showToast('🛒🏅 Bitcoiner badge earned! +100 pts');
            if (typeof launchConfetti === 'function') launchConfetti();
            if (typeof initBadges === 'function') setTimeout(initBadges, 500);
        }
        html += '<div style="text-align:center;padding:30px 0;">' +
            '<div style="font-size:4rem;margin-bottom:16px;">🎉₿🎉</div>' +
            '<h2 style="color:var(--heading);font-size:1.5rem;font-weight:900;margin:0 0 8px;">You\'re a Bitcoiner!</h2>' +
            '<p style="color:var(--text-muted);font-size:0.9rem;line-height:1.6;margin-bottom:24px;">' +
                'You\'ve bought Bitcoin and safely moved it to your own wallet. Welcome to the hardest money humanity has ever created.<br><br>' +
                '<strong style="color:var(--accent);">Next step, set up Lightning!</strong>' +
            '</p>' +
            '<div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:24px;">' +
                '<button onclick="_fpNav(6)" style="padding:12px 24px;background:linear-gradient(135deg,#f7931a,#ea580c);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;font-size:0.95rem;">⚡ Set Up Lightning</button>' +
                '<button onclick="if(typeof go===\'function\')go(\'trails\')" style="padding:12px 24px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-weight:700;cursor:pointer;font-family:inherit;">🦌 Continue Learning</button>' +
                '<button onclick="goHome()" style="padding:12px 24px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-weight:700;cursor:pointer;font-family:inherit;">🏠 Home</button>' +
            '</div>' +
            '<div style="border-top:1px solid var(--border);padding-top:20px;">' +
                '<div style="color:var(--text-faint);font-size:0.75rem;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin-bottom:10px;text-align:center;">📖 Review Steps</div>' +
                '<div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">' +
                    '<button onclick="_fpNav(0)" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">🌍 Region</button>' +
                    '<button onclick="_fpNav(1)" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">📱 Download App</button>' +
                    '<button onclick="_fpNav(2)" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">💰 Buy Bitcoin</button>' +
                    '<button onclick="_fpNav(3)" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">🔐 Self-Custody</button>' +
                    '<button onclick="_fpNav(4)" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">🛡️ Pro Tips</button>' +
                    '<button onclick="_fpNav(6)" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;">⚡ Lightning</button>' +
                '</div>' +
            '</div>' +
        '</div>';

        // Award tickets on first completion (points + badge handled above via btc_fp_completed)
        if (!localStorage.getItem('btc_first_purchase_done')) {
            localStorage.setItem('btc_first_purchase_done', '1');
            if (typeof awardOrangeTickets === 'function') awardOrangeTickets(10, '🛒 First Purchase');
        }
    }

    // Step 6: Lightning (bonus step after completion)
    else if (currentStep >= 6) {
        html += _stepHeader(step);
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="color:var(--text);font-size:0.85rem;line-height:1.7;">' +
                'The <strong>Lightning Network</strong> is Bitcoin\'s payment layer. It enables:<br><br>' +
                '⚡ <strong>Instant</strong> payments (milliseconds, not minutes)<br>' +
                '💸 <strong>Near-free</strong> fees (fraction of a cent)<br>' +
                '🌍 <strong>Global</strong> reach (works everywhere, 24/7)<br>' +
                '🪙 <strong>Tiny amounts</strong> (send 1 sat = $0.0003)<br>' +
            '</div>' +
        '</div>';
        html += '<div style="font-size:0.72rem;color:var(--accent);font-weight:700;margin-bottom:8px;">⚡ LIGHTNING WALLETS</div>';
        LIGHTNING_WALLETS.forEach(function(w) {
            html += _walletCard(w);
        });
        html += '<div style="margin-top:12px;"><a href="#" onclick="event.preventDefault();if(typeof go===\'function\'){goHome();setTimeout(function(){go(\'lightning\')},300)}" style="color:var(--accent);font-size:0.82rem;font-weight:600;">⚡ Set up Lightning in the archive →</a></div>';
        html += '<div style="display:flex;justify-content:space-between;margin-top:20px;">' +
            '<button onclick="_fpNav(5)" style="padding:10px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;touch-action:manipulation;">← Back</button>' +
            '<button onclick="goHome()" style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">🏠 Home</button>' +
        '</div>';
    }

    html += '</div></div>';
    fc.innerHTML = html;
    fc.scrollTop = 0;
    var mainEl = document.getElementById('main');
    if (mainEl) mainEl.scrollTop = 0;
    window.scrollTo(0, 0);

    // ---- Swipe navigation between steps ----
    var _fpSwipeX0 = null;
    var _fpSwipeY0 = null;
    var _fpSwiping = false;
    var fpContainer = fc.querySelector('div');
    if (fpContainer) {
        fpContainer.addEventListener('touchstart', function(e) {
            if (e.touches.length !== 1) return;
            _fpSwipeX0 = e.touches[0].clientX;
            _fpSwipeY0 = e.touches[0].clientY;
            _fpSwiping = false;
        }, { passive: true });
        fpContainer.addEventListener('touchmove', function(e) {
            if (_fpSwipeX0 === null) return;
            var dx = Math.abs(e.touches[0].clientX - _fpSwipeX0);
            var dy = Math.abs(e.touches[0].clientY - _fpSwipeY0);
            if (dx > dy && dx > 15) _fpSwiping = true;
        }, { passive: true });
        fpContainer.addEventListener('touchend', function(e) {
            if (_fpSwipeX0 === null || !_fpSwiping) { _fpSwipeX0 = null; return; }
            var endX = e.changedTouches[0].clientX;
            var diff = endX - _fpSwipeX0;
            _fpSwipeX0 = null;
            _fpSwiping = false;
            var curStep = getStep();
            var maxStep = STEPS.length - 1;
            if (diff < -60 && curStep < maxStep) {
                // Swipe left → next step (only if not on region select without selection)
                if (curStep === 0 && !localStorage.getItem('btc_fp_region')) return;
                _fpNav(curStep + 1);
            } else if (diff > 60 && curStep > 0) {
                // Swipe right → previous step
                _fpNav(curStep - 1);
            }
        }, { passive: true });
    }
};

function _stepHeader(step) {
    return '<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">' +
        '<div style="width:44px;height:44px;background:var(--accent);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0;">' + step.emoji + '</div>' +
        '<div><div style="color:var(--heading);font-weight:800;font-size:1.05rem;">' + step.title + '</div>' +
        '<div style="color:var(--text-muted);font-size:0.78rem;">' + step.desc + '</div></div></div>';
}

function _walletCard(w) {
    var badge = w.rec ? ' <span style="color:var(--accent);font-size:0.6rem;">★ RECOMMENDED</span>' : '';
    if (w.note) badge = ' <span style="color:#a855f7;font-size:0.6rem;font-weight:600;">' + w.note + '</span>';
    var html = '<a href="' + w.url + '" target="_blank" rel="noopener" style="display:flex;align-items:center;gap:10px;padding:12px 14px;margin-bottom:' + (w.extra ? '4px' : '6px') + ';background:var(--card-bg);border:1px solid ' + (w.rec ? 'var(--accent)' : 'var(--border)') + ';border-radius:10px;text-decoration:none;color:var(--text);transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'' + (w.rec ? 'var(--accent)' : 'var(--border)') + '\'">' +
        '<span style="font-size:1.3rem;">' + w.icon + '</span>' +
        '<div style="flex:1;"><div style="font-weight:700;font-size:0.85rem;">' + w.name + badge + ' ↗</div>' +
        '<div style="color:var(--text-muted);font-size:0.75rem;line-height:1.4;margin-top:1px;">' + w.desc + '</div></div></a>';
    if (w.extra === 'watchonly') {
        html += '<button onclick="var p=document.getElementById(\'watchOnlyInfo\');p.style.display=p.style.display===\'none\'?\'block\':\'none\';this.textContent=p.style.display===\'none\'?\'👁️ What is a Watch-Only Wallet? ▼\':\'👁️ What is a Watch-Only Wallet? ▲\'" style="width:100%;padding:8px 12px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.2);border-radius:8px;color:#3b82f6;font-size:0.75rem;font-weight:700;cursor:pointer;font-family:inherit;margin-bottom:6px;transition:0.2s;">👁️ What is a Watch-Only Wallet? ▼</button>' +
        '<div id="watchOnlyInfo" style="display:none;padding:14px;background:var(--card-bg);border:1px solid rgba(59,130,246,0.2);border-radius:10px;margin-bottom:8px;font-size:0.8rem;color:var(--text);line-height:1.6;">' +
            '<div style="font-weight:700;color:var(--heading);margin-bottom:6px;">👁️ Watch-Only Wallet</div>' +
            '<p style="margin:0 0 8px;">A watch-only wallet lets you <strong>monitor your Bitcoin balance and transactions</strong> without being able to spend. It only has your public key (xpub) — no private keys.</p>' +
            '<div style="font-weight:700;color:var(--accent);font-size:0.75rem;margin-bottom:4px;">WHY USE ONE?</div>' +
            '<div style="margin-bottom:8px;">' +
                '📊 Check your balance anytime without exposing your keys<br>' +
                '🔐 Keep your private keys on a hardware wallet or air-gapped device<br>' +
                '📱 Carry your phone without risk — even if stolen, funds are safe<br>' +
                '✅ Verify incoming payments without touching cold storage' +
            '</div>' +
            '<div style="font-weight:700;color:var(--accent);font-size:0.75rem;margin-bottom:4px;">HOW TO SET UP IN BLUE WALLET</div>' +
            '<div>' +
                '1. Open Blue Wallet → tap <strong>+</strong> to add a wallet<br>' +
                '2. Select <strong>"Import Wallet"</strong><br>' +
                '3. Paste your <strong>xpub</strong> (extended public key) from your hardware wallet or other wallet<br>' +
                '4. Blue Wallet detects it as watch-only and shows a 👁️ icon<br>' +
                '5. You can now see all transactions and balances — but cannot spend' +
            '</div>' +
            '<div style="margin-top:8px;padding:8px 10px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.15);border-radius:6px;font-size:0.72rem;color:var(--text-muted);">' +
                '💡 <strong>Tip:</strong> Your xpub is found in your wallet\'s settings under "Account Details" or "Export." Never share your xprv (private key) — only your xpub is needed for watch-only.' +
            '</div>' +
        '</div>';
    }
    return html;
}

function _navButtons(stepNum) {
    return '<div style="display:flex;justify-content:space-between;margin-top:20px;">' +
        '<button onclick="_fpNav(' + (stepNum - 1) + ')" style="padding:10px 20px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);cursor:pointer;font-family:inherit;touch-action:manipulation;">← Back</button>' +
        '<button onclick="_fpNav(' + (stepNum + 1) + ')" style="padding:10px 24px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">Next Step →</button>' +
    '</div>';
}

window._fpSaveStep = function(n) { saveStep(n); };

// Single navigation function
window._fpNav = function(step) {
    saveStep(step);
    // Use requestAnimationFrame to ensure click event completes before DOM replacement
    requestAnimationFrame(function() {
        renderFirstPurchase();
        // Scroll to top of content
        var fc = document.getElementById('forumContainer');
        if (fc) fc.scrollTop = 0;
        var main = document.getElementById('main');
        if (main) main.scrollTop = 0;
    });
};

// Route: go('first-purchase') — now handled by app.js _routeApp retry
// No need to wrap window.go; app.js calls renderFirstPurchase() directly

console.log('[FIRST PURCHASE] Guide loaded');
})();
