// Weekly Signal rotates by ISO week and is not stuck on February copy.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(root, 'ranking.js'), 'utf8');
const start = src.indexOf('window.btcIsoWeekInfo = function');
const end = src.indexOf('window.loadSignalContent = function');
assert(start > 0 && end > start, 'weekly signal helpers missing');

const sandbox = { window: {}, console };
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(src.slice(start, end), sandbox);

const postsA = sandbox.window.btcWeeklySignalPosts(new Date(Date.UTC(2026, 10, 9))); // Nov 9, 2026
const postsB = sandbox.window.btcWeeklySignalPosts(new Date(Date.UTC(2026, 10, 16)));
assert.strictEqual(postsA.length, 4);
assert.strictEqual(postsB.length, 4);
assert.ok(postsA.every(function(p) { return p.date.indexOf('Week of') === 0 && p.channel && p.title; }));
assert.ok(postsA[0].date.indexOf('Feb') === -1, 'dates are the current week, not February');
const titlesA = postsA.map(function(p) { return p.title; }).join('|');
const titlesB = postsB.map(function(p) { return p.title; }).join('|');
assert.notStrictEqual(titlesA, titlesB, 'adjacent weeks rotate featured deep dives');

const ranking = src;
assert.ok(ranking.indexOf("date: 'Feb 26, 2026'") === -1);
assert.ok(ranking.indexOf('btcWeeklySignalPosts') !== -1);
assert.ok(ranking.indexOf('hotTopics') !== -1);
assert.ok(ranking.indexOf('openWeeklySignal') !== -1);

const hot = fs.readFileSync(path.join(root, 'hot-topics.js'), 'utf8');
assert.ok(hot.indexOf('weeklySignalHomeBtn') !== -1);
assert.ok(hot.indexOf('openWeeklySignal') !== -1);

console.log('✅ weekly signal rotates and is not stuck in February');
