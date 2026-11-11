// Load xss-safe.js (window.BQSafe) into a vm sandbox, the same way index.html
// loads it before every app script. Usage: require('./xss/load-bqsafe')(vm, ctx)
const fs = require('fs');
const path = require('path');
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'xss-safe.js'), 'utf8');
module.exports = function loadBQSafe(vm, ctx) {
    vm.runInContext(SRC + '\n;if (typeof window !== "undefined" && window && window.BQSafe && !this.BQSafe) this.BQSafe = window.BQSafe;', ctx, { filename: 'xss-safe.js' });
};
