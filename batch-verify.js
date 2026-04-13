const https = require('https');

function checkVideo(id) {
  return new Promise((resolve) => {
    const url = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`;
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const j = JSON.parse(data);
            resolve({ id, ok: true, title: j.title, author: j.author_name });
          } catch(e) {
            resolve({ id, ok: false, error: 'parse' });
          }
        } else {
          resolve({ id, ok: false, error: `${res.statusCode}` });
        }
      });
    }).on('error', e => resolve({ id, ok: false, error: e.message }));
  });
}

async function main() {
  const ids = process.argv[2].split(',');
  for (const id of ids) {
    const r = await checkVideo(id.trim());
    if (r.ok) console.log(`OK|${r.id}|${r.title}|${r.author}`);
    else console.log(`FAIL|${r.id}|${r.error}`);
  }
}
main();
