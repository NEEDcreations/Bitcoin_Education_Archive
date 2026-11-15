// Streaming pack: GCS objects -> tar -> gzip -> age (public recipient only) -> R2 multipart.
// Constant memory: one R2 part buffer (partSize) + small stream chunks. Never buffers the export.
import { sha256 } from "@noble/hashes/sha2.js";
import { md5 } from "@noble/hashes/legacy.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { Encrypter } from "age-encryption";
import { fileHeaders, padding, trailer } from "./tar.js";

export const AGE_MAGIC = "age-encryption.org/v1";
const RECIPIENT_RE = /^age1[0-9a-z]{58}$/;
const b64ToHex = (b64) => {
  const bin = atob(b64);
  let s = "";
  for (let i = 0; i < bin.length; i++) s += bin.charCodeAt(i).toString(16).padStart(2, "0");
  return s;
};

export class IntegrityError extends Error {
  constructor(msg) { super(msg); this.name = "IntegrityError"; }
}

/** Assert every R2 key the job writes stays under the configured prefix. */
export function assertKeyInPrefix(key, prefix) {
  if (!prefix || !prefix.endsWith("/")) throw new Error("KEY_PREFIX must end with '/'");
  if (!key.startsWith(prefix) || key.includes("..") || key.includes("//")) {
    throw new Error(`refusing to write outside ${prefix}`);
  }
}

/**
 * @param {object} o
 * @param {Array<{name:string,size:number,md5:string|null,generation:string,updated?:string}>} o.objects
 * @param {(obj)=>Promise<ReadableStream<Uint8Array>>} o.open
 * @param {string} o.stripPrefix  path prefix removed from GCS names before the tar root (usually "")
 * @param {string} o.recipient    age1... public key
 * @param {R2Bucket} o.r2
 * @param {string} o.key          destination R2 key
 * @param {number} [o.partSize]   bytes per R2 part (>= 5 MiB except in tests)
 * @param {number} [o.prefetch]   GCS objects opened ahead (<= 3 keeps under 6 connections)
 * @param {Record<string,string>} [o.customMetadata]
 */
export async function packToR2(o) {
  const { objects, open, recipient, r2, key } = o;
  const partSize = o.partSize ?? 8 * 1024 * 1024;
  const prefetch = Math.max(1, Math.min(o.prefetch ?? 3, 4));
  if (!RECIPIENT_RE.test(recipient || "")) throw new Error("BACKUP_AGE_RECIPIENT is not an age1 X25519 recipient");
  if (!objects.length) throw new IntegrityError("no source objects");

  const files = [];
  const tarHash = sha256.create();
  let tarBytes = 0;

  // --- tar producer with bounded prefetch ---
  async function* tarChunks() {
    const pending = [];
    let next = 0;
    const fill = () => { while (pending.length < prefetch && next < objects.length) { const ob = objects[next++]; pending.push(open(ob).then((s) => ({ ob, s }), (e) => ({ ob, e }))); } };
    fill();
    while (pending.length) {
      const { ob, s, e } = await pending.shift();
      if (e) throw e;
      const name = ob.name.slice(o.stripPrefix ? o.stripPrefix.length : 0);
      const mtime = Math.floor(Date.parse(ob.updated || ob.timeCreated || 0) / 1000) || 0;
      yield fileHeaders(name, ob.size, mtime);
      const fh = sha256.create();
      const mh = ob.md5 ? md5.create() : null;
      let n = 0;
      const reader = s.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          n += value.length;
          if (n > ob.size) throw new IntegrityError(`${ob.name}: more bytes than listed size ${ob.size}`);
          fh.update(value); if (mh) mh.update(value);
          yield value;
        }
      } finally { reader.releaseLock(); }
      if (n !== ob.size) throw new IntegrityError(`${ob.name}: got ${n} bytes, listed ${ob.size}`);
      const md5hex = mh ? bytesToHex(mh.digest()) : null;
      if (mh && md5hex !== b64ToHex(ob.md5)) throw new IntegrityError(`${ob.name}: md5 does not match GCS`);
      files.push({ path: name, source: ob.name, generation: ob.generation, bytes: n, sha256: bytesToHex(fh.digest()), gcsMd5Verified: !!mh });
      yield padding(n);
      fill();
    }
    yield trailer();
  }

  const gen = tarChunks();
  const tarStream = new ReadableStream({
    async pull(ctrl) {
      // Loop past empty chunks (e.g. zero padding when size % 512 == 0): a pull()
      // that enqueues nothing is never called again and would stall the pipe.
      try {
        for (;;) {
          const { done, value } = await gen.next();
          if (done) { ctrl.close(); return; }
          if (value.length) { tarHash.update(value); tarBytes += value.length; ctrl.enqueue(value); return; }
        }
      } catch (err) { ctrl.error(err); }
    },
    async cancel() { await gen.return?.(); },
  }, { highWaterMark: 1 });

  const gzHash = sha256.create();
  let gzBytes = 0;
  const gzTap = new TransformStream({ transform(chunk, c) { gzHash.update(chunk); gzBytes += chunk.length; c.enqueue(chunk); } });
  const gz = tarStream.pipeThrough(new CompressionStream("gzip")).pipeThrough(gzTap);

  const e = new Encrypter();
  e.addRecipient(recipient);
  const cipher = await e.encrypt(gz);

  // --- R2 multipart sink ---
  const mpu = await r2.createMultipartUpload(key, {
    httpMetadata: { contentType: "application/octet-stream" },
    customMetadata: o.customMetadata || {},
  });
  const parts = [];
  const ctHash = sha256.create();
  let ctBytes = 0;
  let buf = new Uint8Array(partSize);
  let fillN = 0;
  let head = "";
  const flush = async (final) => {
    if (!fillN && !final) return;
    if (!fillN && parts.length) return;
    const body = fillN === buf.length ? buf : buf.slice(0, fillN);
    parts.push(await mpu.uploadPart(parts.length + 1, body));
    buf = new Uint8Array(partSize);
    fillN = 0;
  };
  try {
    const reader = cipher.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (head.length < AGE_MAGIC.length) head += new TextDecoder().decode(value.subarray(0, AGE_MAGIC.length - head.length));
      ctHash.update(value); ctBytes += value.length;
      let off = 0;
      while (off < value.length) {
        const take = Math.min(value.length - off, buf.length - fillN);
        buf.set(value.subarray(off, off + take), fillN);
        fillN += take; off += take;
        if (fillN === buf.length) await flush(false);
      }
    }
    await flush(true);
    if (head !== AGE_MAGIC) throw new IntegrityError("ciphertext does not start with age header");
    if (files.length !== objects.length) throw new IntegrityError(`packed ${files.length} of ${objects.length} files`);
    const done = await mpu.complete(parts);
    if (done.size !== ctBytes) throw new IntegrityError(`R2 size ${done.size} != streamed ${ctBytes}`);
  } catch (err) {
    try { await mpu.abort(); } catch { /* best effort */ }
    throw err;
  }

  return {
    files,
    tar: { bytes: tarBytes, sha256: bytesToHex(tarHash.digest()) },
    gzip: { bytes: gzBytes, sha256: bytesToHex(gzHash.digest()) },
    ciphertext: { key, bytes: ctBytes, sha256: bytesToHex(ctHash.digest()), parts: parts.length },
  };
}

/** Stream an R2 object back and hash it (post-write verification). */
export async function hashR2Object(r2, key) {
  const obj = await r2.get(key);
  if (!obj) throw new IntegrityError(`R2 object missing: ${key}`);
  const h = sha256.create();
  let n = 0, head = "";
  const reader = obj.body.getReader();
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (head.length < AGE_MAGIC.length) head += new TextDecoder().decode(value.subarray(0, AGE_MAGIC.length - head.length));
    h.update(value); n += value.length;
  }
  return { bytes: n, sha256: bytesToHex(h.digest()), ageHeader: head === AGE_MAGIC };
}
