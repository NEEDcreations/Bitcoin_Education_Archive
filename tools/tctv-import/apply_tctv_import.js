#!/usr/bin/env node
// Timechain TV import: merge new-videos.json into timechain-tv.js.
// DRY RUN by default: prints what would change and writes nothing.
// Usage:
//   node apply_tctv_import.js --file /path/to/repo/timechain-tv.js [--new new-videos.json]
//        [--meta new-videos-meta.json] [--remove-dead dead-existing-ids.txt] [--seed 42] [--write]
//   node apply_tctv_import.js --dir data/tctv --new new-videos.json --meta new-videos-meta.json [--write]
//   Every new entry needs a positive integer duration (1..43200) that matches a
//   YouTube contentDetails duration in the meta file within 2 seconds. P0D is refused.
//   A meta record with short:true is stored as a portrait Short.
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
const FILE = opt('--file', null); const DIR = opt('--dir', null);
const NEW = opt('--new', __dirname + '/new-videos.json');
const META = opt('--meta', NEW.replace(/[^/]+$/, 'new-videos-meta.json'));
const DEAD = opt('--remove-dead', null); const WRITE = args.includes('--write');
const MAX_DURATION = 43200;
function isoDurationSeconds(iso) {
  if (typeof iso !== 'string' || iso === 'P0D' || iso === 'PT0S') return NaN;
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/.exec(iso);
  if (!m) return NaN;
  return Math.round((+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0));
}
function verifiedSeconds(rec) {
  if (!rec || rec.duration === 'P0D' || rec.duration === 0) return NaN;
  const iso = (rec.contentDetails && rec.contentDetails.duration) || rec.durationIso || rec.contentDetailsDuration;
  if (typeof iso === 'string') return isoDurationSeconds(iso);
  if (Number.isInteger(rec.duration) && rec.duration >= 1) return rec.duration;
  return NaN;
}
let seed = parseInt(opt('--seed', '20261022'), 10);
if (!FILE && !DIR) { console.error('need --file path/to/timechain-tv.js or --dir data/tctv'); process.exit(1); }
if (FILE && DIR) { console.error('pass --file or --dir, not both'); process.exit(1); }
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

const path = require('path');
let src = null, start = 0, end = 0, arr;
if (DIR) {
  const names = fs.readdirSync(DIR).filter(name => name.endsWith('.json')).sort();
  if (!names.length) { console.error('no json in ' + DIR); process.exit(1); }
  arr = names.map(name => {
    const videos = JSON.parse(fs.readFileSync(path.join(DIR, name), 'utf8'));
    if (!Array.isArray(videos)) throw new Error(name + ' is not an array');
    return { id: name.replace(/\.json$/, ''), file: path.join(DIR, name), videos };
  });
} else {
  src = fs.readFileSync(FILE, 'utf8');
  ({ start, end, arr } = parseStations(src));
}
const existing = new Set(); arr.forEach(st => st.videos.forEach(v => existing.add(v.id)));
const incoming = JSON.parse(fs.readFileSync(NEW, 'utf8'));
if (!fs.existsSync(META)) { console.error('refusing import: no meta file with YouTube contentDetails durations at ' + META); process.exit(1); }
const metaRaw = JSON.parse(fs.readFileSync(META, 'utf8'));
const verified = new Map();
function addRec(rec) { if (rec && rec.id) verified.set(rec.id, { sec: verifiedSeconds(rec), short: rec.short === true, station: rec.station || '' }); }
if (Array.isArray(metaRaw)) metaRaw.forEach(addRec);
else Object.keys(metaRaw).forEach(k => { const val = metaRaw[k]; if (Array.isArray(val)) val.forEach(addRec); else addRec(val); });
const dead = DEAD ? new Set(fs.readFileSync(DEAD, 'utf8').split(/\s+/).filter(Boolean)) : new Set();

const plan = {}; const seen = new Set(); let refused = 0;
for (const st of incoming) {
  if (!arr.find(x => x.id === st.id)) throw new Error('unknown station ' + st.id);
  plan[st.id] = [];
  for (const v of st.videos) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(v.id) || typeof v.title !== 'string' || !Number.isInteger(v.duration) || v.duration < 1 || v.duration > MAX_DURATION) throw new Error('bad entry ' + JSON.stringify(v));
    const info = verified.get(v.id);
    const sec = info && info.sec;
    if (!Number.isInteger(sec) || sec < 1 || sec > MAX_DURATION || Math.abs(v.duration - sec) > 2) throw new Error('unverified contentDetails duration ' + v.id);
    if (info.station && info.station !== st.id) throw new Error('meta station mismatch ' + v.id);
    if (info.short) v.short = true;
    if (existing.has(v.id) || seen.has(v.id)) { refused++; continue; }
    seen.add(v.id); plan[st.id].push(v);
  }
}

if (DIR) {
  let added = 0; const rows = [];
  for (const st of arr) {
    const before = st.videos.length;
    const fresh = plan[st.id] || [];
    for (const v of fresh) {
      const entry = { id: v.id, title: v.title, duration: v.duration };
      if (v.short) entry.short = true;
      st.videos.splice(Math.floor(rand() * (st.videos.length + 1)), 0, entry);
    }
    added += fresh.length;
    rows.push(`${st.id.padEnd(22)} ${String(before).padStart(5)} -> ${String(st.videos.length).padStart(5)}  (+${fresh.length})`);
    if (WRITE) fs.writeFileSync(st.file, JSON.stringify(st.videos));
  }
  const ids = new Set(); let dupAfter = 0;
  arr.forEach(s => s.videos.forEach(v => { if (ids.has(v.id)) dupAfter++; ids.add(v.id); }));
  console.log(rows.join('\n'));
  console.log(`\nadded ${added}, refused-as-duplicate ${refused}, removed-dead 0, total ${ids.size}, cross-station dupes after ${dupAfter}`);
  if (dupAfter) { console.error('refusing import: duplicate ids'); process.exit(1); }
  console.log(WRITE ? 'WROTE ' + DIR : 'DRY RUN: nothing written. Re-run with --write to apply.');
  process.exit(0);
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
    const txt = '{id:' + JSON.stringify(v.id) + ',title:' + JSON.stringify(v.title) + ',duration:' + Math.round(v.duration) + (v.short ? ',short:1' : '') + '}';
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
