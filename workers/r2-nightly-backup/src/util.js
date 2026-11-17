// Pure helpers (no Workers runtime imports) so they are unit-testable in Node.
import { ConfigError } from "./gcs.js";
import { assertKeyInPrefix } from "./pack.js";

const LABEL_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/;
export const MIN_FILES = 10; // same guard as the GitHub workflow / box script

export function resolveLabel(params, now = new Date()) {
  const label = (params && params.exportPrefix) || now.toISOString().slice(0, 10);
  if (!LABEL_RE.test(label) || label.includes("..")) throw new ConfigError("bad exportPrefix");
  return label;
}

export function keysFor(root, label) {
  const dir = `${root}${label}/`;
  const k = {
    data: `${dir}bq-firestore-${label}.tar.gz.age`,
    manifest: `${dir}manifest.json`,
    lastSuccess: `${root}_health/last-success.json`,
    lastError: `${root}_health/last-error.json`,
  };
  for (const v of Object.values(k)) assertKeyInPrefix(v, root);
  return k;
}

export const putJson = (r2, key, root, obj) => {
  assertKeyInPrefix(key, root);
  return r2.put(key, JSON.stringify(obj, null, 2), { httpMetadata: { contentType: "application/json" } });
};

export function safeError(err) {
  const msg = String((err && err.message) || err).replace(/[A-Za-z0-9_\-]{120,}/g, "[redacted]").slice(0, 500);
  return { class: (err && err.name) || "Error", message: msg };
}

