#!/usr/bin/env node
// Build workers/nacho-search/kb/*.json and kb-data.mjs from authored facts
// plus Bitcoin Quest features in features.registry.js.
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const root = path.join(__dirname, "../..");
const registry = require(path.join(root, "features.registry.js"));

const PRED = /\b(price target|will reach|going to be worth|guaranteed profit|you should buy|you should sell|will hit|predicted to|going to the moon|price will)\b/i;
const DOLLAR = /\$\s?\d/;
const BITCOIN_FOLLOWS = ["basics-what-is-bitcoin", "money-fixed-supply", "mining-proof-of-work", "nodes-full-node", "wallets-not-your-keys"];

function sentences(text) {
    return String(text || "").split(/(?<=[.!?])\s+/).map(function (part) { return part.trim(); }).filter(Boolean);
}

const APP_QUESTIONS = {
    "one-stop-shop": ["What is the One Stop Shop?", "How do I use the One Stop Shop?"],
    home: ["What is the Bitcoin Quest home page?", "How do I use the home page?"],
    channels: ["What are the education channels?", "How do I open an education channel?"],
    signin: ["How does sign-in work on Bitcoin Quest?", "Where do I sign in on Bitcoin Quest?"],
    "say-hi": ["What is the Say hi quest?", "How do I say hi to the community?"],
    "tctv-watch": ["What is the Timechain TV watch quest?", "How do I finish the Timechain TV watch quest?"],
    export: ["What is the export-my-data tool?", "How do I export my data from the app?"],
    donate: ["What is the donate page?", "How do I donate to the archive?"],
    referral: ["What is the invite-friends reward?", "How do I invite friends to Bitcoin Quest?"],
    sats: ["What is the claim-sats page?", "How do I claim sats in the app?"],
    xp: ["What are XP and points in Bitcoin Quest?", "How do XP and points work in the app?"],
    "first-purchase": ["What is the first-purchase lesson?", "How do I open the first-purchase lesson?"],
    audio: ["What are sound effects in Bitcoin Quest?", "How do I control sound effects?"],
    "double-xp": ["What is a Double XP charge?", "How does a Double XP charge work?"],
    "hash-booster": ["What is a hash booster?", "How does the hash booster differ from a second rig?"],
    "hint-token": ["What are hint tokens?", "How do I use a hint token?"],
    "streak-freeze": ["What is a streak freeze?", "How do I use a streak freeze?"],
    dms: ["What are direct messages?", "How do I open direct messages?"],
    ciphers: ["What are locked ciphers?", "How do I open a locked cipher?"],
    keys: ["What are cipher keys?", "How do I use a cipher key?"],
    partnership: ["What are partnership levels?", "How do partnership levels work?"],
    tickets: ["What are orange tickets used for?", "How do I earn orange tickets?"],
    badges: ["What do badges do in Bitcoin Quest?", "How do I earn a badge?"],
    pvp: ["What are PvP trivia battles?", "How do I start a PvP trivia battle?"],
    irl: ["What are IRL Sync meetups?", "How do I find an IRL Sync meetup?"],
    tips: ["What are Lightning tips?", "How do I send a Lightning tip?"],
    "qh-quiz": ["What is the daily quiz in Quest Hub?", "How do I take the daily quiz?"],
    "qh-trivia": ["What is the daily trivia?", "How do I play the daily trivia?"],
    "qh-poll": ["What is the daily poll?", "How do I answer the daily poll?"],
    signal: ["What is the Signal newsletter?", "How do I read the Signal newsletter?"],
    "quest-hub": ["What does the Quest Hub contain?", "How do I open the Quest Hub?"],
    "onboarding-intro": ["What is the welcome tour?", "How do I start the welcome tour?"],
    faq: ["What is the FAQ and guide?", "How do I open the FAQ?"],
    shortcuts: ["What are the keyboard shortcuts?", "How do I see the keyboard shortcuts?"],
    "ln-address": ["What is a Lightning address in the app?", "How do I set a Lightning address?"],
    predictions: ["What is the price prediction game?", "How do I play the price prediction game?"],
    "global-chat": ["What is Global Chat?", "How do I open Global Chat?"],
    marketplace: ["What is LightningMart?", "How do I use LightningMart?"],
    "lightning-wallet": ["What is the Lightning wallet page?", "How do I open the Lightning wallet page?"],
    shoutout: ["What is a Nacho shoutout?", "How do I get a Nacho shoutout?"],
    "gift-bag": ["What is a gift bag?", "How do I open a gift bag?"],
    raffle: ["What is the orange ticket raffle?", "How do I enter the orange ticket raffle?"],
    wheel: ["What is the daily spin wheel?", "How do I spin the daily wheel?"],
    "mini-nacho": ["What is the Mini Nacho bubble?", "How do I open the Mini Nacho bubble?"],
    random: ["What is the random meme button?", "How do I open a random meme?"],
    gifts: ["What is the gift feature?", "How do I send a gift?"],
    favor: ["What does Satoshi's Favor do in the app?", "How do I open Satoshi's Favor?"],
    nook: ["What is inside Nacho's Nook?", "How do I open Nacho's Nook?"],
    tv: ["Where is Timechain TV in the app?", "How do I open Timechain TV?"],
    buddy: ["What is Bitcoin Buddy?", "How do I find a Bitcoin buddy?"],
    faction: ["What is a faction on Bitcoin Quest?", "How do I choose a faction?"]
};

function featureName(title) {
    return String(title || "").replace(/^Brand new\?\s*/i, "").replace(/\?/g, "").replace(/\s+/g, " ").trim();
}

function fitQuestion(text) {
    let phrase = String(text || "").replace(/\s+/g, " ").trim();
    if (!phrase) return "";
    if (!phrase.endsWith("?")) phrase += "?";
    phrase = phrase.replace(/\?{2,}/g, "?");
    if (phrase.length < 8 || phrase.length > 90) return "";
    if ((phrase.match(/\?/g) || []).length !== 1) return "";
    if (/^(?:In simple words,|Help me understand:)/i.test(phrase)) return "";
    if (/, briefly\?$/i.test(phrase)) return "";
    return phrase;
}

function makeAlts(question) {
    const q = String(question || "").replace(/\?$/, "").trim();
    const lower = q.charAt(0).toLowerCase() + q.slice(1);
    const options = [];
    function add(text) {
        const phrase = fitQuestion(text);
        if (phrase) options.push(phrase);
    }
    if (/^What is /i.test(q)) {
        const rest = q.replace(/^What is /i, "");
        add("Define " + rest + "?");
        add("Explain " + rest + "?");
        add("Describe " + rest + "?");
    } else if (/^What are /i.test(q)) {
        const rest = q.replace(/^What are /i, "");
        add("Explain " + rest + "?");
        add("Describe " + rest + "?");
        add("Define " + rest + "?");
    } else if (/^What does /i.test(q)) {
        const rest = q.replace(/^What does /i, "");
        add("Explain what " + rest + "?");
        add("Clarify what " + rest + "?");
        add("Describe what " + rest + "?");
    } else if (/^How do I /i.test(q)) {
        const rest = q.replace(/^How do I /i, "");
        add("How can I " + rest + "?");
        add("Show me how to " + rest + "?");
        add("What is the way to " + rest + "?");
    } else if (/^How does /i.test(q)) {
        const rest = q.replace(/^How does /i, "");
        add("Explain how " + rest + "?");
        add("Describe how " + rest + "?");
        add("How can " + rest + "?");
    } else if (/^How do /i.test(q)) {
        const rest = q.replace(/^How do /i, "");
        add("Explain how " + rest + "?");
        add("Describe how " + rest + "?");
        add("In what way do " + rest + "?");
    } else if (/^Why /i.test(q)) {
        const rest = q.replace(/^Why /i, "");
        add("Explain why " + rest + "?");
        add("For what reason " + rest + "?");
        add("What is the reason " + rest + "?");
    } else if (/^When /i.test(q)) {
        const rest = q.replace(/^When /i, "");
        add("Explain when " + rest + "?");
        add("At what time " + rest + "?");
        add("Which date fits " + rest + "?");
    } else if (/^Who /i.test(q)) {
        const rest = q.replace(/^Who /i, "");
        add("Explain who " + rest + "?");
        add("Which person " + rest + "?");
        add("Name who " + rest + "?");
    } else if (/^(?:Is|Do|Does|Can|Are|Should) /i.test(q)) {
        add("Explain whether " + lower + "?");
        add("Clarify whether " + lower + "?");
        add("Is this the case: " + lower + "?");
    }
    add("Explain this: " + lower + "?");
    add("Clarify this: " + lower + "?");
    add("Unpack this: " + lower + "?");
    return options;
}

function appEntries(topicIds) {
    const out = [];
    registry.FEATURES.forEach(function (feature) {
        const name = featureName(feature.title || feature.id);
        const desc = String(feature.desc || "").trim().replace(/[.!?]$/, "") + ".";
        const how = String(feature.how || "").trim().replace(/[.!?]$/, "") + ".";
        const answer = desc + " " + how + " This describes a Bitcoin Quest feature, not financial advice.";
        const topic = topicIds.has(feature.id) ? feature.id : (feature.id === "pow-support" ? "proof-of-walk" : (feature.id === "audio" ? "faq" : "faq"));
        const second = topicIds.has("one-stop-shop") ? "one-stop-shop" : "faq";
        const custom = APP_QUESTIONS[feature.id];
        function push(suffix, question) {
            const phrase = fitQuestion(question);
            if (!phrase) return;
            out.push({
                id: "app-" + feature.id + "-" + suffix,
                category: "app",
                question: phrase,
                answer: answer,
                topics: topic === second ? [topic] : [topic, second],
                sources: "features.registry.js entry " + feature.id + "."
            });
        }
        const what = custom ? custom[0] : "What is " + name + " in Bitcoin Quest?";
        const howQ = custom ? custom[1] : "How do I use " + name + " in the app?";
        push("what", what);
        push("how", howQ);
    });
    return out;
}

function chooseAlts(question, foldKey, seenKey) {
    const chosen = [];
    const local = new Set();
    const own = foldKey(question);
    makeAlts(question).forEach(function (phrase) {
        if (chosen.length >= 3) return;
        const key = foldKey(phrase);
        if (!key || key === own || seenKey.has(key) || local.has(key)) return;
        local.add(key);
        chosen.push(phrase);
    });
    return chosen;
}

function buildIndex(entries, text) {
    const vocab = new Map();
    function tid(token) {
        let id = vocab.get(token);
        if (id == null) {
            id = vocab.size;
            vocab.set(token, id);
        }
        return id;
    }
    const df = new Map();
    const packed = [];
    const exact = {};
    let total = 0;
    entries.forEach(function (entry) {
        const qTokens = text.contentTokens(entry.question);
        const altTokens = (entry.alts || []).map(function (alt) { return text.contentTokens(alt); });
        const tf = new Map();
        qTokens.forEach(function (token) { tf.set(token, (tf.get(token) || 0) + 1); });
        altTokens.forEach(function (row) {
            row.forEach(function (token) { tf.set(token, (tf.get(token) || 0) + 1); });
        });
        const len = qTokens.length + altTokens.reduce(function (sum, row) { return sum + row.length; }, 0);
        total += len || 1;
        tf.forEach(function (_count, token) { df.set(token, (df.get(token) || 0) + 1); });
        packed.push({
            id: entry.id,
            len: len || 1,
            q: qTokens.slice(),
            alts: altTokens,
            tf: tf
        });
        [entry.question].concat(entry.alts || []).forEach(function (phrase) {
            const key = text.foldKey(phrase);
            if (key && !exact[key]) exact[key] = entry.id;
        });
    });
    const n = packed.length;
    const words = [];
    packed.forEach(function (doc) {
        doc.q = doc.q.map(tid);
        doc.alts = doc.alts.map(function (row) { return row.map(tid); });
    });
    vocab.forEach(function (_id, token) { words[_id] = token; });
    const idf = words.map(function (token) {
        const dfi = df.get(token) || 0;
        return Math.log(1 + (n - dfi + 0.5) / (dfi + 0.5));
    });
    const postings = words.map(function () { return []; });
    packed.forEach(function (doc, di) {
        doc.tf.forEach(function (count, token) {
            postings[vocab.get(token)].push([di, count]);
        });
    });
    return {
        avgdl: n ? total / n : 1,
        n: n,
        vocab: words,
        idf: idf,
        postings: postings,
        docs: packed.map(function (doc) {
            return { id: doc.id, len: doc.len, q: doc.q, alts: doc.alts };
        }),
        exact: exact
    };
}

async function main() {
    const text = await import(pathToFileURL(path.join(__dirname, "kb-text.mjs")).href);
    const foldKey = text.foldKey;
    const src = await import(pathToFileURL(path.join(__dirname, "kb-src/all.mjs")).href);
    const topicMod = await import(pathToFileURL(path.join(__dirname, "topics-data.mjs")).href);
    const topicIds = new Set(topicMod.TOPICS.map(function (topic) { return topic.id; }));
    const entries = src.FACTS.concat(appEntries(topicIds));
    const seenId = new Set();
    const seenKey = new Set();
    const errors = [];
    entries.forEach(function (entry) {
        const ownKey = foldKey(entry.question);
        const merged = [];
        const local = new Set();
        function addAlt(phrase) {
            if (merged.length >= 6) return;
            const fitted = fitQuestion(phrase);
            if (!fitted) return;
            const key = foldKey(fitted);
            if (!key || key === ownKey || seenKey.has(key) || local.has(key)) return;
            local.add(key);
            merged.push(fitted);
        }
        (entry.alts || []).forEach(addAlt);
        chooseAlts(entry.question, foldKey, seenKey).forEach(addAlt);
        entry.alts = merged;
        if (!/^[a-z0-9-]{3,80}$/.test(entry.id)) errors.push("bad id " + entry.id);
        if (seenId.has(entry.id)) errors.push("dup id " + entry.id);
        seenId.add(entry.id);
        if (!entry.question || entry.question.length > 90 || !entry.question.endsWith("?") || (entry.question.match(/\?/g) || []).length !== 1) errors.push("bad question " + entry.id + " " + entry.question);
        const keys = [entry.question].concat(entry.alts);
        keys.forEach(function (phrase) {
            const key = foldKey(phrase);
            if (!key) errors.push("empty phrase " + entry.id);
            if (/^(?:In simple words,|Help me understand:)/i.test(phrase) || /, briefly\?$/i.test(phrase)) errors.push("template " + entry.id + " :: " + phrase);
            if (seenKey.has(key)) errors.push("dup phrase " + entry.id + " :: " + phrase);
            seenKey.add(key);
        });
        const count = sentences(entry.answer);
        if (count < 2 || count > 5) errors.push("sentences " + count + " " + entry.id);
        if (PRED.test(entry.answer) || DOLLAR.test(entry.answer)) errors.push("prediction " + entry.id);
        if (!entry.sources) errors.push("sources " + entry.id);
        if (!entry.category) errors.push("category " + entry.id);
        (entry.topics || []).forEach(function (id) {
            if (!topicIds.has(id)) errors.push("topic " + id + " in " + entry.id);
        });
        if (!entry.topics || entry.topics.length < 1 || entry.topics.length > 3) errors.push("topic count " + entry.id);
    });
    const byCat = new Map();
    entries.forEach(function (entry) {
        if (!byCat.has(entry.category)) byCat.set(entry.category, []);
        byCat.get(entry.category).push(entry);
    });
    byCat.forEach(function (list, category) {
        list.forEach(function (entry, index) {
            if (category === "crypto-steer") {
                entry.followUps = BITCOIN_FOLLOWS.filter(function (id) { return id !== entry.id; }).slice(0, 3);
                return;
            }
            const follows = [];
            for (let step = 1; follows.length < 3 && step < list.length; step++) {
                follows.push(list[(index + step) % list.length].id);
            }
            entry.followUps = follows;
        });
    });
    entries.forEach(function (entry) {
        if (!entry.followUps || entry.followUps.length < 2) errors.push("follows " + entry.id);
        (entry.followUps || []).forEach(function (id) {
            if (!seenId.has(id)) errors.push("missing follow " + id + " from " + entry.id);
            if (id === entry.id) errors.push("self follow " + entry.id);
        });
    });
    if (entries.length < 1000) errors.push("count " + entries.length);
    const steer = entries.filter(function (entry) { return entry.category === "crypto-steer"; });
    if (steer.length < 50) errors.push("steer " + steer.length);
    if (errors.length) {
        console.error(errors.slice(0, 40).join("\n"));
        console.error(errors.length + " errors");
        process.exit(1);
    }
    const dir = path.join(__dirname, "kb");
    fs.mkdirSync(dir, { recursive: true });
    fs.readdirSync(dir).filter(function (name) { return name.endsWith(".json"); }).forEach(function (name) {
        fs.unlinkSync(path.join(dir, name));
    });
    const counts = {};
    byCat.forEach(function (list, category) {
        counts[category] = list.length;
        const clean = list.map(function (entry) {
            return {
                id: entry.id,
                category: entry.category,
                question: entry.question,
                alts: entry.alts,
                answer: entry.answer,
                topics: entry.topics,
                followUps: entry.followUps,
                sources: entry.sources
            };
        });
        fs.writeFileSync(path.join(dir, category + ".json"), JSON.stringify(clean, null, 2) + "\n");
    });
    const flat = entries.map(function (entry) {
        return {
            id: entry.id,
            category: entry.category,
            question: entry.question,
            alts: entry.alts,
            answer: entry.answer,
            topics: entry.topics,
            followUps: entry.followUps,
            sources: entry.sources
        };
    });
    fs.writeFileSync(path.join(__dirname, "kb-data.mjs"), "export const KB = " + JSON.stringify(flat) + ";\n");
    const index = buildIndex(flat, text);
    fs.writeFileSync(path.join(__dirname, "kb-index.mjs"), "export const INDEX = " + JSON.stringify(index) + ";\n");
    console.log("entries", flat.length);
    console.log("index vocab", index.vocab.length, "postings", index.postings.reduce(function (sum, row) { return sum + row.length; }, 0));
    console.log(JSON.stringify(counts, null, 2));
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
