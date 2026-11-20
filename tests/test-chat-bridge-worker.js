// Source-level checks for the chat-bridge worker's agent self-mirror endpoint.
// Run: node tests/test-chat-bridge-worker.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'workers', 'chat-bridge', 'worker.js'), 'utf8');

// The endpoint exists and is wired into the router.
assert.ok(src.indexOf("url.pathname === '/webhook/agent'") !== -1, 'agent route');
assert.ok(src.indexOf('handleAgentWebhook(request, env)') !== -1, 'agent handler wired');

// Fail-closed auth: reject when the secret is unset.
assert.ok(src.indexOf('!env.AGENT_CHAT_SECRET || !timingSafeEqual(agentSecret, env.AGENT_CHAT_SECRET)') !== -1, 'fail-closed auth');

// The agent message is written with source 'telegram' so the App→Telegram
// mirror skips it (no echo loop), and is never treated as a Nacho auto post.
assert.ok(src.indexOf("source: { stringValue: 'telegram' }") !== -1, 'source telegram');
assert.ok(src.indexOf('isNachoAuto: { booleanValue: false }') !== -1, 'not nacho auto');

// The handler rejects empty text and caps the message length.
assert.ok(src.indexOf("if (!text) return corsResponse({ error: 'text required' }, 400);") !== -1, 'empty text rejected');
assert.ok(src.indexOf('.substring(0, 2000)') !== -1, 'text capped');

console.log('✅ chat-bridge worker agent endpoint checks passed');
