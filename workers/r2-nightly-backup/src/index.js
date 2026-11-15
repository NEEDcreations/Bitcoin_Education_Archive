// bq-r2-nightly-backup: cron Worker that starts a Workflow which copies one
// completed Firestore export from GCS (read-only) to R2 as tar.gz.age,
// encrypted ONLY to the owner's age public key. The Worker holds no
// decryption secret. Every write is confined to env.KEY_ROOT.
import { WorkflowEntrypoint } from "cloudflare:workers";
import { getAccessToken, listObjects, openObject, statObject, SourceError } from "./gcs.js";
import { packToR2, hashR2Object, IntegrityError } from "./pack.js";
import { resolveLabel, keysFor, putJson, safeError, MIN_FILES } from "./util.js";

export class BackupWorkflow extends WorkflowEntrypoint {
  async run(event, step) {
    const env = this.env;
    const root = env.KEY_ROOT;
    const bucket = env.GCS_BUCKET;
    const params = event.payload || {};
    const startedAt = new Date().toISOString();
    let label = "unknown";
    let stage = "resolve";
    try {
      label = resolveLabel(params, new Date(event.timestamp || Date.now()));
      const keys = keysFor(root, label);

      const src = await step.do("resolve-export", { retries: { limit: 3, delay: "20 seconds", backoff: "exponential" }, timeout: "5 minutes" }, async () => {
        const token = await getAccessToken(env);
        const metaName = `${label}/${label}.overall_export_metadata`;
        const meta = await statObject(bucket, metaName, token);
        if (!meta) throw new SourceError(`no completed export: gs://${bucket}/${metaName} missing`);
        const objects = await listObjects(bucket, `${label}/`, token);
        if (objects.length <= MIN_FILES) throw new SourceError(`export looks incomplete (${objects.length} files)`);
        const bytes = objects.reduce((a, b) => a + b.size, 0);
        return { objects, bytes, completedAt: meta.timeCreated, metaGeneration: String(meta.generation) };
      });

      if (params.mode === "list") {
        return { mode: "list", label, files: src.objects.length, bytes: src.bytes, completedAt: src.completedAt };
      }

      stage = "pack";
      const packed = await step.do("pack-encrypt-upload", { retries: { limit: 2, delay: "1 minute", backoff: "exponential" }, timeout: "45 minutes" }, async () => {
        const t0 = Date.now();
        let token = await getAccessToken(env);
        let tokenAt = Date.now();
        const open = async (ob) => {
          if (Date.now() - tokenAt > 45 * 60 * 1000) { token = await getAccessToken(env); tokenAt = Date.now(); }
          return openObject(bucket, ob, token);
        };
        const r = await packToR2({
          objects: src.objects, open, stripPrefix: "", recipient: env.BACKUP_AGE_RECIPIENT,
          r2: env.BACKUPS, key: keys.data, partSize: 8 * 1024 * 1024, prefetch: 3,
          customMetadata: { source: `gs://${bucket}/${label}/`, recipient: env.BACKUP_AGE_RECIPIENT, workflowInstance: event.instanceId || "" },
        });
        const manifest = {
          schema: "bq-r2-nightly-backup/manifest@1",
          label,
          source: { gcsFolder: `gs://${bucket}/${label}/`, exportCompletedAt: src.completedAt, metadataObject: `${label}/${label}.overall_export_metadata`, metadataGeneration: src.metaGeneration, docCount: null, docCountNote: "not in GCS listing; the export metadata file is protobuf" },
          encryption: { format: "age-encryption.org/v1", recipient: env.BACKUP_AGE_RECIPIENT, recipientType: "X25519", workerHoldsPrivateKey: false },
          totals: { files: r.files.length, plaintextBytes: r.files.reduce((a, f) => a + f.bytes, 0), listedBytes: src.bytes },
          tar: r.tar,
          gzip: r.gzip,
          ciphertext: r.ciphertext,
          files: r.files,
          run: { workflowInstance: event.instanceId || null, startedAt, packSeconds: Math.round((Date.now() - t0) / 1000) },
          restore: "age -d -i <phil-private-key> <data> | tar -tzv | wc -l  (expect totals.files); sha256 of decrypted .tar.gz must equal gzip.sha256",
        };
        await putJson(env.BACKUPS, keys.manifest, root, manifest);
        return { files: r.files.length, plaintextBytes: manifest.totals.plaintextBytes, tar: r.tar, gzip: r.gzip, ciphertext: r.ciphertext, packSeconds: manifest.run.packSeconds };
      });

      stage = "verify";
      const verified = await step.do("verify-r2", { retries: { limit: 2, delay: "30 seconds" }, timeout: "10 minutes" }, async () => {
        const h = await hashR2Object(env.BACKUPS, keys.data);
        if (!h.ageHeader) throw new IntegrityError("R2 object lacks age header");
        if (h.bytes !== packed.ciphertext.bytes || h.sha256 !== packed.ciphertext.sha256) throw new IntegrityError("R2 read-back does not match streamed ciphertext");
        if (packed.files !== src.objects.length || packed.plaintextBytes !== src.bytes) throw new IntegrityError("packed totals differ from GCS listing");
        const ok = { at: new Date().toISOString(), label, key: keys.data, manifest: keys.manifest, files: packed.files, plaintextBytes: packed.plaintextBytes, ciphertextBytes: h.bytes, ciphertextSha256: h.sha256, startedAt, workflowInstance: event.instanceId || null };
        await putJson(env.BACKUPS, keys.lastSuccess, root, ok);
        return ok;
      });
      return verified;
    } catch (err) {
      const e = safeError(err);
      await step.do("record-failure", async () => {
        await putJson(env.BACKUPS, `${root}_health/last-error.json`, root, { at: new Date().toISOString(), label, stage, error: e, startedAt, workflowInstance: event.instanceId || null });
        return true;
      });
      throw err;
    }
  }
}

export default {
  async scheduled(controller, env, ctx) {
    // Belt and braces: even if a cron is attached, do nothing unless enabled.
    if (env.CRON_ENABLED !== "true") { console.log("cron disabled (CRON_ENABLED != true)"); return; }
    const label = resolveLabel({}, new Date(controller.scheduledTime));
    const inst = await env.BACKUP_WORKFLOW.create({ id: `nightly-${label}-${controller.scheduledTime}`, params: { exportPrefix: label } });
    console.log(`started workflow ${inst.id}`);
  },
  async fetch() {
    // No HTTP surface. Manual runs: `wrangler workflows trigger <workflow> '{"exportPrefix":"..."}'`.
    return new Response("Not found", { status: 404 });
  },
};
