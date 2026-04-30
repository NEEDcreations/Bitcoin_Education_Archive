const fs = require('fs');

let content = fs.readFileSync('/root/simple-archive/timechain-tv.js', 'utf8');
const stationsMatch = content.match(/var STATIONS = (\[[\s\S]*?\n    \]);/);
let stations = JSON.parse(stationsMatch[1]);

const freedomIdx = stations.findIndex(s => s.id === 'freedom-sovereignty');
const homesteadVideos = JSON.parse(fs.readFileSync('/tmp/verified-homestead.json', 'utf8'));

console.log(`Freedom station before: ${stations[freedomIdx].videos.length} videos`);

// Add homesteading videos
stations[freedomIdx].videos.push(...homesteadVideos);

console.log(`Freedom station after: ${stations[freedomIdx].videos.length} videos`);
console.log(`Added ${homesteadVideos.length} homesteading videos`);

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
console.log('File written!');
