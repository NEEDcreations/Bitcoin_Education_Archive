// Lexical retrieval over the vetted Nacho knowledge base.
// The BM25 postings, idf weights, and exact-phrase map are built by build-kb.js
// so the first request does not tokenize the corpus.
import { KB } from "./kb-data.mjs";
import { INDEX } from "./kb-index.mjs";
import { contentTokens, foldKey } from "./kb-text.mjs";

const K1 = 1.2;
const B = 0.75;

// Unambiguous coin and crypto names. Ordinary English words (near, ton, atom,
// sol, ada, cosmos, stellar, ico) are not in this pattern.
export const CRYPTO_RE = /\b(altcoins?|cryptocurrenc(?:y|ies)|ethereum|solana|\bxrp\b|dogecoin|cardano|memecoins?|\bnfts?\b|\bdefi\b|binance|\bbnb\b|polkadot|avalanche|\bavax\b|chainlink|litecoin|bitcoin cash|\bbch\b|shiba|\bpepe\b|\btron\b|monero|\bxmr\b|tether|\busdt\b|\busdc\b|stablecoins?|airdrops?|uniswap|aave|yield farming|which alt|which coin|which crypto|memecoin|token presale|wrapped bitcoin|\bwbtc\b|hedera|\bhbar\b|\bxlm\b|algorand|filecoin|\bsui\b|aptos|bitcoin sv|\bbsv\b)\b/i;

const AMBIGUOUS_RE = /\b(near|atom|sol|ada|cosmos|stellar|ton|icos?|ripple)\b/i;
const CONTEXT_RE = /\b(protocol|coin|token|price)\b/i;

const TOKEN_ID = new Map();
INDEX.vocab.forEach(function (word, index) { TOKEN_ID.set(word, index); });

const BY_ID = new Map();
KB.forEach(function (entry) { BY_ID.set(entry.id, entry); });

const DOCS = INDEX.docs;

export function isAltcoinQuestion(question) {
    const text = String(question || "");
    if (/\bmining\b/i.test(text) && !CRYPTO_RE.test(text)) return false;
    if (CRYPTO_RE.test(text)) return true;
    if (AMBIGUOUS_RE.test(text) && CONTEXT_RE.test(text)) return true;
    if (/\bcrypto\b/i.test(text) && !/\b(bitcoin|btc|mining)\b/i.test(text)) return true;
    return false;
}

export function getKbEntry(id) {
    return BY_ID.get(id) || null;
}

export function kbEntries() {
    return KB;
}

function f1(queryIds, docIds) {
    if (!queryIds.length || !docIds || !docIds.length) return 0;
    const have = new Set(docIds);
    const seen = new Set();
    let hit = 0;
    for (let i = 0; i < queryIds.length; i++) {
        const id = queryIds[i];
        if (seen.has(id)) continue;
        seen.add(id);
        if (have.has(id)) hit += 1;
    }
    if (!hit) return 0;
    const precision = hit / new Set(docIds).size;
    const recall = hit / seen.size;
    return (2 * precision * recall) / (precision + recall);
}

function bestF1(queryIds, doc) {
    let best = f1(queryIds, doc.q);
    const alts = doc.alts || [];
    for (let i = 0; i < alts.length; i++) {
        const next = f1(queryIds, alts[i]);
        if (next > best) best = next;
    }
    return best;
}

function covers(queryIds, doc) {
    if (!queryIds.length) return false;
    const have = new Set(doc.q || []);
    const alts = doc.alts || [];
    for (let i = 0; i < alts.length; i++) {
        const row = alts[i];
        for (let j = 0; j < row.length; j++) have.add(row[j]);
    }
    for (let i = 0; i < queryIds.length; i++) {
        if (!have.has(queryIds[i])) return false;
    }
    return true;
}

export function retrieve(question) {
    const key = foldKey(question);
    const exact = key ? BY_ID.get(INDEX.exact[key]) || null : null;
    const queryTokens = contentTokens(question);
    const queryIds = queryTokens.map(function (token) {
        return TOKEN_ID.has(token) ? TOKEN_ID.get(token) : -1;
    });
    const scores = new Map();
    const avg = INDEX.avgdl || 1;
    queryIds.forEach(function (tid) {
        if (tid < 0) return;
        const weight = INDEX.idf[tid] || 0;
        const posts = INDEX.postings[tid] || [];
        for (let i = 0; i < posts.length; i++) {
            const di = posts[i][0];
            const tf = posts[i][1];
            const dl = (DOCS[di] && DOCS[di].len) || 1;
            const add = weight * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * dl / avg)));
            scores.set(di, (scores.get(di) || 0) + add);
        }
    });
    const ranked = [];
    scores.forEach(function (score, di) {
        if (score > 0) ranked.push({ di: di, score: score });
    });
    ranked.sort(function (a, b) { return b.score - a.score; });
    const top = ranked[0] || null;
    const second = ranked[1] || null;
    const topDoc = top ? DOCS[top.di] : null;
    const topF1 = topDoc ? bestF1(queryIds, topDoc) : 0;
    const topCovered = topDoc ? covers(queryIds, topDoc) : false;
    let direct = exact;
    let mode = exact ? "exact" : "none";
    if (!direct && top && topCovered && topF1 >= 0.86 && top.score > 0) {
        direct = BY_ID.get(topDoc.id) || null;
        mode = direct ? "fuzzy" : "none";
    } else if (!direct && top && second && topCovered && topF1 >= 0.75 && top.score >= second.score * 1.45 && top.score >= 1.5) {
        direct = BY_ID.get(topDoc.id) || null;
        mode = direct ? "fuzzy" : "none";
    }
    const altcoin = isAltcoinQuestion(question);
    if (direct && direct.category === "crypto-steer" && mode !== "exact" && !altcoin) {
        direct = null;
        mode = "none";
    }
    let bestSteer = null;
    let bestSteerScore = 0;
    if (altcoin) {
        for (let i = 0; i < ranked.length; i++) {
            const entry = BY_ID.get(DOCS[ranked[i].di].id);
            if (entry && entry.category === "crypto-steer" && ranked[i].score > bestSteerScore) {
                bestSteer = entry;
                bestSteerScore = ranked[i].score;
            }
        }
    }
    const grounding = [];
    for (let i = 0; i < ranked.length && grounding.length < 5; i++) {
        const entry = BY_ID.get(DOCS[ranked[i].di].id);
        if (!entry) continue;
        if (!altcoin && entry.category === "crypto-steer") continue;
        grounding.push(entry);
    }
    if (/\bcrypto mining\b/i.test(question) && !CRYPTO_RE.test(question)) {
        const mining = BY_ID.get("mining-how-it-works");
        if (mining) {
            direct = mining;
            mode = "exact";
        }
    }
    return {
        direct: direct,
        mode: mode,
        confidence: exact ? 1 : topF1,
        score: top ? top.score : 0,
        grounding: direct ? [] : grounding.slice(0, 5),
        bestSteer: bestSteer,
        altcoin: altcoin && !(direct && direct.category !== "crypto-steer")
    };
}

export const GENERIC_STEER_ID = "crypto-steer-generic";
