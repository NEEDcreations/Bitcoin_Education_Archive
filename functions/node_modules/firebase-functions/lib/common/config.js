const require_rolldown_runtime = require('../_virtual/rolldown_runtime.js');
const require_logger_index = require('../logger/index.js');
let path = require("path");
path = require_rolldown_runtime.__toESM(path);
let fs = require("fs");
fs = require_rolldown_runtime.__toESM(fs);

//#region src/common/config.ts
let cache = null;
/**
* @internal
* @alpha
*/
function resetCache(newCache = null) {
	cache = newCache;
}
/**
* Get the fields you need to initialize a Firebase app
* @alpha
*/
function firebaseConfig() {
	if (cache) {
		return cache;
	}
	let env = process.env.FIREBASE_CONFIG;
	if (env) {
		if (!env.startsWith("{")) {
			env = fs.default.readFileSync(path.join(process.env.PWD, env)).toString("utf8");
		}
		cache = JSON.parse(env);
		return cache;
	}
	if (process.env.GCLOUD_PROJECT) {
		require_logger_index.warn("Warning, estimating Firebase Config based on GCLOUD_PROJECT. Initializing firebase-admin may fail");
		cache = {
			databaseURL: process.env.DATABASE_URL || `https://${process.env.GCLOUD_PROJECT}.firebaseio.com`,
			storageBucket: process.env.STORAGE_BUCKET_URL || `${process.env.GCLOUD_PROJECT}.appspot.com`,
			projectId: process.env.GCLOUD_PROJECT
		};
		return cache;
	} else {
		require_logger_index.warn("Warning, FIREBASE_CONFIG and GCLOUD_PROJECT environment variables are missing. Initializing firebase-admin will fail");
	}
	return null;
}

//#endregion
exports.firebaseConfig = firebaseConfig;
exports.resetCache = resetCache;