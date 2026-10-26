#!/usr/bin/env node
'use strict';

// Builds functions/src/topicAnchorIndex.json from the topic notes.
// Paragraph text comes from the same splitter the page uses, so a button's
// anchor hash matches the row the callable loads.

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const topicDiscussion = require('./src/topicDiscussion');
const topicSections = require('./src/topicSections');

const root = path.join(__dirname, '..');
const sandbox = { console: console, setTimeout: setTimeout, clearTimeout: clearTimeout };
sandbox.window = sandbox;
vm.runInNewContext(fs.readFileSync(path.join(root, 'topic-discussions.js'), 'utf8'), sandbox, { filename: 'topic-discussions.js' });
if (typeof sandbox.bqContentParagraphs !== 'function') {
    console.error('topic-discussions.js did not export bqContentParagraphs');
    process.exit(1);
}

const channelBox = { console: console };
vm.runInNewContext(fs.readFileSync(path.join(root, 'channel_index.js'), 'utf8'), channelBox, { filename: 'channel_index.js' });

const index = {};
Object.keys(channelBox.CHANNELS).forEach(function(id) {
    const file = channelBox.CHANNELS[id] && channelBox.CHANNELS[id].file;
    if (!file) return;
    const full = path.join(root, file);
    if (!fs.existsSync(full)) return;
    let data;
    try { data = JSON.parse(fs.readFileSync(full, 'utf8')); }
    catch (err) { return; }
    const msgs = Array.isArray(data.msgs) ? data.msgs : [];
    const paragraphs = sandbox.bqContentParagraphs(msgs);
    const headings = topicSections.extractHeadings(msgs);
    index[id] = topicSections.buildTopicIndex(paragraphs, headings, topicDiscussion.anchorFingerprint);
});

const out = path.join(__dirname, 'src', 'topicAnchorIndex.json');
fs.writeFileSync(out, JSON.stringify(index));
const topics = Object.keys(index).length;
console.log('topic anchors: ' + topics + ' topics, ' + fs.statSync(out).size + ' bytes');
