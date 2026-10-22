#!/usr/bin/env node
// Shuffle Timechain TV video order inside every station.
// There is no older full-station shuffle. apply_tctv_import.js only inserts
// new videos at seeded-random spots and leaves the existing order alone.
// This uses that script's seeded RNG, then Fisher-Yates over each station.
//
//   node tools/tctv-import/shuffle_tctv_stations.js --file timechain-tv.js [--seed 20261022] [--write]
//   node tools/tctv-import/shuffle_tctv_stations.js --dir data/tctv [--seed 20261022] [--write]
// Dry run unless --write. Station order is unchanged. Entry text is unchanged.
// Refuses to write (exit 1) if any entry lacks an 11-char id, a string title,
// or a positive integer duration from 1s to 12h.
'use strict';
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = opt('--file', null);
const DIR = opt('--dir', null);
const WRITE = args.includes('--write');
let seed = parseInt(opt('--seed', '20261022'), 10);
if (!FILE && !DIR) { console.error('need --file timechain-tv.js or --dir data/tctv'); process.exit(1); }
const ID_RE = /^[A-Za-z0-9_-]{11}$/;
const MAX_DURATION = 43200;
function badEntry(v, where) {
  if (!v || typeof v.id !== 'string' || !ID_RE.test(v.id) || typeof v.title !== 'string' || !Number.isInteger(v.duration) || v.duration < 1 || v.duration > MAX_DURATION) {
    return where + ' id=' + (v && v.id) + ' duration=' + JSON.stringify(v && v.duration);
  }
  return '';
}

// Same generator as tools/tctv-import/apply_tctv_import.js
const rand = () => {
  seed |= 0;
  seed = seed + 0x6D2B79F5 | 0;
  let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
  t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
  return ((t ^ t >>> 14) >>> 0) / 4294967296;
};
function fisherYates(list) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = list[i];
    list[i] = list[j];
    list[j] = tmp;
  }
  return list;
}

if (DIR) {
  const files = fs.readdirSync(DIR).filter(name => name.endsWith('.json')).sort();
  if (!files.length) { console.error('no json in ' + DIR); process.exit(1); }
  const loaded = files.map(name => {
    const full = path.join(DIR, name);
    const videos = JSON.parse(fs.readFileSync(full, 'utf8'));
    if (!Array.isArray(videos)) throw new Error(name + ' is not an array');
    return { name, full, videos };
  });
  const bad = [];
  loaded.forEach(file => file.videos.forEach((v, i) => { const msg = badEntry(v, file.name + '#' + i); if (msg) bad.push(msg); }));
  if (bad.length) { console.error(bad.slice(0, 12).join('\n')); console.error('refusing shuffle: ' + bad.length + ' entries failed the duration check'); process.exit(1); }
  let moved = 0;
  for (const file of loaded) {
    const name = file.name;
    const videos = file.videos;
    const before = videos[0] && videos[0].id;
    fisherYates(videos);
    if (videos[0] && videos[0].id !== before) moved++;
    if (WRITE) fs.writeFileSync(file.full, JSON.stringify(videos));
    console.log(name.padEnd(28), String(videos.length).padStart(5), 'first', videos[0] ? videos[0].id : '-');
  }
  console.log((WRITE ? 'WROTE' : 'DRY RUN') + ' ' + files.length + ' station files, ' + moved + ' first-ids changed');
  process.exit(0);
}

function matchClose(s, i, open, close) {
  let d = 0, inStr = false, q = '';
  for (let k = i; k < s.length; k++) {
    const c = s[k];
    if (inStr) { if (c === '\\') { k++; continue; } if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === open) d++; else if (c === close) { d--; if (d === 0) return k; }
  }
  throw new Error('unbalanced');
}
function topLevelObjects(s, a, b) {
  const out = []; let k = a;
  while (k < b) {
    const o = s.indexOf('{', k);
    if (o < 0 || o >= b) break;
    const c = matchClose(s, o, '{', '}');
    out.push([o, c + 1]);
    k = c + 1;
  }
  return out;
}

const src = fs.readFileSync(FILE, 'utf8');
const start = src.indexOf('var i=[') + 6;
if (start < 6) throw new Error('station array not found');
const end = matchClose(src, start, '[', ']');
let region = src.slice(start, end + 1);
const arr = Function('return ' + region)();
let out = '';
let cursor = 0;
let moved = 0;
const marker = 'videos:[';
for (const st of arr) {
  const idIdx = region.indexOf('id:"' + st.id + '"', cursor);
  const vStart = region.indexOf(marker, idIdx) + marker.length - 1;
  const vEnd = matchClose(region, vStart, '[', ']');
  const spans = topLevelObjects(region, vStart + 1, vEnd);
  const entries = spans.map(([a, b]) => region.slice(a, b));
  const bad = [];
  entries.forEach((text, i) => { let v; try { v = Function('return ' + text)(); } catch (err) { bad.push(st.id + '#' + i + ' unparsable'); return; } const msg = badEntry(v, st.id + '#' + i); if (msg) bad.push(msg); });
  if (bad.length) { console.error(bad.slice(0, 12).join('\n')); console.error('refusing shuffle: ' + bad.length + ' entries failed the duration check'); process.exit(1); }
  const sep = spans.length > 1 ? region.slice(spans[0][1], spans[1][0]) : ',\n                ';
  const lead = spans.length ? region.slice(vStart + 1, spans[0][0]) : '';
  const tail = spans.length ? region.slice(spans[spans.length - 1][1], vEnd) : '';
  const first = entries[0] || '';
  fisherYates(entries);
  if (entries[0] !== first) moved++;
  out += region.slice(cursor, vStart + 1) + lead + entries.join(sep) + tail;
  cursor = vEnd;
  console.log(st.id.padEnd(22), String(entries.length).padStart(5));
}
out += region.slice(cursor);
const updated = src.slice(0, start) + out + src.slice(end + 1);
new Function(updated);
console.log((WRITE ? 'WROTE' : 'DRY RUN') + ' ' + arr.length + ' stations, ' + moved + ' first-entries changed, seed start 20261022');
if (WRITE) fs.writeFileSync(FILE, updated);
else console.log('nothing written');
