'use strict';

// Paragraph sections for private Nacho. The page already numbers content
// paragraphs and fingerprints them. This module groups those paragraphs under
// the bold headings in the notes. The callable trusts only this index.

const SECTION_TEXT_MAX = 900;

function decodeEntities(text) {
    return String(text || '')
        .replace(/&nbsp;/gi, ' ')
        .replace(/&amp;/gi, '&')
        .replace(/&lt;/gi, '<')
        .replace(/&gt;/gi, '>')
        .replace(/&quot;/gi, '"')
        .replace(/&#39;|&apos;/gi, "'");
}

function stripTags(html) {
    return decodeEntities(String(html || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function squash(text) {
    return String(text || '').replace(/\s+/g, ' ').trim();
}

function extractHeadings(msgs) {
    const headings = [];
    (Array.isArray(msgs) ? msgs : []).forEach(function(msg) {
        const raw = String(msg && msg.text || '');
        const re = /<b\b[^>]*>([\s\S]*?)<\/b>/gi;
        let match;
        while ((match = re.exec(raw))) {
            const heading = squash(stripTags(match[1])).toLowerCase();
            if (heading) headings.push(heading);
        }
    });
    return headings;
}

function buildTopicIndex(paragraphs, headings, fingerprint) {
    const sections = [];
    const rows = [];
    let si = -1;
    let hi = 0;
    (Array.isArray(paragraphs) ? paragraphs : []).forEach(function(text) {
        const plain = squash(text);
        const key = plain.toLowerCase();
        const hash = fingerprint(plain);
        if (hi < headings.length && key === headings[hi]) {
            sections.push({ id: 's' + sections.length, heading: plain.slice(0, 80), text: '' });
            si = sections.length - 1;
            hi += 1;
            rows.push({ hash: hash, section: si });
            return;
        }
        if (si < 0) {
            sections.push({ id: 's0', heading: '', text: '' });
            si = 0;
        }
        const section = sections[si];
        if (plain) {
            const next = section.text ? (section.text + ' ' + plain) : plain;
            section.text = next.slice(0, SECTION_TEXT_MAX);
        }
        rows.push({ hash: hash, section: si });
    });
    if (!sections.length) sections.push({ id: 's0', heading: '', text: '' });
    sections.forEach(function(section) {
        if (!section.text && section.heading) section.text = section.heading.slice(0, SECTION_TEXT_MAX);
    });
    return { sections: sections, paragraphs: rows };
}

module.exports = {
    SECTION_TEXT_MAX: SECTION_TEXT_MAX,
    extractHeadings: extractHeadings,
    buildTopicIndex: buildTopicIndex,
};
