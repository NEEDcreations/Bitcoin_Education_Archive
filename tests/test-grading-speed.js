// Daily Quest and poll results paint immediately. XP stays server-authoritative.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
function read(name) {
    return fs.readFileSync(path.join(root, name), 'utf8');
}

let passed = 0;
let failed = 0;
function test(name, fn) {
    try {
        fn();
        console.log('  ok  ' + name);
        passed++;
    } catch (e) {
        console.log('  FAIL ' + name + ': ' + (e && e.message ? e.message : e));
        failed++;
    }
}

test('submitQuest paints the score before awaiting gradeQuest', function () {
    const src = read('quests.js');
    const fn = src.slice(src.indexOf('async function submitQuest()'), src.indexOf('function playHooraySound()'));
    const paint = fn.indexOf('paintQuestResults(questScoreMessage(0, false)');
    const awaitGrade = fn.indexOf('await _gradeQuestOnServer');
    assert.ok(paint !== -1 && awaitGrade !== -1);
    assert.ok(paint < awaitGrade);
    assert.ok(fn.indexOf('Confirming XP') !== -1);
    assert.ok(fn.indexOf("data-xp=\"pending\"") !== -1);
    // First paint must not pass a guessed awarded amount
    assert.ok(fn.indexOf('paintQuestResults(questScoreMessage(0, false), 0, canGrade, true)') !== -1);
});

test('quiz XP on screen comes only from gradeQuest.awarded', function () {
    const src = read('quests.js');
    const fn = src.slice(src.indexOf('async function submitQuest()'), src.indexOf('function playHooraySound()'));
    const awarded = fn.indexOf("serverData && typeof serverData.awarded === 'number' ? serverData.awarded : 0");
    const secondPaint = fn.indexOf('paintQuestResults(msg, pts, false, awarded > 0)');
    assert.ok(awarded !== -1 && secondPaint !== -1);
    assert.ok(awarded < secondPaint);
    assert.ok(fn.indexOf('XP on screen is only what gradeQuest actually paid') !== -1);
});

test('leftover quiz writes go through one Firestore batch', function () {
    const src = read('quests.js');
    const fn = src.slice(src.indexOf('async function submitQuest()'), src.indexOf('function playHooraySound()'));
    assert.ok(fn.indexOf('var batch = db.batch()') !== -1);
    assert.ok(fn.indexOf('batch.update(userRef, userUpdate)') !== -1);
    assert.ok(fn.indexOf("batch.set(db.collection('stats').doc('global')") !== -1);
    assert.ok(fn.indexOf('batch.commit()') !== -1);
    assert.ok(fn.indexOf('await db.collection(\'users\').doc(auth.currentUser.uid).update') === -1);
});

test('pollVote shows results before dailyPollVote returns', function () {
    const src = read('quests.js');
    const fn = src.slice(src.indexOf('window.pollVote = function'), src.indexOf('// RAID BOSS SYSTEM'));
    const show = fn.indexOf('_showPollBody(false)');
    const call = fn.indexOf("httpsCallable('dailyPollVote')");
    const setState = fn.indexOf('_setPollState(state)');
    const capture = fn.indexOf('_capturePollBaseline');
    assert.ok(setState !== -1 && show !== -1 && call !== -1 && capture !== -1);
    assert.ok(setState < show);
    assert.ok(show < capture);
    assert.ok(capture < call);
    assert.ok(fn.indexOf('window._pollXpPending = canCall') !== -1);
    // XP toast still uses the server amount
    assert.ok(fn.indexOf("Number(data.awarded) || 0") !== -1);
});

test('gradeQuest and answerTrivia read transaction docs in parallel', function () {
    const src = read('functions/src/questCallables.js');
    const trivia = src.slice(src.indexOf('const answerTrivia = onCall'), src.indexOf('const gradeQuest = onCall'));
    const quest = src.slice(src.indexOf('const gradeQuest = onCall'), src.indexOf('const startQuest = onCall'));
    assert.ok(trivia.indexOf('await Promise.all([') !== -1);
    assert.ok(trivia.indexOf('tx.get(claimRef)') !== -1);
    assert.ok(quest.indexOf('await Promise.all([') !== -1);
    assert.ok(quest.indexOf('completionRef ? tx.get(completionRef)') !== -1);
    assert.ok(quest.indexOf('passRef ? tx.get(passRef)') !== -1);
    // Sequential await tx.get chains for those docs should be gone
    assert.ok(trivia.indexOf('const rateDoc = await tx.get(rateRef);') === -1);
    assert.ok(quest.indexOf('const rateDoc = await tx.get(rateRef);') === -1);
});

test('minInstances is not set on these callables in this PR', function () {
    const src = read('functions/src/questCallables.js');
    const trivia = src.slice(src.indexOf('function onCall'), src.indexOf('const startQuest = onCall'));
    assert.ok(trivia.indexOf('minInstances') === -1);
    const poll = read('functions/index.js');
    const vote = poll.slice(poll.indexOf('exports.dailyPollVote'), poll.indexOf('exports.reconcileDailyProofs'));
    assert.ok(vote.indexOf('minInstances') === -1);
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
