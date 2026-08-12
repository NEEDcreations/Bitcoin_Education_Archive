#!/usr/bin/env node
/* restyle.mjs — mechanical normalisation onto the design tokens.
 *
 * Handles only the unambiguous substitutions: raw hex literals from the old
 * Tailwind palette, off-scale radii, and above-ceiling font weights. Anything
 * needing judgement (gradients, layout, semantics) is left for a human.
 *
 *   node scripts/restyle.mjs --check  index.html      # report only
 *   node scripts/restyle.mjs         index.html ...   # rewrite in place
 */
import { readFileSync, writeFileSync } from 'node:fs';

const COLORS = {
    // oranges — the app had two competing accents
    '#f7931a': 'var(--orange)', '#f97316': 'var(--orange)',
    '#ea580c': 'var(--orange-hi)', '#e8720c': 'var(--orange-hi)',
    '#fb923c': 'var(--orange-hi)', '#d97706': 'var(--fg-3)',
    '#fc4c02': 'var(--orange)',
    // slate ramp → warm ink ramp
    '#020617': 'var(--ink-950)', '#0f172a': 'var(--ink-925)',
    '#0f1729': 'var(--ink-925)', '#1e293b': 'var(--line)',
    '#334155': 'var(--line-strong)', '#1a1a2e': 'var(--ink-900)',
    '#1a1a1a': 'var(--ink-900)', '#0a0a0a': 'var(--ink-950)',
    '#f8fafc': 'var(--ink-950)', '#f1f5f9': 'var(--ink-925)',
    '#e2e8f0': 'var(--fg)', '#e2e8f0': 'var(--fg)',
    '#94a3b8': 'var(--fg-2)', '#64748b': 'var(--fg-3)',
    '#475569': 'var(--fg-4)', '#52525b': 'var(--fg-4)',
    // semantics → desaturated
    '#22c55e': 'var(--pos)', '#16a34a': 'var(--pos)', '#4ade80': 'var(--pos)',
    '#ef4444': 'var(--neg)', '#dc2626': 'var(--neg)', '#f87171': 'var(--neg)',
    '#eab308': 'var(--warn)', '#f59e0b': 'var(--warn)', '#fbbf24': 'var(--warn)',
    // decorative indigo/violet/blue — no semantic role, collapse to neutral
    '#6366f1': 'var(--fg-2)', '#818cf8': 'var(--fg-2)',
    '#8b5cf6': 'var(--fg-2)', '#a855f7': 'var(--fg-2)',
    '#a78bfa': 'var(--fg-2)', '#7c3aed': 'var(--fg-3)',
    '#6d28d9': 'var(--fg-3)', '#6b21a8': 'var(--fg-3)',
    '#e9d5ff': 'var(--fg-2)',
    '#3b82f6': 'var(--info)', '#2563eb': 'var(--info)',
    '#38bdf8': 'var(--orange)', '#1d9bf0': 'var(--info)',
};

const RADIUS = {
    '2px': 'var(--r-sm)', '3px': 'var(--r-sm)', '4px': 'var(--r-sm)',
    '5px': 'var(--r-sm)', '6px': 'var(--r-sm)', '8px': 'var(--r-sm)',
    '10px': 'var(--r-md)', '12px': 'var(--r-md)', '14px': 'var(--r-md)',
    '16px': 'var(--r-md)', '18px': 'var(--r-md)', '20px': 'var(--r-md)',
    '22px': 'var(--r-md)', '24px': 'var(--r-md)', '28px': 'var(--r-md)',
    '30px': 'var(--r-full)', '999px': 'var(--r-full)', '9999px': 'var(--r-full)',
};

const check = process.argv.includes('--check');
const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!files.length) { console.error('usage: restyle.mjs [--check] <file>...'); process.exit(2); }

let grand = 0;
for (const file of files) {
    let src = readFileSync(file, 'utf8');
    const before = src;
    const tally = {};
    const bump = (k, n = 1) => { tally[k] = (tally[k] || 0) + n; };

    // Colours. Case-insensitive, 6-digit only, and never inside a url(#...)
    // or an href="#..." fragment.
    for (const [hex, tok] of Object.entries(COLORS)) {
        const re = new RegExp(hex.replace('#', '#(?![0-9a-fA-F]{7})'), 'gi');
        src = src.replace(re, (m, off, whole) => {
            const pre = whole.slice(Math.max(0, off - 6), off);
            if (/(url\(|href="|href='|xlink:href=")$/.test(pre)) return m;
            bump(`color ${hex}`); return tok;
        });
    }

    // Single-value border-radius only — multi-value shorthands are deliberate.
    src = src.replace(/border-radius:\s*(\d+px)(?=\s*[;'"}])/gi, (m, v) => {
        const tok = RADIUS[v.toLowerCase()];
        if (!tok) return m;
        bump(`radius ${v}`); return `border-radius:${tok}`;
    });

    // Weight ceiling is 600.
    src = src.replace(/font-weight:\s*(700|800|900)(?=\s*[;'"}])/gi, (m, v) => {
        bump(`weight ${v}`); return 'font-weight:var(--w-semi)';
    });

    const total = Object.values(tally).reduce((a, b) => a + b, 0);
    grand += total;
    console.log(`\n${file}: ${total} substitution${total === 1 ? '' : 's'}`);
    Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 14)
        .forEach(([k, n]) => console.log(`   ${String(n).padStart(4)}  ${k}`));
    const rest = Object.keys(tally).length - 14;
    if (rest > 0) console.log(`   … and ${rest} more kinds`);

    if (!check && src !== before) writeFileSync(file, src);
}
console.log(`\n${check ? '[check] ' : ''}${grand} total`);
