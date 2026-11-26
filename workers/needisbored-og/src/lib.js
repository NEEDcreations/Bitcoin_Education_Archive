import { A } from './assets.js';

export const TARGET = Date.parse('2026-11-25T19:39:00Z');
export const CANON = 'https://bitcoineducation.quest/needisbored';

export function parseT(searchParams) {
  const raw = searchParams.get('t');
  if (raw == null || raw === '') return { at: Date.now(), hasT: false, token: '' };
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return { at: Date.now(), hasT: false, token: '' };
  const at = n < 1e12 ? Math.floor(n * 1000) : Math.floor(n);
  return { at, hasT: true, token: String(Math.floor(n)) };
}

export function remaining(atMs) {
  const ms = Math.max(0, TARGET - atMs);
  const totalSec = Math.floor(ms / 1000);
  return {
    ms,
    totalSec,
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
    blocks: totalSec > 0 ? Math.ceil(totalSec / 600) : 0,
    done: totalSec <= 0
  };
}

function pad(n) { return n < 10 ? '0' + n : String(n); }

export function formatTitle(r) {
  if (r.done) return 'Usage reset! 🎉';
  return pad(r.days) + 'd ' + pad(r.hours) + 'h ' + pad(r.minutes) + 'm ' + pad(r.seconds) + 's · ≈ ' + r.blocks + ' blocks';
}

function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');
}

export function injectOg(html, parsed) {
  const r = remaining(parsed.at);
  const title = formatTitle(r);
  const url = parsed.hasT ? CANON + '?t=' + parsed.token : CANON;
  const image = CANON + '/og.png' + (parsed.hasT ? '?t=' + parsed.token : '');
  const desc = "until Phil's usage resets · Wed Nov 25, 2:39 PM ET";
  function set(prop, value, name) {
    const re = name
      ? new RegExp('(<meta\\s+name="' + name + '"\\s+content=")([^"]*)(")', 'g')
      : new RegExp('(<meta\\s+property="' + prop + '"\\s+content=")([^"]*)(")', 'g');
    return html.replace(re, '$1' + esc(value) + '$3');
  }
  html = set('og:title', title);
  html = set('og:url', url);
  html = set('og:image', image);
  html = set('og:image:alt', title);
  html = set('og:description', desc);
  html = set(null, title, 'twitter:title');
  html = set(null, image, 'twitter:image');
  html = set(null, desc, 'twitter:description');
  return html;
}

// Minimal zlib inflate using DecompressionStream when available, else pako-less sync inflate via node zlib in tests.
export async function inflate(b64) {
  const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  if (typeof DecompressionStream === 'function') {
    const ds = new DecompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    const buf = await new Response(stream).arrayBuffer();
    return new Uint8Array(buf);
  }
  const { inflateSync } = await import('node:zlib');
  return new Uint8Array(inflateSync(bytes));
}

let cache = null;
async function loadAssets() {
  if (cache) return cache;
  const base = await inflate(A.base);
  const num = {};
  for (const [ch, g] of Object.entries(A.num.g)) {
    num[ch] = { ...g, pix: g.m ? await inflate(g.m) : null };
  }
  const blk = {};
  for (const [ch, g] of Object.entries(A.blk.g)) {
    blk[ch] = { ...g, pix: g.m ? await inflate(g.m) : null };
  }
  const lab = {};
  for (const [k, g] of Object.entries(A.lab)) {
    lab[k] = { ...g, pix: g.m ? await inflate(g.m) : null };
  }
  const done = { ...A.done, pix: A.done.m ? await inflate(A.done.m) : null };
  cache = { base, num, blk, lab, done };
  return cache;
}

function blitMask(rgb, W, mask, mw, mh, dx, dy, color) {
  if (!mask) return;
  const [cr, cg, cb] = color;
  for (let y = 0; y < mh; y++) {
    const py = dy + y;
    if (py < 0 || py >= A.H) continue;
    for (let x = 0; x < mw; x++) {
      const a = mask[y * mw + x];
      if (!a) continue;
      const px = dx + x;
      if (px < 0 || px >= W) continue;
      const i = (py * W + px) * 3;
      if (a === 255) {
        rgb[i] = cr; rgb[i+1] = cg; rgb[i+2] = cb;
      } else {
        const inv = 255 - a;
        rgb[i]   = (rgb[i]   * inv + cr * a + 127) / 255 | 0;
        rgb[i+1] = (rgb[i+1] * inv + cg * a + 127) / 255 | 0;
        rgb[i+2] = (rgb[i+2] * inv + cb * a + 127) / 255 | 0;
      }
    }
  }
}

function blitRgba(rgb, W, rgba, mw, mh, dx, dy) {
  if (!rgba) return;
  for (let y = 0; y < mh; y++) {
    const py = dy + y;
    if (py < 0 || py >= A.H) continue;
    for (let x = 0; x < mw; x++) {
      const o = (y * mw + x) * 4;
      const a = rgba[o+3];
      if (!a) continue;
      const px = dx + x;
      if (px < 0 || px >= W) continue;
      const i = (py * W + px) * 3;
      if (a === 255) {
        rgb[i] = rgba[o]; rgb[i+1] = rgba[o+1]; rgb[i+2] = rgba[o+2];
      } else {
        const inv = 255 - a;
        rgb[i]   = (rgb[i]   * inv + rgba[o]   * a + 127) / 255 | 0;
        rgb[i+1] = (rgb[i+1] * inv + rgba[o+1] * a + 127) / 255 | 0;
        rgb[i+2] = (rgb[i+2] * inv + rgba[o+2] * a + 127) / 255 | 0;
      }
    }
  }
}

function measure(font, text) {
  let w = 0;
  for (const ch of text) {
    const g = font[ch];
    w += g ? g.a : 0;
  }
  return w;
}

function drawText(rgb, font, text, x, y, color) {
  let cx = x;
  for (const ch of text) {
    const g = font[ch];
    if (!g) { continue; }
    blitMask(rgb, A.W, g.pix, g.w, g.h, Math.round(cx + g.x), Math.round(y + g.y), color);
    cx += g.a;
  }
  return cx;
}

export async function renderOg(atMs) {
  const assets = await loadAssets();
  const r = remaining(atMs);
  // base already includes PNG filter bytes? we stored '\x00'+row, so unpack to rgb
  const raw = assets.base;
  const W = A.W, H = A.H;
  const rgb = new Uint8Array(W * H * 3);
  // base is filter+row per scanline
  const row = W * 3 + 1;
  if (raw.length === row * H) {
    for (let y = 0; y < H; y++) {
      rgb.set(raw.subarray(y * row + 1, y * row + row), y * W * 3);
    }
  } else if (raw.length === W * H * 3) {
    rgb.set(raw);
  } else {
    throw new Error('bad base length ' + raw.length);
  }

  const WHITE = [244, 244, 245];
  const ORANGE = [247, 147, 26];

  if (r.done) {
    const s = assets.done;
    blitRgba(rgb, W, s.pix, s.w, s.h, Math.round((W - s.w) / 2), Math.round(300 - s.h / 2));
    return encodePng(rgb, W, H);
  }

  const clock = [pad(r.days), ':', pad(r.hours), ':', pad(r.minutes), ':', pad(r.seconds)];
  const labels = ['DAYS', '', 'HOURS', '', 'MINUTES', '', 'SECONDS'];
  const clockWidths = clock.map((t) => measure(assets.num, t));
  const blocksTxt = '≈ ' + r.blocks;
  const blocksW = measure(assets.blk, blocksTxt);
  const gaps = [A.colonGap, A.colonGap, A.colonGap, A.colonGap, A.colonGap, A.colonGap, A.blockGap];
  const total = clockWidths.reduce((a, b) => a + b, 0) + blocksW + gaps.reduce((a, b) => a + b, 0);
  let x = (W - total) / 2;
  const y = A.numY;

  for (let i = 0; i < clock.length; i++) {
    const isColon = clock[i] === ':';
    drawText(rgb, assets.num, clock[i], x, isColon ? y - 10 : y, isColon ? ORANGE : WHITE);
    if (!isColon) {
      const lab = assets.lab[labels[i]];
      if (lab) blitRgba(rgb, W, lab.pix, lab.w, lab.h, Math.round(x + (clockWidths[i] - lab.w) / 2), y + A.numSize + 8);
    }
    x += clockWidths[i] + gaps[i];
  }

  const blkY = y + A.numSize - A.blkSize - 8;
  drawText(rgb, assets.blk, blocksTxt, x, blkY, ORANGE);
  const lab = assets.lab.BLOCKS;
  if (lab) blitRgba(rgb, W, lab.pix, lab.w, lab.h, Math.round(x + (blocksW - lab.w) / 2), y + A.numSize + 8);

  return encodePng(rgb, W, H);
}

function crcTable() {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
}
const CRC = crcTable();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

async function deflate(bytes) {
  if (typeof CompressionStream === 'function') {
    const cs = new CompressionStream('deflate');
    const stream = new Blob([bytes]).stream().pipeThrough(cs);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  const { deflateSync } = await import('node:zlib');
  return new Uint8Array(deflateSync(bytes));
}

export async function encodePng(rgb, width, height) {
  const raw = new Uint8Array((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (width * 3 + 1);
    raw[o] = 0;
    raw.set(rgb.subarray(y * width * 3, (y + 1) * width * 3), o + 1);
  }
  const idat = await deflate(raw);
  const sig = Uint8Array.of(137,80,78,71,13,10,26,10);
  function chunk(type, data) {
    const typ = Uint8Array.from(type, c => c.charCodeAt(0));
    const out = new Uint8Array(8 + data.length + 4);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(typ, 4);
    out.set(data, 8);
    const crcSrc = out.subarray(4, 8 + data.length);
    view.setUint32(8 + data.length, crc32(crcSrc));
    return out;
  }
  const ihdr = new Uint8Array(13);
  const v = new DataView(ihdr.buffer);
  v.setUint32(0, width);
  v.setUint32(4, height);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const parts = [sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', new Uint8Array(0))];
  let len = 0; for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
