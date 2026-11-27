'use strict';
const assert = require('assert');

function cacheName(sw) {
    const m = String(sw).match(/const CACHE_NAME = '(btc-archive-v\d+)'/);
    assert.ok(m && m[1], 'sw.js must declare CACHE_NAME');
    return m[1];
}

function assertCurrentCache(sw) {
    const name = cacheName(sw);
    assert.ok(String(sw).includes("const CACHE_NAME = '" + name + "'"));
    assert.strictEqual((String(sw).match(/const CACHE_NAME = 'btc-archive-v\d+'/g) || []).length, 1);
    return name;
}

function scriptPins(html, file) {
    const escaped = String(file).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp('(?:^|[^A-Za-z0-9_-])' + escaped + '\\?v=([^\\s\'"?]+)', 'g');
    const found = [];
    let m;
    while ((m = re.exec(String(html)))) found.push(m[1]);
    assert.ok(found.length, file + ' must have a ?v= pin');
    assert.ok(found.every(function (p) { return p === found[0]; }), file + ' pins must agree');
    return { pin: found[0], count: found.length, token: file + '?v=' + found[0] };
}

function assertScriptPin(html, file, otherHtml) {
    const info = scriptPins(html, file);
    assert.ok(String(html).includes(info.token), file + ' is pinned at its current ?v=');
    if (otherHtml != null) {
        const other = scriptPins(otherHtml, file);
        assert.strictEqual(other.pin, info.pin, file + ' pin must match in both pages');
    }
    return info;
}

module.exports = {
    cacheName,
    assertCurrentCache,
    scriptPins,
    assertScriptPin
};
