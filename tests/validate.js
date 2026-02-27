const fs = require('fs');

const files = ['app.js', 'ranking.js', 'scholar.js', 'nacho-qa.js', 'nacho.js', 'nacho-live.js'];

files.forEach(f => {
    try {
        const c = fs.readFileSync('/root/simple-archive/' + f, 'utf8');
        new Function(c);
        console.log(`✅ ${f}: VALID`);
    } catch(e) {
        console.error(`❌ ${f}: INVALID - ${e.message}`);
    }
});
