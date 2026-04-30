const https = require('https');
const fs = require('fs');

const YT_API_KEY = 'AIzaSyDvfMI3A2NWibbhd4cRgJUVQzCuU5nzNLM';

// Selected homesteading videos from popular channels
const candidateIds = [
  'uZH1_0sHc7Q', // Your First 5 Steps to Starting a Homesteading Journey | Homesteading Family
  '85e7jsqbSd4', // How to Start a Homestead in 2025 | 5 Beginner Steps
  'WEeICYjlfUQ', // So You Want To Start A Homestead? (Beginner Tips)
  '6CrpwE0Yq9g', // The Big Lie of Modern Homesteading | Anne of All Trades
  'OJZ2wRakOh0', // 14 Years Living Off-Grid in a Self-Built Cabin & Farming
  '9km7jI-mP8Q', // The TRUTH about OFF GRID LIVING in 2025
  'FTpMrI_vavI', // How To Be Free In 2024: Start An Off Grid Homestead
  '0mP4ADWY0xY', // 25 Amish Tricks for Living Off Grid in a Cold Climate
  '8G8cH740_TQ', // How to raise chickens in your backyard (10 tips) | City Prepping
  '5n452vfBX8U', // What I Wish I Knew BEFORE Getting Backyard Chickens
  'wuOd5_M9yDQ', // Raising Chickens: Everything You Need To Know! | Epic Homesteading
  'IgI8h68EiU8', // Canning 101: A Beginner's Guide | That 1870's Homestead
  'jPTG0-syzrM', // One Year's Worth of Food | GIANT Pantry Tour | 1600+ Jars
  'hU9C4rbK6wg', // How to Preserve a Year's Worth of Food WITHOUT GOING INSANE
  '9R-utqpmwmE', // Planning a Vegetable Garden for Beginners: 5 Golden Rules | GrowVeg
  'u34R01BEPdE', // Using SQUARE FOOT Gardening Easily DOUBLED Harvests | Gardening Channel
  'DoKh7SdbnXM', // 5 Tasks You Should Do EVERY DAY in the Veggie Garden | Self Sufficient Me
  'BuYGS5pLRZg', // THIS FARM CRACKED THE CODE: Water Wizard of Oregon
  'TJ3DUI7NvNk', // 7 Ways this Farm Harvests FREE Water | Andrew Millison
  '79s_PJ0E2CQ', // Rain Water Harvesting System Top Mistakes!
];

function parseDuration(iso) {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  return (parseInt(match[1] || 0) * 3600) + (parseInt(match[2] || 0) * 60) + parseInt(match[3] || 0);
}

function fetchBatch(ids) {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,status&id=${ids.join(',')}&key=${YT_API_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch(e) { reject(e); }
      });
    }).on('error', reject);
  });
}

async function main() {
  const result = await fetchBatch(candidateIds);
  
  if (!result.items) {
    console.error('API error:', JSON.stringify(result));
    process.exit(1);
  }
  
  const verified = [];
  const rejected = [];
  
  for (const item of result.items) {
    const id = item.id;
    const title = item.snippet.title;
    const embeddable = item.status.embeddable;
    const privacy = item.status.privacyStatus;
    const duration = parseDuration(item.contentDetails.duration);
    
    if (embeddable && privacy === 'public' && duration > 0) {
      verified.push({ id, title, duration });
    } else {
      rejected.push({ id, title, embeddable, privacy, duration });
    }
  }
  
  // Check which IDs didn't return (deleted/private)
  const returnedIds = result.items.map(i => i.id);
  const missing = candidateIds.filter(id => !returnedIds.includes(id));
  
  console.log(`\n=== VERIFIED (${verified.length}) ===`);
  verified.forEach(v => console.log(`  ${v.id} | ${v.title} | ${v.duration}s`));
  
  if (rejected.length) {
    console.log(`\n=== REJECTED (${rejected.length}) ===`);
    rejected.forEach(v => console.log(`  ${v.id} | ${v.title} | embeddable=${v.embeddable} privacy=${v.privacy}`));
  }
  
  if (missing.length) {
    console.log(`\n=== MISSING/DELETED (${missing.length}) ===`);
    missing.forEach(id => console.log(`  ${id}`));
  }
  
  // Write verified to a temp file for the next script to use
  fs.writeFileSync('/tmp/verified-homestead.json', JSON.stringify(verified, null, 2));
  console.log(`\nWrote ${verified.length} verified videos to /tmp/verified-homestead.json`);
}

main().catch(e => { console.error(e); process.exit(1); });
