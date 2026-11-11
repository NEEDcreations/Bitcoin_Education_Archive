#!/usr/bin/env node
'use strict';

// Prints the per-function runtime service account plan: one account per
// secret-bound function, the exact IAM grants it needs, and the named deploy
// batches. PRINTS ONLY. It never calls gcloud, never changes IAM, never
// deploys, and never reads a secret value.
//
//   node scripts/runtime-sa-plan.js            # markdown table + batches
//   node scripts/runtime-sa-plan.js --json     # machine-readable plan
//   node scripts/runtime-sa-plan.js --gcloud 3 # gcloud commands for batch 3
//
// Run IAM commands only with Phil's OK, one batch at a time, and only before
// deploying that same batch by name (never deploy-all).
const path = require('path');
const { RUNTIME_SERVICE_ACCOUNTS, EXTRA_ROLES } = require('../src/runtimeServiceAccounts');

const PROJECT = process.env.GCLOUD_PROJECT || 'bitcoin-education-archive';
const REGION = 'us-central1';
const DEFAULT_BUCKET = process.env.BQ_DEFAULT_BUCKET || 'bitcoin-education-archive.firebasestorage.app';
const BACKUP_BUCKET = process.env.BQ_BACKUP_BUCKET || (PROJECT + '-backups');
// Set BQ_DEPLOYER_SA to the deploy identity's email when printing commands.
const DEPLOYER = process.env.BQ_DEPLOYER_SA || '<deployer-sa-email>';
const NEVER_DEPLOY = ['adminApproveFactionPayout'];

// Lowest risk first. Wallet-paying functions go last.
const BATCHES = [
    { name: 'canary: admin read-only HTTP (gen1)', fns: ['dailyActiveUsers', 'adminLookupUser', 'adminQueryUsers', 'watchlistCheck', 'auditWithdrawals'] },
    { name: 'admin tools + Telegram webhook (gen1)', fns: ['adminBanUser', 'adminUnbanUser', 'investigateUsers', 'backfillJoinDates', 'refreshBadgeDistributionHttp', 'setTelegramWebhook', 'handleTelegramWebhook'] },
    { name: 'Telegram mirrors (gen2 Firestore triggers + schedule)', fns: ['onGlobalChatTelegram', 'onGlobalChatTelegramUpdated', 'onGlobalChatTelegramDeleted', 'onAnnouncementsTelegram', 'onAnnouncementsTelegramUpdated', 'onAnnouncementsTelegramDeleted', 'onForumShoutoutUpdated', 'onForumShoutoutDeleted', 'onMarketplaceShoutoutUpdated', 'onMarketplaceShoutoutDeleted', 'flushTelegramMirror'] },
    { name: 'admin kill switch (gen1 callable)', fns: ['adminSetKillSwitch'] },
    { name: 'gen2 schedules + referral/X triggers', fns: ['scheduleRaidBoss', 'scheduleRaidBossCatchup', 'refreshHotTopics', 'tweetSatoshisFavor', 'onUserReferral', 'payQualifiedReferrals'] },
    { name: 'gen1 hot topics, Strava, referral callables', fns: ['refreshHotTopicsHttp', 'refreshHotTopicsForce', 'stravaAuth', 'syncStravaWalks', 'verifyReferral', 'registerReferral'] },
    { name: 'account security: TOTP, username, email change, delete', fns: ['totpSetup', 'totpVerify', 'totpCheck', 'totpDisable', 'totpStepUp', 'regenerateRecoveryCodes', 'setUsername', 'prepareEmailChange', 'syncEmailChange', 'confirmAccountLink', 'deleteAccount'] },
    { name: 'wallet / NWC (last)', fns: ['getFaucetStats', 'confirmTipSent', 'adminResolveCipherSatsClaim', 'resetLightningAddressOnce', 'claimSats', 'claimCipherSats', 'claimCipherWin', 'tctvDripTick'] },
];

function loadEndpoints() {
    process.env.GCLOUD_PROJECT = PROJECT;
    if (!process.env.FIREBASE_CONFIG) {
        process.env.FIREBASE_CONFIG = JSON.stringify({ projectId: PROJECT, storageBucket: DEFAULT_BUCKET });
    }
    const ex = require(path.join(__dirname, '..', 'index.js'));
    const out = {};
    Object.keys(ex).forEach(function (name) {
        const ep = ex[name] && ex[name].__endpoint;
        if (!ep) return;
        let trigger = 'other';
        if (ep.httpsTrigger) trigger = 'https';
        else if (ep.callableTrigger) trigger = 'callable';
        else if (ep.scheduleTrigger) trigger = 'schedule';
        else if (ep.eventTrigger) trigger = 'event';
        out[name] = {
            gen: ep.platform === 'gcfv2' ? 2 : 1,
            trigger: trigger,
            secrets: (ep.secretEnvironmentVariables || []).map(function (s) { return s.key; }).sort(),
            serviceAccount: typeof ep.serviceAccountEmail === 'string' ? ep.serviceAccountEmail : null,
        };
    });
    return out;
}

function buildPlan(endpoints) {
    const fns = {};
    Object.keys(RUNTIME_SERVICE_ACCOUNTS).sort().forEach(function (name) {
        const entry = RUNTIME_SERVICE_ACCOUNTS[name];
        const ep = endpoints[name];
        if (!ep) throw new Error('manifest function is not exported: ' + name);
        const email = entry.id + '@' + PROJECT + '.iam.gserviceaccount.com';
        const projectRoles = ['roles/datastore.user'];
        entry.extra.forEach(function (x) { if (x !== 'storage' && x !== 'backups') projectRoles.push(EXTRA_ROLES[x]); });
        if (ep.gen === 2 && ep.trigger === 'event') projectRoles.push('roles/eventarc.eventReceiver');
        fns[name] = {
            id: entry.id,
            email: email,
            gen: ep.gen,
            trigger: ep.trigger,
            secrets: ep.secrets,
            projectRoles: projectRoles,
            bucketRoles: [].concat(
                entry.extra.indexOf('storage') !== -1 ? [{ bucket: DEFAULT_BUCKET, role: EXTRA_ROLES.storage }] : [],
                entry.extra.indexOf('backups') !== -1 ? [{ bucket: BACKUP_BUCKET, role: EXTRA_ROLES.backups }] : []),
            // Gen2 event + schedule triggers now authenticate as this account.
            selfInvoker: ep.gen === 2 && (ep.trigger === 'event' || ep.trigger === 'schedule'),
        };
    });
    return { project: PROJECT, region: REGION, deployer: DEPLOYER, neverDeploy: NEVER_DEPLOY, functions: fns, batches: BATCHES };
}

function gcloudFor(plan, batchIndex) {
    const b = plan.batches[batchIndex];
    const P = plan.project;
    const lines = ['# Batch ' + (batchIndex + 1) + ': ' + b.name + ' (' + b.fns.length + ' functions)', 'set -euo pipefail', 'P=' + P];
    b.fns.forEach(function (name) {
        const f = plan.functions[name];
        const m = 'serviceAccount:' + f.email;
        lines.push('', '# ' + name + ' (gen' + f.gen + ' ' + f.trigger + ')');
        lines.push('gcloud iam service-accounts create ' + f.id + ' --project "$P" --display-name "BQ runtime ' + name + '" --description "Runtime SA for Cloud Function ' + name + ' only"');
        lines.push('gcloud iam service-accounts add-iam-policy-binding ' + f.email + ' --project "$P" --member serviceAccount:' + plan.deployer + ' --role roles/iam.serviceAccountUser --condition=None');
        f.projectRoles.forEach(function (r) {
            lines.push('gcloud projects add-iam-policy-binding "$P" --member ' + m + ' --role ' + r + ' --condition=None');
        });
        f.bucketRoles.forEach(function (br) {
            lines.push('gcloud storage buckets add-iam-policy-binding gs://' + br.bucket + ' --member ' + m + ' --role ' + br.role);
        });
        f.secrets.forEach(function (s) {
            lines.push('gcloud secrets add-iam-policy-binding ' + s + ' --project "$P" --member ' + m + ' --role roles/secretmanager.secretAccessor --condition=None');
        });
        if (f.selfInvoker) {
            lines.push('gcloud run services add-iam-policy-binding ' + name.toLowerCase() + ' --project "$P" --region ' + plan.region + ' --member ' + m + ' --role roles/run.invoker');
        }
    });
    lines.push('', '# Then deploy THIS batch by name only (never deploy-all):');
    lines.push('firebase deploy --project "$P" --non-interactive --force --only ' + b.fns.map(function (n) { return 'functions:' + n; }).join(','));
    return lines.join('\n');
}

function markdown(plan) {
    const out = ['| # | function | gen | trigger | service account | secrets | roles |', '|---|---|---|---|---|---|---|'];
    plan.batches.forEach(function (b, i) {
        b.fns.forEach(function (name) {
            const f = plan.functions[name];
            const roles = f.projectRoles.map(function (r) { return r.replace('roles/', ''); })
                .concat(f.bucketRoles.map(function (br) { return br.role.replace('roles/', '') + '@bucket'; }))
                .concat(f.selfInvoker ? ['run.invoker@own-service'] : []);
            out.push('| ' + (i + 1) + ' | ' + name + ' | ' + f.gen + ' | ' + f.trigger + ' | ' + f.id + ' | ' + f.secrets.join(', ') + ' | ' + roles.join(', ') + ' |');
        });
    });
    out.push('');
    plan.batches.forEach(function (b, i) {
        out.push('Batch ' + (i + 1) + ' (' + b.name + ', ' + b.fns.length + '): `firebase deploy --only ' + b.fns.map(function (n) { return 'functions:' + n; }).join(',') + '`');
    });
    return out.join('\n');
}

module.exports = { BATCHES: BATCHES, NEVER_DEPLOY: NEVER_DEPLOY, loadEndpoints: loadEndpoints, buildPlan: buildPlan, gcloudFor: gcloudFor, markdown: markdown };

if (require.main === module) {
    const plan = buildPlan(loadEndpoints());
    const argv = process.argv.slice(2);
    const g = argv.indexOf('--gcloud');
    if (argv.indexOf('--json') !== -1) console.log(JSON.stringify(plan, null, 2));
    else if (g !== -1) {
        const n = parseInt(argv[g + 1], 10);
        if (!(n >= 1 && n <= plan.batches.length)) { console.error('batch 1..' + plan.batches.length); process.exit(1); }
        console.log(gcloudFor(plan, n - 1));
    } else console.log(markdown(plan));
}
