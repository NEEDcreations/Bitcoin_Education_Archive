#!/usr/bin/env node
// Build icon-system.js from assets/icons/*.svg + the emoji→icon mapping below.
// Usage: node scripts/build-icons.js
//
// Mapping policy (see icon-system.js header): only object/symbol emojis used
// as app chrome are mapped. Expressive/social emojis (faces, hands, hearts,
// flags) are deliberately NOT mapped so they stay native everywhere.
'use strict';
const fs = require('fs');
const path = require('path');

const ICON_DIR = path.join(__dirname, '..', 'assets', 'icons');
const TEMPLATE = path.join(__dirname, 'icon-runtime.template.js');
const OUT = path.join(__dirname, '..', 'icon-system.js');

const MAP = {
  // brand / energy
  '⚡': 'zap', '🔥': 'flame', '🦌': 'deer', '🚀': 'rocket', '✨': 'sparkles',
  '🎉': 'confetti', '🎊': 'confetti', '🔮': 'crystal-ball',
  // arrows
  '→': 'arrow-right', '➡️': 'arrow-right', '←': 'arrow-left', '⬅️': 'arrow-left',
  '↗': 'arrow-up-right', '🔄': 'refresh', '🔃': 'refresh',
  // status / feedback
  '✓': 'check', '✔️': 'check', '✅': 'check-circle', '☑️': 'check-circle',
  '✕': 'x', '✖️': 'x', '❌': 'x-circle', '🚫': 'ban', '⛔': 'ban',
  '⚠️': 'alert', '🚨': 'siren', '❓': 'help', '❔': 'help', '💡': 'bulb',
  '⏳': 'hourglass', '⌛': 'hourglass',
  '🔴': 'dot-red', '🟢': 'dot-green', '🟠': 'dot-orange', '🟣': 'dot-purple',
  '🔵': 'dot-blue', '🟡': 'dot-yellow',
  // achievement
  '🏆': 'trophy', '🏅': 'medal', '🥇': 'medal', '🎖️': 'medal',
  '⭐': 'star', '🌟': 'star', '👑': 'crown', '💎': 'gem', '🎯': 'target',
  // communication
  '💬': 'chat', '🗨️': 'chat', '🗣️': 'megaphone', '📣': 'megaphone', '📢': 'megaphone',
  '📧': 'mail', '✉️': 'mail', '📨': 'mail', '🔔': 'bell', '📤': 'upload',
  '📱': 'smartphone', '📡': 'radio',
  // docs / knowledge
  '📋': 'clipboard', '📖': 'book', '📕': 'book', '📚': 'library', '📜': 'scroll',
  '📝': 'pencil', '✏️': 'pencil', '🖊️': 'pencil', '📄': 'file', '📃': 'file',
  '📰': 'news', '🔖': 'bookmark', '📌': 'pin', '📍': 'map-pin',
  '🎓': 'grad-cap', '🧠': 'brain', '📅': 'calendar', '🗓️': 'calendar',
  '⏰': 'clock', '⏱️': 'stopwatch',
  // security
  '🔒': 'lock', '🔐': 'lock', '🔑': 'key', '🗝️': 'key', '🛡️': 'shield',
  '🕵️': 'spy', '🕵️‍♂️': 'spy', '🕵️‍♀️': 'spy', '👁️': 'eye', '👀': 'eye',
  // tools / building
  '⛏️': 'pickaxe', '⚔️': 'swords', '🛠️': 'wrench', '🔧': 'wrench', '🔨': 'hammer',
  '⚙️': 'gear', '🧰': 'toolbox', '⛓️': 'chains', '🧊': 'cube', '🧱': 'bricks',
  '⚖️': 'scales',
  // world / places
  '🌍': 'globe', '🌎': 'globe', '🌏': 'globe', '🌐': 'globe', '💹': 'geo-macro', '🗺️': 'map',
  '🏔️': 'mountain', '⛰️': 'mountain', '🏛️': 'landmark', '🗽': 'landmark',
  '🏦': 'landmark', '🏠': 'home', '🏡': 'home',
  '☀️': 'sun', '🌙': 'moon', '🌱': 'sprout', '🌳': 'tree', '🌲': 'tree',
  // charts / money
  '📊': 'chart', '📈': 'trend-up', '📉': 'trend-down', '💰': 'money',
  '💸': 'banknote', '💵': 'banknote', '💳': 'card', '🪙': 'coin',
  // media
  '📺': 'tv', '🎵': 'music', '🎶': 'music', '🎧': 'headphones', '🎸': 'guitar',
  '🎤': 'mic', '🎙️': 'mic', '🔊': 'volume', '🔇': 'volume-off', '💿': 'disc',
  '⏸️': 'pause', '📷': 'camera', '📸': 'camera', '🎬': 'clapper', '🎥': 'clapper',
  '🎮': 'gamepad', '🕹️': 'gamepad', '🎨': 'palette', '🎲': 'dice', '🎰': 'slot',
  '🎡': 'wheel', '🎟️': 'ticket', '🎫': 'ticket',
  // commerce / misc
  '🛒': 'cart', '🔍': 'search', '🔎': 'search', '🔗': 'link', '🗑️': 'trash',
  '➕': 'plus', '📦': 'package', '💾': 'save', '💻': 'laptop', '🖥️': 'monitor',
  '🤖': 'robot', '👥': 'users', '👤': 'user', '🚩': 'flag', '💀': 'skull',
  '🔢': 'hash', '💯': 'hundred',
  // channel-topic coverage (incl. pun icons)
  '📆': 'calendar', '🕐': 'clock', '🕑': 'clock', '🕒': 'clock', '🕓': 'clock',
  '🕔': 'clock', '🕕': 'clock', '🕖': 'clock', '🕗': 'clock', '🕘': 'clock',
  '🕙': 'clock', '🕚': 'clock', '🕛': 'clock',
  '✍️': 'pencil', '📒': 'book', '🌀': 'refresh', '♻️': 'refresh', '➰': 'refresh',
  '🚲': 'wheel', '🛑': 'ban', '🟩': 'dot-green', '💲': 'banknote', '🕳️': 'cube',
  '🌋': 'mountain', '☣️': 'skull', '👨‍💻': 'laptop', '👩‍💻': 'laptop',
  '👷': 'toolbox', '👴': 'hourglass', '🏈': 'dice', '🚧': 'bricks', '🥐': 'package',
  '☮️': 'peace', '🕊️': 'peace', '🍴': 'fork', '🍽️': 'fork', '⛵': 'sailboat',
  '🏋️': 'dumbbell', '🔋': 'battery', '🥕': 'carrot', '🥤': 'drink', '🥩': 'steak',
  '🐈': 'cat', '🐱': 'cat', '👕': 'tshirt', '🧢': 'cap', '🍎': 'apple', '🎭': 'laugh',
  // feature-identity icons
  '🐝': 'bee', '🦡': 'badger', '🍀': 'clover', '☘️': 'clover', '👻': 'ghost',
  '🐋': 'whale', '🐳': 'whale', '🐟': 'whale', '🐙': 'octopus', '🍕': 'pizza',
  '👔': 'tie', '🛋️': 'couch', '🧭': 'compass', '🌈': 'rainbow', '💥': 'burst',
  '💣': 'burst', '🌊': 'wave', '🏄': 'wave', '🎛️': 'sliders', '🎚️': 'sliders',
  '🚶': 'footsteps', '🏃': 'footsteps', '👟': 'footsteps', '💼': 'briefcase',
  '🔱': 'trident', '🧩': 'puzzle', '♟️': 'pawn', '♾️': 'infinity', '🚪': 'door',
  '🎁': 'gift', '💧': 'drop', '🧲': 'magnet', '🔓': 'unlock', '🖼️': 'image',
  '❄️': 'snowflake', '🐇': 'rabbit', '🐰': 'rabbit', '💊': 'pill',
  '🤝': 'handshake', '👉': 'arrow-right', '👈': 'arrow-left', '⭕': 'unlock',
  // tail coverage -> existing icons
  '🏗️': 'bricks', '🏟️': 'landmark', '🏰': 'landmark', '🏢': 'landmark',
  '📘': 'book', '📗': 'book', '📙': 'book', '📓': 'book',
  '🌿': 'sprout', '🌴': 'tree', '🌞': 'sun', '🌅': 'sun', '🌤️': 'sun', '🌕': 'moon',
  '📬': 'mail', '📫': 'mail', '📮': 'mail', '📥': 'mail', '🏁': 'flag', '🏴': 'flag',
  '🏪': 'cart', '🏬': 'cart', '🛍️': 'cart', '📻': 'radio', '🛰️': 'radio',
  '🥈': 'medal', '🥉': 'medal', '💫': 'sparkles', '🆕': 'sparkles', '🌌': 'sparkles',
  '🏎️': 'rocket', '🛸': 'rocket', '📵': 'ban', '🔈': 'volume', '🔉': 'volume',
  '🔘': 'target', '🔬': 'search', '🔭': 'search', '🪖': 'shield', '🍺': 'drink',
  '☕': 'drink', '🏜️': 'mountain', '🎽': 'tshirt', '🧥': 'tshirt', '👗': 'tshirt',
  '🟧': 'dot-orange', '🕰️': 'clock', '📯': 'megaphone', '📀': 'disc', '🔁': 'refresh',
  '💱': 'refresh', '☆': 'star', '★': 'star', '🧮': 'chart', '🃏': 'dice',
  '🎱': 'dice', '👾': 'gamepad', '🕶️': 'spy', '💠': 'gem', '🆘': 'siren',
  '♫': 'music', '♪': 'music', '🥊': 'swords', '🗡️': 'swords', '✗': 'x',
  '📐': 'pencil', '🍊': 'apple', '🗳️': 'clipboard', '🐂': 'trend-up', '🐻': 'trend-down',
  '🪫': 'battery', '🔌': 'battery',
};

const VS = '️';

// Expand variation-selector forms: every key should match with and without
// U+FE0F so both '⚠' and '⚠️' resolve (longest-first regex picks the right one).
function expandMap(map) {
  const out = {};
  for (const [k, v] of Object.entries(map)) {
    out[k] = v;
    if (k.includes(VS)) {
      const bare = k.split(VS).join('');
      if (!(bare in map)) out[bare] = v;
    } else if ([...k].length === 1) {
      const vsForm = k + VS;
      if (!(vsForm in map)) out[vsForm] = v;
    }
  }
  return out;
}

function main() {
  const expanded = expandMap(MAP);
  const names = [...new Set(Object.values(expanded))].sort();

  const icons = {};
  const missing = [];
  for (const name of names) {
    const file = path.join(ICON_DIR, `${name}.svg`);
    if (!fs.existsSync(file)) { missing.push(name); continue; }
    let svg = fs.readFileSync(file, 'utf8').trim().replace(/\s+/g, ' ');
    svg = svg.replace('<svg ', '<svg aria-hidden="true" focusable="false" ');
    icons[name] = svg;
  }
  if (missing.length) {
    console.error('Missing icon files for:', missing.join(', '));
    process.exit(1);
  }

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  const out = template
    .replace('__ICONS__', JSON.stringify(icons))
    .replace('__MAP__', JSON.stringify(expanded));
  fs.writeFileSync(OUT, out);

  const kb = (Buffer.byteLength(out) / 1024).toFixed(1);
  console.log(`icon-system.js: ${names.length} icons, ${Object.keys(expanded).length} emoji forms, ${kb} KB`);
}

main();
