const fs = require('fs');

// Read the file
let content = fs.readFileSync('/root/simple-archive/timechain-tv.js', 'utf8');

// Extract the stations array from the JS
// The file structure is: const STATIONS = [...]; followed by other code
const stationsMatch = content.match(/var STATIONS = (\[[\s\S]*?\n    \]);/);
if (!stationsMatch) {
  console.error("Could not find STATIONS array");
  process.exit(1);
}

let stations = JSON.parse(stationsMatch[1]);

// Find the two stations
const freedomIdx = stations.findIndex(s => s.id === 'freedom-sovereignty');
const beginnersIdx = stations.findIndex(s => s.id === 'orange-pill');

if (freedomIdx === -1 || beginnersIdx === -1) {
  console.error("Could not find stations", freedomIdx, beginnersIdx);
  process.exit(1);
}

console.log(`Freedom station: index ${freedomIdx}, ${stations[freedomIdx].videos.length} videos`);
console.log(`Beginners station: index ${beginnersIdx}, ${stations[beginnersIdx].videos.length} videos`);

// Keywords indicating self-custody content (to MOVE)
const selfCustodyKeywords = [
  'hardware wallet', 'cold storage', 'seed phrase', 'multisig', 'multi-sig', 'multi sig',
  'coldcard', 'cold card', 'sparrow wallet', 'sparrow', 'specter', 'bitbox', 'seedsigner',
  'blockstream jade', 'jade plus', 'keystone', 'trezor', 'ledger', 'private key',
  'passphrase', 'air-gapped', 'airgapped', 'air gapped', 'utxo', 'wallet setup',
  'wallet tutorial', 'cove wallet', 'self-custody', 'self custody', 'selfcustody',
  'signing device', 'paper wallet', 'bitkey', 'nunchuk', 'electrum',
  'seed storage', 'metal backup', 'dice roll seed', 'spending policy',
  'key teleport', 'co-sign', 'tapsigner', 'bag number', 'replace by fee',
  'child pays for parent', 'rbf', 'diy bitcoin', 'bowser',
  'hardware wallet', 'bitcoin wallet', 'bitcoin security',
  'importing', 'coldcard', 'mk4', 'mk5', 'mk 4', 'mk 5',
  'secure notes', 'secure passwords'
];

// Keywords indicating content to KEEP in Freedom station
const keepKeywords = [
  'human rights', 'alex gladstein', 'hrf', 'refugees', 'tyranny', 'whitney webb',
  'ross ulbricht', 'nomad', 'travel', 'vr', 'etf', 'philosophy', 'bible',
  'art', 'economics', 'advocacy', 'freedom fellowship', 'freedom festival',
  'oslo freedom', 'financial freedom', 'human rights foundation',
  'authoritarianism', 'autocracy', 'navalny', 'north korea', 'nk insider',
  'dictator', 'tyranny tracker', 'democracy index', 'debank',
  'celebrities & dictators', 'kleptocrat', 'shell company',
  'running llms', 'maple ai', 'isabella santos', 'circular economy',
  'edward snowden', 'snowden', 'cbdc', 'cryptofascist',
  'gary\'s economics', 'economic philosophy', 'bitstein',
  'anita posch', 'carla kirk-cohen', 'lightning for financial freedom',
  'doors to freedom', 'bitcoin protects human rights',
  'banking on freedom', 'bitcoin against autocracy',
  'nomad capitalist', 'tax-friendly', 'crypto-friendly',
  'move with bitcoin', 'countries for crypto',
  'reckless vr', 'bitcoin vr', 'maximalism', 'dark ages',
  'brief look', 'ethereum', 'billion', 'debt', 'greed', 'inflation',
  'e.b. tucker', 'gold'
];

// Classify each video in Freedom station
const toMove = [];
const toKeep = [];

for (const video of stations[freedomIdx].videos) {
  const titleLower = video.title.toLowerCase();
  
  // Check if it matches keep keywords first (priority)
  let shouldKeep = false;
  for (const kw of keepKeywords) {
    if (titleLower.includes(kw.toLowerCase())) {
      shouldKeep = true;
      break;
    }
  }
  
  if (shouldKeep) {
    toKeep.push(video);
    continue;
  }
  
  // Check if it matches self-custody keywords
  let shouldMove = false;
  for (const kw of selfCustodyKeywords) {
    if (titleLower.includes(kw.toLowerCase())) {
      shouldMove = true;
      break;
    }
  }
  
  if (shouldMove) {
    toMove.push(video);
  } else {
    toKeep.push(video);
  }
}

console.log(`\nVideos to MOVE to Beginners: ${toMove.length}`);
console.log(`Videos to KEEP in Freedom: ${toKeep.length}`);
console.log(`\n--- MOVING these videos ---`);
toMove.forEach(v => console.log(`  ${v.id}: ${v.title}`));
console.log(`\n--- KEEPING these videos ---`);
toKeep.forEach(v => console.log(`  ${v.id}: ${v.title}`));

// Apply changes
// 1. Rename Freedom station
stations[freedomIdx].name = "Freedom, Sovereignty & Homesteading";
stations[freedomIdx].desc = "Human rights, financial freedom, homesteading & sovereignty";
stations[freedomIdx].videos = toKeep;

// 2. Rename Beginners station  
stations[beginnersIdx].name = "Beginners 101, Orange-pill & Self-Custody";

// 3. Move self-custody videos to Beginners station
stations[beginnersIdx].videos = [...stations[beginnersIdx].videos, ...toMove];

console.log(`\nAfter changes:`);
console.log(`Freedom station: ${stations[freedomIdx].videos.length} videos`);
console.log(`Beginners station: ${stations[beginnersIdx].videos.length} videos`);

// Write back
const newStationsJson = JSON.stringify(stations, null, 16)
  // The file uses 16-space indent for the array items but compact for video objects
  // Let's match the original format better
  ;

// Actually let's reconstruct more carefully to match existing format
// The original uses compact single-line video objects
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

// Replace in the content
content = content.replace(stationsMatch[1], output);

fs.writeFileSync('/root/simple-archive/timechain-tv.js', content);
console.log('\nFile written successfully!');
