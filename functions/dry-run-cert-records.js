#!/usr/bin/env node
'use strict';

// Counts certificate and exam records that a later migration would touch.
// It never writes. --apply is refused before any Firestore connection.
// Counts only: no uids, emails, names, or document ids.

if (process.argv.indexOf('--apply') !== -1) {
    console.error('Refusing to apply. This script never writes certificate records.');
    process.exit(1);
}

if (process.env.CERT_DRY_RUN !== '1') {
    console.log('Dry run was not executed. Set CERT_DRY_RUN=1 to count records. Nothing was written.');
    process.exit(0);
}

const admin = require('firebase-admin');
if (!admin.apps.length) admin.initializeApp();
const db = admin.firestore();

function bump(map, key) {
    map[key] = (map[key] || 0) + 1;
}

async function main() {
    const certs = await db.collection('certs').get();
    let withUid = 0;
    const byPerson = {};
    certs.forEach(function (doc) {
        const row = doc.data() || {};
        if (Object.prototype.hasOwnProperty.call(row, 'uid')) withUid++;
        if (row.uid && row.type) bump(byPerson, String(row.uid) + '\n' + String(row.type));
    });
    let extraCerts = 0;
    Object.keys(byPerson).forEach(function (key) {
        if (byPerson[key] > 1) extraCerts += byPerson[key] - 1;
    });

    const owners = await db.collection('cert_by_user').get();
    const owned = {};
    owners.forEach(function (doc) {
        const row = doc.data() || {};
        if (row.uid && row.type) owned[String(row.uid) + '\n' + String(row.type)] = true;
    });

    const passed = await db.collection('scholar_exam_keys').where('passed', '==', true).get();
    let passesWithoutCert = 0;
    passed.forEach(function (doc) {
        const row = doc.data() || {};
        const score = Number(row.score);
        if (row.passed !== true || !Number.isFinite(score) || score < 20) return;
        if (row.type !== 'properties' && row.type !== 'technical') return;
        const certType = row.type === 'technical' ? 'technical' : 'scholar';
        const key = String(row.uid || '') + '\n' + certType;
        if (!row.uid || !owned[key]) passesWithoutCert++;
    });

    const open = await db.collection('scholar_exam_keys').where('graded', '==', false).get();
    let textKeyAttempts = 0;
    open.forEach(function (doc) {
        const row = doc.data() || {};
        const keys = row.keys;
        const served = row.served;
        const hasText = Array.isArray(keys) && keys.some(function (item) {
            return item && typeof item.correct === 'string';
        });
        const hasServed = Array.isArray(served) && served.length > 0 && served[0] && served[0].correctOptionId;
        if (hasText && !hasServed) textKeyAttempts++;
    });

    console.log('Certificates that still store a uid: ' + withUid);
    console.log('Extra certificates beyond one per person per quest: ' + extraCerts);
    console.log('Passing exams with no certificate index: ' + passesWithoutCert);
    console.log('Open attempts that still store answer text and no option ids: ' + textKeyAttempts);
    console.log('1 placeholder question was excluded from the Scholar pool (properties index 119). The draw pool is 213 Scholar questions and 165 Protocol Expert questions. The published 214 included that placeholder.');
    console.log('A later migration would move uid onto cert_owners, delete uid from the public certificate, and keep the newest certificate per person per quest. It would not regrade old passes or change the 2,100 XP. Open attempts that still store answer text simply will not grade.');
    console.log('Nothing was written.');
}

main().then(function () {
    process.exit(0);
}).catch(function (err) {
    console.error(err && err.message ? err.message : err);
    process.exit(1);
});
