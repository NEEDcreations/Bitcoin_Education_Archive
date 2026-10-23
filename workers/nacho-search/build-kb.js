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

function makeAlts(question) {
    const body = String(question || "").replace(/\?$/, "").trim();
    const lower = body.charAt(0).toLowerCase() + body.slice(1);
    const titled = lower.charAt(0).toUpperCase() + lower.slice(1);
    return [
        "In simple words, " + lower + "?",
        titled + ", briefly?",
        "Help me understand: " + lower + "?"
    ];
}

function appEntries(topicIds) {
    const out = [];
    registry.FEATURES.forEach(function (feature) {
        const title = String(feature.title || feature.id);
        const desc = String(feature.desc || "").trim().replace(/[.!?]$/, "") + ".";
        const how = String(feature.how || "").trim().replace(/[.!?]$/, "") + ".";
        const answer = desc + " " + how + " This describes a Bitcoin Quest feature, not financial advice.";
        const topic = topicIds.has(feature.id) ? feature.id : (feature.id === "pow-support" ? "proof-of-walk" : "faq");
        const second = topicIds.has("one-stop-shop") ? "one-stop-shop" : "faq";
        function push(suffix, question) {
            if (question.length > 90) return;
            out.push({
                id: "app-" + feature.id + "-" + suffix,
                category: "app",
                question: question,
                answer: answer,
                topics: topic === second ? [topic] : [topic, second],
                sources: "features.registry.js entry " + feature.id + "."
            });
        }
        let what = "What is " + title + " in Bitcoin Quest?";
        if (what.length > 90) what = "What is " + title + "?";
        let howQ = "How do I use " + title + " in the app?";
        if (howQ.length > 90) howQ = "How do I use " + title + "?";
        push("what", what);
        push("how", howQ);
    });
    return out;
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
        entry.alts = (entry.alts && entry.alts.length >= 3) ? entry.alts.slice(0, 6) : makeAlts(entry.question);
        if (!/^[a-z0-9-]{3,80}$/.test(entry.id)) errors.push("bad id " + entry.id);
        if (seenId.has(entry.id)) errors.push("dup id " + entry.id);
        seenId.add(entry.id);
        if (!entry.question || entry.question.length > 90 || !entry.question.endsWith("?")) errors.push("bad question " + entry.id + " " + entry.question);
        const keys = [entry.question].concat(entry.alts);
        keys.forEach(function (phrase) {
            const key = foldKey(phrase);
            if (!key) errors.push("empty phrase " + entry.id);
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
    console.log("entries", flat.length);
    console.log(JSON.stringify(counts, null, 2));
}

main().catch(function (err) {
    console.error(err);
    process.exit(1);
});
