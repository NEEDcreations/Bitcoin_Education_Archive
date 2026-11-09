#!/usr/bin/env node
// Owner edit and soft delete for Global Chat and DMs.
// Starts the Firestore emulator when FIRESTORE_EMULATOR_HOST is not set.
'use strict';
const { spawnSync } = require('child_process');
const path = require('path');
const root = path.join(__dirname, '..', '..');

if (!process.env.FIRESTORE_EMULATOR_HOST) {
    const child = spawnSync('npx', [
        '--yes', 'firebase-tools',
        'emulators:exec',
        '--only', 'firestore',
        '--project', 'demo-chat-edit',
        'node tests/rules/chat-edit-rules.js',
    ], {
        cwd: root,
        stdio: 'inherit',
        env: Object.assign({}, process.env, { CI: 'true' }),
    });
    process.exit(child.status == null ? 1 : child.status);
}

const fs = require('fs');
const { initializeTestEnvironment, assertSucceeds, assertFails } = require('@firebase/rules-unit-testing');
const { doc, setDoc, getDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } = require('firebase/firestore');

const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const emu = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8085';
const parts = emu.split(':');
const password = { firebase: { sign_in_provider: 'password' } };
const anon = { firebase: { sign_in_provider: 'anonymous' } };
const adminToken = { admin: true, firebase: { sign_in_provider: 'password' } };

function editPatch(text, count) {
    return {
        text: text,
        edited: true,
        editedAt: serverTimestamp(),
        editCount: count,
    };
}

function captionPatch(caption, count) {
    return {
        caption: caption,
        edited: true,
        editedAt: serverTimestamp(),
        editCount: count,
    };
}

(async function main() {
    let failed = 0;
    const env = await initializeTestEnvironment({
        projectId: 'demo-chat-edit',
        firestore: { rules: rules, host: parts[0], port: Number(parts[1] || 8085) },
    });
    async function expect(name, run, shouldAllow) {
        try {
            if (shouldAllow) await assertSucceeds(run());
            else await assertFails(run());
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✓');
        } catch (e) {
            failed++;
            console.log((shouldAllow ? 'ALLOW' : 'DENY ') + '  ' + name + '  ✗ ' + (e.message || e));
        }
    }
    try {
        await env.clearFirestore();
        await env.withSecurityRulesDisabled(async function (ctx) {
            const db = ctx.firestore();
            await setDoc(doc(db, 'users', 'user1'), { username: 'phil' });
            await setDoc(doc(db, 'users', 'user2'), { username: 'sam' });
            const old = Timestamp.fromMillis(Date.now() - 20 * 60 * 1000);
            await setDoc(doc(db, 'global_chat', 'old1'), {
                uid: 'user1', name: 'phil', text: 'stale', ts: old, isNachoAuto: false,
            });
            await setDoc(doc(db, 'global_chat', 'cap1'), {
                uid: 'user1', name: 'phil', text: 'fifth', ts: Timestamp.now(), isNachoAuto: false, editCount: 5,
            });
            await setDoc(doc(db, 'global_chat', 'gone1'), {
                uid: 'user1', name: 'phil', text: '', ts: Timestamp.now(), deleted: true, isNachoAuto: false,
            });
            await setDoc(doc(db, 'global_chat', 'nacho1'), {
                uid: 'nacho-bot', name: '🦌 Nacho', text: 'hi', ts: Timestamp.now(), isNachoAuto: true,
            });
            await setDoc(doc(db, 'global_chat', 'sys1'), {
                uid: 'system', name: 'system', text: 'hi', ts: Timestamp.now(), isNachoAuto: false,
            });
            await setDoc(doc(db, 'global_chat', 'tg1'), {
                uid: 'user1', name: 'phil', text: 'from tg', ts: Timestamp.now(), source: 'telegram',
            });
            await setDoc(doc(db, 'global_chat', 'capmsg'), {
                uid: 'user1', name: 'phil', text: 'https://firebasestorage.googleapis.com/x.jpg', ts: Timestamp.now(),
                isGif: true, caption: 'secret caption',
            });
            await setDoc(doc(db, 'global_chat', 'capedit'), {
                uid: 'user1', name: 'phil', text: 'https://firebasestorage.googleapis.com/edit.jpg', ts: Timestamp.now(),
                isGif: true, caption: 'secret caption',
            });
            await setDoc(doc(db, 'global_chat', 'capold'), {
                uid: 'user1', name: 'phil', text: 'https://firebasestorage.googleapis.com/old.jpg', ts: old,
                isGif: true, caption: 'late caption',
            });
            await setDoc(doc(db, 'global_chat', 'capmax'), {
                uid: 'user1', name: 'phil', text: 'https://firebasestorage.googleapis.com/max.jpg', ts: Timestamp.now(),
                isGif: true, caption: 'fifth', editCount: 5,
            });
            await setDoc(doc(db, 'global_chat', 'gif1'), {
                uid: 'user1', name: 'phil', text: 'cap', ts: Timestamp.now(), isGif: true, gifUrl: 'https://media.tenor.com/x.gif',
            });
            await setDoc(doc(db, 'dm_conversations', 'user1_user2'), {
                participants: ['user1', 'user2'],
            });
            await setDoc(doc(db, 'dm_conversations', 'user1_user2', 'messages', 'dold'), {
                senderUid: 'user1', text: 'old dm', createdAt: old,
            });
            await setDoc(doc(db, 'dm_conversations', 'user1_user2', 'messages', 'dgif'), {
                senderUid: 'user1', text: '', imageUrl: 'https://example.com/a.png', isGif: true, createdAt: Timestamp.now(),
            });
            await setDoc(doc(db, 'dm_conversations', 'user1_user2', 'messages', 'dnacho'), {
                senderUid: 'nacho-bot', text: 'auto', isNachoAuto: true, createdAt: Timestamp.now(),
            });
            await setDoc(doc(db, 'chat_moderation_log', 'row1'), {
                uid: 'user1', before: 'secret', after: 'x', action: 'edit',
            });
        });

        const user = env.authenticatedContext('user1', password).firestore();
        const other = env.authenticatedContext('user2', password).firestore();
        const guest = env.authenticatedContext('user1', anon).firestore();
        const stranger = env.authenticatedContext('user3', password).firestore();
        const admin = env.authenticatedContext('admin1', adminToken).firestore();

        await expect('global chat id with a quote', function () {
            return setDoc(doc(user, 'global_chat', "bad'id"), {
                uid: 'user1', name: 'phil', text: 'nope', ts: serverTimestamp(), isNachoAuto: false,
            });
        }, false);
        await expect('own global chat message', function () {
            return setDoc(doc(user, 'global_chat', 'fresh1'), {
                uid: 'user1', name: 'phil', text: 'hello', ts: serverTimestamp(), isNachoAuto: false,
            });
        }, true);
        await expect('owner edit within 15 minutes', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), editPatch('hello there', 1));
        }, true);
        await expect('editCount must rise by exactly 1', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), editPatch('hello again', 1));
        }, false);
        await expect('second edit is allowed', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), editPatch('hello again', 2));
        }, true);
        await expect('editCount cannot be reset', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), editPatch('reset', 0));
        }, false);
        await expect('edited must be true', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), {
                text: 'no flag', edited: false, editedAt: serverTimestamp(), editCount: 3,
            });
        }, false);
        await expect('editedAt must be request.time', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), {
                text: 'stale stamp', edited: true, editedAt: Timestamp.fromMillis(Date.now() - 60000), editCount: 3,
            });
        }, false);
        await expect('only text edited editedAt editCount may change', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), Object.assign(editPatch('sneaky', 3), { name: 'other' }));
        }, false);
        await expect('edit over 300 characters', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), editPatch('x'.repeat(301), 3));
        }, false);
        await expect('empty edit', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), editPatch('', 3));
        }, false);
        await expect('non-owner edit', function () {
            return updateDoc(doc(other, 'global_chat', 'fresh1'), editPatch('hijack', 3));
        }, false);
        await expect('edit after 15 minutes', function () {
            return updateDoc(doc(user, 'global_chat', 'old1'), editPatch('too late', 1));
        }, false);
        await expect('sixth edit', function () {
            return updateDoc(doc(user, 'global_chat', 'cap1'), editPatch('sixth', 6));
        }, false);
        await expect('edit after delete', function () {
            return updateDoc(doc(user, 'global_chat', 'gone1'), editPatch('back', 1));
        }, false);
        await expect('edit a Nacho message', function () {
            return updateDoc(doc(user, 'global_chat', 'nacho1'), editPatch('fake', 1));
        }, false);
        await expect('edit a system message', function () {
            return updateDoc(doc(user, 'global_chat', 'sys1'), editPatch('fake', 1));
        }, false);
        await expect('edit a Telegram message', function () {
            return updateDoc(doc(user, 'global_chat', 'tg1'), editPatch('fake', 1));
        }, false);
        await expect('edit a GIF message', function () {
            return updateDoc(doc(user, 'global_chat', 'gif1'), editPatch('caption', 1));
        }, false);
        await expect('edit an image caption within 15 minutes', function () {
            return updateDoc(doc(user, 'global_chat', 'capedit'), captionPatch('fixed caption', 1));
        }, true);
        await expect('caption edit cannot change the image url', function () {
            return updateDoc(doc(user, 'global_chat', 'capedit'), Object.assign(captionPatch('sneaky', 2), {
                text: 'https://evil.example/a.jpg',
            }));
        }, false);
        await expect('caption edit over 300 characters', function () {
            return updateDoc(doc(user, 'global_chat', 'capedit'), captionPatch('x'.repeat(301), 2));
        }, false);
        await expect('empty caption edit', function () {
            return updateDoc(doc(user, 'global_chat', 'capedit'), captionPatch('', 2));
        }, false);
        await expect('second caption edit is allowed', function () {
            return updateDoc(doc(user, 'global_chat', 'capedit'), captionPatch('fixed again', 2));
        }, true);
        await expect('caption edit after 15 minutes', function () {
            return updateDoc(doc(user, 'global_chat', 'capold'), captionPatch('too late', 1));
        }, false);
        await expect('sixth caption edit', function () {
            return updateDoc(doc(user, 'global_chat', 'capmax'), captionPatch('sixth', 6));
        }, false);
        await expect('non-owner caption edit', function () {
            return updateDoc(doc(other, 'global_chat', 'capedit'), captionPatch('hijack', 3));
        }, false);
        await expect('caption edit on a text message', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), captionPatch('not media', 3));
        }, false);
        await expect('anonymous caption edit', function () {
            return updateDoc(doc(guest, 'global_chat', 'capedit'), captionPatch('anon', 3));
        }, false);
        await expect('anonymous edit', function () {
            return updateDoc(doc(guest, 'global_chat', 'fresh1'), editPatch('anon', 3));
        }, false);
        await expect('soft delete must clear caption', function () {
            return updateDoc(doc(user, 'global_chat', 'capmsg'), {
                deleted: true, deletedAt: serverTimestamp(), text: '',
            });
        }, false);
        await expect('soft delete clears caption', function () {
            return updateDoc(doc(user, 'global_chat', 'capmsg'), {
                deleted: true, deletedAt: serverTimestamp(), text: '', caption: '',
            });
        }, true);
        await expect('owner soft delete', function () {
            return updateDoc(doc(user, 'global_chat', 'fresh1'), {
                deleted: true, deletedAt: serverTimestamp(), text: '',
            });
        }, true);
        await expect('soft delete must blank text', function () {
            return updateDoc(doc(user, 'global_chat', 'old1'), {
                deleted: true, deletedAt: serverTimestamp(), text: 'still here',
            });
        }, false);
        await expect('owner hard delete', function () {
            return deleteDoc(doc(user, 'global_chat', 'old1'));
        }, false);
        await expect('admin hard delete', function () {
            return deleteDoc(doc(admin, 'global_chat', 'old1'));
        }, true);
        await expect('admin cannot edit', function () {
            return updateDoc(doc(admin, 'global_chat', 'cap1'), editPatch('admin edit', 6));
        }, false);

        await expect('own DM message', function () {
            return setDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'd1'), {
                senderUid: 'user1', text: 'hey', createdAt: serverTimestamp(),
            });
        }, true);
        await expect('DM create cannot set editCount or a future createdAt', function () {
            return setDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'dforged'), {
                senderUid: 'user1',
                text: 'forged',
                createdAt: Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000),
                editCount: -1000,
            });
        }, false);
        await expect('DM owner edit', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'd1'), editPatch('hey there', 1));
        }, true);
        await expect('DM edit over 1000 characters', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'd1'), editPatch('y'.repeat(1001), 2));
        }, false);
        await expect('DM edit at 1000 characters', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'd1'), editPatch('y'.repeat(1000), 2));
        }, true);
        await expect('DM non-participant edit', function () {
            return updateDoc(doc(stranger, 'dm_conversations', 'user1_user2', 'messages', 'd1'), editPatch('nope', 3));
        }, false);
        await expect('DM other participant cannot edit', function () {
            return updateDoc(doc(other, 'dm_conversations', 'user1_user2', 'messages', 'd1'), editPatch('nope', 3));
        }, false);
        await expect('DM edit after 15 minutes', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'dold'), editPatch('late', 1));
        }, false);
        await expect('DM GIF edit', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'dgif'), editPatch('no', 1));
        }, false);
        await expect('DM Nacho edit', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'dnacho'), editPatch('no', 1));
        }, false);
        await expect('DM owner soft delete', function () {
            return updateDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'd1'), {
                deleted: true, deletedAt: serverTimestamp(), text: '',
            });
        }, true);
        await expect('DM hard delete', function () {
            return deleteDoc(doc(user, 'dm_conversations', 'user1_user2', 'messages', 'dold'));
        }, false);
        await expect('client write moderation log', function () {
            return setDoc(doc(user, 'chat_moderation_log', 'evil'), { uid: 'user1', before: 'x' });
        }, false);
        await expect('non-admin read moderation log', function () {
            return getDoc(doc(user, 'chat_moderation_log', 'row1'));
        }, false);
        await expect('admin read moderation log', function () {
            return getDoc(doc(admin, 'chat_moderation_log', 'row1'));
        }, true);
        await expect('client write edit rate', function () {
            return setDoc(doc(user, 'chat_edit_rate', 'user1'), { count: 0, flagged: false });
        }, false);
        await expect('admin read edit rate', function () {
            return getDoc(doc(admin, 'chat_edit_rate', 'user1'));
        }, true);
    } finally {
        await env.cleanup();
    }
    if (failed) process.exit(1);
})().catch(function (e) {
    console.error(e);
    process.exit(1);
});
