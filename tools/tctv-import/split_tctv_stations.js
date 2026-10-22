#!/usr/bin/env node
// Move each station's videos out of timechain-tv.js into data/tctv/<station-id>.json
// and leave videos:[] in the player file. Station id/name/emoji stay put.
// The player fetches a station file when Timechain TV opens.
// Dry run unless --write.
//   node tools/tctv-import/split_tctv_stations.js --file timechain-tv.js --dir data/tctv --write
'use strict';
const fs = require('fs');
const path = require('path');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = opt('--file');
const DIR = opt('--dir', 'data/tctv');
const WRITE = args.includes('--write');
if (!FILE) { console.error('need --file'); process.exit(1); }

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

const src = fs.readFileSync(FILE, 'utf8');
const start = src.indexOf('var i=[') + 6;
if (start < 6) throw new Error('station array not found');
const end = matchClose(src, start, '[', ']');
const region = src.slice(start, end + 1);
const arr = Function('return ' + region)();
let out = '';
let cursor = 0;
let total = 0;
const marker = 'videos:[';
if (WRITE) fs.mkdirSync(DIR, { recursive: true });
for (const st of arr) {
  const idIdx = region.indexOf('id:"' + st.id + '"', cursor);
  const markerAt = region.indexOf(marker, idIdx);
  const vStart = markerAt + marker.length - 1;
  const vEnd = matchClose(region, vStart, '[', ']');
  const videos = st.videos.map(v => {
    const row = { id: v.id, title: v.title, duration: v.duration };
    if (v.short) row.short = true;
    return row;
  });
  total += videos.length;
  const file = path.join(DIR, st.id + '.json');
  if (WRITE) fs.writeFileSync(file, JSON.stringify(videos));
  out += region.slice(cursor, markerAt) + 'videos:[]';
  cursor = vEnd + 1;
  console.log(st.id.padEnd(22), String(videos.length).padStart(5), 'shorts', videos.filter(v => v.short).length);
}
out += region.slice(cursor);
const updated = src.slice(0, start) + out + src.slice(end + 1);
new Function(updated);
const bytes = Buffer.byteLength(updated);
console.log('stations', arr.length, 'videos', total, 'player bytes', bytes);
if (WRITE) fs.writeFileSync(FILE, updated);
else console.log('DRY RUN');
