// Google Cloud Storage access from a Worker: service-account JWT (RS256 via
// WebCrypto) -> OAuth access token (read-only scope) -> JSON API list/get.
// No GCP client library. Never logs key material or tokens.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/devstorage.read_only";
const API = "https://storage.googleapis.com/storage/v1";

const b64url = (bytes) => {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const b64urlStr = (str) => b64url(new TextEncoder().encode(str));

export function pemToPkcs8(pem) {
  // Accept a PEM with real newlines or literal "\n" (as stored in JSON keys).
  const body = String(pem)
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  if (!body) throw new ConfigError("GCP private key is empty or not PKCS8 PEM");
  const bin = atob(body);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export class ConfigError extends Error {
  constructor(msg) { super(msg); this.name = "ConfigError"; }
}
export class SourceError extends Error {
  constructor(msg) { super(msg); this.name = "SourceError"; }
}

export async function signJwt(clientEmail, privateKeyPem, nowSec = Math.floor(Date.now() / 1000)) {
  if (!clientEmail || !/^[^@\s]+@[^@\s]+\.iam\.gserviceaccount\.com$/.test(clientEmail)) {
    throw new ConfigError("GCP_BACKUP_READER_CLIENT_EMAIL missing or not a service account");
  }
  if (!privateKeyPem) throw new ConfigError("GCP_BACKUP_READER_PRIVATE_KEY missing");
  const header = { alg: "RS256", typ: "JWT" };
  const claims = { iss: clientEmail, scope: SCOPE, aud: TOKEN_URL, iat: nowSec, exp: nowSec + 3600 };
  const unsigned = `${b64urlStr(JSON.stringify(header))}.${b64urlStr(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8", pemToPkcs8(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  return `${unsigned}.${b64url(sig)}`;
}

export async function getAccessToken(env, fetchFn = fetch) {
  const jwt = await signJwt(env.GCP_BACKUP_READER_CLIENT_EMAIL, env.GCP_BACKUP_READER_PRIVATE_KEY);
  const res = await fetchFn(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=${encodeURIComponent("urn:ietf:params:oauth:grant-type:jwt-bearer")}&assertion=${jwt}`,
  });
  if (!res.ok) {
    // Body may echo error codes but never the key; keep only the error field.
    let code = "";
    try { code = (await res.json()).error || ""; } catch { /* ignore */ }
    throw new ConfigError(`GCS token exchange failed: HTTP ${res.status} ${code}`.trim());
  }
  const j = await res.json();
  if (!j.access_token) throw new ConfigError("GCS token exchange returned no access_token");
  return j.access_token;
}

async function gcsJson(url, token, fetchFn) {
  const res = await fetchFn(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 404) return null;
  if (!res.ok) throw new SourceError(`GCS ${res.status} on ${new URL(url).pathname}`);
  return res.json();
}

export async function statObject(bucket, name, token, fetchFn = fetch) {
  return gcsJson(`${API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}`, token, fetchFn);
}

export async function listObjects(bucket, prefix, token, fetchFn = fetch) {
  const items = [];
  let pageToken = "";
  for (let page = 0; page < 100; page++) {
    const u = new URL(`${API}/b/${encodeURIComponent(bucket)}/o`);
    u.searchParams.set("prefix", prefix);
    u.searchParams.set("maxResults", "1000");
    u.searchParams.set("fields", "items(name,size,md5Hash,generation,timeCreated,updated),nextPageToken");
    if (pageToken) u.searchParams.set("pageToken", pageToken);
    const j = await gcsJson(u.toString(), token, fetchFn);
    for (const it of (j && j.items) || []) {
      items.push({ name: it.name, size: Number(it.size), md5: it.md5Hash || null,
        generation: String(it.generation), timeCreated: it.timeCreated, updated: it.updated });
    }
    pageToken = j && j.nextPageToken;
    if (!pageToken) break;
  }
  items.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  return items;
}

export async function openObject(bucket, obj, token, fetchFn = fetch) {
  const u = `${API}/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(obj.name)}?alt=media&generation=${encodeURIComponent(obj.generation)}`;
  const res = await fetchFn(u, { headers: { authorization: `Bearer ${token}`, "accept-encoding": "identity" } });
  if (!res.ok || !res.body) throw new SourceError(`GCS download ${res.status} for ${obj.name}`);
  return res.body;
}
