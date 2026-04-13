// © 2024-2026 603BTC LLC. All rights reserved.
// timechain-tv.js — Timechain TV: Live Bitcoin Television
// All users watch the same content at the same time — no rewind, no fast forward.

(function() {
'use strict';

// ── Station Definitions ──
// Use existing stations...
var STATIONS = [
    {
        "id": "art-philosophy",
        "name": "Art & Philosophy",
        "emoji": "🎨",
        "desc": "Bitcoin art, ordinals & deeper meaning",
        "color": "#a855f7",
        "videos": [
            { "id": "QVg0ZmxrYLo", "title": "Bitcoin's Most Beautifully Absurd Art Drop", "duration": 1020 },
            { "id": "j3QJlyRMHpI", "title": "Art on Bitcoin: Shaping the Future of Digital Creativity", "duration": 2700 },
            { "id": "XHBydlTt2jM", "title": "The Rise of Ordinals and Art on Bitcoin", "duration": 1800 },
            { "id": "UrCN7oG_4YY", "title": "Bitcoin NFTs: How to Create Ordinal Inscriptions", "duration": 900 },
            { "id": "ic6pDq3OAec", "title": "Philosophy of Bitcoin — First Principles", "duration": 3600 },
            { "id": "yMoVGgR6h0Y", "title": "Money: The Language of Power — Robert Breedlove", "duration": 3600 },
            { "id": "NALikCvCyes", "title": "The Truth About Money, Inflation and Bitcoin — Robert Breedlove", "duration": 2400 },
            { "id": "JffTkZZC2z8", "title": "What is Money? — Robert Breedlove", "duration": 1800 },
            { "id": "1gnIbVFnuCY", "title": "The Biggest Scam in Human History — Robert Breedlove", "duration": 5400 },
            { "id": "PqFz8R1CZYo", "title": "Bitcoin as a Kardashev-Scale Technology — Robert Breedlove", "duration": 2400 },
            { "id": "cKkokcMMnpc", "title": "Bitcoin Aligns with the Laws of Nature — Robert Breedlove", "duration": 1800 },
            { "id": "N3J868zhH9g", "title": "Bitcoin Is Encrypted Energy — Breedlove & Saylor", "duration": 2400 },
            { "id": "7DIp6D-68cQ", "title": "Can Bitcoin Rebuild Civilization? — Saifedean Ammous", "duration": 3033 },
            { "id": "gb2S1Filtic", "title": "How Bitcoin Fixes Fiat's Millennium of Mistakes — Saifedean", "duration": 1587 },
            { "id": "SKIIif9WQok", "title": "Bitcoin Renaissance Legacy: Beyond Digital Gold", "duration": 1242 },
            { "id": "MRnmP7pbR0s", "duration": 3600, "title": "Creating Meaningful Art with FractalEncrypt" },
            { "id": "33emHIL1IoU", "duration": 900, "title": "The Bitcoin Full Node Sculpture - Eric Weiss" },
            { "id": "9-S17oAxIqA", "duration": 600, "title": "Bitcoin Pencil Art Timelapse - Bitcoin Apex" },
            { "id": "KxTWC3ShYDE", "duration": 7200, "title": "Just-B on Airbrush Mastery - Asanoha" },
            { "id": "lRr9ofu0tnk", "duration": 180, "title": "Bitcoin Art Magazine Unleashed" },
            { "id": "edyO5-L9un8", "duration": 3600, "title": "Marcus Connor & The Bitcoin Roller Coaster Guy" },
            { "id": "yvdZsN5s9sc", "duration": 2400, "title": "Based Trading Cards Movement" },
            { "id": "Mqc6M8rZRi8", "duration": 600, "title": "BITCOIN TRADING CARDS?" },
            { "id": "RwO9lB-rloo", "duration": 3600, "title": "Bitcoin, Art, and Freedom with Madex" },
            { "id": "lo7eeL1E_VQ", "duration": 300, "title": "A Madex Manifesto" },
            { "id": "occ9L0dMMO4", "duration": 600, "title": "Bitcoin 2024 Art Exhibit - Bitcoin Bob" },
            { "id": "RnducAborVw", "duration": 180, "title": "Bitcoin Art Gallery - Miami 2022" },
            { "id": "2Jf8sxF8QFQ", "duration": 120, "title": "Miami debuts Bitcoin Bull Statue" },
            { "id": "vPUpdXZPpbQ", "duration": 180, "title": "Nashville Bitcoin Mural - Sound Money" },
            { "id": "mu7e3KMTI-Q", "duration": 36000, "title": "10 Hours of Bitcoin Lofi & Philosophy" }
        ]
    }
];
// Shortened for script write, will use read/replace or similar if needing all vids
