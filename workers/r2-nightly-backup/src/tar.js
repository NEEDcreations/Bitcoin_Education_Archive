// Minimal streaming ustar writer (+ PAX header for long/non-ASCII names).
// Output is accepted by GNU tar, bsdtar and Python tarfile.

const enc = new TextEncoder();
export const BLOCK = 512;

function writeStr(buf, off, len, str) {
  const b = enc.encode(str);
  if (b.length > len) throw new Error(`tar field overflow at ${off}`);
  buf.set(b, off);
}
function writeOctal(buf, off, len, n) {
  // len-1 octal digits + NUL
  const s = Math.floor(n).toString(8).padStart(len - 1, "0");
  if (s.length > len - 1) throw new Error("tar numeric field overflow");
  writeStr(buf, off, len, s + "\0");
}

export function header(name, size, mtimeSec, typeflag = "0") {
  const h = new Uint8Array(BLOCK);
  writeStr(h, 0, 100, name);
  writeOctal(h, 100, 8, 0o644);
  writeOctal(h, 108, 8, 0);
  writeOctal(h, 116, 8, 0);
  writeOctal(h, 124, 12, size);
  writeOctal(h, 136, 12, mtimeSec);
  h.fill(0x20, 148, 156); // checksum placeholder = spaces
  writeStr(h, 156, 1, typeflag);
  writeStr(h, 257, 6, "ustar\0");
  writeStr(h, 263, 2, "00");
  writeStr(h, 265, 32, "root");
  writeStr(h, 297, 32, "root");
  let sum = 0;
  for (let i = 0; i < BLOCK; i++) sum += h[i];
  writeStr(h, 148, 8, sum.toString(8).padStart(6, "0") + "\0 ");
  return h;
}

function paxRecord(key, value) {
  const body = ` ${key}=${value}\n`;
  const bodyLen = enc.encode(body).length;
  let len = bodyLen + 1;
  while (String(len).length + bodyLen !== len) len = String(len).length + bodyLen;
  return `${len}${body}`;
}

export function padding(size) {
  const r = size % BLOCK;
  return r === 0 ? new Uint8Array(0) : new Uint8Array(BLOCK - r);
}

/** Header block(s) for one regular file. Returns Uint8Array. */
export function fileHeaders(name, size, mtimeSec) {
  const ascii = /^[\x20-\x7e]*$/.test(name);
  if (ascii && enc.encode(name).length <= 100) return header(name, size, mtimeSec, "0");
  const pax = enc.encode(paxRecord("path", name));
  const short = "PaxHeaders/" + name.replace(/[^\x20-\x7e]/g, "_").slice(-80);
  const parts = [header(short, pax.length, mtimeSec, "x"), pax, padding(pax.length),
    header(short.slice(0, 100), size, mtimeSec, "0")];
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export const trailer = () => new Uint8Array(BLOCK * 2);
