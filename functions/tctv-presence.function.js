// Retired. Do not deploy this file.
//
// The live scheduler is exports.tctvAggregatePresence in functions/index.js
// (firebase deploy --only functions:tctvAggregatePresence).
//
// This module used to schedule aggregateTctvPresence every 10 seconds and
// read the entire tctv_presence collection. That full scan is the read-cost
// bug. Nothing in the repo imports this file. It intentionally exports no
// Cloud Function.
module.exports = {};
