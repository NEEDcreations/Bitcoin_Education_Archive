// © 2024-2026 603BTC LLC. All rights reserved.
// =============================================
// ₿ Self-Custody On-Chain Wallet
// Route: go('wallet')
// Keys generated & encrypted client-side.
// Private keys NEVER leave the device.
// =============================================

(function() {
'use strict';

var _w = {
    unlocked: false,
    addresses: [],
    balance: null,
    txs: [],
    price: 0,
    selIdx: 0,
};

// ─── Storage ─────────────────────────────────────────────
function hasWallet() { return !!localStorage.getItem('btc_wallet_enc'); }
function saveEnc(o) { localStorage.setItem('btc_wallet_enc', JSON.stringify(o)); }
function getEnc() { try { return JSON.parse(localStorage.getItem('btc_wallet_enc')); } catch(e) { return null; } }
function saveAddrCache(a) { localStorage.setItem('btc_wallet_addrs', JSON.stringify(a)); }
function getAddrCache() { try { return JSON.parse(localStorage.getItem('btc_wallet_addrs')) || []; } catch(e) { return []; } }

// ─── MAIN RENDER ─────────────────────────────────────────
window.renderWallet = function() {
    var fc = document.getElementById('forumContainer');
    if (!fc) return;
    if (!_w.unlocked && hasWallet()) _w.addresses = getAddrCache();

    var h = '<div style="max-width:580px;margin:0 auto;padding:20px 16px 120px;">';

    // Header
    h += '<div style="text-align:center;margin-bottom:24px;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div onclick="goHome()" style="cursor:pointer;display:inline-flex;align-items:center;gap:8px;margin-bottom:12px;color:var(--text-muted);font-size:0.8rem;">← Back to Archive</div>' +
        '<div style="font-size:2.5rem;margin-bottom:6px;">₿</div>' +
        '<h2 style="color:var(--heading);font-size:1.4rem;font-weight:900;margin:0 0 4px;">Self-Custody Wallet</h2>' +
        '<p style="color:var(--text-muted);font-size:0.82rem;margin:0;">Your keys · Your coins · 100% client-side</p>' +
    '</div>';

    if (!hasWallet()) h += renderSetup();
    else if (!_w.unlocked) h += renderLocked();
    else h += renderDashboard();

    h += '</div>';
    fc.innerHTML = h;
};

// ─── Setup (create / import) ─────────────────────────────
function renderSetup() {
    return '<div style="animation:fadeSlideIn 0.5s ease-out;">' +
        // Security callout
        '<div style="padding:14px 16px;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:14px;margin-bottom:18px;display:flex;gap:10px;align-items:flex-start;">' +
            '<span style="font-size:1.1rem;margin-top:1px;">🔒</span>' +
            '<div style="color:var(--text);font-size:0.82rem;line-height:1.55;">Your seed phrase is generated <strong>on your device</strong> using cryptographic randomness, encrypted with your password, and <strong>never sent to any server</strong>. We cannot recover it.</div>' +
        '</div>' +

        // Create
        '<div style="padding:20px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;margin-bottom:10px;">' +
            '<h3 style="color:var(--heading);font-size:1.05rem;font-weight:700;margin:0 0 6px;">Create New Wallet</h3>' +
            '<p style="color:var(--text-muted);font-size:0.82rem;margin:0 0 14px;">BIP39 seed · Native SegWit (bc1) · BIP84 derivation</p>' +
            '<input type="password" id="wcPwd" placeholder="Choose a strong password…" style="width:100%;padding:11px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.92rem;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:8px;" minlength="8">' +
            '<input type="password" id="wcPwd2" placeholder="Confirm password…" style="width:100%;padding:11px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.92rem;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:12px;">' +
            '<button onclick="walletCreate()" style="width:100%;padding:13px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;touch-action:manipulation;">⚡ Generate Wallet</button>' +
            '<div id="wcStatus" style="text-align:center;margin-top:8px;font-size:0.82rem;"></div>' +
        '</div>' +

        '<p style="text-align:center;margin-top:14px;color:var(--text-faint);font-size:0.72rem;line-height:1.5;">⚠️ This is an educational wallet. For significant amounts, use a hardware wallet (Coldcard, Trezor, BitKey).</p>' +
    '</div>';
}

// ─── Locked ──────────────────────────────────────────────
function renderLocked() {
    var a = _w.addresses;
    var preview = a.length > 0 ? a[0].address : '…';
    var short = preview.length > 20 ? preview.substr(0, 10) + '…' + preview.substr(-8) : preview;

    return '<div style="animation:fadeSlideIn 0.4s ease-out;">' +
        '<div style="padding:28px;background:var(--card-bg);border:1px solid var(--border);border-radius:16px;text-align:center;">' +
            '<div style="font-size:2rem;margin-bottom:10px;">🔐</div>' +
            '<h3 style="color:var(--heading);font-size:1.05rem;font-weight:700;margin:0 0 4px;">Wallet Locked</h3>' +
            '<p style="color:var(--text-muted);font-size:0.78rem;font-family:monospace;margin:0 0 14px;">' + escapeHtml(short) + '</p>' +
            '<input type="password" id="wuPwd" placeholder="Wallet password…" style="width:100%;max-width:280px;padding:11px 14px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.92rem;font-family:inherit;outline:none;text-align:center;margin-bottom:12px;box-sizing:border-box;" onkeydown="if(event.key===\'Enter\')walletUnlock()">' +
            '<br><button onclick="walletUnlock()" style="padding:13px 36px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">🔓 Unlock</button>' +
            '<div id="wuStatus" style="margin-top:8px;font-size:0.82rem;"></div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:14px;">' +
            '<button onclick="walletDeleteConfirm()" style="background:none;border:none;color:var(--text-faint);font-size:0.78rem;cursor:pointer;font-family:inherit;">Delete wallet from this device</button>' +
        '</div>' +
    '</div>';
}

// ─── Dashboard ───────────────────────────────────────────
function renderDashboard() {
    var bal = _w.balance;
    var tot = bal ? bal.total : 0;
    var price = _w.price;
    var addr = _w.addresses[_w.selIdx] || _w.addresses[0];
    var h = '<div style="animation:fadeSlideIn 0.4s ease-out;">';

    // Balance card
    h += '<div style="padding:22px;background:linear-gradient(135deg,rgba(249,115,22,0.1),rgba(234,88,12,0.05));border:1px solid rgba(249,115,22,0.25);border-radius:20px;text-align:center;margin-bottom:14px;">' +
        '<div style="color:var(--text-muted);font-size:0.7rem;text-transform:uppercase;letter-spacing:1.5px;font-weight:700;margin-bottom:4px;">On-Chain Balance</div>' +
        '<div style="color:var(--heading);font-size:1.9rem;font-weight:900;margin-bottom:2px;">' +
            (bal ? WalletBridge.formatSats(tot) : '<span class="skeleton" style="display:inline-block;width:110px;height:26px;"></span>') + '</div>' +
        (price ? '<div style="color:var(--accent);font-size:0.95rem;font-weight:600;">' + WalletBridge.formatUsd(tot, price) + '</div>' : '') +
        (bal && bal.unconfirmed ? '<div style="color:var(--text-faint);font-size:0.72rem;margin-top:4px;">⏳ ' + WalletBridge.formatSats(bal.unconfirmed) + ' unconfirmed</div>' : '') +
    '</div>';

    // Actions
    h += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:16px;">' +
        '<button onclick="walletShowReceive()" style="padding:13px 6px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;color:var(--text);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:5px;transition:0.2s;touch-action:manipulation;"><span style="font-size:1.2rem;">📥</span>Receive</button>' +
        '<button onclick="walletShowSend()" style="padding:13px 6px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;color:var(--text);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:5px;"><span style="font-size:1.2rem;">📤</span>Send</button>' +
        '<button onclick="walletShowSettings()" style="padding:13px 6px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;color:var(--text);font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;flex-direction:column;align-items:center;gap:5px;"><span style="font-size:1.2rem;">⚙️</span>Settings</button>' +
    '</div>';

    // Current address
    if (addr) {
        h += '<div style="padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:14px;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">' +
                '<span style="color:var(--text-dim);font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:1px;">Receiving Address</span>' +
                '<span style="color:var(--text-faint);font-size:0.68rem;">' + escapeHtml(addr.path) + '</span>' +
            '</div>' +
            '<div onclick="walletCopyAddr(\'' + addr.address + '\')" style="padding:9px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;font-family:monospace;font-size:0.76rem;color:var(--accent);word-break:break-all;line-height:1.5;cursor:pointer;transition:0.2s;" title="Tap to copy">' + escapeHtml(addr.address) + '</div>' +
            '<div style="text-align:center;margin-top:3px;"><span style="color:var(--text-faint);font-size:0.68rem;">Tap to copy</span></div>' +
        '</div>';
    }

    // Go to Lightning
    h += '<button onclick="go(\'lightning\')" style="width:100%;padding:13px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:14px;color:var(--heading);font-size:0.88rem;font-weight:700;cursor:pointer;font-family:inherit;display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;transition:0.2s;touch-action:manipulation;">⚡ Connect Lightning Wallet</button>';

    // Transactions
    h += '<h3 style="color:var(--heading);font-size:0.9rem;font-weight:700;margin:0 0 8px;">Recent Transactions</h3>';
    if (_w.txs.length === 0) {
        h += '<div style="padding:28px;text-align:center;color:var(--text-faint);font-size:0.82rem;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;">📭 No transactions yet. Share your address to receive Bitcoin!</div>';
    } else {
        var myAddrs = _w.addresses.map(function(a) { return a.address; });
        _w.txs.slice(0, 10).forEach(function(tx) {
            var isIn = tx.vout && tx.vout.some(function(o) { return o.scriptpubkey_address && myAddrs.indexOf(o.scriptpubkey_address) !== -1; });
            var amt = 0;
            if (tx.vout) tx.vout.forEach(function(o) { if (o.scriptpubkey_address && myAddrs.indexOf(o.scriptpubkey_address) !== -1) amt += o.value || 0; });
            var conf = tx.status && tx.status.confirmed;
            var t = tx.status && tx.status.block_time ? new Date(tx.status.block_time * 1000).toLocaleDateString() : 'Pending';

            h += '<div onclick="window.open(\'https://mempool.space/tx/' + tx.txid + '\',\'_blank\')" style="display:flex;align-items:center;gap:10px;padding:11px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;margin-bottom:5px;cursor:pointer;transition:0.15s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                '<div style="font-size:1.2rem;">' + (isIn ? '📥' : '📤') + '</div>' +
                '<div style="flex:1;min-width:0;"><div style="color:var(--text);font-size:0.82rem;font-weight:600;">' + (isIn ? 'Received' : 'Sent') + '</div><div style="color:var(--text-faint);font-size:0.68rem;">' + t + (conf ? '' : ' ⏳') + '</div></div>' +
                '<div style="text-align:right;"><div style="color:' + (isIn ? '#22c55e' : 'var(--text)') + ';font-size:0.82rem;font-weight:700;">' + (isIn ? '+' : '-') + WalletBridge.formatSats(amt) + '</div>' +
                (price ? '<div style="color:var(--text-faint);font-size:0.68rem;">' + WalletBridge.formatUsd(amt, price) + '</div>' : '') + '</div>' +
            '</div>';
        });
    }

    // Lock
    h += '<div style="text-align:center;margin-top:16px;"><button onclick="walletLock()" style="background:none;border:1px solid var(--border);color:var(--text-muted);padding:9px 22px;border-radius:10px;font-size:0.82rem;cursor:pointer;font-family:inherit;">🔐 Lock Wallet</button></div>';

    h += '</div>';
    return h;
}

// ─── Actions ─────────────────────────────────────────────
window.walletCreate = async function() {
    var p1 = document.getElementById('wcPwd'), p2 = document.getElementById('wcPwd2'), st = document.getElementById('wcStatus');
    if (!p1 || !p1.value || p1.value.length < 8) { st.innerHTML = '<span style="color:#ef4444;">Password must be at least 8 characters</span>'; return; }
    if (p1.value !== p2.value) { st.innerHTML = '<span style="color:#ef4444;">Passwords don\'t match</span>'; return; }
    st.innerHTML = '<span style="color:var(--accent);">⏳ Generating…</span>';
    try {
        var w = await WalletCore.createWallet(p1.value, 12);
        saveEnc(w.encrypted); saveAddrCache(w.addresses);
        _w.unlocked = true; _w.addresses = w.addresses;
        showSeedBackup(w.mnemonic);
    } catch(e) { st.innerHTML = '<span style="color:#ef4444;">' + escapeHtml(e.message) + '</span>'; }
};

window.walletImport = async function() {
    var seed = document.getElementById('wiSeed'), pwd = document.getElementById('wiPwd'), st = document.getElementById('wiStatus');
    if (!seed || !seed.value.trim()) { st.innerHTML = '<span style="color:#ef4444;">Enter your seed phrase</span>'; return; }
    if (!pwd || !pwd.value || pwd.value.length < 8) { st.innerHTML = '<span style="color:#ef4444;">Password must be at least 8 characters</span>'; return; }
    st.innerHTML = '<span style="color:var(--accent);">⏳ Importing…</span>';
    try {
        var w = await WalletCore.restoreWallet(seed.value.trim(), pwd.value);
        saveEnc(w.encrypted); saveAddrCache(w.addresses);
        _w.unlocked = true; _w.addresses = w.addresses;
        if (typeof showToast === 'function') showToast('✅ Wallet imported!');
        renderWallet(); refreshWalletData();
    } catch(e) { st.innerHTML = '<span style="color:#ef4444;">' + escapeHtml(e.message) + '</span>'; }
};

window.walletUnlock = async function() {
    var pwd = document.getElementById('wuPwd'), st = document.getElementById('wuStatus');
    if (!pwd || !pwd.value) { st.innerHTML = '<span style="color:#ef4444;">Enter your password</span>'; return; }
    st.innerHTML = '<span style="color:var(--accent);">⏳ Decrypting…</span>';
    try {
        var enc = getEnc(), mnemonic = await WalletCore.decryptSeed(enc, pwd.value);
        var s = await WalletCore.mnemonicToSeed(mnemonic);
        var addrs = await WalletCore.deriveAddresses(s, 5);
        _w.unlocked = true; _w.addresses = addrs; saveAddrCache(addrs);
        renderWallet(); refreshWalletData();
    } catch(e) { st.innerHTML = '<span style="color:#ef4444;">Wrong password</span>'; }
};

window.walletLock = function() { _w.unlocked = false; _w.balance = null; _w.txs = []; renderWallet(); };

async function refreshWalletData() {
    if (!_w.unlocked) return;
    try {
        _w.price = await WalletBridge.getBtcPrice();
        _w.balance = await WalletBridge.getWalletBalance(_w.addresses.map(function(a) { return a.address; }));
        _w.txs = await WalletBridge.getWalletTxs(_w.addresses.map(function(a) { return a.address; }));
        renderWallet();
    } catch(e) { console.warn('[WALLET] refresh error:', e); }
}

// ─── Receive overlay ─────────────────────────────────────
window.walletShowReceive = function() {
    var addr = _w.addresses[_w.selIdx] || _w.addresses[0];
    if (!addr) return;
    var ov = document.createElement('div');
    ov.id = 'walletRecvOv';
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:26px;max-width:360px;width:100%;text-align:center;animation:fadeSlideIn 0.3s;">' +
        '<h3 style="color:var(--heading);font-size:1.15rem;font-weight:800;margin:0 0 14px;">📥 Receive Bitcoin</h3>' +
        '<div style="margin-bottom:14px;">' + WalletCore.generateAddressQR(addr.address, 200) + '</div>' +
        '<div onclick="walletCopyAddr(\'' + addr.address + '\')" style="padding:10px;background:var(--input-bg);border:1px solid var(--border);border-radius:10px;font-family:monospace;font-size:0.72rem;color:var(--accent);word-break:break-all;line-height:1.5;cursor:pointer;margin-bottom:10px;">' + escapeHtml(addr.address) + '</div>' +
        '<button onclick="walletCopyAddr(\'' + addr.address + '\')" style="width:100%;padding:11px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.92rem;font-weight:700;cursor:pointer;font-family:inherit;">📋 Copy Address</button>' +
        '<p style="color:var(--text-faint);font-size:0.68rem;margin:10px 0 0;">Only send Bitcoin (BTC) to this address.</p>' +
    '</div>';
    document.body.appendChild(ov);
};

// ─── Send info overlay ───────────────────────────────────
window.walletShowSend = function() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:26px;max-width:380px;width:100%;animation:fadeSlideIn 0.3s;">' +
        '<h3 style="color:var(--heading);font-size:1.15rem;font-weight:800;margin:0 0 14px;text-align:center;">📤 Send Bitcoin</h3>' +
        '<div style="padding:14px;background:rgba(234,179,8,0.08);border:1px solid rgba(234,179,8,0.25);border-radius:12px;margin-bottom:14px;">' +
            '<p style="color:var(--text);font-size:0.85rem;font-weight:600;margin:0 0 6px;">Transaction signing is coming soon!</p>' +
            '<p style="color:var(--text-muted);font-size:0.8rem;margin:0;">For now, export your seed phrase to a full wallet app to send transactions:</p>' +
        '</div>' +
        '<div style="display:flex;flex-direction:column;gap:6px;margin-bottom:14px;">' +
            '<div style="padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.82rem;"><strong>BlueWallet</strong> — iOS & Android</div>' +
            '<div style="padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.82rem;"><strong>Sparrow</strong> — Desktop (Windows/Mac/Linux)</div>' +
            '<div style="padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.82rem;"><strong>Electrum</strong> — Desktop & Android</div>' +
        '</div>' +
        '<button onclick="walletShowSettings()" style="width:100%;padding:11px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.88rem;font-weight:600;cursor:pointer;font-family:inherit;">⚙️ Export Seed in Settings</button>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="width:100%;padding:9px;background:none;border:none;color:var(--text-faint);font-size:0.82rem;cursor:pointer;font-family:inherit;margin-top:6px;">Close</button>' +
    '</div>';
    document.body.appendChild(ov);
};

// ─── Settings overlay ────────────────────────────────────
window.walletShowSettings = function() {
    var ov = document.createElement('div');
    ov.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.85);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);z-index:10000;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;';
    ov.onclick = function(e) { if (e.target === ov) ov.remove(); };
    ov.innerHTML = '<div style="background:var(--bg-side);border:1px solid var(--border);border-radius:20px;padding:26px;max-width:400px;width:100%;animation:fadeSlideIn 0.3s;margin:auto;">' +
        '<h3 style="color:var(--heading);font-size:1.15rem;font-weight:800;margin:0 0 18px;text-align:center;">⚙️ Wallet Settings</h3>' +
        // Export seed
        '<div style="padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;">' +
            '<h4 style="color:var(--heading);font-size:0.88rem;font-weight:700;margin:0 0 6px;">🔑 Export Seed Phrase</h4>' +
            '<input type="password" id="wExpPwd" placeholder="Enter wallet password…" style="width:100%;padding:9px 12px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:0.88rem;font-family:inherit;outline:none;box-sizing:border-box;margin-bottom:8px;">' +
            '<button onclick="walletExportSeed()" style="width:100%;padding:9px;background:#ef4444;color:#fff;border:none;border-radius:8px;font-size:0.82rem;font-weight:700;cursor:pointer;font-family:inherit;">⚠️ Reveal Seed Phrase</button>' +
            '<div id="wExpResult" style="margin-top:6px;"></div>' +
        '</div>' +
        // Addresses list
        '<div style="padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:14px;margin-bottom:10px;">' +
            '<h4 style="color:var(--heading);font-size:0.88rem;font-weight:700;margin:0 0 6px;">📋 Your Addresses</h4>' +
            _w.addresses.map(function(a) {
                return '<div onclick="walletCopyAddr(\'' + a.address + '\')" style="padding:5px 0;border-bottom:1px solid var(--msg-border);font-family:monospace;font-size:0.68rem;color:var(--text-muted);word-break:break-all;cursor:pointer;" title="Tap to copy">' +
                    '<span style="color:var(--text-faint);">' + a.path + '</span><br><span style="color:var(--accent);">' + a.address + '</span></div>';
            }).join('') +
        '</div>' +
        // Delete
        '<div style="text-align:center;margin-top:12px;"><button onclick="walletDeleteConfirm()" style="background:none;border:1px solid #ef4444;color:#ef4444;padding:9px 22px;border-radius:10px;font-size:0.82rem;cursor:pointer;font-family:inherit;">🗑️ Delete Wallet From Device</button></div>' +
        '<button onclick="this.closest(\'div[style*=fixed]\').remove()" style="width:100%;padding:9px;background:none;border:none;color:var(--text-faint);font-size:0.82rem;cursor:pointer;font-family:inherit;margin-top:10px;">Close</button>' +
    '</div>';
    document.body.appendChild(ov);
};

// ─── Seed backup screen ──────────────────────────────────
function showSeedBackup(mnemonic) {
    var words = mnemonic.split(' ');
    var fc = document.getElementById('forumContainer');
    if (!fc) return;
    var h = '<div style="max-width:480px;margin:0 auto;padding:20px 16px 120px;animation:fadeSlideIn 0.4s ease-out;">' +
        '<div style="text-align:center;margin-bottom:18px;"><div style="font-size:2rem;margin-bottom:6px;">⚠️</div>' +
        '<h2 style="color:#ef4444;font-size:1.2rem;font-weight:900;margin:0 0 6px;">BACKUP YOUR SEED PHRASE</h2>' +
        '<p style="color:var(--text);font-size:0.88rem;margin:0;">Write these words down on paper. This is the <strong>only way</strong> to recover your wallet.</p></div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:18px;">';
    words.forEach(function(w, i) {
        h += '<div style="padding:7px;background:var(--input-bg);border:1px solid var(--border);border-radius:8px;text-align:center;">' +
            '<span style="color:var(--text-faint);font-size:0.62rem;">' + (i + 1) + '</span><br>' +
            '<span style="color:var(--heading);font-size:0.82rem;font-weight:700;">' + escapeHtml(w) + '</span></div>';
    });
    h += '</div>' +
        '<div style="padding:14px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:14px;margin-bottom:16px;">' +
            '<p style="color:#ef4444;font-size:0.82rem;font-weight:700;margin:0 0 4px;">🚨 NEVER share your seed phrase</p>' +
            '<p style="color:var(--text);font-size:0.78rem;margin:0;line-height:1.5;">Anyone with these words can steal your Bitcoin. Do not screenshot. Write it on paper and store it safely.</p></div>' +
        '<label style="display:flex;align-items:flex-start;gap:9px;margin-bottom:14px;cursor:pointer;">' +
            '<input type="checkbox" id="seedConfirm" style="width:20px;height:20px;accent-color:#f97316;margin-top:2px;flex-shrink:0;">' +
            '<span style="color:var(--text);font-size:0.82rem;">I have written down my seed phrase and stored it safely. I understand losing these words means losing my Bitcoin forever.</span></label>' +
        '<button id="seedContinue" onclick="walletSeedDone()" disabled style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;opacity:0.4;transition:0.2s;">Continue to Wallet →</button>' +
        '<script>document.getElementById("seedConfirm").onchange=function(){var b=document.getElementById("seedContinue");b.disabled=!this.checked;b.style.opacity=this.checked?"1":"0.4";};<\/script></div>';
    fc.innerHTML = h;
}
window.walletSeedDone = function() { if (typeof showToast === 'function') showToast('✅ Wallet created!'); renderWallet(); refreshWalletData(); };

window.walletExportSeed = async function() {
    var pwd = document.getElementById('wExpPwd'), res = document.getElementById('wExpResult');
    if (!pwd || !pwd.value) { res.innerHTML = '<span style="color:#ef4444;">Enter password</span>'; return; }
    try {
        var m = await WalletCore.decryptSeed(getEnc(), pwd.value);
        res.innerHTML = '<div style="padding:10px;background:var(--input-bg);border:2px solid #ef4444;border-radius:10px;font-family:monospace;font-size:0.76rem;color:var(--heading);word-break:break-word;line-height:1.6;margin-top:6px;">' + escapeHtml(m) + '</div><div style="color:#ef4444;font-size:0.72rem;margin-top:4px;font-weight:600;">Write this down and close immediately!</div>';
    } catch(e) { res.innerHTML = '<span style="color:#ef4444;">Wrong password</span>'; }
};

window.walletCopyAddr = function(a) { navigator.clipboard.writeText(a).then(function() { if (typeof showToast === 'function') showToast('📋 Address copied!'); }); };

window.walletDeleteConfirm = function() {
    if (confirm('⚠️ Are you sure?\n\nIf you haven\'t backed up your seed phrase, your Bitcoin will be PERMANENTLY LOST.')) {
        if (confirm('Final confirmation: DELETE wallet?')) {
            localStorage.removeItem('btc_wallet_enc'); localStorage.removeItem('btc_wallet_addrs');
            _w = { unlocked: false, addresses: [], balance: null, txs: [], price: 0, selIdx: 0 };
            if (typeof showToast === 'function') showToast('🗑️ Wallet deleted');
            renderWallet();
        }
    }
};

console.log('[WALLET] On-chain self-custody UI loaded');
})();
