// =============================================
// 🛒 Bitcoin Marketplace
// Inspired by: FB Marketplace (familiarity), Craigslist (simplicity),
// Plebeian Market (Bitcoin-native), eBay (trust/ratings)
// =============================================

(function() {
'use strict';

var MARKETPLACE_SECTIONS = [
    { id: 'educational', name: 'Educational Products', emoji: '🎓', desc: 'Learn Bitcoin with the best tools' },
    { id: 'general', name: 'General LightningMart', emoji: '🛒', desc: 'Buy & sell everything else' },
];

var MARKETPLACE_CATEGORIES = [
    // Educational Products
    { id: 'books', name: 'Books', emoji: '📚', section: 'educational' },
    { id: 'courses', name: 'Courses & Workshops', emoji: '🎓', section: 'educational' },
    { id: 'hardware_edu', name: 'Hardware Wallets', emoji: '🔐', section: 'educational' },
    { id: 'nodes', name: 'Node Kits & Guides', emoji: '💻', section: 'educational' },
    { id: 'kids', name: 'Kids & Family', emoji: '👨‍👩‍👧‍👦', section: 'educational' },
    { id: 'tools', name: 'Learning Tools', emoji: '🧰', section: 'educational' },
    { id: 'edu_other', name: 'Other Educational', emoji: '📦', section: 'educational' },
    // General Marketplace
    { id: 'mining', name: 'Mining Equipment', emoji: '⛏️', section: 'general' },
    { id: 'merch', name: 'Apparel & Merch', emoji: '👕', section: 'general' },
    { id: 'art', name: 'Art & Collectibles', emoji: '🎨', section: 'general' },
    { id: 'stickers', name: 'Stickers & Prints', emoji: '🖼️', section: 'general' },
    { id: 'services', name: 'Services', emoji: '🛠️', section: 'general' },
    { id: 'electronics', name: 'Electronics & Tech', emoji: '📱', section: 'general' },
    { id: 'other', name: 'Other', emoji: '📦', section: 'general' },
];

var CONDITIONS = [
    { id: 'new', label: 'New', color: '#22c55e' },
    { id: 'like_new', label: 'Like New', color: '#84cc16' },
    { id: 'good', label: 'Good', color: '#eab308' },
    { id: 'fair', label: 'Fair', color: '#f97316' },
    { id: 'for_parts', label: 'For Parts', color: '#ef4444' },
];

var SORT_OPTIONS = [
    { id: 'newest', label: 'Newest First' },
    { id: 'price_low', label: 'Price: Low → High' },
    { id: 'price_high', label: 'Price: High → Low' },
    { id: 'popular', label: 'Most Saved' },
];

// ---- Marketplace History (back button support) ----
// Sub-view pushState — marketplace browse is handled by go('marketplace')
// These push additional states for listing detail and my listings
function mktPushState(type, id) {
    if (type === 'listing') {
        history.pushState({ channel: 'marketplace', mktView: 'listing', listingId: id }, '', '#marketplace/listing/' + id);
    } else if (type === 'my') {
        history.pushState({ channel: 'marketplace', mktView: 'my' }, '', '#marketplace/my');
    }
}

// Called from the main popstate handler in index.html
window.handleMarketplacePopState = function(state, hash) {
    if (state && state.mktView === 'listing' && state.listingId) {
        renderMarketplace({ listingId: state.listingId, _noHistory: true });
        return true;
    }
    if (state && state.mktView === 'my') {
        showMyListings(true);
        return true;
    }
    if (hash && hash.indexOf('marketplace/listing/') === 0) {
        var lid = hash.replace('marketplace/listing/', '');
        renderMarketplace({ listingId: lid, _noHistory: true });
        return true;
    }
    if (hash === 'marketplace/my') {
        showMyListings(true);
        return true;
    }
    // Default: show marketplace browse
    renderMarketplace({ _noHistory: true });
    return true;
};

// ---- Render Marketplace ----
window.renderMarketplace = function(options) {
    options = options || {};
    var container = document.getElementById('forumContainer');
    if (!container) return;

    container.style.display = 'block';
    container.innerHTML = '';

    var activeCategory = options.category || 'all';
    var searchQuery = options.search || '';
    var sortBy = options.sort || 'newest';
    var viewListing = options.listingId || null;

    // View single listing
    if (viewListing) {
        if (!options._noHistory) mktPushState('listing', viewListing);
        renderListingDetail(container, viewListing);
        return;
    }

    // Header
    var html = '<div style="max-width:900px;margin:0 auto;padding:16px;">';

    // Top bar
    html += '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px;">' +
        '<div style="display:flex;align-items:center;gap:10px;">' +
            '<span style="font-size:1.5rem;">⚡</span>' +
            '<div>' +
                '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);">LightningMart</div>' +
                '<div style="font-size:0.7rem;color:var(--text-faint);">Buy & sell with Bitcoin ⚡</div>' +
            '</div>' +
        '</div>' +
        '<div style="display:flex;gap:8px;">' +
            '<button onclick="showMyListings()" style="padding:8px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:600;">📋 My Listings</button>' +
            '<button onclick="showCreateListing()" style="padding:8px 14px;background:var(--accent);border:none;border-radius:10px;color:#fff;font-size:0.8rem;cursor:pointer;font-family:inherit;font-weight:700;">+ Sell</button>' +
        '</div>' +
    '</div>';

    // Search bar
    html += '<div style="margin-bottom:14px;">' +
        '<input type="text" id="marketSearch" placeholder="🔍 Search listings..." value="' + (searchQuery || '') + '" ' +
        'oninput="clearTimeout(window._mktSearchTimer);window._mktSearchTimer=setTimeout(function(){renderMarketplace({search:document.getElementById(\'marketSearch\').value,category:\'' + activeCategory + '\',sort:\'' + sortBy + '\'})},400)" ' +
        'style="width:100%;padding:12px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:0.9rem;font-family:inherit;box-sizing:border-box;">' +
    '</div>';

    // Determine active section from category
    var activeSection = options.section || 'all';
    if (activeCategory !== 'all' && activeSection === 'all') {
        var catObj = MARKETPLACE_CATEGORIES.find(function(c) { return c.id === activeCategory; });
        if (catObj) activeSection = catObj.section;
    }

    // Section tabs: All | Educational | General
    html += '<div style="display:flex;gap:0;margin-bottom:14px;border:1px solid var(--border);border-radius:12px;overflow:hidden;">';
    var sectionTabs = [{ id: 'all', name: 'All', emoji: '🛒' }].concat(MARKETPLACE_SECTIONS);
    for (var si = 0; si < sectionTabs.length; si++) {
        var sec = sectionTabs[si];
        var secActive = activeSection === sec.id;
        html += '<button onclick="renderMarketplace({section:\'' + sec.id + '\',category:\'all\',search:\'' + searchQuery + '\',sort:\'' + sortBy + '\'})" ' +
            'style="flex:1;padding:10px 8px;background:' + (secActive ? 'var(--accent)' : 'var(--card-bg)') + ';color:' + (secActive ? '#fff' : 'var(--text-muted)') + ';border:none;font-size:0.8rem;font-weight:' + (secActive ? '700' : '500') + ';cursor:pointer;font-family:inherit;transition:0.2s;">' + sec.emoji + ' ' + sec.name + '</button>';
    }
    html += '</div>';

    // Subcategory pills (filtered by active section)
    var visibleCats = activeSection === 'all' ? MARKETPLACE_CATEGORIES : MARKETPLACE_CATEGORIES.filter(function(c) { return c.section === activeSection; });
    html += '<div style="display:flex;gap:8px;overflow-x:auto;padding-bottom:8px;margin-bottom:14px;-webkit-overflow-scrolling:touch;">';
    html += '<button onclick="renderMarketplace({section:\'' + activeSection + '\',category:\'all\',search:\'' + searchQuery + '\',sort:\'' + sortBy + '\'})" ' +
        'style="padding:6px 14px;border-radius:20px;border:1px solid ' + (activeCategory === 'all' ? 'var(--accent)' : 'var(--border)') + ';background:' + (activeCategory === 'all' ? 'var(--accent)' : 'var(--card-bg)') + ';color:' + (activeCategory === 'all' ? '#fff' : 'var(--text-muted)') + ';font-size:0.75rem;cursor:pointer;font-family:inherit;white-space:nowrap;font-weight:600;">All</button>';
    for (var c = 0; c < visibleCats.length; c++) {
        var cat = visibleCats[c];
        var isActive = activeCategory === cat.id;
        html += '<button onclick="renderMarketplace({section:\'' + activeSection + '\',category:\'' + cat.id + '\',search:\'' + searchQuery + '\',sort:\'' + sortBy + '\'})" ' +
            'style="padding:6px 14px;border-radius:20px;border:1px solid ' + (isActive ? 'var(--accent)' : 'var(--border)') + ';background:' + (isActive ? 'var(--accent)' : 'var(--card-bg)') + ';color:' + (isActive ? '#fff' : 'var(--text-muted)') + ';font-size:0.75rem;cursor:pointer;font-family:inherit;white-space:nowrap;font-weight:600;">' + cat.emoji + ' ' + cat.name + '</button>';
    }
    html += '</div>';

    // Sort dropdown
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
        '<span id="marketResultCount" style="font-size:0.75rem;color:var(--text-faint);">Loading...</span>' +
        '<select id="marketSort" onchange="renderMarketplace({section:\'' + activeSection + '\',category:\'' + activeCategory + '\',search:\'' + searchQuery + '\',sort:this.value})" ' +
        'style="padding:6px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;color:var(--text-muted);font-size:0.75rem;font-family:inherit;">';
    for (var s = 0; s < SORT_OPTIONS.length; s++) {
        html += '<option value="' + SORT_OPTIONS[s].id + '"' + (sortBy === SORT_OPTIONS[s].id ? ' selected' : '') + '>' + SORT_OPTIONS[s].label + '</option>';
    }
    html += '</select></div>';

    // Listings grid
    html += '<div id="marketListings" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;"></div>';

    html += '</div>';
    container.innerHTML = html;

    // Load listings from Firestore
    loadMarketListings(activeCategory, searchQuery, sortBy, activeSection);
};

// ---- Load Listings from Firestore ----
function loadMarketListings(category, search, sort, section) {
    var grid = document.getElementById('marketListings');
    var countEl = document.getElementById('marketResultCount');
    if (!grid || typeof db === 'undefined') {
        if (grid) grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-faint);">Loading marketplace...</div>';
        return;
    }

    var query = db.collection('marketplace').where('status', '==', 'active');
    if (category && category !== 'all') {
        query = query.where('category', '==', category);
    }

    // Sort
    if (sort === 'price_low') query = query.orderBy('priceSats', 'asc');
    else if (sort === 'price_high') query = query.orderBy('priceSats', 'desc');
    else if (sort === 'popular') query = query.orderBy('saves', 'desc');
    else query = query.orderBy('createdAt', 'desc');

    query.limit(50).get().then(function(snap) {
        var listings = [];
        snap.forEach(function(doc) {
            listings.push({ id: doc.id, ...doc.data() });
        });

        // Client-side section filter
        if (section && section !== 'all') {
            var sectionCatIds = MARKETPLACE_CATEGORIES.filter(function(c) { return c.section === section; }).map(function(c) { return c.id; });
            listings = listings.filter(function(l) { return sectionCatIds.indexOf(l.category) !== -1; });
        }

        // Client-side search filter
        if (search) {
            var q = search.toLowerCase();
            listings = listings.filter(function(l) {
                return (l.title || '').toLowerCase().includes(q) ||
                       (l.description || '').toLowerCase().includes(q);
            });
        }

        if (countEl) countEl.textContent = listings.length + ' listing' + (listings.length !== 1 ? 's' : '');

        if (listings.length === 0) {
            grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;">' +
                '<div style="font-size:2rem;margin-bottom:8px;">🏜️</div>' +
                '<div style="color:var(--text-muted);font-size:0.9rem;">No listings yet</div>' +
                '<button onclick="showCreateListing()" style="margin-top:12px;padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;font-size:0.85rem;font-weight:700;cursor:pointer;font-family:inherit;">Be the first to sell something!</button>' +
            '</div>';
            return;
        }

        var savedItems = JSON.parse(localStorage.getItem('btc_market_saved') || '[]');

        grid.innerHTML = listings.map(function(l) {
            var isSaved = savedItems.indexOf(l.id) !== -1;
            var cond = CONDITIONS.find(function(c) { return c.id === l.condition; });
            var condColor = cond ? cond.color : 'var(--text-faint)';
            var condLabel = cond ? cond.label : '';
            var catObj = MARKETPLACE_CATEGORIES.find(function(c) { return c.id === l.category; });
            var catEmoji = catObj ? catObj.emoji : '📦';

            // Format price
            var priceDisplay = '';
            if (l.priceSats >= 1000000) priceDisplay = (l.priceSats / 1000000).toFixed(2) + 'M sats';
            else if (l.priceSats >= 1000) priceDisplay = Math.floor(l.priceSats / 1000) + 'K sats';
            else priceDisplay = l.priceSats.toLocaleString() + ' sats';

            return '<div onclick="renderMarketplace({listingId:\'' + l.id + '\'})" style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;overflow:hidden;cursor:pointer;transition:0.2s;touch-action:manipulation;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                // Image or placeholder
                (l.imageUrl
                    ? '<div style="width:100%;aspect-ratio:1;background:url(\'' + l.imageUrl + '\') center/cover;border-bottom:1px solid var(--border);"></div>'
                    : '<div style="width:100%;aspect-ratio:1;background:var(--bg-side);display:flex;align-items:center;justify-content:center;font-size:2.5rem;border-bottom:1px solid var(--border);">' + catEmoji + '</div>'
                ) +
                '<div style="padding:10px;">' +
                    '<div style="font-size:0.8rem;font-weight:700;color:var(--heading);line-height:1.3;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">' + escapeHtml(l.title) + '</div>' +
                    '<div style="font-size:0.85rem;font-weight:800;color:var(--accent);">⚡ ' + priceDisplay + '</div>' +
                    (satsToUSD(l.priceSats) ? '<div style="font-size:0.65rem;color:var(--text-faint);margin-bottom:4px;">' + satsToUSD(l.priceSats) + '</div>' : '<div style="margin-bottom:4px;"></div>') +
                    '<div style="display:flex;justify-content:space-between;align-items:center;">' +
                        '<span style="font-size:0.65rem;color:' + condColor + ';font-weight:600;">' + condLabel + '</span>' +
                        '<span onclick="event.stopPropagation();toggleMarketSave(\'' + l.id + '\')" style="font-size:0.9rem;cursor:pointer;">' + (isSaved ? '❤️' : '🤍') + '</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('');
    }).catch(function(e) {
        grid.innerHTML = '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--text-faint);">Error loading listings. Try refreshing.</div>';
    });
}

function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ---- Single Listing Detail ----
function renderListingDetail(container, listingId) {
    container.innerHTML = '<div style="max-width:600px;margin:0 auto;padding:16px;"><div style="text-align:center;padding:40px;color:var(--text-faint);">Loading...</div></div>';

    db.collection('marketplace').doc(listingId).get().then(function(doc) {
        if (!doc.exists) {
            container.innerHTML = '<div style="max-width:600px;margin:0 auto;padding:16px;text-align:center;"><div style="font-size:2rem;margin-bottom:8px;">😕</div><div style="color:var(--text-muted);">Listing not found</div><button onclick="history.back()" style="margin-top:12px;padding:10px 20px;background:var(--accent);color:#fff;border:none;border-radius:10px;cursor:pointer;font-family:inherit;font-weight:700;">← Back to LightningMart</button></div>';
            return;
        }
        var l = { id: doc.id, ...doc.data() };
        var cond = CONDITIONS.find(function(c) { return c.id === l.condition; });
        var condLabel = cond ? cond.label : '';
        var condColor = cond ? cond.color : 'var(--text-faint)';
        var catObj = MARKETPLACE_CATEGORIES.find(function(c) { return c.id === l.category; });
        var catName = catObj ? catObj.emoji + ' ' + catObj.name : '📦 Other';
        var savedItems = JSON.parse(localStorage.getItem('btc_market_saved') || '[]');
        var isSaved = savedItems.indexOf(l.id) !== -1;
        var isOwner = (typeof auth !== 'undefined' && auth.currentUser && auth.currentUser.uid === l.sellerUid);

        // Format price
        var priceDisplay = l.priceSats >= 1000000 ? (l.priceSats / 1000000).toFixed(2) + 'M sats' :
            l.priceSats >= 1000 ? Math.floor(l.priceSats / 1000) + 'K sats' : l.priceSats.toLocaleString() + ' sats';

        // Approximate USD (if btc price available)
        var usdDisplay = '';
        try {
            var btcPrice = parseFloat(localStorage.getItem('btc_last_price') || '0');
            if (btcPrice > 0) {
                var usd = (l.priceSats / 100000000) * btcPrice;
                usdDisplay = ' <span style="color:var(--text-faint);font-size:0.8rem;">(~$' + usd.toFixed(2) + ')</span>';
            }
        } catch(e) {}

        var timeAgo = getTimeAgo(l.createdAt ? l.createdAt.toDate() : new Date());

        var html = '<div style="max-width:600px;margin:0 auto;padding:16px;">';

        // Back button
        html += '<button onclick="history.back()" style="padding:8px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;margin-bottom:16px;">← Back</button>';

        // Image
        if (l.imageUrl) {
            html += '<div style="width:100%;aspect-ratio:4/3;background:url(\'' + l.imageUrl + '\') center/contain no-repeat;background-color:var(--bg-side);border-radius:14px;border:1px solid var(--border);margin-bottom:16px;"></div>';
        } else {
            var catE = catObj ? catObj.emoji : '📦';
            html += '<div style="width:100%;aspect-ratio:4/3;background:var(--bg-side);display:flex;align-items:center;justify-content:center;font-size:4rem;border-radius:14px;border:1px solid var(--border);margin-bottom:16px;">' + catE + '</div>';
        }

        // Title & price
        html += '<div style="margin-bottom:16px;">' +
            '<div style="font-size:1.2rem;font-weight:800;color:var(--heading);line-height:1.3;margin-bottom:6px;">' + escapeHtml(l.title) + '</div>' +
            '<div style="font-size:1.3rem;font-weight:900;color:var(--accent);">⚡ ' + priceDisplay + usdDisplay + '</div>' +
        '</div>';

        // Meta row
        html += '<div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:16px;">' +
            '<span style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.7rem;color:' + condColor + ';font-weight:600;">' + condLabel + '</span>' +
            '<span style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.7rem;color:var(--text-muted);">' + catName + '</span>' +
            '<span style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.7rem;color:var(--text-faint);">🕐 ' + timeAgo + '</span>' +
            (l.shipping ? '<span style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.7rem;color:var(--text-muted);">📦 Ships</span>' : '') +
            (l.localPickup ? '<span style="padding:4px 10px;background:var(--card-bg);border:1px solid var(--border);border-radius:8px;font-size:0.7rem;color:var(--text-muted);">📍 Local pickup</span>' : '') +
        '</div>';

        // Description
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Description</div>' +
            '<div style="color:var(--text);font-size:0.85rem;line-height:1.6;white-space:pre-wrap;">' + escapeHtml(l.description || 'No description provided.') + '</div>' +
        '</div>';

        // Seller info
        html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:16px;margin-bottom:16px;">' +
            '<div style="font-size:0.7rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">Seller</div>' +
            '<div style="display:flex;align-items:center;gap:10px;">' +
                '<div style="width:36px;height:36px;border-radius:50%;background:var(--accent);display:flex;align-items:center;justify-content:center;font-size:1rem;color:#fff;font-weight:700;">' + (l.sellerName ? l.sellerName.charAt(0).toUpperCase() : '?') + '</div>' +
                '<div>' +
                    '<div style="font-weight:700;color:var(--heading);font-size:0.9rem;">' + escapeHtml(l.sellerName || 'Anonymous') + '</div>' +
                    (l.sellerRank ? '<div style="font-size:0.7rem;color:var(--text-muted);">' + l.sellerRank + '</div>' : '') +
                '</div>' +
            '</div>' +
        '</div>';

        // Action buttons
        if (!isOwner) {
            html += '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
                '<button onclick="contactSeller(\'' + l.id + '\',\'' + escapeHtml(l.sellerName || '') + '\')" style="flex:1;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Contact Seller</button>' +
                '<button onclick="toggleMarketSave(\'' + l.id + '\')" style="padding:14px 18px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;font-size:1.1rem;cursor:pointer;">' + (isSaved ? '❤️' : '🤍') + '</button>' +
            '</div>';
            // Lightning payment hint
            if (l.lightningAddress) {
                html += '<div style="background:rgba(247,147,26,0.1);border:1px solid rgba(247,147,26,0.3);border-radius:12px;padding:12px;text-align:center;margin-bottom:16px;">' +
                    '<div style="font-size:0.8rem;color:var(--accent);font-weight:600;">⚡ This seller accepts Lightning payments</div>' +
                '</div>';
            }
        } else {
            html += '<div style="display:flex;gap:10px;margin-bottom:16px;">' +
                '<button onclick="editListing(\'' + l.id + '\')" style="flex:1;padding:14px;background:var(--card-bg);border:1px solid var(--border);border-radius:12px;color:var(--text);font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">✏️ Edit</button>' +
                '<button onclick="deleteListing(\'' + l.id + '\')" style="padding:14px 18px;background:var(--card-bg);border:1px solid #ef4444;border-radius:12px;color:#ef4444;font-size:0.9rem;font-weight:600;cursor:pointer;font-family:inherit;">🗑️ Delete</button>' +
            '</div>';
        }

        html += '</div>';
        container.innerHTML = html;

        // Increment view count
        db.collection('marketplace').doc(listingId).update({
            views: firebase.firestore.FieldValue.increment(1)
        }).catch(function(){});

    }).catch(function() {
        container.innerHTML = '<div style="max-width:600px;margin:0 auto;padding:16px;text-align:center;color:var(--text-faint);">Error loading listing.</div>';
    });
}

// ---- Create Listing ----
window.showCreateListing = function() {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        if (typeof showToast === 'function') showToast('🔒 Sign in to create a listing!');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    var html = '<div id="createListingOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;overflow-y:auto;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:20px;padding:24px;max-width:450px;width:100%;max-height:90vh;overflow-y:auto;">' +
        '<div style="font-size:1.2rem;font-weight:800;color:var(--heading);margin-bottom:16px;">📝 Create Listing</div>' +

        // Title
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Title *</label>' +
        '<input type="text" id="mktTitle" maxlength="80" placeholder="What are you selling?" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +

        // Price in sats with live USD conversion
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Price (sats) *</label>' +
        '<input type="number" id="mktPrice" min="1" placeholder="21000" oninput="updateMktPriceUSD()" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:4px;box-sizing:border-box;">' +
        '<div id="mktPriceUSD" style="font-size:0.75rem;color:var(--accent);margin-bottom:12px;min-height:1.2em;"></div>' +

        // Category
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Category *</label>' +
        '<select id="mktCategory" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +
        '<optgroup label="🎓 Educational Products">' +
        MARKETPLACE_CATEGORIES.filter(function(c){ return c.section === 'educational'; }).map(function(c) { return '<option value="' + c.id + '">' + c.emoji + ' ' + c.name + '</option>'; }).join('') +
        '</optgroup><optgroup label="🛒 General Marketplace">' +
        MARKETPLACE_CATEGORIES.filter(function(c){ return c.section === 'general'; }).map(function(c) { return '<option value="' + c.id + '">' + c.emoji + ' ' + c.name + '</option>'; }).join('') +
        '</optgroup></select>' +

        // Condition
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Condition *</label>' +
        '<select id="mktCondition" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +
        CONDITIONS.map(function(c) { return '<option value="' + c.id + '">' + c.label + '</option>'; }).join('') +
        '</select>' +

        // Description
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Description</label>' +
        '<textarea id="mktDesc" rows="4" maxlength="1000" placeholder="Describe your item, include details about condition, what\'s included, etc." style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;resize:vertical;"></textarea>' +

        // Image upload or URL
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Photo (optional)</label>' +
        '<div style="display:flex;gap:8px;margin-bottom:4px;">' +
            '<label style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;background:var(--card-bg);border:2px dashed var(--border);border-radius:10px;cursor:pointer;color:var(--text-muted);font-size:0.85rem;font-family:inherit;transition:0.2s;" onmouseover="this.style.borderColor=\'var(--accent)\'" onmouseout="this.style.borderColor=\'var(--border)\'">' +
                '<input type="file" id="mktImageFile" accept="image/*" onchange="handleMktImageUpload(this)" style="display:none;">' +
                '📷 Upload Photo' +
            '</label>' +
        '</div>' +
        '<div id="mktImagePreview" style="margin-bottom:8px;display:none;text-align:center;"><img id="mktImagePreviewImg" style="max-width:100%;max-height:200px;border-radius:10px;border:1px solid var(--border);" /><button onclick="clearMktImage()" style="display:block;margin:6px auto 0;padding:4px 12px;background:none;border:1px solid var(--border);border-radius:6px;color:var(--text-faint);font-size:0.7rem;cursor:pointer;font-family:inherit;">✕ Remove</button></div>' +
        '<div style="text-align:center;color:var(--text-faint);font-size:0.7rem;margin-bottom:4px;">— or paste an image URL —</div>' +
        '<input type="url" id="mktImage" placeholder="https://imgur.com/your-image.jpg" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +

        // Lightning address
        '<label style="display:block;font-size:0.75rem;color:var(--text-faint);text-transform:uppercase;letter-spacing:1px;margin-bottom:4px;">Lightning Address (optional)</label>' +
        '<input type="text" id="mktLightning" placeholder="you@walletofsatoshi.com" style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.85rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;">' +

        // Shipping / Local
        '<div style="display:flex;gap:12px;margin-bottom:16px;">' +
            '<label style="display:flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;"><input type="checkbox" id="mktShipping"> 📦 Shipping available</label>' +
            '<label style="display:flex;align-items:center;gap:6px;color:var(--text-muted);font-size:0.85rem;cursor:pointer;"><input type="checkbox" id="mktLocal"> 📍 Local pickup</label>' +
        '</div>' +

        // Submit
        '<button onclick="submitListing()" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:1rem;font-weight:700;cursor:pointer;font-family:inherit;">⚡ Post Listing</button>' +
        '<button onclick="document.getElementById(\'createListingOverlay\').remove()" style="width:100%;padding:10px;background:none;border:none;color:var(--text-faint);font-size:0.85rem;cursor:pointer;font-family:inherit;margin-top:8px;">Cancel</button>' +
        '</div></div>';

    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

// ---- Submit Listing to Firestore ----
window.submitListing = function() {
    var title = (document.getElementById('mktTitle').value || '').trim();
    var price = parseInt(document.getElementById('mktPrice').value);
    var category = document.getElementById('mktCategory').value;
    var condition = document.getElementById('mktCondition').value;
    var desc = (document.getElementById('mktDesc').value || '').trim();
    var imageUrl = window._mktUploadedImage || (document.getElementById('mktImage').value || '').trim();
    var lightning = (document.getElementById('mktLightning').value || '').trim();
    var shipping = document.getElementById('mktShipping').checked;
    var local = document.getElementById('mktLocal').checked;

    if (!title || title.length < 3) { showToast('Please enter a title (3+ characters)'); return; }
    if (!price || price < 1) { showToast('Please enter a price in sats'); return; }

    var sellerName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Anonymous';
    var sellerRank = '';
    if (typeof currentUser !== 'undefined' && currentUser && typeof getLevel === 'function') {
        var lv = getLevel(currentUser.points || 0);
        sellerRank = lv.emoji + ' ' + lv.name;
    }

    var listing = {
        title: title,
        description: desc,
        priceSats: price,
        category: category,
        condition: condition,
        imageUrl: imageUrl || null,
        lightningAddress: lightning || null,
        shipping: shipping,
        localPickup: local,
        sellerUid: auth.currentUser.uid,
        sellerName: sellerName,
        sellerRank: sellerRank,
        status: 'active',
        views: 0,
        saves: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    };

    db.collection('marketplace').add(listing).then(function() {
        window._mktUploadedImage = null;
        var overlay = document.getElementById('createListingOverlay');
        if (overlay) overlay.remove();
        if (typeof showToast === 'function') showToast('🛒 Listing posted!');
        if (typeof awardPoints === 'function') awardPoints(15, '🛒 Marketplace listing!');
        // Track for badge
        if (auth && auth.currentUser) {
            db.collection('users').doc(auth.currentUser.uid).update({
                marketListings: firebase.firestore.FieldValue.increment(1)
            }).catch(function(){});
            if (typeof currentUser !== 'undefined' && currentUser) currentUser.marketListings = (currentUser.marketListings || 0) + 1;
        }
        renderMarketplace();
    }).catch(function(e) {
        showToast('Error posting listing. Try again.');
    });
};

// ---- Save/Unsave Listings ----
window.toggleMarketSave = function(listingId) {
    var saved = JSON.parse(localStorage.getItem('btc_market_saved') || '[]');
    var idx = saved.indexOf(listingId);
    if (idx !== -1) {
        saved.splice(idx, 1);
        db.collection('marketplace').doc(listingId).update({ saves: firebase.firestore.FieldValue.increment(-1) }).catch(function(){});
    } else {
        saved.push(listingId);
        db.collection('marketplace').doc(listingId).update({ saves: firebase.firestore.FieldValue.increment(1) }).catch(function(){});
    }
    localStorage.setItem('btc_market_saved', JSON.stringify(saved));
    // Sync to Firestore
    if (typeof db !== 'undefined' && auth && auth.currentUser && !auth.currentUser.isAnonymous) {
        db.collection('users').doc(auth.currentUser.uid).update({ marketSaved: saved }).catch(function(){});
    }
    // Refresh current view
    var container = document.getElementById('forumContainer');
    if (container && container.innerHTML.includes('marketListings')) {
        renderMarketplace();
    }
};

// ---- Contact Seller ----
window.contactSeller = function(listingId, sellerName) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        showToast('🔒 Sign in to contact sellers');
        if (typeof showUsernamePrompt === 'function') showUsernamePrompt();
        return;
    }

    var buyerName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Buyer';
    var html = '<div id="contactSellerOverlay" style="position:fixed;inset:0;background:rgba(0,0,0,0.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:16px;" onclick="if(event.target===this)this.remove()">' +
        '<div style="background:var(--bg-side);border:2px solid var(--accent);border-radius:20px;padding:24px;max-width:400px;width:100%;">' +
        '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:12px;">💬 Message ' + escapeHtml(sellerName) + '</div>' +
        '<textarea id="mktMessage" rows="4" placeholder="Hi! I\'m interested in your listing..." style="width:100%;padding:10px 14px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:0.9rem;font-family:inherit;margin-bottom:12px;box-sizing:border-box;resize:vertical;"></textarea>' +
        '<button onclick="sendMarketMessage(\'' + listingId + '\')" style="width:100%;padding:14px;background:var(--accent);color:#fff;border:none;border-radius:12px;font-size:0.95rem;font-weight:700;cursor:pointer;font-family:inherit;">Send Message ⚡</button>' +
        '</div></div>';
    var div = document.createElement('div');
    div.innerHTML = html;
    document.body.appendChild(div.firstChild);
};

window.sendMarketMessage = function(listingId) {
    var msg = (document.getElementById('mktMessage').value || '').trim();
    if (!msg) { showToast('Please write a message'); return; }

    var buyerName = (typeof currentUser !== 'undefined' && currentUser && currentUser.username) ? currentUser.username : 'Buyer';

    db.collection('marketplace_messages').add({
        listingId: listingId,
        buyerUid: auth.currentUser.uid,
        buyerName: buyerName,
        message: msg,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        read: false,
    }).then(function() {
        var overlay = document.getElementById('contactSellerOverlay');
        if (overlay) overlay.remove();
        showToast('💬 Message sent to seller!');
        // Track for badge
        db.collection('users').doc(auth.currentUser.uid).update({
            marketMessages: firebase.firestore.FieldValue.increment(1)
        }).catch(function(){});
        if (typeof currentUser !== 'undefined' && currentUser) currentUser.marketMessages = (currentUser.marketMessages || 0) + 1;
    }).catch(function() {
        showToast('Error sending message. Try again.');
    });
};

// ---- My Listings ----
window.showMyListings = function(fromPopState) {
    if (!auth || !auth.currentUser || auth.currentUser.isAnonymous) {
        showToast('🔒 Sign in to see your listings');
        return;
    }
    if (!fromPopState) mktPushState('my');

    var container = document.getElementById('forumContainer');
    if (!container) return;
    container.innerHTML = '<div style="max-width:600px;margin:0 auto;padding:16px;"><div style="text-align:center;padding:40px;color:var(--text-faint);">Loading your listings...</div></div>';

    db.collection('marketplace')
        .where('sellerUid', '==', auth.currentUser.uid)
        .orderBy('createdAt', 'desc')
        .get().then(function(snap) {
            var html = '<div style="max-width:600px;margin:0 auto;padding:16px;">';
            html += '<button onclick="history.back()" style="padding:8px 16px;background:var(--card-bg);border:1px solid var(--border);border-radius:10px;color:var(--text-muted);font-size:0.8rem;cursor:pointer;font-family:inherit;margin-bottom:16px;">← Back to LightningMart</button>';
            html += '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-bottom:16px;">📋 My Listings</div>';

            if (snap.empty) {
                html += '<div style="text-align:center;padding:30px;color:var(--text-faint);">No listings yet. <span onclick="showCreateListing()" style="color:var(--accent);cursor:pointer;font-weight:600;">Create one!</span></div>';
            } else {
                snap.forEach(function(doc) {
                    var l = doc.data();
                    var statusColor = l.status === 'active' ? '#22c55e' : l.status === 'sold' ? '#ef4444' : 'var(--text-faint)';
                    html += '<div style="background:var(--card-bg);border:1px solid var(--border);border-radius:12px;padding:14px;margin-bottom:10px;display:flex;justify-content:space-between;align-items:center;">' +
                        '<div style="flex:1;">' +
                            '<div style="font-weight:700;color:var(--heading);font-size:0.9rem;">' + escapeHtml(l.title) + '</div>' +
                            '<div style="font-size:0.8rem;color:var(--accent);font-weight:600;">⚡ ' + (l.priceSats || 0).toLocaleString() + ' sats</div>' +
                            '<div style="font-size:0.7rem;color:var(--text-faint);">👁️ ' + (l.views || 0) + ' views · ❤️ ' + (l.saves || 0) + ' saves</div>' +
                        '</div>' +
                        '<div style="display:flex;gap:8px;align-items:center;">' +
                            '<span style="font-size:0.65rem;color:' + statusColor + ';font-weight:700;text-transform:uppercase;">' + (l.status || 'active') + '</span>' +
                            (l.status === 'active' ? '<button onclick="markSold(\'' + doc.id + '\')" style="padding:6px 12px;background:#22c55e;color:#fff;border:none;border-radius:8px;font-size:0.7rem;font-weight:700;cursor:pointer;font-family:inherit;">Mark Sold</button>' : '') +
                        '</div>' +
                    '</div>';
                });
            }

            // Messages section
            html += '<div style="font-size:1.1rem;font-weight:800;color:var(--heading);margin-top:24px;margin-bottom:12px;">💬 Messages</div>';
            html += '<div id="myMarketMessages" style="color:var(--text-faint);font-size:0.85rem;">Loading messages...</div>';
            html += '</div>';
            container.innerHTML = html;

            // Load messages
            loadMyMessages();
        });
};

function loadMyMessages() {
    var msgContainer = document.getElementById('myMarketMessages');
    if (!msgContainer) return;

    // Get messages for seller's listings
    db.collection('marketplace_messages')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get().then(function(snap) {
            var myUid = auth.currentUser.uid;
            var messages = [];
            snap.forEach(function(doc) {
                var d = doc.data();
                // Show if I'm the buyer or need to check if I'm the seller
                if (d.buyerUid === myUid) {
                    messages.push({ id: doc.id, ...d, role: 'buyer' });
                }
            });

            // Also check messages TO my listings
            db.collection('marketplace').where('sellerUid', '==', myUid).get().then(function(listingSnap) {
                var myListingIds = [];
                listingSnap.forEach(function(d) { myListingIds.push(d.id); });

                snap.forEach(function(doc) {
                    var d = doc.data();
                    if (myListingIds.indexOf(d.listingId) !== -1 && d.buyerUid !== myUid) {
                        messages.push({ id: doc.id, ...d, role: 'seller' });
                    }
                });

                if (messages.length === 0) {
                    msgContainer.innerHTML = '<div style="color:var(--text-faint);font-size:0.85rem;">No messages yet.</div>';
                    return;
                }

                msgContainer.innerHTML = messages.map(function(m) {
                    var timeAgo = m.createdAt ? getTimeAgo(m.createdAt.toDate()) : '';
                    return '<div style="background:var(--card-bg);border:1px solid ' + (m.read ? 'var(--border)' : 'var(--accent)') + ';border-radius:10px;padding:12px;margin-bottom:8px;">' +
                        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">' +
                            '<span style="font-weight:700;color:var(--heading);font-size:0.85rem;">' + (m.role === 'seller' ? '📩 From ' : '📤 To seller · ') + escapeHtml(m.buyerName || 'Buyer') + '</span>' +
                            '<span style="font-size:0.65rem;color:var(--text-faint);">' + timeAgo + '</span>' +
                        '</div>' +
                        '<div style="color:var(--text-muted);font-size:0.8rem;">' + escapeHtml(m.message) + '</div>' +
                    '</div>';
                }).join('');
            });
        });
}

// ---- Mark as Sold ----
window.markSold = function(listingId) {
    db.collection('marketplace').doc(listingId).update({ status: 'sold' }).then(function() {
        showToast('✅ Marked as sold!');
        showMyListings();
    });
};

// ---- Delete Listing ----
window.deleteListing = function(listingId) {
    if (!confirm('Delete this listing?')) return;
    db.collection('marketplace').doc(listingId).update({ status: 'deleted' }).then(function() {
        showToast('🗑️ Listing deleted');
        renderMarketplace();
    });
};

// ---- Time Ago Helper ----
// ---- Live USD Price Conversion ----
window.updateMktPriceUSD = function() {
    var sats = parseInt(document.getElementById('mktPrice').value) || 0;
    var el = document.getElementById('mktPriceUSD');
    if (!el) return;
    if (sats <= 0) { el.textContent = ''; return; }
    var btcPrice = parseFloat(localStorage.getItem('btc_last_price') || '0');
    if (btcPrice <= 0) {
        // Fetch price if not cached
        fetch('https://mempool.space/api/v1/prices').then(function(r) { return r.json(); }).then(function(d) {
            if (d && d.USD) {
                localStorage.setItem('btc_last_price', d.USD);
                updateMktPriceUSD();
            }
        }).catch(function(){});
        el.textContent = 'Loading USD price...';
        return;
    }
    var usd = (sats / 100000000) * btcPrice;
    el.textContent = '≈ $' + usd.toFixed(2) + ' USD';
};

// Format sats to USD for display
window.satsToUSD = function(sats) {
    var btcPrice = parseFloat(localStorage.getItem('btc_last_price') || '0');
    if (btcPrice <= 0 || !sats) return '';
    var usd = (sats / 100000000) * btcPrice;
    return '~$' + usd.toFixed(2);
};

// ---- Image Upload (converts to base64 data URL) ----
window.handleMktImageUpload = function(input) {
    var file = input.files && input.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        if (typeof showToast === 'function') showToast('Image too large (max 5MB)');
        return;
    }
    var reader = new FileReader();
    reader.onload = function(e) {
        // Resize to max 800px wide for storage
        var img = new Image();
        img.onload = function() {
            var maxW = 800;
            var w = img.width, h = img.height;
            if (w > maxW) { h = Math.round(h * maxW / w); w = maxW; }
            var canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            var dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            // Show preview
            var preview = document.getElementById('mktImagePreview');
            var previewImg = document.getElementById('mktImagePreviewImg');
            if (preview && previewImg) {
                previewImg.src = dataUrl;
                preview.style.display = 'block';
            }
            // Store for submission
            window._mktUploadedImage = dataUrl;
            // Clear URL field since upload takes priority
            var urlField = document.getElementById('mktImage');
            if (urlField) urlField.value = '';
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
};

window.clearMktImage = function() {
    window._mktUploadedImage = null;
    var preview = document.getElementById('mktImagePreview');
    if (preview) preview.style.display = 'none';
    var fileInput = document.getElementById('mktImageFile');
    if (fileInput) fileInput.value = '';
};

function getTimeAgo(date) {
    var seconds = Math.floor((new Date() - date) / 1000);
    if (seconds < 60) return 'just now';
    var minutes = Math.floor(seconds / 60);
    if (minutes < 60) return minutes + 'm ago';
    var hours = Math.floor(minutes / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    if (days < 30) return days + 'd ago';
    return Math.floor(days / 30) + 'mo ago';
}

})();
