const fs = require('fs');

let content = fs.readFileSync('/root/simple-archive/timechain-tv.js', 'utf8');
const stationsMatch = content.match(/var STATIONS = (\[[\s\S]*?\n    \]);/);
let stations = JSON.parse(stationsMatch[1]);

const freedomIdx = stations.findIndex(s => s.id === 'freedom-sovereignty');
const beginnersIdx = stations.findIndex(s => s.id === 'orange-pill');

// IDs that should move from Freedom to Beginners (clearly self-custody hardware wallet content)
const shouldMove = [
  '6zRIE8ScGOM', // Bitkey Cold Storage from Jack Dorsey's Block
  'xQXuc8v-LdQ', // Traveling With Bitcoin? Blockstream Jade Is the Only Hardware Wallet to Carry
  'H6PM4mbGwp8', // Bitcoin Hardware Wallet Unboxing - Setting Up Blockstream Jade Plus in Rose Gold
  'llCrHefbZa0', // Bitcoin Hardware Wallet Glow-Up - Jade Plus
  'P3U3jZTMXOk', // COLDCARD + Cove Wallet Quick Start Guide
  'n_bU0bSJglw', // Don't Lose Your Bitcoin Generational Wealth | BTC Sessions (self-custody focused)
  'eWbBnqRcIo0', // Attack Vectors in Real Life: Being your own Bitcoin Bank
];

const moved = [];
for (const id of shouldMove) {
  const idx = stations[freedomIdx].videos.findIndex(v => v.id === id);
  if (idx !== -1) {
    const video = stations[freedomIdx].videos.splice(idx, 1)[0];
    stations[beginnersIdx].videos.push(video);
    moved.push(video.title);
  }
}

console.log(`Moved ${moved.length} additional videos:`);
moved.forEach(t => console.log(`  - ${t}`));
console.log(`\nFreedom: ${stations[freedomIdx].videos.length} videos`);
console.log(`Beginners: ${stations[beginnersIdx].videos.length} videos`);

// Rebuild
let output = '[\n';
for (let i = 0; i < stations.length; i++) {
  const s = stations[i];
  output += '        {\n';
  output += `            "id": ${JSON.stringify(s.id)},\n`;
  output += `            "name": ${JSON.stringify(s.name)},\n`;
  output += `            "emoji": ${JSON.stringify(s.emoji)},\n`;
  output += `            "desc": ${JSON.stringify(s.desc)},\n`;
  output += `            "color": ${JSON.stringify(s.color)},\n`;
  output += `            "videos": [\n`;
  for (let j = 0; j < s.videos.length; j++) {
    const v = s.videos[j];
    const comma = j < s.videos.length - 1 ? ',' : '';
    output += `                {"id":${JSON.stringify(v.id)},"title":${JSON.stringify(v.title)},"duration":${v.duration}}${comma}\n`;
  }
  output += '            ]\n';
  output += '        }';
  if (i < stations.length - 1) output += ',';
  output += '\n';
}
output += '    ]';

content = content.replace(stationsMatch[1], output);
fs.writeFileSync('/root/simple-archive/timechain-tv.js', content);
console.log('File updated!');
