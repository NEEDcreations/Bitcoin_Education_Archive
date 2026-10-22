// =============================================
// MARKETPLACE CLIENT CONTRACT
// The Firestore rules accept the payload marketplace.js actually sends.
// Allow/deny coverage lives in tests/rules/marketplace-rules.js (emulator).
// Run: node tests/test-marketplace.js
// =============================================
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const root = path.join(__dirname, '..');
const market = fs.readFileSync(path.join(root, 'marketplace.js'), 'utf8');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log('✅ ' + name);
        passed++;
    } catch (e) {
        console.log('❌ ' + name + ': ' + e.message);
        failed++;
    }
}

test('listing ids stay out of inline handlers', () => {
    assert.ok(market.includes("db.collection('marketplace').add(listing)"));
    assert.ok(market.includes('data-mkt-action="open"'));
    assert.ok(market.includes('data-mkt-action="edit"'));
    assert.ok(market.includes('data-mkt-action="delete"'));
    assert.ok(market.includes('data-mkt-action="sold"'));
    assert.ok(market.includes('data-mkt-action="save"'));
    assert.ok(market.includes('data-mkt-action="browse"'));
    assert.ok(market.includes('data-mkt-action="sort"'));
    assert.ok(market.includes('data-mkt-search="'));
    assert.ok(market.includes('data-mkt-root="1"'));
    assert.ok(market.includes('function mktInMarketplace(node)'));
    assert.ok(market.includes("value=\"' + escapeHtml(searchQuery || '') + '\""));
    assert.strictEqual(market.includes("search:\\'' + searchQuery"), false);
    assert.ok(market.includes("escapeHtml(l.sellerName ? l.sellerName.charAt(0).toUpperCase() : '?')"));
    assert.strictEqual(market.includes("onclick=\"editListing('"), false);
    assert.strictEqual(market.includes("onclick=\"deleteListing('"), false);
    assert.strictEqual(market.includes("onclick=\"markSold('"), false);
    assert.strictEqual(market.includes("onclick=\"toggleMarketSave('"), false);
    assert.strictEqual(market.includes("onclick=\"renderMarketplace({listingId:"), false);
    assert.strictEqual(market.includes("onclick=\"sendMarketMessage('"), false);
    assert.strictEqual(market.includes("+ (l.sellerName ? l.sellerName.charAt(0).toUpperCase() : '?') +"), false);
});

test('create sends priceSats and the profile username', () => {
    assert.ok(market.includes('priceSats: price'));
    assert.ok(market.includes('function sellerNameFromProfile(userDoc)'));
    assert.ok(market.includes("if (typeof profile.username === 'string') return profile.username;"));
    assert.ok(market.includes('Set a username before posting a listing'));
    assert.ok(market.includes('showUsernamePrompt()'));
    const submit = market.slice(market.indexOf('window.submitListing = function()'), market.indexOf('window.toggleMarketSave'));
    const promptAt = submit.indexOf('Set a username before posting a listing');
    const timerAt = submit.indexOf('_lastMktListingTime = Date.now()');
    const addAt = submit.indexOf('.add(listing)');
    assert.ok(promptAt > 0 && timerAt > promptAt && addAt > timerAt);
    assert.ok(market.includes('function refreshMarketListingBadges(uid)'));
    assert.ok(submit.includes('refreshMarketListingBadges(auth.currentUser.uid)'));
    assert.strictEqual(market.includes('marketListings: firebase.firestore.FieldValue.increment'), false);
    assert.strictEqual(market.includes("currentUser.username) ? currentUser.username : 'Anonymous'"), false);
    assert.ok(market.includes('localPickup: local'));
    assert.ok(market.includes("status: 'active'"));
    assert.ok(market.includes('views: 0'));
    assert.ok(market.includes('saves: 0'));
});

test('edit, soft-delete, and save match the rules', () => {
    assert.ok(market.includes('localPickup: local'));
    assert.ok(market.includes('local: local'));
    assert.ok(market.includes('updatedAt: firebase.firestore.FieldValue.serverTimestamp()'));
    assert.ok(market.includes('deletedBy: auth.currentUser.uid'));
    assert.strictEqual(market.includes("deletedBy: isAdmin ? 'admin' : 'owner'"), false);
    assert.ok(market.includes('savedBy: firebase.firestore.FieldValue.arrayUnion(uid)'));
    assert.ok(market.includes('savedBy: firebase.firestore.FieldValue.arrayRemove(uid)'));
    assert.ok(market.includes('saves: firebase.firestore.FieldValue.increment(1)'));
    assert.ok(market.includes('saves: firebase.firestore.FieldValue.increment(-1)'));
    assert.ok(market.includes('views: firebase.firestore.FieldValue.increment(1)'));
    assert.ok(market.includes("{ status: 'sold' }"));
});

test('rules allow the client create fields and block impersonation', () => {
    const start = rules.indexOf('match /marketplace/{listingId}');
    const end = rules.indexOf('match /marketplace_messages/{msgId}');
    assert.ok(start > 0 && end > start);
    const block = rules.slice(start, end);
    assert.ok(block.includes("hasOnly(['title','description','priceSats','category','condition','imageUrl','lightningAddress','shipping','localPickup','sellerUid','sellerName','sellerRank','status','views','saves','createdAt'])"));
    assert.ok(block.includes('marketSellerNameMatches()'));
    assert.ok(block.includes("request.resource.data.status == 'active'"));
    assert.ok(block.includes('request.resource.data.views == 0'));
    assert.ok(block.includes('request.resource.data.saves == 0'));
    assert.ok(block.includes('request.resource.data.createdAt == request.time'));
    assert.ok(block.includes('request.resource.data.sellerUid == request.auth.uid'));
    assert.ok(block.includes("listingId.matches('^[A-Za-z0-9]{20}$')"));
    assert.ok(block.includes("!request.auth.token.firebase.sign_in_provider.matches('anonymous')"));
    assert.ok(rules.includes("oldStatus != 'deleted'"));
    assert.ok(rules.includes("oldStatus == 'active' && (newStatus == 'sold' || newStatus == 'deleted')"));
    assert.ok(rules.includes("oldStatus == 'sold' && newStatus == 'deleted'"));
    assert.ok(rules.includes('function marketSaveToggle()'));
    assert.ok(rules.includes('function marketViewBump()'));
    assert.ok(rules.includes('function marketOwnerEdit()'));
    assert.ok(rules.includes('function marketDeletedByOk(by)'));
    assert.ok(rules.includes("by == request.auth.uid || by == 'owner' || by == 'admin'"));
    assert.ok(rules.includes('marketDeletedByOk(d.deletedBy)'));
    assert.ok(rules.includes("(!changed.hasAny(['status']) || d.status is string)"));
    assert.ok(rules.includes('function marketOwnerHardDelete()'));
    assert.ok(block.includes('marketOwnerHardDelete()'));
    assert.ok(rules.includes("resource.data.get('moderated', false) != true"));
    assert.ok(rules.includes("resource.data.get('moderationHidden', false) != true"));
    assert.ok(rules.includes("resource.data.get('hidden', false) != true"));
    assert.ok(rules.includes("'marketListings', 'marketMessages'"));
    assert.ok(rules.includes('match /market_listing_counts/{listingId}'));
    const index = fs.readFileSync(path.join(root, 'functions', 'index.js'), 'utf8');
    assert.ok(index.includes('exports.onMarketplaceListingCount'));
    assert.ok(index.includes('countMarketplaceListing('));
    assert.ok(block.includes('marketOwnerEdit()'));
    assert.ok(block.includes('marketViewBump()'));
    assert.ok(block.includes('marketSaveToggle()'));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed > 0 ? 1 : 0);
