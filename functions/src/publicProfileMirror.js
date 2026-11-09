'use strict';

// Fields that must not stay on public_profiles.
// lightning / lightningAddress are payment endpoints.
// lastSeen / isOnline are presence. They belong on profile_presence/{uid}.
const STRIP_FIELDS = ['lightningAddress', 'lightning', 'lastSeen', 'isOnline'];
const PRESENCE_FIELDS = ['lastSeen', 'isOnline'];

function hasOwn(data, key) {
    return !!data && Object.prototype.hasOwnProperty.call(data, key);
}

function presencePatch(data) {
    const patch = {};
    if (!data) return patch;
    if (hasOwn(data, 'lastSeen')) patch.lastSeen = data.lastSeen;
    if (hasOwn(data, 'isOnline')) patch.isOnline = data.isOnline === true;
    return patch;
}

function secretsOnProfile(data) {
    const removed = {};
    STRIP_FIELDS.forEach(function (key) {
        if (hasOwn(data, key)) removed[key] = data[key];
    });
    return removed;
}

function planStrip(id, data) {
    const removed = secretsOnProfile(data);
    return {
        id: String(id || ''),
        remove: Object.keys(removed).length > 0,
        removed: removed,
        presence: presencePatch(data)
    };
}

function parseArgs(argv) {
    const args = argv || [];
    let backup = '';
    const at = args.indexOf('--backup');
    if (at !== -1 && args[at + 1] && args[at + 1].indexOf('--') !== 0) backup = args[at + 1];
    return {
        help: args.indexOf('--help') !== -1 || args.indexOf('-h') !== -1,
        apply: args.indexOf('--apply') !== -1,
        write: args.indexOf('--write') !== -1,
        backup: backup
    };
}

function buildBackup(plans, nowIso) {
    const docs = {};
    (plans || []).forEach(function (plan) {
        if (!plan || !plan.remove || !plan.id) return;
        docs[plan.id] = plan.removed;
    });
    return {
        createdAt: nowIso || new Date().toISOString(),
        collection: 'public_profiles',
        fields: STRIP_FIELDS.slice(),
        docs: docs
    };
}

module.exports = {
    STRIP_FIELDS: STRIP_FIELDS,
    PRESENCE_FIELDS: PRESENCE_FIELDS,
    presencePatch: presencePatch,
    secretsOnProfile: secretsOnProfile,
    planStrip: planStrip,
    parseArgs: parseArgs,
    buildBackup: buildBackup
};
