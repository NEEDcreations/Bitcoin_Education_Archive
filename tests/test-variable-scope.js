// =============================================
// VARIABLE SCOPE TESTS
// Catches the exact bug pattern that broke Settings:
// a variable used inside a function but never declared there.
// Run: node tests/test-variable-scope.js
// =============================================
const fs = require('fs');
const path = require('path');

const JS_FILES = fs.readdirSync(path.join(__dirname, '..')).filter(f => f.endsWith('.js') && !f.startsWith('test'));
let passed = 0, failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ ${name}`);
        passed++;
    } catch (e) {
        console.log(`❌ ${name}: ${e.message}`);
        failed++;
    }
}

// Only check variables that caused actual production bugs
// These are state-tracking variables that MUST be function-local
const DANGEROUS_VARS = ['isAnon', 'isRealUser', 'settingsEmoji'];

JS_FILES.forEach(file => {
    const filepath = path.join(__dirname, '..', file);
    const code = fs.readFileSync(filepath, 'utf8');
    const lines = code.split('\n');

    // Parse functions and their variable declarations
    let funcStack = [{ name: 'global', vars: new Set(), params: new Set() }];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Skip comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

        // Detect function declarations (with params)
        const funcMatch = trimmed.match(/function\s+(\w+)\s*\(([^)]*)\)|(\w+)\s*=\s*function\s*\(([^)]*)\)|(\w+)\s*=\s*\(([^)]*)\)\s*=>/);
        if (funcMatch) {
            const name = funcMatch[1] || funcMatch[3] || funcMatch[5] || 'anonymous';
            const params = (funcMatch[2] || funcMatch[4] || funcMatch[6] || '').split(',').map(p => p.trim()).filter(Boolean);
            const paramSet = new Set(params);
            funcStack.push({ name, vars: new Set(), params: paramSet });
        }

        // Track variable declarations
        const varMatches = line.matchAll(/(?:var|let|const)\s+(\w+)/g);
        for (const m of varMatches) {
            const top = funcStack[funcStack.length - 1];
            top.vars.add(m[1]);
        }

        // Check dangerous variable usage
        for (const varName of DANGEROUS_VARS) {
            const regex = new RegExp('\\b' + varName + '\\b');
            if (!regex.test(line)) continue;

            // Skip declaration lines
            if (new RegExp('(?:var|let|const)\\s+' + varName).test(line)) continue;
            // Skip property access (e.g., user.isAnonymous)
            if (line.includes('.' + varName)) continue;
            // Skip string content
            if (trimmed.startsWith("'") || trimmed.startsWith('"') || trimmed.startsWith('`')) continue;

            // Check if variable is declared in current or any parent scope
            const isDeclared = funcStack.some(scope =>
                scope.vars.has(varName) || scope.params.has(varName)
            );

            if (!isDeclared) {
                const currentFunc = funcStack[funcStack.length - 1].name;
                test(`${file}:${i + 1} '${varName}' in ${currentFunc}`, () => {
                    throw new Error(`'${varName}' used but not declared — this is the exact bug that broke Settings`);
                });
            }
        }
    }
});

if (failed === 0) {
    test('No dangerous undefined variables found', () => {});
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
