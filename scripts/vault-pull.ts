#!/usr/bin/env bun
/**
 * Pull advisor memory files from R2 into the local Obsidian vault.
 *
 * Syncs: R2 bucket (swain-vaults) → ~/Vaults/swain/
 *
 * R2 key structure: advisors/<captain-name>/memory/captain.md
 * Local structure:  ~/Vaults/swain/advisors/<captain-name>/memory/captain.md
 *
 * Usage:
 *   bun scripts/vault-pull.ts              # one-shot sync
 *   bun scripts/vault-pull.ts --watch      # poll every 30s
 *   bun scripts/vault-pull.ts --watch 10   # poll every 10s
 */

import {
  S3Client,
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { mkdir, writeFile, stat } from "fs/promises";
import { join, dirname } from "path";

const VAULT_DIR = process.env.VAULT_DIR || join(process.env.HOME!, "Vaults", "swain");
const BUCKET = process.env.R2_BUCKET || "swain-vaults";
const PREFIX = "advisors/"; // only sync advisor files

const s3 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

interface SyncState {
  etags: Record<string, string>; // key → etag
}

let state: SyncState = { etags: {} };

async function pullAll(): Promise<number> {
  let updated = 0;
  let continuationToken: string | undefined;

  do {
    const res = await s3.send(new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX,
      ContinuationToken: continuationToken,
    }));

    for (const obj of res.Contents ?? []) {
      if (!obj.Key || !obj.ETag) continue;

      // Skip _meta.json files
      if (obj.Key.endsWith("_meta.json")) continue;

      // Skip if etag unchanged
      if (state.etags[obj.Key] === obj.ETag) continue;

      // Download
      try {
        const getRes = await s3.send(new GetObjectCommand({
          Bucket: BUCKET,
          Key: obj.Key,
        }));

        const body = await getRes.Body?.transformToString();
        if (!body) continue;

        // Write to local vault
        const localPath = join(VAULT_DIR, obj.Key);
        await mkdir(dirname(localPath), { recursive: true });
        await writeFile(localPath, body);

        state.etags[obj.Key] = obj.ETag;
        updated++;

        const shortKey = obj.Key.replace(PREFIX, "");
        console.log(`  ↓ ${shortKey}`);
      } catch (err) {
        console.error(`  ✗ ${obj.Key}: ${err}`);
      }
    }

    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return updated;
}

async function sync(): Promise<void> {
  const start = Date.now();
  const updated = await pullAll();
  const elapsed = ((Date.now() - start) / 1000).toFixed(1);

  if (updated > 0) {
    console.log(`[vault-pull] synced ${updated} file(s) in ${elapsed}s → ${VAULT_DIR}`);
  }
}

// --- Main ---

const args = process.argv.slice(2);
const watchMode = args.includes("--watch");
const intervalSec = watchMode
  ? Number(args[args.indexOf("--watch") + 1]) || 30
  : 0;

// Validate credentials
if (!process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_ENDPOINT) {
  console.error("Missing R2 credentials. Set R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT.");
  process.exit(1);
}

console.log(`[vault-pull] syncing R2 (${BUCKET}) → ${VAULT_DIR}`);

if (watchMode) {
  console.log(`[vault-pull] watching every ${intervalSec}s (Ctrl+C to stop)`);
  while (true) {
    await sync();
    await Bun.sleep(intervalSec * 1000);
  }
} else {
  await sync();
}
