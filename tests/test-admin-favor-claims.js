'use strict';
// Admin panel: Satoshi's Favor claims tool. Admin-only, a fresh step-up on
// every callable, a confirm before turning claims on, dry run before freeze,
// and every value rendered with textContent (never innerHTML).
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (n) => fs.readFileSync(path.join(root, n), 'utf8');
const PANEL = read('admin-panel.js');

let passed = 0;
let failed = 0;
async function test(name, fn) {
    try { await fn(); console.log('\u2705 ' + name); passed++; }
    catch (e) { console.log('\u274c ' + name + ': ' + (e && e.stack || e)); failed++; }
}
const flush = () => new Promise((r) => setTimeout(r, 0));
async function settle() { for (let i = 0; i < 6; i++) await flush(); }

// ---- tiny DOM fake ------------------------------------------------------
function makeDoc() {
    let innerHtmlWrites = 0;
    function makeEl(tag) {
        const node = {
            tagName: String(tag || 'div').toUpperCase(), id: '', className: '', style: {}, attributes: {},
            children: [], parentNode: null, listeners: {}, value: '', checked: false, disabled: false, type: '',
            _text: '',
            get textContent() { return this._text + this.children.map((c) => c.textContent).join(''); },
            set textContent(v) { this.children = []; this._text = String(v); },
            set innerHTML(v) { innerHtmlWrites++; this._text = String(v); },
            get firstChild() { return this.children[0] || null; },
            appendChild(c) { c.parentNode = this; this.children.push(c); return c; },
            removeChild(c) { this.children = this.children.filter((x) => x !== c); c.parentNode = null; return c; },
            setAttribute(k, v) { this.attributes[k] = String(v); },
            getAttribute(k) { return this.attributes[k]; },
            addEventListener(t, fn) { (this.listeners[t] = this.listeners[t] || []).push(fn); },
            click() { if (this.disabled) return; (this.listeners.click || []).forEach((fn) => fn({ target: this })); },
            input(v) { this.value = v; (this.listeners.input || []).forEach((fn) => fn({ target: this })); },
        };
        return node;
    }
    const head = makeEl('head');
    const body = makeEl('body');
    function walk(n, fn) { if (fn(n)) return n; for (const c of n.children) { const r = walk(c, fn); if (r) return r; } return null; }
    return {
        head, body,
        createElement: makeEl,
        getElementById: (id) => walk(head, (n) => n.id === id) || walk(body, (n) => n.id === id),
        find: (fn) => walk(body, fn),
        findAll(fn) { const out = []; (function w(n) { if (fn(n)) out.push(n); n.children.forEach(w); })(body); return out; },
        addEventListener() {}, removeEventListener() {},
        get innerHtmlWrites() { return innerHtmlWrites; },
    };
}

function sandbox(opts) {
    const o = opts || {};
    const doc = makeDoc();
    const calls = [];
    const stepUps = [];
    const confirms = [];
    let proofN = 0;
    const cfg = o.cfg || { claimsEnabled: false, enabledEpochs: [1] };
    const results = o.results || [];
    const responses = o.responses || {};
    const sb = {
        document: doc, console, setTimeout, Promise,
        _isAdminClaim: o.admin !== false,
        confirm: (t) => { confirms.push(t); return o.confirm !== false; },
        _showFreshStepUp: (action) => { stepUps.push(action); return Promise.resolve(o.cancel ? null : 'proof-' + (++proofN)); },
        firebase: {
            firestore: () => ({
                collection: (name) => ({
                    doc: (id) => ({ get: () => Promise.resolve({ exists: name === 'config' && id === 'satoshiFavorPayouts', data: () => cfg }) }),
                    get: () => Promise.resolve({ docs: name === 'sf_payout_results' ? results.map((r) => ({ id: r._id || ('epoch_' + r.epochNumber), data: () => r })) : [] }),
                }),
            }),
            functions: () => ({
                httpsCallable: (fn) => (payload) => {
                    calls.push({ fn, payload });
                    const r = responses[fn];
                    return Promise.resolve({ data: typeof r === 'function' ? r(payload) : (r || { ok: true }) });
                },
            }),
        },
    };
    sb.window = sb;
    vm.createContext(sb);
    vm.runInContext(PANEL, sb, { filename: 'admin-panel.js' });
    return { sb, doc, calls, stepUps, confirms };
}

const byId = (doc, id) => doc.getElementById(id);
const btnByText = (doc, re) => doc.find((n) => n.tagName === 'BUTTON' && re.test(n.textContent));

const EPOCH1 = {
    kind: 'epoch_blocks', version: 2, epochNumber: 1,
    blocks: [
        { block: 0, uid: 'uidAAAAA111', amount: 4200, frozenLn: 'amtest01@getalby.com', manualReview: '' },
        { block: 1, uid: 'uidBBBBB222', amount: 4200, frozenLn: 'nitest02@walletofsatoshi.com', manualReview: 'address_changed_after_close' },
    ],
};

(async function () {
    await test('pure helpers: epoch list parsing and freeze summary', function () {
        const { sb } = sandbox();
        const h = sb.bqFavorAdmin;
        assert.deepStrictEqual(JSON.parse(JSON.stringify(h.parseEpochList('1'))), { ok: true, epochs: [1] });
        assert.deepStrictEqual(JSON.parse(JSON.stringify(h.parseEpochList(' 3, 1,1 2 '))).epochs, [1, 2, 3]);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(h.parseEpochList(''))).epochs, []);
        assert.strictEqual(h.parseEpochList('1,x').ok, false);
        assert.strictEqual(h.parseEpochList('0').ok, false);
        assert.strictEqual(h.parseEpochList('-1').ok, false);
        assert.strictEqual(h.parseEpochList('1.5').ok, false);
        assert.strictEqual(h.parseEpoch('10000'), null);
        assert.strictEqual(h.parseEpoch('1'), 1);
        const s = h.summarizeFreeze({ blocks: [{ amount: 4200 }, { amount: 4200, manualReview: 'no_address' }, { amount: 4200 }] });
        assert.strictEqual(s.claimable.length, 2);
        assert.strictEqual(s.claimableSats, 8400);
        assert.strictEqual(s.review.length, 1);
        assert.strictEqual(s.reviewSats, 4200);
        assert.strictEqual(h.maskUid('abcdefgh'), 'abcde\u2026');
        assert.strictEqual(h.maskLn('amtest01@getalby.com'), 'am\u2026@getalby.com');
    });

    await test('the tile is in the Payouts group and refuses without the admin claim', function () {
        const { sb, doc } = sandbox({ admin: false });
        const payouts = sb.bqAdminPanelTools.find((g) => g.title === 'Payouts');
        const t = payouts.tools.find((x) => x.id === 'favorClaims');
        assert.ok(t && t.tip.length >= 20 && t.tip.length <= 90 && t.how.length >= 20);
        sb.bqOpenFavorClaims();
        assert.strictEqual(byId(doc, 'bqFavorUi'), null);
    });

    await test('shows claim state and the review queue from admin-readable docs', async function () {
        const { sb, doc } = sandbox({ cfg: { claimsEnabled: true, enabledEpochs: [1], perClaimCapSats: 5000 }, results: [EPOCH1] });
        sb.bqOpenFavorClaims();
        await settle();
        const st = byId(doc, 'sfuState').textContent;
        assert.ok(/ClaimsON/.test(st), st);
        assert.ok(/Open epochs1/.test(st));
        assert.ok(/Fee halt/.test(st));
        assert.strictEqual(byId(doc, 'sfuClaimsOn').checked, true);
        assert.strictEqual(byId(doc, 'sfuEpochs').value, '1');
        const rv = byId(doc, 'sfuReview').textContent;
        assert.ok(rv.includes('Epoch 1, block 1'));
        assert.ok(rv.includes('ni\u2026@walletofsatoshi.com'));
        assert.ok(!rv.includes('uidBBBBB222'), 'uid is masked');
        assert.ok(!rv.includes('block 0'), 'claimable block not in review list');
    });

    await test('freeze: dry run first with its own step-up, then confirm runs the real one with a new proof', async function () {
        const { sb, doc, calls, stepUps, confirms } = sandbox({
            responses: { adminFreezeFavorEpoch: (p) => ({ ok: true, dryRun: !!p.dryRun, created: !p.dryRun, blocks: [
                { block: 0, uid: 'uidAA\u2026', amount: 4200, payTo: 'am\u2026@getalby.com', manualReview: '' },
                { block: 1, uid: 'uidBB\u2026', amount: 4200, payTo: '<img src=x onerror=alert(1)>', manualReview: 'address_changed_after_close' },
            ] }) },
        });
        sb.bqOpenFavorClaims();
        await settle();
        const confirmBtn = byId(doc, 'sfuFreezeConfirm');
        assert.strictEqual(confirmBtn.style.display, 'none');
        byId(doc, 'sfuFreezeEpoch').input('1');
        byId(doc, 'sfuFreezePreview').click();
        await settle();
        assert.deepStrictEqual(calls.map((c) => c.fn), ['adminFreezeFavorEpoch']);
        assert.strictEqual(calls[0].payload.dryRun, true);
        assert.strictEqual(calls[0].payload.epoch, 1);
        assert.strictEqual(calls[0].payload.freshProofId, 'proof-1');
        const out = byId(doc, 'sfuFreezeOut').textContent;
        assert.ok(/Claimable1 blocks, 4,200 sats/.test(out), out);
        assert.ok(/Manual review1 blocks, 4,200 sats/.test(out));
        assert.ok(out.includes('<img src=x onerror=alert(1)>'), 'shown as text');
        assert.strictEqual(confirmBtn.style.display, '');
        confirmBtn.click();
        await settle();
        assert.strictEqual(confirms.length, 1);
        assert.ok(/Freeze epoch 1\?/.test(confirms[0]));
        assert.strictEqual(calls.length, 2);
        assert.strictEqual(calls[1].payload.dryRun, false);
        assert.strictEqual(calls[1].payload.freshProofId, 'proof-2');
        assert.deepStrictEqual(stepUps, ['adminFreezeFavorEpoch', 'adminFreezeFavorEpoch']);
        assert.ok(byId(doc, 'sfuFreezeOut').textContent.includes('is now frozen'));
        assert.strictEqual(doc.innerHtmlWrites, 0, 'no innerHTML anywhere');
    });

    await test('changing the epoch after a preview hides Confirm freeze', async function () {
        const { sb, doc, calls } = sandbox({ responses: { adminFreezeFavorEpoch: { ok: true, dryRun: true, blocks: [] } } });
        sb.bqOpenFavorClaims();
        await settle();
        byId(doc, 'sfuFreezeEpoch').input('1');
        byId(doc, 'sfuFreezePreview').click();
        await settle();
        assert.strictEqual(byId(doc, 'sfuFreezeConfirm').style.display, '');
        byId(doc, 'sfuFreezeEpoch').input('2');
        assert.strictEqual(byId(doc, 'sfuFreezeConfirm').style.display, 'none');
        assert.strictEqual(calls.length, 1);
    });

    await test('an already-frozen epoch never offers Confirm freeze', async function () {
        const { sb, doc } = sandbox({ responses: { adminFreezeFavorEpoch: { ok: true, existed: true, dryRun: false, blocks: [] } } });
        sb.bqOpenFavorClaims();
        await settle();
        byId(doc, 'sfuFreezeEpoch').input('1');
        byId(doc, 'sfuFreezePreview').click();
        await settle();
        assert.strictEqual(byId(doc, 'sfuFreezeConfirm').style.display, 'none');
        assert.ok(byId(doc, 'sfuFreezeOut').textContent.includes('already frozen'));
    });

    await test('claims on: confirm dialog, then adminSetFavorClaims with a fresh proof', async function () {
        const { sb, doc, calls, stepUps, confirms } = sandbox({
            responses: { adminSetFavorClaims: { ok: true, config: { claimsEnabled: true, enabledEpochs: [1] } } },
        });
        sb.bqOpenFavorClaims();
        await settle();
        byId(doc, 'sfuClaimsOn').checked = true;
        byId(doc, 'sfuEpochs').value = '1';
        byId(doc, 'sfuClaimsSave').click();
        await settle();
        assert.ok(/Turn claims ON for epoch 1\?/.test(confirms[0]), confirms[0]);
        assert.deepStrictEqual(stepUps, ['adminSetFavorClaims']);
        assert.strictEqual(calls.length, 1);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0].payload)), { claimsEnabled: true, enabledEpochs: [1], freshProofId: 'proof-1' });
        assert.ok(/ClaimsON/.test(byId(doc, 'sfuState').textContent));
    });

    await test('claims: a declined confirm, a cancelled step-up, a bad list, or on with no epochs sends nothing', async function () {
        let s = sandbox({ confirm: false });
        s.sb.bqOpenFavorClaims(); await settle();
        byId(s.doc, 'sfuClaimsOn').checked = true;
        byId(s.doc, 'sfuClaimsSave').click(); await settle();
        assert.strictEqual(s.calls.length, 0);
        assert.strictEqual(s.stepUps.length, 0);

        s = sandbox({ cancel: true });
        s.sb.bqOpenFavorClaims(); await settle();
        byId(s.doc, 'sfuClaimsOn').checked = true;
        byId(s.doc, 'sfuClaimsSave').click(); await settle();
        assert.strictEqual(s.calls.length, 0);
        assert.ok(/fresh authenticator code/.test(byId(s.doc, 'sfuClaimsStatus').textContent));

        s = sandbox();
        s.sb.bqOpenFavorClaims(); await settle();
        byId(s.doc, 'sfuEpochs').value = '1, two';
        byId(s.doc, 'sfuClaimsSave').click(); await settle();
        assert.strictEqual(s.calls.length, 0);

        s = sandbox();
        s.sb.bqOpenFavorClaims(); await settle();
        byId(s.doc, 'sfuClaimsOn').checked = true;
        byId(s.doc, 'sfuEpochs').value = '';
        byId(s.doc, 'sfuClaimsSave').click(); await settle();
        assert.strictEqual(s.calls.length, 0);
        assert.strictEqual(s.confirms.length, 0);
    });

    await test('clear fee halt: confirm, step-up, then { clearFeeHalt: true } only', async function () {
        const { sb, doc, calls, stepUps, confirms } = sandbox({ responses: { adminSetFavorClaims: { ok: true, feeHaltCleared: true } } });
        sb.bqOpenFavorClaims(); await settle();
        byId(doc, 'sfuClearHalt').click(); await settle();
        assert.ok(/Alby Hub/.test(confirms[0]));
        assert.deepStrictEqual(stepUps, ['adminSetFavorClaims']);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0].payload)), { clearFeeHalt: true, freshProofId: 'proof-1' });
        assert.ok(/cleared/.test(byId(doc, 'sfuHaltStatus').textContent));
    });

    await test('review list reads epochNumber, falls back to the doc id, and skips a doc with no epoch', async function () {
        const noNum = Object.assign({}, EPOCH1, { epochNumber: undefined, _id: 'epoch_7' });
        const bad = Object.assign({}, EPOCH1, { epochNumber: undefined, _id: 'weird' });
        const { sb, doc } = sandbox({ results: [noNum, bad] });
        sb.bqOpenFavorClaims(); await settle();
        const rv = byId(doc, 'sfuReview').textContent;
        assert.ok(rv.includes('Epoch 7, block 1'), rv);
        assert.ok(!rv.includes('NaN'));
        assert.strictEqual((rv.match(/Epoch /g) || []).length, 1);
    });

    await test('release a review block: note required, then adminResolveFavorReview with action release', async function () {
        const { sb, doc, calls, stepUps } = sandbox({ results: [EPOCH1], responses: { adminResolveFavorReview: { ok: true, code: 'released' } } });
        sb.bqOpenFavorClaims(); await settle();
        const rel = btnByText(doc, /^Release to winner$/);
        rel.click(); await settle();
        assert.strictEqual(calls.length, 0, 'no note, no call');
        byId(doc, 'sfuNote_1_1').value = 'Checked with Phil, address is theirs';
        rel.click(); await settle();
        assert.deepStrictEqual(stepUps, ['adminResolveFavorReview']);
        assert.deepStrictEqual(JSON.parse(JSON.stringify(calls[0].payload)),
            { epoch: 1, block: 1, action: 'release', note: 'Checked with Phil, address is theirs', freshProofId: 'proof-1' });
        assert.ok(byId(doc, 'sfuReview').textContent.includes('Released'));
    });

    await test('source: the Favor tool never writes innerHTML or Firestore, and never rejects a block', function () {
        const i = PANEL.indexOf("// ---- Satoshi's Favor claims (admin)");
        const j = PANEL.indexOf('window.bqFavorAdmin = {');
        assert.ok(i > 0 && j > i);
        const chunk = PANEL.slice(i, j);
        assert.ok(!chunk.includes('innerHTML'));
        assert.ok(!/\.(set|update|add|delete)\(/.test(chunk.replace(/\.addEventListener\(/g, '')), 'no Firestore writes');
        assert.ok(!chunk.includes("action: 'reject'"));
        const ranking = read('ranking.js');
        assert.ok(ranking.includes("adminFreezeFavorEpoch: 'Enter a fresh authenticator code"));
        assert.ok(ranking.includes("adminResolveFavorReview: 'Enter a fresh authenticator code"));
    });

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed > 0 ? 1 : 0);
})();
