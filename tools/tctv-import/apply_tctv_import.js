#!/usr/bin/env node
// Timechain TV import: merge new-videos.json into timechain-tv.js.
// DRY RUN by default: prints what would change and writes nothing.
// Usage:
//   node apply_tctv_import.js --file /path/to/repo/timechain-tv.js [--new new-videos.json]
//        [--remove-dead dead-existing-ids.txt] [--seed 42] [--write]
// Behaviour:
//   - Existing entries keep their exact original text; new entries are inserted at
//     seeded-random positions inside each station's videos array (no full reshuffle).
//   - Refuses any new ID already present anywhere in the file.
//   - With --write, writes the file and re-parses it to confirm counts + syntax.
//   - Does NOT touch index.html / 404.html cache-busters or sw.js CACHE_NAME.
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = opt('--file'); const NEW = opt('--new', __dirname + '/new-videos.json');
const DEAD = opt('--remove-dead', null); const WRITE = args.includes('--write');
let seed = parseInt(opt('--seed', '20261022'), 10);
if (!FILE) { console.error('need --file path/to/timechain-tv.js'); process.exit(1); }
const rand = () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

function matchClose(s, i, open, close) { // s[i] === open; returns index of matching close
  let d = 0, inStr = false, q = '';
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (c === '\\') { k++; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === open) d++; else if (c === close) { d--; if (d === 0) return k; }
  }
  throw new Error('unbalanced');
}
function parseStations(src) {
  const start = src.indexOf('var i=[') + 6;
  if (start < 6) throw new Error('station array not found');
  const end = matchClose(src, start, '[', ']');
  return { start, end, arr: Function('return ' + src.slice(start, end + 1))() };
}
function topLevelObjects(s, a, b) { // object spans between a..b (exclusive)
  const out = []; let k = a;
  while (k < b) { const o = s.indexOf('{', k); if (o < 0 || o >= b) break; const c = matchClose(s, o, '{', '}'); out.push([o, c + 1]); k = c + 1; }
  return out;
}

const src = fs.readFileSync(FILE, 'utf8');
const { start, end, arr } = parseStations(src);
const existing = new Set(); arr.forEach(st => st.videos.forEach(v => existing.add(v.id)));
const incoming = JSON.parse(fs.readFileSync(NEW, 'utf8'));
const dead = DEAD ? new Set(fs.readFileSync(DEAD, 'utf8').split(/\s+/).filter(Boolean)) : new Set();

const plan = {}; const seen = new Set(); let refused = 0;
for (const st of incoming) {
  if (!arr.find(x => x.id === st.id)) throw new Error('unknown station ' + st.id);
  plan[st.id] = [];
  for (const v of st.videos) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(v.id) || typeof v.title !== 'string' || !(v.duration > 0)) throw new Error('bad entry ' + JSON.stringify(v));
    if (existing.has(v.id) || seen.has(v.id)) { refused++; continue; }
    seen.add(v.id); plan[st.id].push(v);
  }
}

// Rebuild only the station array region, keeping original entry text.
let region = src.slice(start, end + 1); let out = ''; let cursor = 0; let removed = 0;
const marker = 'videos:[';
for (const st of arr) {
  const idIdx = region.indexOf('id:"' + st.id + '"', cursor);
  const vStart = region.indexOf(marker, idIdx) + marker.length - 1; // at '['
  const vEnd = matchClose(region, vStart, '[', ']');
  const spans = topLevelObjects(region, vStart + 1, vEnd);
  let entries = spans.map(([a, b]) => region.slice(a, b));
  const sep = spans.length > 1 ? region.slice(spans[0][1], spans[1][0]) : ',\n                ';
  const lead = spans.length ? region.slice(vStart + 1, spans[0][0]) : '\n                ';
  const tail = spans.length ? region.slice(spans[spans.length - 1][1], vEnd) : '\n            ';
  if (dead.size) { const before = entries.length; entries = entries.filter(e => { const m = e.match(/id:"([A-Za-z0-9_-]{11})"/); return !(m && dead.has(m[1])); }); removed += before - entries.length; }
  for (const v of (plan[st.id] || [])) {
    const txt = '{id:' + JSON.stringify(v.id) + ',title:' + JSON.stringify(v.title) + ',duration:' + Math.round(v.duration) + '}';
    entries.splice(Math.floor(rand() * (entries.length + 1)), 0, txt);
  }
  out += region.slice(cursor, vStart + 1) + lead + entries.join(sep) + tail;
  cursor = vEnd;
}
out += region.slice(cursor);
const updated = src.slice(0, start) + out + src.slice(end + 1);

// Verify
new Function(updated); // syntax check (throws on error)
const after = parseStations(updated).arr;
let added = 0; const rows = [];
for (const st of after) {
  const b = arr.find(x => x.id === st.id).videos.length; const n = (plan[st.id] || []).length; added += n;
  rows.push(`${st.id.padEnd(22)} ${String(b).padStart(5)} -> ${String(st.videos.length).padStart(5)}  (+${n})`);
}
const ids = new Set(); let dupAfter = 0; after.forEach(s => s.videos.forEach(v => { if (ids.has(v.id)) dupAfter++; ids.add(v.id); }));
console.log(rows.join('\n'));
console.log(`\nadded ${added}, refused-as-duplicate ${refused}, removed-dead ${removed}, total ${after.reduce((a, s) => a + s.videos.length, 0)}, cross-station dupes after ${dupAfter}`);
console.log('syntax OK');
if (WRITE) { fs.writeFileSync(FILE, updated); console.log('WROTE', FILE); }
else console.log('DRY RUN: nothing written. Re-run with --write to apply.');
