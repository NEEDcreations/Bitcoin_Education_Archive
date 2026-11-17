'use strict';
// Payout rail selector. Alby / NWC stays the default. Wavelength is only
// used when config/payoutRail.provider is exactly 'wavelength'.
// This module does not call any wallet. Callers that pay must still go
// through their existing NWC path unless they opt into the adapter.

const PROVIDERS = Object.freeze({ NWC: 'nwc', WAVELENGTH: 'wavelength' });

function getProvider(cfg) {
    const v = cfg && cfg.provider;
    if (v === PROVIDERS.WAVELENGTH) return PROVIDERS.WAVELENGTH;
    return PROVIDERS.NWC;
}

function isWavelength(cfg) {
    return getProvider(cfg) === PROVIDERS.WAVELENGTH;
}

async function loadConfig(db) {
    if (!db) return {};
    try {
        const snap = await db.collection('config').doc('payoutRail').get();
        return snap && snap.exists ? (snap.data() || {}) : {};
    } catch (e) {
        return {};
    }
}

module.exports = {
    PROVIDERS: PROVIDERS,
    getProvider: getProvider,
    isWavelength: isWavelength,
    loadConfig: loadConfig,
};
