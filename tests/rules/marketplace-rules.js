#!/usr/bin/env node
// Marketplace Firestore rules.
//
// The rest of tests/ are plain Node scripts. This one needs the Firestore
// emulator configured in firebase.json (127.0.0.1:8085). It checks the real
// marketplace.js payloads and the attacks that must stay denied.
//
//   cd tests/rules && npm install
//   cd ../.. && npx --yes firebase-tools emulators:exec --only firestore --project demo-marketplace \
//     "node tests/rules/marketplace-rules.js"
//
const fs = require('fs');
const path = require('path');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const {
    doc, setDoc, addDoc, collection, updateDoc, deleteDoc,
    serverTimestamp, increment, arrayUnion, arrayRemove, deleteField,
} = require('firebase/firestore');

const root = path.join(__dirname, '..', '..');
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const emuParts = emu.split(':');
const host = emuParts[0];
const port = Number(emuParts[1] || 8085);

const DEFAULTS = {
    title: 'Cold Card Mk4',
    description: 'Lightly used',
    priceSats: 50000,
    category: 'hardware_edu',
    condition: 'like_new',
    imageUrl: null,
    lightningAddress: null,
    shipping: true,
    localPickup: false,
    sellerUid: 'seller1',
    sellerName: 'phil',
    sellerRank: '🦌 Maxi',
    status: 'active',
    views: 0,
    saves: 0,
};

function payload(over) {
    const data = Object.assign({}, DEFAULTS, over || {});
    if (!over || !Object.prototype.hasOwnProperty.call(over, 'createdAt')) {
        data.createdAt = serverTimestamp();
    }
    return data;
}

function editPayload(over) {
    return Object.assign({
        title: 'New title',
        priceSats: 60000,
        category: 'electronics',
        condition: 'good',
        description: 'd',
        lightningAddress: '',
        shipping: true,
        local: false,
        localPickup: false,
        updatedAt: serverTimestamp(),
    }, over || {});
}

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-marketplace',
        firestore: { rules: rules, host: host, port: port },
    });

    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }

    try {
        await env.clearFirestore();
        const password = { firebase: { sign_in_provider: 'password' } };
        const seller = env.authenticatedContext('seller1', password).firestore();
        const other = env.authenticatedContext('other2', password).firestore();
        const blank = env.authenticatedContext('blankuser', password).firestore();
        const nouser = env.authenticatedContext('nouser', password).firestore();
        const guest = env.authenticatedContext('guest1', { firebase: { sign_in_provider: 'anonymous' } }).firestore();
        const admin = env.authenticatedContext('admin1', { admin: true, firebase: { sign_in_provider: 'password' } }).firestore();

        await env.withSecurityRulesDisabled(async function (ctx) {
            const adminDb = ctx.firestore();
            await setDoc(doc(adminDb, 'users', 'seller1'), { username: 'phil' });
            await setDoc(doc(adminDb, 'users', 'blankuser'), { points: 0 });
            const seed = Object.assign({}, DEFAULTS, { createdAt: new Date('2026-08-01T00:00:00Z') });
            const docs = {
                Ledit: {},
                Lsold: {},
                Ldel: {},
                Lview: { views: 4 },
                Lsave: {},
                Lunsave: { saves: 1, savedBy: ['other2'] },
                Lhard: {},
                LhardNo: {},
                LsoldStay: { status: 'sold' },
                LsoldDel: { status: 'sold' },
                LsoldLive: { status: 'sold' },
                LliveOwner: {},
                LliveAdmin: {},
                Ldeleted: { status: 'deleted', deletedBy: 'seller1' },
                LadminRemoved: { status: 'deleted', deletedBy: 'admin-mod' },
                LadminHard: { status: 'deleted', deletedBy: 'admin-mod' },
                LadminLiteral: { status: 'deleted', deletedBy: 'admin' },
                LselfDeleted: { status: 'deleted', deletedBy: 'seller1' },
                LownerLiteral: { status: 'deleted', deletedBy: 'owner' },
                Lmoderated: { moderated: true },
                LmodHidden: { moderationHidden: true },
                LhiddenFlag: { hidden: true },
                Lstatus: {},
                Lcombo: {},
            };
            const ids = Object.keys(docs);
            for (let i = 0; i < ids.length; i++) {
                await setDoc(doc(adminDb, 'marketplace', ids[i]), Object.assign({}, seed, docs[ids[i]]));
            }
        });

        const image = 'data:image/jpeg;base64,' + Buffer.alloc(150000, 7).toString('base64');
        const creates = [
            ['exact client payload (no image)', function () { return payload(); }, true],
            ['exact client payload (uploaded data-URL image ~200KB)', function () { return payload({ imageUrl: image }); }, true],
            ['exact client payload (https image + LN addr)', function () { return payload({ imageUrl: 'https://i.imgur.com/x.jpg', lightningAddress: 'me@getalby.com' }); }, true],
            ['exact client payload (empty seller rank)', function () { return payload({ sellerRank: '' }); }, true],
            ['username missing on the profile, empty sellerName', function () { return payload({ sellerUid: 'blankuser', sellerName: '' }); }, true, blank],
            ['user doc missing, empty sellerName', function () { return payload({ sellerUid: 'nouser', sellerName: '' }); }, true, nouser],
            ['ATTACK views:9999', function () { return payload({ views: 9999 }); }, false],
            ['ATTACK saves:500', function () { return payload({ saves: 500 }); }, false],
            ['ATTACK status sold', function () { return payload({ status: 'sold' }); }, false],
            ['ATTACK sellerUid spoof', function () { return payload({ sellerUid: 'victim' }); }, false],
            ['ATTACK sellerName spoof', function () { return payload({ sellerName: 'satoshi' }); }, false],
            ['ATTACK empty sellerName while username exists', function () { return payload({ sellerName: '' }); }, false],
            ['ATTACK sellerName Anonymous with no username', function () { return payload({ sellerUid: 'nouser', sellerName: 'Anonymous' }); }, false, nouser],
            ['ATTACK extra field featured', function () { return payload({ featured: true }); }, false],
            ['ATTACK javascript: image', function () { return payload({ imageUrl: 'javascript:alert(1)' }); }, false],
            ['ATTACK backdated createdAt', function () { return payload({ createdAt: new Date('2030-01-01') }); }, false],
            ['ATTACK title 5000 chars', function () { return payload({ title: 'x'.repeat(5000) }); }, false],
            ['ATTACK priceSats string', function () { return payload({ priceSats: '50000' }); }, false],
            ['ATTACK legacy payload with price', function () {
                return { sellerUid: 'seller1', title: 'abc', price: 5, description: '', category: 'other', createdAt: serverTimestamp() };
            }, false],
            ['ATTACK anonymous create', function () {
                return payload({ sellerUid: 'guest1', sellerName: '' });
            }, false, guest],
        ];

        for (let i = 0; i < creates.length; i++) {
            const name = creates[i][0];
            const make = creates[i][1];
            const shouldAllow = creates[i][2];
            const db = creates[i][3] || seller;
            await expect(name, function () { return addDoc(collection(db, 'marketplace'), make()); }, shouldAllow);
        }

        const autoId = 'AbC1234567890xyzABCD';
        await expect('create with a 20-char auto id', function () {
            return setDoc(doc(seller, 'marketplace', autoId), payload());
        }, true);
        await expect('ATTACK short listing id', function () {
            return setDoc(doc(seller, 'marketplace', 'short'), payload());
        }, false);
        await expect('ATTACK listing id with a symbol', function () {
            return setDoc(doc(seller, 'marketplace', 'aaaaaaaaaaaaaaaaaaa!'), payload());
        }, false);
        await expect('ATTACK listing id 21 chars', function () {
            return setDoc(doc(seller, 'marketplace', 'aaaaaaaaaaaaaaaaaaaaa'), payload());
        }, false);
        await expect('ATTACK listing id shaped like script', function () {
            return setDoc(doc(seller, 'marketplace', "a');alert(1);xxxx"), payload());
        }, false);

        await expect('owner editListing payload', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ledit'), editPayload());
        }, true);
        await expect('owner editListing payload (local pickup + https image)', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ledit'), editPayload({
                title: 'Picked up',
                shipping: false,
                local: true,
                localPickup: true,
                imageUrl: 'https://i.imgur.com/x.jpg',
            }));
        }, true);
        await expect('ATTACK owner backdated updatedAt', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ledit'), editPayload({
                title: 'Backdated',
                updatedAt: new Date('2020-01-01'),
            }));
        }, false);
        await expect('ATTACK owner changes sellerUid', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ledit'), { sellerUid: 'victim' });
        }, false);
        await expect('ATTACK owner sets views 9999', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ledit'), { views: 9999 });
        }, false);
        await expect('ATTACK non-owner edit', function () {
            return updateDoc(doc(other, 'marketplace', 'Ledit'), editPayload());
        }, false);
        await expect('ATTACK non-owner mark sold', function () {
            return updateDoc(doc(other, 'marketplace', 'Lsold'), { status: 'sold' });
        }, false);
        await expect('owner mark sold', function () {
            return updateDoc(doc(seller, 'marketplace', 'Lsold'), { status: 'sold' });
        }, true);
        await expect('ATTACK soft-delete deletedBy is another uid', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ldel'), {
                status: 'deleted',
                deletedBy: 'victim',
                deletedAt: serverTimestamp(),
            });
        }, false);
        await expect('live client soft-delete deletedBy owner', function () {
            return updateDoc(doc(seller, 'marketplace', 'LliveOwner'), {
                status: 'deleted',
                deletedBy: 'owner',
                deletedAt: serverTimestamp(),
            });
        }, true);
        await expect('live client soft-delete deletedBy admin literal', function () {
            return updateDoc(doc(seller, 'marketplace', 'LliveAdmin'), {
                status: 'deleted',
                deletedBy: 'admin',
                deletedAt: serverTimestamp(),
            });
        }, true);
        await expect('ATTACK mark sold also stamps deletedAt', function () {
            return updateDoc(doc(seller, 'marketplace', 'LsoldStay'), {
                status: 'sold',
                deletedAt: serverTimestamp(),
                deletedBy: 'owner',
            });
        }, false);
        await expect('ATTACK non-owner delete', function () {
            return updateDoc(doc(other, 'marketplace', 'Ldel'), {
                status: 'deleted',
                deletedBy: 'other2',
                deletedAt: serverTimestamp(),
            });
        }, false);
        await expect('owner soft-delete payload', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ldel'), {
                status: 'deleted',
                deletedBy: 'seller1',
                deletedAt: serverTimestamp(),
            });
        }, true);
        await expect('viewer views+1', function () {
            return updateDoc(doc(other, 'marketplace', 'Lview'), { views: increment(1) });
        }, true);
        await expect('viewer views+1 again', function () {
            return updateDoc(doc(other, 'marketplace', 'Lview'), { views: increment(1) });
        }, true);
        await expect('ATTACK viewer views jump to 9999', function () {
            return updateDoc(doc(other, 'marketplace', 'Lview'), { views: 9999 });
        }, false);
        await expect('viewer save', function () {
            return updateDoc(doc(other, 'marketplace', 'Lsave'), {
                saves: increment(1),
                savedBy: arrayUnion('other2'),
            });
        }, true);
        await expect('ATTACK double save', function () {
            return updateDoc(doc(other, 'marketplace', 'Lsave'), {
                saves: increment(1),
                savedBy: arrayUnion('other2'),
            });
        }, false);
        await expect('ATTACK saves +1 without savedBy', function () {
            return updateDoc(doc(other, 'marketplace', 'Lsave'), { saves: increment(1) });
        }, false);
        await expect('viewer unsave', function () {
            return updateDoc(doc(other, 'marketplace', 'Lunsave'), {
                saves: increment(-1),
                savedBy: arrayRemove('other2'),
            });
        }, true);
        await expect('ATTACK second unsave', function () {
            return updateDoc(doc(other, 'marketplace', 'Lunsave'), {
                saves: increment(-1),
                savedBy: arrayRemove('other2'),
            });
        }, false);
        await expect('ATTACK non-owner hard delete', function () {
            return deleteDoc(doc(other, 'marketplace', 'LhardNo'));
        }, false);
        await expect('owner hard delete', function () {
            return deleteDoc(doc(seller, 'marketplace', 'Lhard'));
        }, true);
        await expect('ATTACK owner hard-deletes a listing an admin removed', function () {
            return deleteDoc(doc(seller, 'marketplace', 'LadminHard'));
        }, false);
        await expect('ATTACK owner hard-deletes a listing marked deletedBy admin', function () {
            return deleteDoc(doc(seller, 'marketplace', 'LadminLiteral'));
        }, false);
        await expect('admin hard-deletes a moderated listing', function () {
            return deleteDoc(doc(admin, 'marketplace', 'LadminHard'));
        }, true);
        await expect('owner hard-deletes their own soft-delete', function () {
            return deleteDoc(doc(seller, 'marketplace', 'LselfDeleted'));
        }, true);
        await expect('owner hard-deletes a live-client owner soft-delete', function () {
            return deleteDoc(doc(seller, 'marketplace', 'LownerLiteral'));
        }, true);
        await expect('ATTACK owner hard-deletes a moderated listing', function () {
            return deleteDoc(doc(seller, 'marketplace', 'Lmoderated'));
        }, false);
        await expect('ATTACK owner hard-deletes a moderationHidden listing', function () {
            return deleteDoc(doc(seller, 'marketplace', 'LmodHidden'));
        }, false);
        await expect('ATTACK owner hard-deletes a hidden listing', function () {
            return deleteDoc(doc(seller, 'marketplace', 'LhiddenFlag'));
        }, false);
        await expect('admin hard-deletes a moderated listing', function () {
            return deleteDoc(doc(admin, 'marketplace', 'Lmoderated'));
        }, true);
        await expect('ATTACK owner removes the status field', function () {
            return updateDoc(doc(seller, 'marketplace', 'Lstatus'), { status: deleteField() });
        }, false);
        await expect('ATTACK owner sets status null', function () {
            return updateDoc(doc(seller, 'marketplace', 'Lstatus'), { status: null });
        }, false);
        await expect('ATTACK sold to active', function () {
            return updateDoc(doc(seller, 'marketplace', 'LsoldStay'), { status: 'active' });
        }, false);
        await expect('ATTACK deleted to active', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ldeleted'), { status: 'active' });
        }, false);
        await expect('ATTACK deleted to sold', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ldeleted'), { status: 'sold' });
        }, false);
        await expect('ATTACK content edit while sold', function () {
            return updateDoc(doc(seller, 'marketplace', 'LsoldStay'), editPayload());
        }, false);
        await expect('ATTACK content edit while deleted', function () {
            return updateDoc(doc(seller, 'marketplace', 'Ldeleted'), editPayload());
        }, false);
        await expect('ATTACK owner edits a listing an admin removed', function () {
            return updateDoc(doc(seller, 'marketplace', 'LadminRemoved'), editPayload());
        }, false);
        await expect('ATTACK owner restores a listing an admin removed', function () {
            return updateDoc(doc(seller, 'marketplace', 'LadminRemoved'), { status: 'active' });
        }, false);
        await expect('ATTACK content edit combined with mark sold', function () {
            return updateDoc(doc(seller, 'marketplace', 'Lcombo'), editPayload({ status: 'sold' }));
        }, false);
        await expect('live client sold to deleted with deletedBy owner', function () {
            return updateDoc(doc(seller, 'marketplace', 'LsoldLive'), {
                status: 'deleted',
                deletedBy: 'owner',
                deletedAt: serverTimestamp(),
            });
        }, true);
        await expect('owner sold to deleted', function () {
            return updateDoc(doc(seller, 'marketplace', 'LsoldDel'), {
                status: 'deleted',
                deletedBy: 'seller1',
                deletedAt: serverTimestamp(),
            });
        }, true);
        await expect('admin restores a deleted listing', function () {
            return updateDoc(doc(admin, 'marketplace', 'Ldeleted'), { status: 'active' });
        }, true);
        await expect('viewer can still count a view on an admin-removed listing', function () {
            return updateDoc(doc(other, 'marketplace', 'LadminRemoved'), { views: increment(1) });
        }, true);
        await expect('ATTACK standalone marketListings +1 without listing', function () {
            return updateDoc(doc(seller, 'users', 'seller1'), { marketListings: increment(1) });
        }, false);
        await expect('ATTACK marketListings jump to 999', function () {
            return updateDoc(doc(seller, 'users', 'seller1'), { marketListings: 999 });
        }, false);
        await expect('ATTACK other user marketListings +1', function () {
            return updateDoc(doc(other, 'users', 'seller1'), { marketListings: increment(1) });
        }, false);
        await expect('ATTACK marketMessages stays server-only', function () {
            return updateDoc(doc(seller, 'users', 'seller1'), { marketMessages: increment(1) });
        }, false);
    } finally {
        await env.cleanup();
    }

    console.log(failed === 0 ? '\nALL MARKETPLACE RULES CHECKS PASSED' : '\n' + failed + ' MARKETPLACE RULES CHECKS FAILED');
    process.exit(failed === 0 ? 0 : 1);
})().catch(function (e) {
    console.error('ERR', e && e.stack ? e.stack : e);
    process.exit(1);
});
