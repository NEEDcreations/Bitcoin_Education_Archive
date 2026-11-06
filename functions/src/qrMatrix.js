'use strict';

// QR matrix for certificate verify links. The vendored generator is MIT
// (Kazuhiko Arase). Callers paint the rows. This file does not add a dependency.
const qrcode = require('./vendor/qrcode');

function matrixFor(text) {
    const qr = qrcode(0, 'M');
    qr.addData(String(text || ''));
    qr.make();
    const count = qr.getModuleCount();
    const rows = [];
    for (let r = 0; r < count; r++) {
        let line = '';
        for (let c = 0; c < count; c++) line += qr.isDark(r, c) ? '1' : '0';
        rows.push(line);
    }
    return rows;
}

module.exports = { matrixFor: matrixFor };
