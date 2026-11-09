// dailyAuthExport: age encryption interop, export shape, fail-closed paths,
// no plaintext/PII in logs or manifest, and the restore-verify script.
// Offline: fake Auth, fake bucket, fake fetch. If the official `age` CLI is
// installed (PATH or ~/bin), also checks that it decrypts our output.
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const fnRoot = path.join(root, 'functions');
const age = require(path.join(fnRoot, 'src', 'ageEncrypt.js'));
const ex = require(path.join(fnRoot, 'src', 'authExport.js'));
const cfg = require(path.join(fnRoot, 'src', 'authBackupConfig.js'));
const verify = require(path.join(fnRoot, 'scripts', 'auth-export-verify.js'));

let passed = 0;
let failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name: name, fn: fn }); }

// ── test-only age X25519 keys + decrypt (the function itself cannot decrypt)
function keypair() {
    const kp = crypto.generateKeyPairSync('x25519');
    const jwk = kp.privateKey.export({ format: 'jwk' });
    const priv = Buffer.from(jwk.d, 'base64url');
    const pub = Buffer.from(jwk.x, 'base64url');
    return {
        priv: priv, pub: pub,
        recipient: age.bech32Encode('age', pub),
        identity: age.bech32Encode('age-secret-key-', priv).toUpperCase(),
    };
}
function unb64(s) { return Buffer.from(s, 'base64'); }
function open(key, nonce, data) {
    const d = crypto.createDecipheriv('chacha20-poly1305', key, nonce, { authTagLength: 16 });
    d.setAuthTag(data.subarray(data.length - 16));
    return Buffer.concat([d.update(data.subarray(0, data.length - 16)), d.final()]);
}
function hkdf(ikm, salt, info) { return Buffer.from(crypto.hkdfSync('sha256', ikm, salt, Buffer.from(info), 32)); }
function ageDecrypt(file, kp) {
    const end = file.indexOf('\n---') + 1;
    const nl = file.indexOf('\n', end);
    const headerText = file.subarray(0, nl).toString('utf8');
    const lines = headerText.split('\n');
    assert.strictEqual(lines[0], 'age-encryption.org/v1');
    const macLine = lines[lines.length - 1];
    const stanza = lines[1].split(' ');
    assert.strictEqual(stanza[1], 'X25519');
    const share = unb64(stanza[2]);
    const body = unb64(lines[2]);
    const privKey = crypto.createPrivateKey({ key: { kty: 'OKP', crv: 'X25519', d: kp.priv.toString('base64url'), x: kp.pub.toString('base64url') }, format: 'jwk' });
    const pubKey = crypto.createPublicKey({ key: { kty: 'OKP', crv: 'X25519', x: share.toString('base64url') }, format: 'jwk' });
    const shared = crypto.diffieHellman({ privateKey: privKey, publicKey: pubKey });
    const fileKey = open(hkdf(shared, Buffer.concat([share, kp.pub]), 'age-encryption.org/v1/X25519'), Buffer.alloc(12), body);
    const macInput = headerText.slice(0, headerText.length - macLine.length) + '---';
    const mac = crypto.createHmac('sha256', hkdf(fileKey, Buffer.alloc(0), 'header')).update(macInput).digest();
    assert.ok(mac.equals(unb64(macLine.slice(4))), 'header MAC');
    const payload = file.subarray(nl + 1);
    const nonce = payload.subarray(0, 16);
    const key = hkdf(fileKey, nonce, 'payload');
    const out = [];
    const C = 65536 + 16;
    for (let i = 0, off = 16; off < payload.length || i === 0; i++, off += C) {
        const chunk = payload.subarray(off, off + C);
        const n = Buffer.alloc(12);
        n.writeUIntBE(i, 5, 6);
        if (off + C >= payload.length) n[11] = 1;
        out.push(open(key, n, chunk));
        if (off + C >= payload.length) break;
    }
    return Buffer.concat(out);
}
function ageCli() {
    const cands = [path.join(os.homedir(), 'bin', 'age'), '/usr/bin/age', '/usr/local/bin/age'];
    for (let i = 0; i < cands.length; i++) if (fs.existsSync(cands[i])) return cands[i];
    try { return execFileSync('which', ['age'], { encoding: 'utf8' }).trim() || null; } catch (e) { return null; }
}

// ── fakes
function fakeUsers(n, opts) {
    opts = opts || {};
    const users = [];
    for (let i = 0; i < n; i++) {
        const isPw = i % 3 === 0;
        const u = {
            uid: 'uid' + String(i).padStart(6, '0') + 'ZZsecretuid',
            email: 'person' + i + '@example.com',
            emailVerified: i % 2 === 0,
            displayName: 'Name ' + i,
            disabled: i % 50 === 0,
            metadata: { creationTime: 'Mon, 01 Jan 2024 00:00:00 GMT', lastSignInTime: null },
            providerData: [{ uid: isPw ? 'person' + i + '@example.com' : 'g' + i, providerId: isPw ? 'password' : 'google.com', email: 'person' + i + '@example.com' }],
            customClaims: i === 7 ? { admin: true } : undefined,
        };
        if (isPw && !opts.noHashes) {
            u.passwordHash = Buffer.from('HASH-' + i + '-xxxxxxxxxxxxxxxx').toString('base64');
            u.passwordSalt = Buffer.from('SALT-' + i).toString('base64');
        }
        if (i === 9) u.multiFactor = { enrolledFactors: [{ uid: 'mf9', factorId: 'phone', phoneNumber: '+15555550109', enrollmentTime: 'x' }] };
        users.push(u);
    }
    return users;
}
function fakeAuth(users) {
    const calls = [];
    return {
        calls: calls,
        listUsers: async function (max, token) {
            calls.push(max);
            const start = token ? Number(token) : 0;
            const page = users.slice(start, start + max);
            const next = start + max < users.length ? String(start + max) : undefined;
            return { users: page.map(function (u) { return { toJSON: function () { return u; } }; }), pageToken: next };
        },
    };
}
function fakeBucket(opts) {
    opts = opts || {};
    const objects = {};
    return {
        objects: objects,
        file: function (name) {
            return {
                save: async function (body, o) {
                    assert.ok(o && o.preconditionOpts && o.preconditionOpts.ifGenerationMatch === 0, 'create-only write');
                    if (opts.failOn && name.indexOf(opts.failOn) !== -1) throw new Error('403 storage.objects.create denied for x@y.iam.gserviceaccount.com');
                    if (objects[name]) throw new Error('412 Precondition Failed');
                    objects[name] = { body: Buffer.from(body), opts: o };
                },
            };
        },
    };
}
function captureLog() {
    const lines = [];
    return { lines: lines, log: function () { lines.push(Array.from(arguments).join(' ')); }, error: function () { lines.push(Array.from(arguments).join(' ')); } };
}
const HASH_CONFIG = { algorithm: 'SCRYPT', signerKey: Buffer.alloc(64, 7).toString('base64'), saltSeparator: 'Bw==', rounds: 8, memoryCost: 14 };
const NOW = new Date('2026-11-10T08:30:00Z'); // 3:30 AM ET
function noPii(text, users) {
    users.forEach(function (u) {
        assert.ok(text.indexOf(u.uid) === -1, 'uid leaked');
        assert.ok(text.indexOf(u.email) === -1, 'email leaked');
        if (u.passwordHash) assert.ok(text.indexOf(u.passwordHash) === -1, 'hash leaked');
    });
    assert.ok(text.indexOf(HASH_CONFIG.signerKey) === -1, 'signer key leaked');
}

// ── age
test('age: our ciphertext decrypts (test decrypt) at chunk boundaries', function () {
    const kp = keypair();
    [0, 1, 65535, 65536, 65537, 3 * 65536 + 5].forEach(function (n) {
        const p = crypto.randomBytes(n);
        assert.ok(ageDecrypt(age.encrypt(p, [kp.recipient]), kp).equals(p), 'size ' + n);
    });
});

test('age: official age CLI decrypts our output (skipped if age is not installed)', function () {
    const cli = ageCli();
    if (!cli) { console.log('    (age CLI not found, skipped)'); return; }
    const kp = keypair();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'agetest-'));
    try {
        fs.writeFileSync(path.join(dir, 'id'), kp.identity + '\n', { mode: 0o600 });
        [0, 70000, 200001].forEach(function (n) {
            const p = crypto.randomBytes(n);
            fs.writeFileSync(path.join(dir, 'c'), age.encrypt(p, [kp.recipient]));
            const out = execFileSync(cli, ['-d', '-i', path.join(dir, 'id'), path.join(dir, 'c')]);
            assert.ok(out.equals(p), 'size ' + n);
        });
        const k2 = keypair();
        fs.writeFileSync(path.join(dir, 'id2'), k2.identity + '\n', { mode: 0o600 });
        fs.writeFileSync(path.join(dir, 'c'), age.encrypt('two', [kp.recipient, k2.recipient]));
        assert.strictEqual(execFileSync(cli, ['-d', '-i', path.join(dir, 'id2'), path.join(dir, 'c')]).toString(), 'two');
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('age: parseRecipient accepts age1 keys and refuses secret keys / bad checksums', function () {
    const kp = keypair();
    assert.strictEqual(age.parseRecipient(kp.recipient).length, 32);
    assert.throws(function () { age.parseRecipient(kp.identity); });
    assert.throws(function () { age.parseRecipient(kp.recipient.slice(0, -1) + (kp.recipient.slice(-1) === 'q' ? 'p' : 'q')); });
    assert.throws(function () { age.parseRecipient(''); });
    assert.throws(function () { age.encrypt('x', []); });
});

test('age: two encryptions of the same data differ (fresh file key and nonce)', function () {
    const kp = keypair();
    assert.ok(!age.encrypt('same', [kp.recipient]).equals(age.encrypt('same', [kp.recipient])));
});

// ── export
test('etDate uses America/New_York', function () {
    assert.strictEqual(ex.etDate(new Date('2026-11-10T08:30:00Z')), '2026-11-10');
    assert.strictEqual(ex.etDate(new Date('2026-11-10T03:00:00Z')), '2026-11-09');
    assert.strictEqual(ex.etDate(new Date('2026-07-01T03:59:00Z')), '2026-06-30');
});

test('happy path: pages listUsers, encrypts, writes data + manifest, counts only in logs', async function () {
    const kp = keypair();
    const users = fakeUsers(2503);
    const auth = fakeAuth(users);
    const bucket = fakeBucket();
    const L = captureLog();
    const m = await ex.runAuthExport({ auth: auth, bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { return HASH_CONFIG; } });
    assert.deepStrictEqual(auth.calls, [1000, 1000, 1000]);
    assert.deepStrictEqual(Object.keys(bucket.objects).sort(), ['auth/2026-11-10.jsonl.age', 'auth/2026-11-10.manifest.json']);
    const cipher = bucket.objects['auth/2026-11-10.jsonl.age'].body;
    assert.ok(cipher.subarray(0, 21).toString() === 'age-encryption.org/v1');
    noPii(cipher.toString('latin1'), users);
    const plain = ageDecrypt(cipher, kp);
    const lines = plain.toString().trim().split('\n');
    assert.strictEqual(lines.length, 2504);
    const header = JSON.parse(lines[0]);
    assert.strictEqual(header._bq, ex.HEADER_TYPE);
    assert.deepStrictEqual(header.hashConfig, HASH_CONFIG);
    assert.strictEqual(header.userCount, 2503);
    const u0 = JSON.parse(lines[1]);
    assert.strictEqual(u0.uid, users[0].uid);
    assert.strictEqual(u0.passwordHash, users[0].passwordHash);
    assert.strictEqual(u0.passwordSalt, users[0].passwordSalt);
    assert.deepStrictEqual(JSON.parse(lines[8]).customClaims, { admin: true });
    assert.strictEqual(JSON.parse(lines[10]).multiFactor.enrolledFactors[0].phoneNumber, '+15555550109');
    const manText = bucket.objects['auth/2026-11-10.manifest.json'].body.toString();
    const man = JSON.parse(manText);
    noPii(manText, users);
    assert.strictEqual(man.userCount, 2503);
    assert.strictEqual(man.passwordUsers, 835);
    assert.strictEqual(man.withPasswordHash, 835);
    assert.strictEqual(man.complete, true);
    assert.strictEqual(man.hashConfigIncluded, true);
    assert.strictEqual(man.ciphertextSha256, crypto.createHash('sha256').update(cipher).digest('hex'));
    assert.strictEqual(man.plaintextSha256, crypto.createHash('sha256').update(plain).digest('hex'));
    assert.deepStrictEqual(man.recipients, [kp.recipient]);
    assert.strictEqual(m.userCount, 2503);
    noPii(L.lines.join('\n'), users);
    assert.ok(L.lines.some(function (l) { return /users 2503/.test(l); }));
});

test('fail closed: no recipient -> FAILED marker, no data, never lists users', async function () {
    const users = fakeUsers(5);
    const auth = fakeAuth(users);
    const bucket = fakeBucket();
    const L = captureLog();
    await assert.rejects(ex.runAuthExport({ auth: auth, bucket: bucket, recipients: [], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { return HASH_CONFIG; } }), /no age recipient/);
    assert.deepStrictEqual(Object.keys(bucket.objects), ['auth/2026-11-10.FAILED.json']);
    assert.deepStrictEqual(auth.calls, []);
});

test('fail closed: a pasted secret key is refused as a recipient', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const L = captureLog();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(fakeUsers(3)), bucket: bucket, recipients: [kp.identity], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { return HASH_CONFIG; } }));
    assert.deepStrictEqual(Object.keys(bucket.objects), ['auth/2026-11-10.FAILED.json']);
    const marker = bucket.objects['auth/2026-11-10.FAILED.json'].body.toString();
    assert.ok(marker.indexOf(kp.identity) === -1 && L.lines.join('\n').indexOf(kp.identity) === -1);
});

test('incomplete: hashes missing (no getHashConfig) -> still uploads encrypted, manifest complete:false, FAILED, throws', async function () {
    const kp = keypair();
    const users = fakeUsers(30, { noHashes: true });
    const bucket = fakeBucket();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return null; } }), /incomplete/);
    assert.deepStrictEqual(Object.keys(bucket.objects).sort(), ['auth/2026-11-10.FAILED.json', 'auth/2026-11-10.jsonl.age', 'auth/2026-11-10.manifest.json']);
    const man = JSON.parse(bucket.objects['auth/2026-11-10.manifest.json'].body.toString());
    assert.strictEqual(man.complete, false);
    assert.strictEqual(man.hashConfigIncluded, false);
    assert.strictEqual(man.issues.length, 2);
});

test('hash config read error -> FAILED marker, no data, reason sanitized', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const L = captureLog();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(fakeUsers(3)), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { throw new Error('denied for someone@example.com token ya29.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'); } }));
    const marker = bucket.objects['auth/2026-11-10.FAILED.json'].body.toString();
    assert.ok(marker.indexOf('someone@example.com') === -1 && marker.indexOf('AAAAAAAAAAAAAAAAAAAAAAAA') === -1);
    assert.ok(!bucket.objects['auth/2026-11-10.jsonl.age']);
});

test('create-only: a second run the same day fails instead of overwriting', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const d = { auth: fakeAuth(fakeUsers(4)), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } };
    await ex.runAuthExport(d);
    const first = bucket.objects['auth/2026-11-10.jsonl.age'].body;
    await assert.rejects(ex.runAuthExport(Object.assign({}, d, { auth: fakeAuth(fakeUsers(4)) })));
    assert.ok(bucket.objects['auth/2026-11-10.jsonl.age'].body.equals(first));
});

test('zero users -> fails, nothing but the marker', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth([]), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } }), /0 users/);
    assert.deepStrictEqual(Object.keys(bucket.objects), ['auth/2026-11-10.FAILED.json']);
});

test('fetchHashConfig reads admin v2 config and errors without echoing the body', async function () {
    const admin = { app: function () { return { options: { credential: { getAccessToken: async function () { return { access_token: 't' }; } } } }; } };
    let url = '';
    const hc = await ex.fetchHashConfig(admin, 'demo', async function (u, o) {
        url = u;
        assert.strictEqual(o.headers.Authorization, 'Bearer t');
        return { ok: true, json: async function () { return { signIn: { hashConfig: HASH_CONFIG }, other: 1 }; } };
    });
    assert.strictEqual(url, 'https://identitytoolkit.googleapis.com/admin/v2/projects/demo/config');
    assert.deepStrictEqual(hc, HASH_CONFIG);
    await assert.rejects(ex.fetchHashConfig(admin, 'demo', async function () {
        return { ok: false, status: 403, json: async function () { return { error: { code: 403, status: 'PERMISSION_DENIED', message: 'secret detail' } }; } };
    }), function (e) { return /PERMISSION_DENIED/.test(e.message) && e.message.indexOf('secret detail') === -1; });
});

// ── wiring + config
test('index.js: dailyAuthExport is a gen2 3:30 AM ET schedule on its own account with no secrets', function () {
    process.env.GCLOUD_PROJECT = 'bitcoin-education-archive';
    process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: 'bitcoin-education-archive', storageBucket: 'bitcoin-education-archive.firebasestorage.app' });
    const ep = require(path.join(fnRoot, 'index.js')).dailyAuthExport.__endpoint;
    assert.strictEqual(ep.platform, 'gcfv2');
    assert.strictEqual(ep.scheduleTrigger.schedule, '30 3 * * *');
    assert.strictEqual(ep.scheduleTrigger.timeZone, 'America/New_York');
    assert.strictEqual(ep.serviceAccountEmail, 'fn-daily-auth-export@bitcoin-education-archive.iam.gserviceaccount.com');
    assert.deepStrictEqual(ep.secretEnvironmentVariables || [], []);
    assert.strictEqual(cfg.authBackupBucket('bitcoin-education-archive'), 'bitcoin-education-archive-auth-backups');
});

test('config holds only valid public recipients; no age secret key anywhere in the repo source', function () {
    cfg.AGE_RECIPIENTS.forEach(function (r) { assert.strictEqual(age.parseRecipient(r).length, 32); });
    const hits = [];
    (function walk(d) {
        fs.readdirSync(d).forEach(function (f) {
            if (f === 'node_modules' || f === '.git' || f.startsWith('.')) return;
            const p = path.join(d, f);
            const st = fs.statSync(p);
            if (st.isDirectory()) walk(p);
            else if (/\.(js|json|md|sh|txt|yml|yaml)$/.test(f) && st.size < 5e6) {
                if (/AGE-SECRET-KEY-1[0-9A-Z]{20,}/.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(root, p));
            }
        });
    })(path.join(root, 'functions'));
    [path.join(root, 'scripts')].forEach(function (d) {
        fs.readdirSync(d).forEach(function (f) {
            const p = path.join(d, f);
            if (fs.statSync(p).isFile() && /AGE-SECRET-KEY-1[0-9A-Z]{20,}/.test(fs.readFileSync(p, 'utf8'))) hits.push(path.relative(root, p));
        });
    });
    assert.deepStrictEqual(hits, []);
});

// ── restore-verify script
test('verify script: counts, sha match, 1% drift check, refuses non-staging import', async function () {
    const kp = keypair();
    const users = fakeUsers(300);
    const bucket = fakeBucket();
    const man = await ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } });
    const plain = ageDecrypt(bucket.objects['auth/2026-11-10.jsonl.age'].body, kp);
    const parsed = verify.parse(plain);
    const s = verify.summarize(parsed);
    const sha = crypto.createHash('sha256').update(plain).digest('hex');
    assert.deepStrictEqual(verify.check(s, man, sha, 300), []);
    assert.deepStrictEqual(verify.check(s, man, sha, 303), []);
    assert.ok(verify.check(s, man, sha, 310).some(function (p) { return /1%/.test(p); }));
    assert.ok(verify.check(s, man, 'bad', 300).some(function (p) { return /sha256/.test(p); }));

    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-'));
    try {
        fs.writeFileSync(path.join(dir, 'p.jsonl'), plain);
        fs.writeFileSync(path.join(dir, 'm.json'), JSON.stringify(man));
        const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
        const out = execFileSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--manifest', path.join(dir, 'm.json'), '--expect', '300'], { encoding: 'utf8' });
        assert.ok(/VERIFY: PASS/.test(out));
        noPii(out, users);
        const dry = execFileSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--sample', '20'], { encoding: 'utf8' });
        assert.ok(/Import plan: 20 users/.test(dry) && /with hash: 10/.test(dry) && /DRY RUN/.test(dry));
        noPii(dry, users);
        let code = 0;
        try { execFileSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--import', '--project', 'bitcoin-education-archive', '--apply'], { stdio: 'pipe' }); }
        catch (e) { code = e.status; }
        assert.strictEqual(code, 2);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verify script: pseudonymized sample keeps hashes but no real uid/email/name', function () {
    const users = fakeUsers(40).map(function (u) { return JSON.parse(JSON.stringify(u)); });
    const recs = verify.buildRecords({ users: users }, { sample: 10, all: false });
    assert.strictEqual(recs.length, 10);
    assert.strictEqual(recs.filter(function (r) { return r.passwordHash; }).length, 5);
    noPii(JSON.stringify(recs), users);
    recs.forEach(function (r, i) {
        assert.strictEqual(r.uid, 'rv-' + i);
        assert.ok(/@restore-test\.invalid$/.test(r.email));
        assert.ok(!r.displayName && !r.providerData && !r.customClaims && !r.phoneNumber);
    });
    const opts = verify.hashOptions(HASH_CONFIG);
    assert.strictEqual(opts.hash.algorithm, 'SCRYPT');
    assert.strictEqual(opts.hash.rounds, 8);
    assert.strictEqual(opts.hash.memoryCost, 14);
});

(async function () {
    for (let i = 0; i < queue.length; i++) {
        try { await queue[i].fn(); passed++; console.log('  ok  ' + queue[i].name); }
        catch (e) { failed++; console.log('  FAIL ' + queue[i].name + ': ' + (e && e.message)); }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
