const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const filesToValidate = ['app.js', 'ranking.js', 'badges.js', 'scholar.js', 'nacho-qa.js', 'forum.js', 'marketplace.js'];

console.log('--- STARTING COMPREHENSIVE VALIDATION ---');

let failureCount = 0;

filesToValidate.forEach(file => {
    const fullPath = path.join(projectRoot, file);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ Missing File: ${file}`);
        failureCount++;
        return;
    }

    const content = fs.readFileSync(fullPath, 'utf8');

    // 1. Logic Check (Basic Syntax)
    try {
        new Function(content);
        console.log(`✅ ${file}: Syntax Valid`);
    } catch (e) {
        console.error(`❌ ${file}: Syntax Error - ${e.message}`);
        failureCount++;
    }

    // 2. Content Validity: Search for specific Bitcoin mining terms we must avoid
    if (content.includes('complex math problems') || content.includes('complex puzzles')) {
        console.error(`❌ ${file}: Contains forbidden mining description ('complex puzzles')`);
        failureCount++;
    }

    // 3. Content Validity: Search for unfinished markers
    if (content.includes('TODO') || content.includes('coming soon')) {
        console.warn(`⚠️ ${file}: Contains TODO or 'coming soon' tags`);
    }
    
    // 4. Reference check
    if (file === 'app.js') {
        const refs = [/CHANNELS/, /auth/, /db/, /currentUser/];
        refs.forEach(r => {
            if (!content.match(r)) console.warn(`⚠️ ${file}: Potential missing reference to ${r}`);
        });
    }
});

// 5. Responsiveness Check (Heuristic)
const htmlContent = fs.readFileSync(path.join(projectRoot, 'index.html'), 'utf8');
if (!htmlContent.includes('viewport') || !htmlContent.includes('@media')) {
    console.error('❌ index.html: Missing critical responsiveness meta tags or media queries');
    failureCount++;
} else {
    console.log('✅ index.html: Responsiveness tags present');
}

console.log('--- VALIDATION COMPLETE ---');
if (failureCount > 0) {
    console.error(`FAILED: ${failureCount} errors found.`);
    process.exit(1);
} else {
    console.log('PASSED: System integrity verified.');
}
