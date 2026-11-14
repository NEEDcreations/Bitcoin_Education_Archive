'use strict';

// firebase-admin 14 removed the namespaced admin.firestore() / admin.auth()
// surface from require('firebase-admin'). Existing call sites still use that
// surface. This restores it on the shared module object.
const admin = require('firebase-admin');

if (typeof admin.firestore !== 'function') {
    const firestoreMod = require('firebase-admin/firestore');
    const authMod = require('firebase-admin/auth');
    const messagingMod = require('firebase-admin/messaging');
    const storageMod = require('firebase-admin/storage');
    const { getApp, getApps } = require('firebase-admin/app');

    function firestore(app) {
        return app ? firestoreMod.getFirestore(app) : firestoreMod.getFirestore();
    }
    firestore.FieldValue = firestoreMod.FieldValue;
    firestore.Timestamp = firestoreMod.Timestamp;
    firestore.FieldPath = firestoreMod.FieldPath;
    admin.firestore = firestore;

    admin.auth = function (app) {
        return app ? authMod.getAuth(app) : authMod.getAuth();
    };
    admin.messaging = function (app) {
        return app ? messagingMod.getMessaging(app) : messagingMod.getMessaging();
    };
    admin.storage = function (app) {
        return app ? storageMod.getStorage(app) : storageMod.getStorage();
    };
    if (!admin.credential) {
        admin.credential = {
            cert: admin.cert,
            applicationDefault: admin.applicationDefault,
        };
    }
    if (typeof admin.app !== 'function') {
        admin.app = function (name) { return name ? getApp(name) : getApp(); };
    }
    if (!Object.prototype.hasOwnProperty.call(admin, 'apps')) {
        Object.defineProperty(admin, 'apps', {
            enumerable: true,
            get: function () { return getApps(); },
        });
    }
}

module.exports = admin;
