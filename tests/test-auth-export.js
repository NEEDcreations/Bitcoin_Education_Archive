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

function metaCreated(iso, extra) { return Object.assign({ timeCreated: iso }, extra || {}); }
function auditCreate(objectName, sa, ts, generation) {
    const gen = String(generation == null ? '1' : generation);
    return [{
        protoPayload: {
            methodName: 'storage.objects.create',
            authenticationInfo: { principalEmail: sa },
            resourceName: 'projects/_/buckets/demo-auth-backups/objects/' + objectName,
            response: { name: objectName, generation: gen },
        },
        timestamp: ts || isoOrNow(),
    }];
}
function metaForCipher(objectName, iso, buf, generation) {
    const h = verify.fileHashes(buf);
    return {
        name: objectName,
        generation: String(generation == null ? '1' : generation),
        timeCreated: iso,
        md5Hash: h.md5,
        crc32c: h.crc32c,
    };
}
function writeIdentity(dir, kp) {
    const pth = path.join(dir, 'identity.txt');
    fs.writeFileSync(pth, kp.identity + '\n', { mode: 0o600 });
    return pth;
}
function isoOrNow() { return '2026-11-10T08:30:30.000Z'; }
const IN_WINDOW = '2026-11-10T08:30:30.000Z'; // 3:30:30 AM ET
const IN_WINDOW_EARLIER = '2026-11-10T08:29:30.000Z'; // 3:29:30 AM ET
const OUT_WINDOW = '2026-11-10T09:01:00.000Z'; // 4:01 AM ET

function objectsEnding(bucket, suffix) {
    return Object.keys(bucket.objects).filter(function (k) { return k.endsWith(suffix); }).sort();
}
function oneObject(bucket, suffix) {
    const keys = objectsEnding(bucket, suffix);
    assert.strictEqual(keys.length, 1, 'expected 1 *' + suffix + ', got ' + Object.keys(bucket.objects).join(', '));
    return keys[0];
}
function assertPerRunName(name, date, utcTime, suffix) {
    const re = new RegExp('^auth\\/' + date + '\\/' + utcTime + '-[0-9a-f]{16}\\.' + suffix.replace(/\./g, '\\.') + '$');
    assert.ok(re.test(name), 'bad object name: ' + name);
}
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
    const dataName = oneObject(bucket, '.jsonl.age');
    const manName = oneObject(bucket, '.manifest.json');
    assertPerRunName(dataName, '2026-11-10', '083000Z', 'jsonl.age');
    assertPerRunName(manName, '2026-11-10', '083000Z', 'manifest.json');
    assert.strictEqual(m.object, dataName);
    assert.strictEqual(m.manifestObject, manName);
    assert.ok(/^[0-9a-f]{16}$/.test(m.runId));
    const cipher = bucket.objects[dataName].body;
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
    const manText = bucket.objects[manName].body.toString();
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
    assertPerRunName(oneObject(bucket, '.FAILED.json'), '2026-11-10', '083000Z', 'FAILED.json');
    assert.strictEqual(objectsEnding(bucket, '.jsonl.age').length, 0);
    assert.deepStrictEqual(auth.calls, []);
});

test('fail closed: a pasted secret key is refused as a recipient', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const L = captureLog();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(fakeUsers(3)), bucket: bucket, recipients: [kp.identity], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { return HASH_CONFIG; } }));
    const failedName = oneObject(bucket, '.FAILED.json');
    assertPerRunName(failedName, '2026-11-10', '083000Z', 'FAILED.json');
    const marker = bucket.objects[failedName].body.toString();
    assert.ok(marker.indexOf(kp.identity) === -1 && L.lines.join('\n').indexOf(kp.identity) === -1);
});

test('incomplete: hashes missing (no getHashConfig) -> still uploads encrypted, manifest complete:false, FAILED, throws', async function () {
    const kp = keypair();
    const users = fakeUsers(30, { noHashes: true });
    const bucket = fakeBucket();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return null; } }), /incomplete/);
    const dataName = oneObject(bucket, '.jsonl.age');
    const manName = oneObject(bucket, '.manifest.json');
    assertPerRunName(dataName, '2026-11-10', '083000Z', 'jsonl.age');
    assertPerRunName(manName, '2026-11-10', '083000Z', 'manifest.json');
    assertPerRunName(oneObject(bucket, '.FAILED.json'), '2026-11-10', '083000Z', 'FAILED.json');
    const man = JSON.parse(bucket.objects[manName].body.toString());
    assert.strictEqual(man.object, dataName);
    assert.strictEqual(man.complete, false);
    assert.strictEqual(man.hashConfigIncluded, false);
    assert.strictEqual(man.issues.length, 2);
});

test('hash config read error -> FAILED marker, no data, reason sanitized', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const L = captureLog();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(fakeUsers(3)), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { throw new Error('denied for someone@example.com token ya29.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'); } }));
    const marker = bucket.objects[oneObject(bucket, '.FAILED.json')].body.toString();
    assert.ok(marker.indexOf('someone@example.com') === -1 && marker.indexOf('AAAAAAAAAAAAAAAAAAAAAAAA') === -1);
    assert.ok(marker.indexOf('<email>') !== -1);
    assert.strictEqual(objectsEnding(bucket, '.jsonl.age').length, 0);
});

test('same-day rerun writes a new unique object and keeps the first (create-only)', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const d = { auth: fakeAuth(fakeUsers(4)), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } };
    const firstMan = await ex.runAuthExport(d);
    const firstBody = Buffer.from(bucket.objects[firstMan.object].body);
    const secondMan = await ex.runAuthExport(Object.assign({}, d, { auth: fakeAuth(fakeUsers(4)) }));
    assert.notStrictEqual(firstMan.object, secondMan.object);
    assert.notStrictEqual(firstMan.runId, secondMan.runId);
    assert.ok(bucket.objects[firstMan.object].body.equals(firstBody));
    assert.strictEqual(objectsEnding(bucket, '.jsonl.age').length, 2);
    assert.strictEqual(objectsEnding(bucket, '.manifest.json').length, 2);
    assertPerRunName(firstMan.object, '2026-11-10', '083000Z', 'jsonl.age');
    assertPerRunName(secondMan.object, '2026-11-10', '083000Z', 'jsonl.age');
});

test('create-only: writing the same run name twice fails and leaves the first object', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const d = { auth: fakeAuth(fakeUsers(4)), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, runId: 'aaaaaaaaaaaaaaaa', log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } };
    const first = await ex.runAuthExport(d);
    const firstBody = Buffer.from(bucket.objects[first.object].body);
    await assert.rejects(ex.runAuthExport(Object.assign({}, d, { auth: fakeAuth(fakeUsers(4)) })), /dailyAuthExport failed/);
    assert.ok(bucket.objects[first.object].body.equals(firstBody));
    assert.strictEqual(objectsEnding(bucket, '.jsonl.age').length, 1);
});

test('zero users -> fails, nothing but the marker', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth([]), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } }), /0 users/);
    assertPerRunName(oneObject(bucket, '.FAILED.json'), '2026-11-10', '083000Z', 'FAILED.json');
    assert.strictEqual(objectsEnding(bucket, '.jsonl.age').length, 0);
});

test('fetchHashConfig reads admin v2 config and errors without echoing the body', async function () {
    const admin = { app: function () { return { options: { credential: { getAccessToken: async function () { return { access_token: 't' }; } } } }; } };
    let url = '';
    const hc = await ex.fetchHashConfig(admin, 'demo', async function (u, o) {
        url = u;
        assert.strictEqual(o.headers.Authorization, 'Bearer t');
        assert.ok(!Object.prototype.hasOwnProperty.call(o.headers, 'x-goog-user-project'));
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
    const plain = ageDecrypt(bucket.objects[man.object].body, kp);
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
        const cipherPath = path.join(dir, 'c.jsonl.age');
        fs.writeFileSync(cipherPath, bucket.objects[man.object].body);
        const identity = writeIdentity(dir, kp);
        const sa = verify.expectedBackupSa('demo');
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(metaForCipher(man.object, IN_WINDOW, bucket.objects[man.object].body)));
        fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(auditCreate(man.object, sa, IN_WINDOW)));
        const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
        const out = execFileSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--manifest', path.join(dir, 'm.json'), '--expect', '300'], { encoding: 'utf8' });
        assert.ok(/VERIFY: PASS/.test(out));
        noPii(out, users);
        const dry = execFileSync('node', [script, '--ciphertext', cipherPath, '--identity', identity, '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--sample', '20', '--object-meta', path.join(dir, 'meta.json'), '--audit-log', path.join(dir, 'audit.json')], { encoding: 'utf8' });
        assert.ok(/VERIFY: PASS/.test(dry));
        assert.ok(/Import plan: 20 users/.test(dry) && /with hash: 10/.test(dry) && /DRY RUN/.test(dry));
        noPii(dry, users);
        let code = 0, err = '';
        try { execFileSync('node', [script, '--ciphertext', cipherPath, '--identity', identity, '--manifest', path.join(dir, 'm.json'), '--object-meta', path.join(dir, 'meta.json'), '--audit-log', path.join(dir, 'audit.json'), '--import', '--project', 'bitcoin-education-archive', '--apply'], { stdio: 'pipe' }); }
        catch (e) { code = e.status; err = (e.stderr || '').toString(); }
        assert.strictEqual(code, 2);
        assert.ok(/Staging only/.test(err), err);
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


test('sanitize redacts emails, tokens, and spaced or local phone formats', function () {
    const s = ex.sanitize('denied for someone@example.com phone +15555550109 also +447911123456 token ya29.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
    assert.ok(s.indexOf('someone@example.com') === -1);
    assert.ok(s.indexOf('+15555550109') === -1);
    assert.ok(s.indexOf('+447911123456') === -1);
    assert.ok(s.indexOf('ya29.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA') === -1);
    assert.ok(s.indexOf('<email>') !== -1);
    assert.ok(s.indexOf('<phone>') !== -1);
    assert.ok(s.indexOf('<redacted>') !== -1);
    ['+1 555 123 4567', '(555) 123-4567', '555-123-4567', '5551234567'].forEach(function (phone) {
        const out = ex.sanitize('call ' + phone + ' now');
        assert.ok(out.indexOf(phone) === -1, 'left phone in place: ' + phone + ' -> ' + out);
        assert.ok(out.indexOf('<phone>') !== -1, 'did not redact ' + phone);
    });
    assert.ok(ex.sanitize('short +123456 stays').indexOf('+123456') !== -1);
});

test('sanitize leaves ordinary counts and timestamps in log lines alone', function () {
    const line = '[AUTH-BACKUP] wrote auth/2026-11-10/083000Z-aaaaaaaaaaaaaaaa.jsonl.age users 2503 passwordUsers 835 withHash 835 hashConfig true bytes 1234567 started 2026-11-10T08:30:00.000Z';
    const out = ex.sanitize('error at ' + line);
    assert.ok(out.indexOf('2026-11-10') !== -1, out);
    assert.ok(out.indexOf('2026-11-10T08:30:00.000Z') !== -1, out);
    assert.ok(out.indexOf('users 2503') !== -1, out);
    assert.ok(out.indexOf('passwordUsers 835') !== -1, out);
    assert.ok(out.indexOf('bytes 1234567') !== -1, out);
    assert.ok(out.indexOf('083000Z-aaaaaaaaaaaaaaaa') !== -1, out);
    const mixed = ex.sanitize('denied +1 555 123 4567 on 2026-11-10T08:30:00.000Z users 2503');
    assert.ok(mixed.indexOf('+1 555 123 4567') === -1);
    assert.ok(mixed.indexOf('<phone>') !== -1);
    assert.ok(mixed.indexOf('2026-11-10T08:30:00.000Z') !== -1);
    assert.ok(mixed.indexOf('users 2503') !== -1);
});

test('hash config error marker also redacts phone numbers', async function () {
    const kp = keypair();
    const bucket = fakeBucket();
    const L = captureLog();
    await assert.rejects(ex.runAuthExport({ auth: fakeAuth(fakeUsers(3)), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: L, getHashConfig: async function () { throw new Error('denied for someone@example.com phone +15555550100'); } }));
    const marker = bucket.objects[oneObject(bucket, '.FAILED.json')].body.toString();
    const logs = L.lines.join('\n');
    assert.ok(marker.indexOf('+15555550100') === -1 && logs.indexOf('+15555550100') === -1);
    assert.ok(marker.indexOf('<phone>') !== -1);
    assert.ok(marker.indexOf('someone@example.com') === -1);
});

test('objectNames include the UTC stamp and a random id, and two calls differ', function () {
    const a = ex.objectNames('2026-11-10', NOW, ex.newRunId());
    const b = ex.objectNames('2026-11-10', NOW, ex.newRunId());
    assert.strictEqual(ex.utcStamp(NOW), '083000Z');
    assertPerRunName(a.data, '2026-11-10', '083000Z', 'jsonl.age');
    assertPerRunName(b.data, '2026-11-10', '083000Z', 'jsonl.age');
    assert.notStrictEqual(a.data, b.data);
    assert.notStrictEqual(a.runId, b.runId);
    assert.ok(a.manifest.startsWith('auth/2026-11-10/083000Z-') && a.failed.startsWith('auth/2026-11-10/083000Z-'));
});

test('verify script: findLatestComplete ranks by timeCreated and flags extras and out-of-window runs', function () {
    const older = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/082930Z-aaaaaaaaaaaaaaaa.jsonl.age', finishedAt: '2026-11-10T10:00:00.000Z', date: '2026-11-10' };
    const later = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/083030Z-bbbbbbbbbbbbbbbb.jsonl.age', finishedAt: '2026-11-10T08:31:00.000Z', date: '2026-11-10' };
    const planted = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/090100Z-cccccccccccccccc.jsonl.age', finishedAt: '2026-11-10T12:00:00.000Z', date: '2026-11-10' };
    const incomplete = { format: 'bq-auth-export-v2', complete: false, object: 'auth/2026-11-10/100000Z-dddddddddddddddd.jsonl.age', finishedAt: '2026-11-10T10:01:00.000Z', date: '2026-11-10' };
    const latest = verify.findLatestComplete([
        { manifest: incomplete },
        { manifest: planted, meta: metaCreated(OUT_WINDOW) },
        { manifest: older, meta: metaCreated(IN_WINDOW_EARLIER) },
        { manifest: later, meta: metaCreated(IN_WINDOW) },
    ]);
    assert.strictEqual(latest.manifest.object, later.object);
    assert.strictEqual(latest.timeCreated, IN_WINDOW);
    assert.ok(latest.flags.some(function (f) { return /outside the backup schedule window/.test(f) && f.indexOf(planted.object) !== -1; }), String(latest.flags));
    assert.ok(latest.flags.some(function (f) { return /more than one complete run on 2026-11-10/.test(f); }), String(latest.flags));
    // A later finishedAt must not beat an earlier timeCreated.
    const forged = verify.findLatestComplete([
        { manifest: older, meta: metaCreated(IN_WINDOW) },
        { manifest: planted, meta: metaCreated(IN_WINDOW_EARLIER) },
    ]);
    assert.strictEqual(forged.manifest.object, older.object);
    assert.strictEqual(verify.findLatestComplete([{ manifest: incomplete }]), null);
    assert.strictEqual(verify.findLatestComplete([]), null);
    const noneInWindow = verify.findLatestComplete([{ manifest: planted, meta: metaCreated(OUT_WINDOW) }]);
    assert.ok(noneInWindow && !noneInWindow.manifest);
    assert.ok(noneInWindow.flags.some(function (f) { return /outside the backup schedule window/.test(f); }));
    // A planted manifest with an uploader-set timeCreated and no sidecar
    // must not outrank a real backup that has server metadata.
    const noSidecar = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/083100Z-eeeeeeeeeeeeeeee.jsonl.age', timeCreated: '2026-11-18T08:31:00.000Z', finishedAt: '2026-11-18T08:31:00.000Z', date: '2026-11-18' };
    const ranked = verify.findLatestComplete([
        { manifest: noSidecar },
        { manifest: older, meta: metaCreated(IN_WINDOW_EARLIER) },
    ]);
    assert.strictEqual(ranked.manifest.object, older.object);
    assert.ok(ranked.flags.some(function (f) { return /missing timeCreated/.test(f) && f.indexOf(noSidecar.object) !== -1; }), String(ranked.flags));
});

test('verify script: --latest-from --print-latest selects by timeCreated and prints flags', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-latest-'));
    try {
        const day = path.join(dir, '2026-11-10');
        fs.mkdirSync(day);
        const older = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/082930Z-aaaaaaaaaaaaaaaa.jsonl.age', finishedAt: '2026-11-10T10:00:00.000Z', plaintextSha256: 'x', date: '2026-11-10' };
        const later = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/083030Z-bbbbbbbbbbbbbbbb.jsonl.age', finishedAt: '2026-11-10T08:31:00.000Z', plaintextSha256: 'y', date: '2026-11-10' };
        const planted = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/090100Z-cccccccccccccccc.jsonl.age', finishedAt: '2026-11-10T12:00:00.000Z', plaintextSha256: 'z', date: '2026-11-10' };
        fs.writeFileSync(path.join(day, '082930Z-aaaaaaaaaaaaaaaa.manifest.json'), JSON.stringify(older));
        fs.writeFileSync(path.join(day, '082930Z-aaaaaaaaaaaaaaaa.meta.json'), JSON.stringify(metaCreated(IN_WINDOW_EARLIER)));
        fs.writeFileSync(path.join(day, '083030Z-bbbbbbbbbbbbbbbb.manifest.json'), JSON.stringify(later));
        fs.writeFileSync(path.join(day, '083030Z-bbbbbbbbbbbbbbbb.meta.json'), JSON.stringify(metaCreated(IN_WINDOW)));
        fs.writeFileSync(path.join(day, '090100Z-cccccccccccccccc.manifest.json'), JSON.stringify(planted));
        fs.writeFileSync(path.join(day, '090100Z-cccccccccccccccc.meta.json'), JSON.stringify(metaCreated(OUT_WINDOW)));
        const loaded = verify.loadManifestsFromDir(dir);
        assert.strictEqual(loaded.length, 3);
        const latest = verify.findLatestComplete(loaded);
        assert.strictEqual(latest.manifest.object, later.object);
        const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
        const out = execFileSync('node', [script, '--latest-from', dir, '--print-latest'], { encoding: 'utf8' });
        assert.ok(out.indexOf(later.object) !== -1);
        assert.ok(out.indexOf('timeCreated ' + IN_WINDOW) !== -1);
        assert.ok(/FLAG:.*outside the backup schedule window/.test(out));
        assert.ok(/FLAG:.*more than one complete run on 2026-11-10/.test(out));
        assert.ok(out.indexOf(planted.object) === -1 || /FLAG:.*090100Z-cccccccccccccccc/.test(out));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verify script: --all requires --delete-after; --file warns on stderr', async function () {
    const kp = keypair();
    const users = fakeUsers(8);
    const bucket = fakeBucket();
    const man = await ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } });
    const plain = ageDecrypt(bucket.objects[man.object].body, kp);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-flags-'));
    const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
    const { spawnSync } = require('child_process');
    try {
        fs.writeFileSync(path.join(dir, 'p.jsonl'), plain);
        fs.writeFileSync(path.join(dir, 'm.json'), JSON.stringify(man));
        const warn = spawnSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--manifest', path.join(dir, 'm.json')], { encoding: 'utf8' });
        assert.strictEqual(warn.status, 0);
        assert.ok(/VERIFY: PASS/.test(warn.stdout));
        assert.ok(/WARNING: --file reads a plaintext Auth export/.test(warn.stderr));
        assert.ok(/never the shared box/.test(warn.stderr));
        noPii(warn.stdout, users);
        const all = spawnSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--all', '--apply'], { encoding: 'utf8' });
        assert.strictEqual(all.status, 2);
        assert.ok(/--all requires --delete-after/.test(all.stderr));
        const dryAll = spawnSync('node', [script, '--file', path.join(dir, 'p.jsonl'), '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--all'], { encoding: 'utf8' });
        assert.strictEqual(dryAll.status, 2);
        assert.ok(/--all requires --delete-after/.test(dryAll.stderr));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verify script: customClaims are omitted by default and included only with keepClaims', function () {
    const users = fakeUsers(20).map(function (u) { return JSON.parse(JSON.stringify(u)); });
    assert.deepStrictEqual(users[7].customClaims, { admin: true });
    const denied = verify.buildRecords({ users: users }, { all: true });
    assert.strictEqual(denied.length, 20);
    assert.ok(denied.every(function (r) { return !r.customClaims; }));
    const kept = verify.buildRecords({ users: users }, { all: true, keepClaims: true });
    assert.deepStrictEqual(kept[7].customClaims, { admin: true });
    assert.ok(kept.filter(function (r) { return r.customClaims; }).length === 1);
    const sample = verify.buildRecords({ users: users }, { sample: 10, all: false, keepClaims: true });
    assert.ok(sample.every(function (r) { return !r.customClaims; }));
});

test('verify script: provenance is fail-closed, uses audit-log creator and the schedule window', function () {
    const sa = verify.expectedBackupSa('demo');
    const objectName = 'auth/2026-11-10/083000Z-aaaaaaaaaaaaaaaa.jsonl.age';
    assert.strictEqual(sa, 'fn-daily-auth-export@demo.iam.gserviceaccount.com');
    const ok = verify.checkBackupProvenance({
        required: true,
        meta: metaCreated(IN_WINDOW, { name: objectName, generation: '1' }),
        audit: auditCreate(objectName, sa, IN_WINDOW, '1'),
        objectName: objectName,
        expectedSa: sa,
        window: verify.DEFAULT_SCHEDULE_WINDOW,
    });
    assert.deepStrictEqual(ok, []);
    // Missing or empty inputs fail closed when required.
    assert.ok(verify.checkBackupProvenance({ required: true, expectedSa: sa }).some(function (p) { return /metadata is missing or empty/.test(p); }));
    assert.ok(verify.checkBackupProvenance({ required: true, meta: {}, audit: [], expectedSa: sa }).some(function (p) { return /metadata is missing or empty/.test(p); }));
    assert.ok(verify.checkBackupProvenance({ required: true, meta: metaCreated(IN_WINDOW), audit: null, expectedSa: sa }).some(function (p) { return /audit log is missing or empty/.test(p); }));
    assert.ok(verify.checkBackupProvenance({ required: true, meta: { cacheControl: 'no-store' }, audit: auditCreate(objectName, sa), objectName: objectName, expectedSa: sa }).some(function (p) { return /missing timeCreated/.test(p); }));
    // Custom metadata creator/createdBy is ignored; audit principalEmail is the source.
    const forgedMeta = { timeCreated: IN_WINDOW, name: objectName, generation: '1', metadata: { creator: sa, createdBy: sa }, creator: sa };
    const evilAudit = auditCreate(objectName, 'evil@example.com', IN_WINDOW);
    assert.ok(verify.checkBackupProvenance({ required: true, meta: forgedMeta, audit: evilAudit, objectName: objectName, expectedSa: sa }).some(function (p) { return /creator is not the expected service account/.test(p); }));
    assert.deepStrictEqual(verify.checkBackupProvenance({ required: true, meta: forgedMeta, audit: auditCreate(objectName, sa), objectName: objectName, expectedSa: sa }), []);
    // Window check, not manifest finishedAt. A matching forged finishedAt does not help an out-of-window object.
    const out = verify.checkBackupProvenance({
        required: true,
        meta: metaCreated(OUT_WINDOW, { name: objectName, generation: '1' }),
        audit: auditCreate(objectName, sa, OUT_WINDOW),
        objectName: objectName,
        expectedSa: sa,
        finishedAt: OUT_WINDOW,
        startedAt: OUT_WINDOW,
        window: verify.DEFAULT_SCHEDULE_WINDOW,
    });
    assert.ok(out.some(function (p) { return /outside the backup schedule window/.test(p); }), String(out));
    assert.ok(verify.checkBackupProvenance({ required: true, meta: { timeCreated: 'not-a-date' }, audit: auditCreate(objectName, sa), objectName: objectName, expectedSa: sa }).some(function (p) { return /not a valid timestamp/.test(p); }));
    // Optional path (verify-only, no flags) still stays quiet.
    assert.deepStrictEqual(verify.checkBackupProvenance({ required: false, expectedSa: sa }), []);
    // July (EDT): 07:30 UTC is 3:30 AM ET and is in window.
    const july = '2026-07-01T07:30:00.000Z';
    assert.ok(verify.inScheduleWindow(july, verify.DEFAULT_SCHEDULE_WINDOW));
    assert.ok(!verify.inScheduleWindow('2026-07-01T08:00:00.000Z', verify.DEFAULT_SCHEDULE_WINDOW));
});

test('verify script: --import without provenance is refused, even on a dry run', async function () {
    const kp = keypair();
    const users = fakeUsers(8);
    const bucket = fakeBucket();
    const man = await ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } });
    const plain = ageDecrypt(bucket.objects[man.object].body, kp);
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-prov-'));
    const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
    const { spawnSync } = require('child_process');
    try {
        fs.writeFileSync(path.join(dir, 'p.jsonl'), plain);
        fs.writeFileSync(path.join(dir, 'm.json'), JSON.stringify(man));
        const cipherPath = path.join(dir, 'c.jsonl.age');
        fs.writeFileSync(cipherPath, bucket.objects[man.object].body);
        const none = spawnSync('node', [script, '--ciphertext', cipherPath, '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--sample', '4'], { encoding: 'utf8' });
        assert.notStrictEqual(none.status, 0);
        assert.ok(/object metadata is missing or empty/.test(none.stdout + none.stderr));
        assert.ok(/audit log is missing or empty/.test(none.stdout + none.stderr));
        fs.writeFileSync(path.join(dir, 'empty-meta.json'), '');
        fs.writeFileSync(path.join(dir, 'empty-audit.json'), '');
        const empty = spawnSync('node', [script, '--ciphertext', cipherPath, '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--object-meta', path.join(dir, 'empty-meta.json'), '--audit-log', path.join(dir, 'empty-audit.json')], { encoding: 'utf8' });
        assert.notStrictEqual(empty.status, 0);
        assert.ok(/object metadata is missing or empty/.test(empty.stdout + empty.stderr));
        const sa = verify.expectedBackupSa('demo');
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({ metadata: { creator: sa, createdBy: sa }, creator: sa }));
        fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(auditCreate(man.object, sa, IN_WINDOW)));
        const noTime = spawnSync('node', [script, '--ciphertext', cipherPath, '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--object-meta', path.join(dir, 'meta.json'), '--audit-log', path.join(dir, 'audit.json')], { encoding: 'utf8' });
        assert.notStrictEqual(noTime.status, 0);
        assert.ok(/missing timeCreated/.test(noTime.stdout + noTime.stderr));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('crc32c matches the Castagnoli vector used by GCS metadata', function () {
    assert.strictEqual(verify.crc32cUint(Buffer.from('123456789')).toString(16), 'e3069283');
});

test('sanitize redacts a phone sitting after a count word', function () {
    ['failed 5551234567', 'users: 5551234567', 'lines 5551234567'].forEach(function (msg) {
        const out = ex.sanitize(msg);
        assert.ok(out.indexOf('5551234567') === -1, 'left phone in place: ' + msg + ' -> ' + out);
        assert.ok(out.indexOf('<phone>') !== -1, 'did not redact ' + msg + ' -> ' + out);
    });
    assert.ok(ex.sanitize('failed 12').indexOf('failed 12') !== -1);
    assert.ok(ex.sanitize('users: 26615').indexOf('users: 26615') !== -1);
});

test('verify script: --import refuses a run with no manifest', async function () {
    const kp = keypair();
    const users = fakeUsers(8);
    const bucket = fakeBucket();
    const man = await ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-nomans-'));
    const { spawnSync } = require('child_process');
    const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
    try {
        const cipherPath = path.join(dir, 'c.jsonl.age');
        fs.writeFileSync(cipherPath, bucket.objects[man.object].body);
        const sa = verify.expectedBackupSa('demo');
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(metaForCipher(man.object, IN_WINDOW, bucket.objects[man.object].body)));
        fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(auditCreate(man.object, sa, IN_WINDOW)));
        const none = spawnSync('node', [script, '--ciphertext', cipherPath, '--import', '--project', 'bitcoin-quest-staging', '--sample', '4', '--object-meta', path.join(dir, 'meta.json'), '--audit-log', path.join(dir, 'audit.json')], { encoding: 'utf8' });
        assert.strictEqual(none.status, 2);
        assert.ok(/--import requires --manifest or --latest-from/.test(none.stderr + none.stdout), none.stderr + none.stdout);
        assert.ok(!/VERIFY: PASS/.test(none.stdout));
        assert.ok(!/Import plan:/.test(none.stdout));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verify script: an auth/ substring in the manifest does not satisfy provenance', function () {
    const sa = verify.expectedBackupSa('demo');
    const real = 'auth/2026-11-10/083000Z-aaaaaaaaaaaaaaaa.jsonl.age';
    const problems = verify.checkBackupProvenance({
        required: true,
        meta: metaCreated(IN_WINDOW, { name: real, generation: '1' }),
        audit: auditCreate(real, sa, IN_WINDOW),
        objectName: 'auth/',
        expectedSa: sa,
        window: verify.DEFAULT_SCHEDULE_WINDOW,
    });
    assert.ok(problems.some(function (p) { return /name does not match manifest.object/.test(p); }), String(problems));
    assert.ok(problems.some(function (p) { return /no storage.objects.create principalEmail for this object/.test(p); }), String(problems));
    assert.strictEqual(verify.creatorFromAuditLog(auditCreate(real, sa, IN_WINDOW), 'auth/'), '');
    assert.strictEqual(verify.auditCreateHits(auditCreate(real, sa, IN_WINDOW), 'auth/').length, 0);
    assert.strictEqual(verify.creatorFromAuditLog(auditCreate(real, sa, IN_WINDOW), real), sa);
});

test('verify script: a meta/manifest object name mismatch is refused', function () {
    const sa = verify.expectedBackupSa('demo');
    const objectName = 'auth/2026-11-10/083000Z-aaaaaaaaaaaaaaaa.jsonl.age';
    const problems = verify.checkBackupProvenance({
        required: true,
        meta: metaCreated(IN_WINDOW, { name: 'auth/2026-11-10/083000Z-ffffffffffffffff.jsonl.age', generation: '1' }),
        audit: auditCreate(objectName, sa, IN_WINDOW),
        objectName: objectName,
        expectedSa: sa,
        window: verify.DEFAULT_SCHEDULE_WINDOW,
    });
    assert.ok(problems.some(function (p) { return /name does not match manifest.object/.test(p); }), String(problems));
});

test('verify script: delete then recreate (two creates / two generations) is refused', function () {
    const sa = verify.expectedBackupSa('demo');
    const objectName = 'auth/2026-11-10/083000Z-aaaaaaaaaaaaaaaa.jsonl.age';
    const first = auditCreate(objectName, sa, IN_WINDOW, '1')[0];
    const second = auditCreate(objectName, 'evil@example.com', IN_WINDOW, '2')[0];
    const problems = verify.checkBackupProvenance({
        required: true,
        meta: metaCreated(IN_WINDOW, { name: objectName, generation: '2' }),
        audit: [first, second],
        objectName: objectName,
        expectedSa: sa,
        window: verify.DEFAULT_SCHEDULE_WINDOW,
    });
    assert.ok(problems.some(function (p) { return /more than one storage.objects.create/.test(p); }), String(problems));
    assert.strictEqual(verify.creatorFromAuditLog([first, second], objectName), '');
    // hits[0] would have been the legitimate first create; we must not take it.
    assert.strictEqual(verify.creatorFromAuditLog([first], objectName), sa);
});

test('verify script: CLI --import refuses forged no-manifest, auth/ substring, name mismatch, and delete+recreate', async function () {
    const kp = keypair();
    const users = fakeUsers(8);
    const bucket = fakeBucket();
    const man = await ex.runAuthExport({ auth: fakeAuth(users), bucket: bucket, recipients: [kp.recipient], projectId: 'demo', now: NOW, log: captureLog(), getHashConfig: async function () { return HASH_CONFIG; } });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-forge-'));
    const { spawnSync } = require('child_process');
    const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
    try {
        const cipherPath = path.join(dir, 'c.jsonl.age');
        const cipher = bucket.objects[man.object].body;
        fs.writeFileSync(cipherPath, cipher);
        const identity = writeIdentity(dir, kp);
        const sa = verify.expectedBackupSa('demo');
        fs.writeFileSync(path.join(dir, 'm.json'), JSON.stringify(man));
        fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify(metaForCipher(man.object, IN_WINDOW, cipher)));
        fs.writeFileSync(path.join(dir, 'audit.json'), JSON.stringify(auditCreate(man.object, sa, IN_WINDOW)));

        const noMan = spawnSync('node', [script, '--ciphertext', cipherPath, '--identity', identity, '--import', '--project', 'bitcoin-quest-staging', '--object-meta', path.join(dir, 'meta.json'), '--audit-log', path.join(dir, 'audit.json')], { encoding: 'utf8' });
        assert.strictEqual(noMan.status, 2);
        assert.ok(/--import requires --manifest or --latest-from/.test(noMan.stderr + noMan.stdout));

        const planted = Object.assign({}, man, { object: 'auth/' });
        fs.writeFileSync(path.join(dir, 'm-auth.json'), JSON.stringify(planted));
        const sub = spawnSync('node', [script, '--ciphertext', cipherPath, '--identity', identity, '--manifest', path.join(dir, 'm-auth.json'), '--import', '--project', 'bitcoin-quest-staging', '--object-meta', path.join(dir, 'meta.json'), '--audit-log', path.join(dir, 'audit.json')], { encoding: 'utf8' });
        assert.notStrictEqual(sub.status, 0);
        const subOut = sub.stdout + sub.stderr;
        assert.ok(/name does not match manifest.object/.test(subOut) || /no storage.objects.create principalEmail/.test(subOut), subOut);
        assert.ok(!/VERIFY: PASS/.test(sub.stdout));
        assert.ok(!/Import plan:/.test(sub.stdout));

        const mismatchMeta = metaForCipher('auth/2026-11-10/083000Z-ffffffffffffffff.jsonl.age', IN_WINDOW, cipher);
        fs.writeFileSync(path.join(dir, 'meta-mismatch.json'), JSON.stringify(mismatchMeta));
        const mismatch = spawnSync('node', [script, '--ciphertext', cipherPath, '--identity', identity, '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--object-meta', path.join(dir, 'meta-mismatch.json'), '--audit-log', path.join(dir, 'audit.json')], { encoding: 'utf8' });
        assert.notStrictEqual(mismatch.status, 0);
        assert.ok(/name does not match manifest.object/.test(mismatch.stdout + mismatch.stderr), mismatch.stdout + mismatch.stderr);
        assert.ok(!/Import plan:/.test(mismatch.stdout));

        const first = auditCreate(man.object, sa, IN_WINDOW, '1')[0];
        const second = auditCreate(man.object, 'evil@example.com', IN_WINDOW, '2')[0];
        const meta2 = metaForCipher(man.object, IN_WINDOW, cipher, '2');
        fs.writeFileSync(path.join(dir, 'meta-recreate.json'), JSON.stringify(meta2));
        fs.writeFileSync(path.join(dir, 'audit-recreate.json'), JSON.stringify([first, second]));
        const rec = spawnSync('node', [script, '--ciphertext', cipherPath, '--identity', identity, '--manifest', path.join(dir, 'm.json'), '--import', '--project', 'bitcoin-quest-staging', '--object-meta', path.join(dir, 'meta-recreate.json'), '--audit-log', path.join(dir, 'audit-recreate.json')], { encoding: 'utf8' });
        assert.notStrictEqual(rec.status, 0);
        assert.ok(/more than one storage.objects.create/.test(rec.stdout + rec.stderr), rec.stdout + rec.stderr);
        assert.ok(!/Import plan:/.test(rec.stdout));
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verify script: a missing .meta.json sidecar is flagged and excluded from --latest-from', function () {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abv-sidecar-'));
    try {
        const day = path.join(dir, '2026-11-10');
        fs.mkdirSync(day);
        const real = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/083030Z-bbbbbbbbbbbbbbbb.jsonl.age', finishedAt: '2026-11-10T08:31:00.000Z', plaintextSha256: 'y', ciphertextSha256: 'y2', date: '2026-11-10' };
        const planted = { format: 'bq-auth-export-v2', complete: true, object: 'auth/2026-11-10/083100Z-cccccccccccccccc.jsonl.age', timeCreated: '2026-11-18T08:31:00.000Z', finishedAt: '2026-11-18T08:31:00.000Z', plaintextSha256: 'z', ciphertextSha256: 'z2', date: '2026-11-18' };
        fs.writeFileSync(path.join(day, '083030Z-bbbbbbbbbbbbbbbb.manifest.json'), JSON.stringify(real));
        fs.writeFileSync(path.join(day, '083030Z-bbbbbbbbbbbbbbbb.meta.json'), JSON.stringify(metaCreated(IN_WINDOW)));
        fs.writeFileSync(path.join(day, '083100Z-cccccccccccccccc.manifest.json'), JSON.stringify(planted));
        // no sidecar for planted
        const loaded = verify.loadManifestsFromDir(dir);
        const latest = verify.findLatestComplete(loaded);
        assert.strictEqual(latest.manifest.object, real.object);
        assert.ok(latest.flags.some(function (f) { return /missing timeCreated/.test(f) && f.indexOf(planted.object) !== -1; }), String(latest.flags));
        const script = path.join(fnRoot, 'scripts', 'auth-export-verify.js');
        const out = execFileSync('node', [script, '--latest-from', dir, '--print-latest'], { encoding: 'utf8' });
        assert.ok(out.indexOf(real.object) !== -1);
        assert.ok(/FLAG:.*missing timeCreated/.test(out));
        assert.ok(out.indexOf('Latest complete backup: ' + planted.object) === -1);
    } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('verify script: mid-import crash runs delete-after in finally and prints a cleanup command otherwise', async function () {
    const uids = ['rv-0', 'rv-1', 'rv-2'];
    const records = uids.map(function (u) { return { uid: u, email: u + '@restore-test.invalid' }; });
    const lines = [];
    const log = function (m) { lines.push(m); };
    let deleted = [];
    const authOkDelete = {
        importUsers: async function (batch) { return { successCount: batch.length, failureCount: 0, errors: [] }; },
        getUsers: async function () { throw new Error('boom after import'); },
        deleteUsers: async function (batch) { deleted = deleted.concat(batch); return { successCount: batch.length }; },
    };
    await assert.rejects(verify.applyImport('bitcoin-quest-staging', records, null, true, log, { auth: authOkDelete }), /boom after import/);
    assert.deepStrictEqual(deleted, uids);
    assert.ok(lines.some(function (l) { return /--delete-after cleaned up 3 uids/.test(l); }));
    assert.ok(!lines.some(function (l) { return /Cleanup with:/.test(l); }));

    const lines2 = [];
    const log2 = function (m) { lines2.push(m); };
    const authNoDelete = {
        importUsers: async function (batch) { return { successCount: batch.length, failureCount: 0, errors: [] }; },
        getUsers: async function () { throw new Error('boom after import'); },
        deleteUsers: async function () { throw new Error('should not delete'); },
    };
    await assert.rejects(verify.applyImport('bitcoin-quest-staging', records, null, false, log2, { auth: authNoDelete }), /boom after import/);
    const cleanup = lines2.join('\n');
    assert.ok(/Cleanup with:/.test(cleanup));
    const cmd = lines2.find(function (l) { return /--cleanup --project bitcoin-quest-staging --uids-file /.test(l); });
    assert.ok(cmd, cleanup);
    const file = cmd.split('--uids-file ')[1];
    const listed = fs.readFileSync(file, 'utf8').trim().split('\n');
    assert.deepStrictEqual(listed, uids);
    fs.unlinkSync(file);

    const lines3 = [];
    const log3 = function (m) { lines3.push(m); };
    const authDeleteFails = {
        importUsers: async function (batch) { return { successCount: batch.length, failureCount: 0, errors: [] }; },
        getUsers: async function () { throw new Error('boom after import'); },
        deleteUsers: async function () { throw new Error('delete failed'); },
    };
    await assert.rejects(verify.applyImport('bitcoin-quest-staging', records, null, true, log3, { auth: authDeleteFails }), /boom after import/);
    assert.ok(lines3.some(function (l) { return /Cleanup with:/.test(l); }));
    assert.ok(lines3.some(function (l) { return /--cleanup --project bitcoin-quest-staging --uids-file /.test(l); }));
});

(async function () {
    for (let i = 0; i < queue.length; i++) {
        try { await queue[i].fn(); passed++; console.log('  ok  ' + queue[i].name); }
        catch (e) { failed++; console.log('  FAIL ' + queue[i].name + ': ' + (e && e.message)); }
    }
    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    process.exit(failed ? 1 : 0);
})();
