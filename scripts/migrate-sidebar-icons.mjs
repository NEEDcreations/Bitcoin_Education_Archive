#!/usr/bin/env node
/* migrate-sidebar-icons.mjs
 *
 * The 147 sidebar nav buttons are static markup in index.html, each labelled
 * with a leading emoji:
 *
 *   <button class="ch-btn" onclick="go('whitepaper',this)">📄 whitepaper</button>
 *
 * Static HTML cannot call icon(), so the SVG is inlined here at build time
 * using the icon each channel was assigned in channel_index.js. Emitted as
 * <span class="ch-ico"> so the sidebar rules can colour it via currentColor.
 *
 *   node scripts/migrate-sidebar-icons.mjs --check
 *   node scripts/migrate-sidebar-icons.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const check = process.argv.includes('--check');

// Load ICON_PATHS and the channel table without a module system.
const iconSrc = readFileSync('styles/icons.js', 'utf8');
const box = {};
new Function('box', iconSrc + ';box.ICON_PATHS=ICON_PATHS;box.strip=stripLeadingEmoji;')(box);
const { ICON_PATHS, strip } = box;

const chanSrc = readFileSync('channel_index.js', 'utf8');
const CHANNELS = JSON.parse(chanSrc.slice(chanSrc.indexOf('{'), chanSrc.lastIndexOf('}') + 1));

const svg = (name) => {
    const p = ICON_PATHS[name] || ICON_PATHS.book;
    return '<svg class="icon icon-16 ch-ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + p + '</svg>';
};

let html = readFileSync('index.html', 'utf8');
let done = 0, missing = [], noIcon = 0;

// <button class="ch-btn" ... onclick="go('KEY'...)">LABEL</button>
html = html.replace(
    /(<button class="ch-btn"[^>]*onclick="go\((?:&#39;|')([a-z0-9_-]+)(?:&#39;|')[^"]*"[^>]*>)([\s\S]*?)(<\/button>)/gi,
    (m, openTag, key, label, closeTag) => {
        // Re-runnable: an already-migrated button has its icon replaced rather
        // than being skipped, so a change to the icon mapping propagates.
        const meta = CHANNELS[key];
        if (!meta) { missing.push(key); }
        const name = (meta && meta.icon) || 'book';
        if (!meta || !meta.icon) noIcon++;
        // Recover the plain label whether this is a first pass (emoji + text)
        // or a re-run (svg + <span class="ch-label">text</span>).
        const inner = /<span class="ch-label">([\s\S]*?)<\/span>/.exec(label);
        const clean = strip(inner ? inner[1] : label.replace(/<svg[\s\S]*?<\/svg>/g, '')).trim();
        done++;
        return openTag + svg(name) + '<span class="ch-label">' + clean + '</span>' + closeTag;
    }
);

console.log(`buttons rewritten:      ${done}`);
console.log(`keys not in CHANNELS:   ${missing.length}${missing.length ? ' → ' + missing.join(', ') : ''}`);
console.log(`fell back to 'book':    ${noIcon}`);

const leftover = (html.match(/class="ch-btn"[^>]*>(?!<svg)/g) || []).length;
console.log(`ch-btn without an icon: ${leftover}`);

if (!check) { writeFileSync('index.html', html); console.log('wrote index.html'); }
else console.log('[check] no files written');
