#!/usr/bin/env node
// After an import: drop dead ids, drop cross-station duplicate ids (keep the
// first copy), and mark Shorts with short:1 so the player can frame them.
// Dry run unless --write.
//   node tools/tctv-import/normalize_tctv_catalog.js --file timechain-tv.js \
//        --dead tools/tctv-import/dead-existing-ids.txt \
//        --meta /path/new-videos-meta.json \
//        --rejected tools/tctv-import/rejected-shorts.json --write
'use strict';
const fs = require('fs');
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FILE = opt('--file');
const DEAD = opt('--dead', null);
const META = opt('--meta', null);
const REJECTED = opt('--rejected', null);
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

const shortIds = new Set();
if (META) {
  const meta = JSON.parse(fs.readFileSync(META, 'utf8'));
  for (const vids of Object.values(meta)) {
    for (const v of vids) if (v.short) shortIds.add(v.id);
  }
}
if (REJECTED) {
  const rows = JSON.parse(fs.readFileSync(REJECTED, 'utf8'));
  for (const v of rows) if (v && v.id) shortIds.add(v.id);
}
const dead = DEAD ? new Set(fs.readFileSync(DEAD, 'utf8').split(/\s+/).filter(Boolean)) : new Set();

const src = fs.readFileSync(FILE, 'utf8');
const start = src.indexOf('var i=[') + 6;
const end = matchClose(src, start, '[', ']');
let region = src.slice(start, end + 1);
const arr = Function('return ' + region)();
const seen = new Set();
let out = '';
let cursor = 0;
let removedDead = 0;
let removedDupes = 0;
let flagged = 0;
let alreadyShort = 0;
const marker = 'videos:[';
const titleShort = /#shorts\b|youtubeshorts/i;

for (const st of arr) {
  const idIdx = region.indexOf('id:"' + st.id + '"', cursor);
  const vStart = region.indexOf(marker, idIdx) + marker.length - 1;
  const vEnd = matchClose(region, vStart, '[', ']');
  const spans = topLevelObjects(region, vStart + 1, vEnd);
  const sep = spans.length > 1 ? region.slice(spans[0][1], spans[1][0]) : ',\n                ';
  const lead = spans.length ? region.slice(vStart + 1, spans[0][0]) : '';
  const tail = spans.length ? region.slice(spans[spans.length - 1][1], vEnd) : '';
  const entries = [];
  for (const [a, b] of spans) {
    let text = region.slice(a, b);
    const obj = Function('return ' + text)();
    if (dead.has(obj.id)) { removedDead++; continue; }
    if (seen.has(obj.id)) { removedDupes++; continue; }
    seen.add(obj.id);
    const wantShort = !!(obj.short || shortIds.has(obj.id) || titleShort.test(obj.title || ''));
    if (wantShort && !obj.short) {
      if (!text.endsWith('}')) throw new Error('entry does not end with } ' + obj.id);
      text = text.slice(0, -1) + ',short:1}';
      flagged++;
    } else if (obj.short) alreadyShort++;
    entries.push(text);
  }
  out += region.slice(cursor, vStart + 1) + lead + entries.join(sep) + tail;
  cursor = vEnd;
  console.log(st.id.padEnd(22), String(entries.length).padStart(5));
}
out += region.slice(cursor);
const updated = src.slice(0, start) + out + src.slice(end + 1);
new Function(updated);
console.log('removed-dead', removedDead, 'removed-dupes', removedDupes, 'flagged-short', flagged, 'already-short', alreadyShort, 'unique', seen.size);
if (WRITE) { fs.writeFileSync(FILE, updated); console.log('WROTE', FILE); }
else console.log('DRY RUN');
