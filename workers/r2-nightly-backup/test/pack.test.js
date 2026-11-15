import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Decrypter, generateX25519Identity, identityToRecipient } from "age-encryption";
import { packToR2, hashR2Object, assertKeyInPrefix, IntegrityError } from "../src/pack.js";
import { FakeR2, chunked, readAll } from "./helpers.js";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const md5b64 = (b) => createHash("md5").update(b).digest("base64");

function makeExport(label, n = 14) {
  const files = new Map();
  files.set(`${label}/${label}.overall_export_metadata`, randomBytes(300));
  for (let i = 0; i < n; i++) files.set(`${label}/all_namespaces/all_kinds/output-${i}`, randomBytes(1000 + i * 4099));
  // a long, PAX-requiring name and an empty file
  files.set(`${label}/all_namespaces/${"k".repeat(120)}/output-long`, randomBytes(2048));
  files.set(`${label}/all_namespaces/all_kinds/empty`, new Uint8Array(0));
  const objects = [...files.entries()].map(([name, b], i) => ({ name, size: b.length, md5: md5b64(b), generation: String(1000 + i), updated: "2026-11-14T23:40:00Z" }))
    .sort((a, b) => (a.name < b.name ? -1 : 1));
  return { files, objects };
}

test("streams tar.gz.age to R2; decrypts with a TEST identity; per-file hashes match", async () => {
  const id = await generateX25519Identity();
  const recipient = await identityToRecipient(id);
  const label = "pre-ship-test-20261114T000000Z";
  const { files, objects } = makeExport(label);
  const r2 = new FakeR2();
  const key = "staging-test/age/firestore/x/bq.tar.gz.age";
  const r = await packToR2({ objects, open: async (ob) => chunked(files.get(ob.name)), recipient, r2, key, partSize: 16 * 1024, prefetch: 3 });

  assert.equal(r.files.length, objects.length);
  for (const f of r.files) { assert.equal(f.sha256, sha(files.get(f.source))); assert.equal(f.bytes, files.get(f.source).length); assert.equal(f.gcsMd5Verified, true); }
  const ct = r2.objects.get(key);
  assert.equal(ct.length, r.ciphertext.bytes);
  assert.equal(sha(ct), r.ciphertext.sha256);
  assert.equal(new TextDecoder().decode(ct.slice(0, 21)), "age-encryption.org/v1");
  assert.ok(r.ciphertext.parts > 1, "used multiple parts");

  const d = new Decrypter(); d.addIdentity(id);
  const gz = await d.decrypt(ct);
  assert.equal(sha(gz), r.gzip.sha256);
  const dir = mkdtempSync(join(tmpdir(), "bqtar-"));
  try {
    writeFileSync(join(dir, "a.tar.gz"), gz);
    execFileSync("tar", ["-xzf", "a.tar.gz"], { cwd: dir });
    for (const [name, b] of files) assert.equal(sha(readFileSync(join(dir, name))), sha(b), name);
    const list = execFileSync("tar", ["-tzf", "a.tar.gz"], { cwd: dir }).toString().trim().split("\n");
    assert.equal(list.length, files.size);
  } finally { rmSync(dir, { recursive: true, force: true }); }

  const h = await hashR2Object(r2, key);
  assert.deepEqual(h, { bytes: r.ciphertext.bytes, sha256: r.ciphertext.sha256, ageHeader: true });
});

test("size mismatch aborts multipart and writes nothing", async () => {
  const id = await generateX25519Identity();
  const recipient = await identityToRecipient(id);
  const { files, objects } = makeExport("d", 12);
  objects[3] = { ...objects[3], size: objects[3].size + 1 };
  const r2 = new FakeR2();
  await assert.rejects(packToR2({ objects, open: async (ob) => chunked(files.get(ob.name)), recipient, r2, key: "staging-test/k", partSize: 8192 }), (e) => e instanceof IntegrityError || /bytes/.test(e.message));
  assert.equal(r2.objects.size, 0);
  assert.equal(r2.aborted, 1);
});

test("md5 mismatch vs GCS is fatal", async () => {
  const id = await generateX25519Identity();
  const recipient = await identityToRecipient(id);
  const { files, objects } = makeExport("d", 12);
  objects[2] = { ...objects[2], md5: md5b64(Buffer.from("nope")) };
  const r2 = new FakeR2();
  await assert.rejects(packToR2({ objects, open: async (ob) => chunked(files.get(ob.name)), recipient, r2, key: "staging-test/k", partSize: 8192 }), /md5/);
  assert.equal(r2.objects.size, 0);
});

test("source download error is fatal and aborts", async () => {
  const id = await generateX25519Identity();
  const recipient = await identityToRecipient(id);
  const { files, objects } = makeExport("d", 12);
  const r2 = new FakeR2();
  await assert.rejects(packToR2({ objects, open: async (ob) => { if (ob.name.endsWith("output-5")) throw new Error("GCS 503"); return chunked(files.get(ob.name)); }, recipient, r2, key: "staging-test/k", partSize: 8192 }), /503/);
  assert.equal(r2.objects.size, 0);
});

test("rejects a non-age1 recipient (e.g. passphrase or secret key)", async () => {
  const { files, objects } = makeExport("d", 12);
  for (const bad of ["", "AGE-SECRET-KEY-1QQQ", "hunter2", "age1short"]) {
    await assert.rejects(packToR2({ objects, open: async (ob) => chunked(files.get(ob.name)), recipient: bad, r2: new FakeR2(), key: "staging-test/k" }), /recipient/);
  }
});

test("prefix guard", () => {
  assertKeyInPrefix("staging-test/age/firestore/a/b", "staging-test/age/firestore/");
  for (const k of ["age/firestore/a", "staging-test/age/firestore/../x", "staging-test/age/firestore//x", "firestore/x.zip"]) {
    assert.throws(() => assertKeyInPrefix(k, "staging-test/age/firestore/"));
  }
  assert.throws(() => assertKeyInPrefix("x/y", "x"));
});

test("regression: files whose size is a multiple of 512 (empty padding) do not stall", async () => {
  const id = await generateX25519Identity();
  const recipient = await identityToRecipient(id);
  const files = new Map();
  for (let i = 0; i < 12; i++) files.set(`r/f${i}`, randomBytes(512 * (i + 1)));
  const objects = [...files.entries()].map(([name, b], i) => ({ name, size: b.length, md5: md5b64(b), generation: String(i) }));
  const r = await packToR2({ objects, open: async (ob) => chunked(files.get(ob.name), 512), recipient, r2: new FakeR2(), key: "staging-test/k", partSize: 8192 });
  assert.equal(r.files.length, 12);
});
