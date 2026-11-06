'use strict';

const fs = require('fs');
const path = require('path');

function question(pool, index) {
    const prefix = pool === 'technical' ? 't' : 'p';
    const label = pool + ' ' + index;
    return {
        id: prefix + String(index).padStart(3, '0'),
        q: 'Fixture ' + label + ' question',
        a: 'Fixture ' + label + ' answer',
        w: [
            'Fixture ' + label + ' wrong 0',
            'Fixture ' + label + ' wrong 1',
            'Fixture ' + label + ' wrong 2',
            'Fixture ' + label + ' wrong 3',
        ],
    };
}

function buildBank() {
    const properties = [];
    const technical = [];
    for (let i = 0; i < 213; i++) properties.push(question('properties', i));
    for (let i = 0; i < 165; i++) technical.push(question('technical', i));
    return { properties: properties, technical: technical };
}

function write(name) {
    const file = path.join('/tmp', 'scholar-fixture-' + String(name || 'bank') + '.json');
    fs.writeFileSync(file, JSON.stringify(buildBank()));
    return file;
}

module.exports = { buildBank: buildBank, write: write };
