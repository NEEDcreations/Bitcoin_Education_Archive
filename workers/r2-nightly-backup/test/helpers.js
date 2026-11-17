// Test doubles: in-memory R2 bucket with multipart semantics close to R2's.
export class FakeR2 {
  constructor() { this.objects = new Map(); this.aborted = 0; this.partSizes = []; }
  async put(key, body) { const b = typeof body === "string" ? new TextEncoder().encode(body) : new Uint8Array(body); this.objects.set(key, b); return { key, size: b.length }; }
  async get(key) { const b = this.objects.get(key); if (!b) return null; return { body: new Blob([b]).stream(), size: b.length }; }
  async createMultipartUpload(key) {
    const parts = new Map(); const self = this;
    return {
      async uploadPart(n, data) { const b = new Uint8Array(data); parts.set(n, b); self.partSizes.push(b.length); return { partNumber: n, etag: `e${n}` }; },
      async complete(list) {
        const sizes = list.map((p) => parts.get(p.partNumber).length);
        for (let i = 0; i < sizes.length - 1; i++) if (sizes[i] !== sizes[0]) throw new Error("R2: non-final parts must be equal size");
        const total = sizes.reduce((a, b) => a + b, 0); const out = new Uint8Array(total); let o = 0;
        for (const p of list) { out.set(parts.get(p.partNumber), o); o += parts.get(p.partNumber).length; }
        self.objects.set(key, out); return { key, size: total };
      },
      async abort() { self.aborted++; },
    };
  }
}

export function chunked(bytes, size = 7777) {
  let o = 0;
  return new ReadableStream({ pull(c) { if (o >= bytes.length) { c.close(); return; } c.enqueue(bytes.slice(o, o + size)); o += size; } });
}

export async function readAll(stream) {
  const r = stream.getReader(); const parts = []; let n = 0;
  for (;;) { const { done, value } = await r.read(); if (done) break; parts.push(value); n += value.length; }
  const out = new Uint8Array(n); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out;
}
