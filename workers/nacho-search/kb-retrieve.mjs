// Lexical retrieval over the vetted Nacho knowledge base.
// No paid search service. Exact normalized matches win, then BM25 with synonyms.
import { KB } from "./kb-data.mjs";
import { contentTokens, foldKey } from "./kb-text.mjs";

const K1 = 1.2;
const B = 0.75;

export const CRYPTO_RE = /\b(altcoins?|cryptocurrenc(?:y|ies)|ethereum|\beth\b|solana|\bsol\b|\bxrp\b|ripple|dogecoin|\bdoge\b|cardano|\bada\b|memecoins?|\bnfts?\b|\bdefi\b|binance|\bbnb\b|polkadot|avalanche|\bavax\b|chainlink|litecoin|\bltc\b|bitcoin cash|\bbch\b|shiba|\bpepe\b|\btron\b|monero|\bxmr\b|tether|\busdt\b|\busdc\b|stablecoins?|airdrops?|uniswap|aave|yield farming|which alt|which coin|which crypto|memecoin|token presale|\bicos?\b|wrapped bitcoin|\bwbtc\b|hedera|\bhbar\b|stellar|\bxlm\b|algorand|filecoin|cosmos|\batom\b|\bton\b|\bsui\b|aptos|\bnear\b|bitcoin sv|\bbsv\b)\b/i;

const BY_ID = new Map();
const EXACT = new Map();
const DOCS = [];
const DF = new Map();
let AVG = 1;
let READY = false;

function rememberExact(key, id) {
    if (!key) return;
    const prev = EXACT.get(key);
    if (prev && prev !== id) return;
    EXACT.set(key, id);
}

function buildIndex() {
    if (READY) return;
    KB.forEach(function (entry) {
        BY_ID.set(entry.id, entry);
        rememberExact(foldKey(entry.question), entry.id);
        (entry.alts || []).forEach(function (alt) { rememberExact(foldKey(alt), entry.id); });
        const tokens = contentTokens([entry.question].concat(entry.alts || []).join(" "));
        const tf = new Map();
        tokens.forEach(function (token) { tf.set(token, (tf.get(token) || 0) + 1); });
        DOCS.push({ entry: entry, tokens: tokens, tf: tf, qTokens: contentTokens(entry.question), altTokens: (entry.alts || []).map(contentTokens) });
        tf.forEach(function (_n, token) { DF.set(token, (DF.get(token) || 0) + 1); });
    });
    let total = 0;
    DOCS.forEach(function (doc) { total += doc.tokens.length || 1; });
    AVG = DOCS.length ? total / DOCS.length : 1;
    READY = true;
}

function idf(df) {
    const n = DOCS.length || 1;
    return Math.log(1 + (n - df + 0.5) / (df + 0.5));
}

function f1(queryTokens, docTokens) {
    if (!queryTokens.length || !docTokens.length) return 0;
    const have = new Set(docTokens);
    let hit = 0;
    queryTokens.forEach(function (token) { if (have.has(token)) hit += 1; });
    if (!hit) return 0;
    const precision = hit / new Set(docTokens).size;
    const recall = hit / new Set(queryTokens).size;
    return (2 * precision * recall) / (precision + recall);
}

function scoreDoc(queryTokens, doc) {
    let score = 0;
    const dl = doc.tokens.length || 1;
    queryTokens.forEach(function (token) {
        const tf = doc.tf.get(token) || 0;
        if (!tf) return;
        const weight = idf(DF.get(token) || 0);
        score += weight * ((tf * (K1 + 1)) / (tf + K1 * (1 - B + B * dl / AVG)));
    });
    return score;
}

function bestF1(queryTokens, doc) {
    let best = f1(queryTokens, doc.qTokens);
    doc.altTokens.forEach(function (tokens) {
        const next = f1(queryTokens, tokens);
        if (next > best) best = next;
    });
    return best;
}

export function isAltcoinQuestion(question) {
    const text = String(question || "");
    if (CRYPTO_RE.test(text)) return true;
    if (/\bcrypto\b/i.test(text) && !/\b(bitcoin|btc)\b/i.test(text)) return true;
    return false;
}

export function getKbEntry(id) {
    buildIndex();
    return BY_ID.get(id) || null;
}

export function kbEntries() {
    buildIndex();
    return KB;
}

export function retrieve(question) {
    buildIndex();
    const exactId = EXACT.get(foldKey(question));
    const queryTokens = contentTokens(question);
    const ranked = DOCS.map(function (doc) {
        return { entry: doc.entry, score: scoreDoc(queryTokens, doc), f1: bestF1(queryTokens, doc) };
    });
    ranked.sort(function (a, b) { return b.score - a.score || b.f1 - a.f1; });
    const top = ranked[0] || null;
    const second = ranked.find(function (row) { return top && row.entry.id !== top.entry.id; }) || null;
    const exact = exactId ? BY_ID.get(exactId) : null;
    let direct = exact || null;
    let mode = exact ? "exact" : "none";
    if (!direct && top && top.f1 >= 0.86 && top.score > 0) {
        direct = top.entry;
        mode = "fuzzy";
    } else if (!direct && top && second && top.f1 >= 0.75 && top.score >= second.score * 1.45 && top.score >= 1.5) {
        direct = top.entry;
        mode = "fuzzy";
    }
    const steerRows = ranked.filter(function (row) { return row.entry.category === "crypto-steer" && (row.score > 0 || row.f1 >= 0.34); }).slice(0, 3);
    const grounding = [];
    ranked.forEach(function (row) {
        if (grounding.length >= 5) return;
        if (row.score <= 0 && row.f1 < 0.34) return;
        grounding.push(row.entry);
    });
    return {
        direct: direct,
        mode: mode,
        confidence: exact ? 1 : (top ? top.f1 : 0),
        score: top ? top.score : 0,
        grounding: direct ? [] : grounding.slice(0, 5),
        bestSteer: steerRows.length ? steerRows[0].entry : null,
        altcoin: isAltcoinQuestion(question)
    };
}

export const GENERIC_STEER_ID = "crypto-steer-generic";
