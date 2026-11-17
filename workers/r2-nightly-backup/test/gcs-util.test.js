import { test } from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, createVerify } from "node:crypto";
import { signJwt, getAccessToken, listObjects, ConfigError } from "../src/gcs.js";
import { resolveLabel, keysFor, safeError } from "../src/util.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const pem = privateKey.export({ type: "pkcs8", format: "pem" });
const email = "bq-r2-backup-reader@example-proj.iam.gserviceaccount.com";

test("JWT is RS256, read-only scope, verifiable", async () => {
  const jwt = await signJwt(email, pem.replace(/\n/g, "\\n"), 1700000000);
  const [h, c, s] = jwt.split(".");
  const claims = JSON.parse(Buffer.from(c, "base64url"));
  assert.equal(JSON.parse(Buffer.from(h, "base64url")).alg, "RS256");
  assert.equal(claims.scope, "https://www.googleapis.com/auth/devstorage.read_only");
  assert.equal(claims.exp - claims.iat, 3600);
  const v = createVerify("RSA-SHA256"); v.update(`${h}.${c}`);
  assert.ok(v.verify(publicKey, Buffer.from(s, "base64url")));
});

test("missing secrets -> ConfigError, no network", async () => {
  let called = false;
  const f = async () => { called = true; };
  await assert.rejects(getAccessToken({}, f), ConfigError);
  await assert.rejects(getAccessToken({ GCP_BACKUP_READER_CLIENT_EMAIL: email }, f), ConfigError);
  assert.equal(called, false);
});

test("token error does not leak response body", async () => {
  const f = async () => new Response(JSON.stringify({ error: "invalid_grant", error_description: "secret-ish detail" }), { status: 400 });
  await assert.rejects(getAccessToken({ GCP_BACKUP_READER_CLIENT_EMAIL: email, GCP_BACKUP_READER_PRIVATE_KEY: pem }, f), (e) => /invalid_grant/.test(e.message) && !/detail/.test(e.message));
});

test("listObjects paginates and sorts", async () => {
  const pages = [{ items: [{ name: "p/b", size: "2", generation: 1 }], nextPageToken: "t" }, { items: [{ name: "p/a", size: "1", generation: 2, md5Hash: "x" }] }];
  let i = 0;
  const out = await listObjects("bk", "p/", "tok", async (u) => { assert.match(String(u), /prefix=p%2F/); return new Response(JSON.stringify(pages[i++])); });
  assert.deepEqual(out.map((o) => [o.name, o.size]), [["p/a", 1], ["p/b", 2]]);
});

test("labels and keys", () => {
  assert.equal(resolveLabel({}, new Date("2026-11-15T02:30:00Z")), "2026-11-15");
  assert.equal(resolveLabel({ exportPrefix: "pre-ship-324-20261114T233946Z" }), "pre-ship-324-20261114T233946Z");
  for (const bad of ["../x", "a/b", "", " x", "a..b"]) assert.throws(() => resolveLabel({ exportPrefix: bad || "/" }));
  const k = keysFor("staging-test/age/firestore/", "2026-11-14");
  assert.equal(k.data, "staging-test/age/firestore/2026-11-14/bq-firestore-2026-11-14.tar.gz.age");
  assert.equal(k.lastError, "staging-test/age/firestore/_health/last-error.json");
  assert.equal(safeError(new Error("x".repeat(200))).message, "[redacted]");
});
