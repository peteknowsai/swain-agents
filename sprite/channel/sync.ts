/**
 * R2 vault sync — pushes changed .md files to Cloudflare R2.
 *
 * Runs after each claude -p turn. Compares mtimes against last sync
 * state and uploads only what changed. Non-blocking — errors are
 * logged but never surface to the captain.
 */

import {
  S3Client,
  PutObjectCommand,
  type PutObjectCommandInput,
} from "@aws-sdk/client-s3";
import { readdir, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const SYNC_STATE_FILE = "/home/sprite/.sync-state.json";
const HOME = "/home/sprite";

// Directories to sync (relative to HOME)
const SYNC_DIRS = [".claude/memory", "notes"];
// Individual files to sync (relative to HOME)
const SYNC_FILES = ["CLAUDE.md"];

interface SyncState {
  lastSync: number; // epoch ms
  mtimes: Record<string, number>; // path → mtime ms
}

let s3: S3Client | null = null;
let bucket: string | null = null;

function getClient(): S3Client | null {
  if (s3) return s3;

  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint = process.env.R2_ENDPOINT;
  bucket = process.env.R2_BUCKET ?? "swain-vaults";

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    return null;
  }

  s3 = new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
  });
  return s3;
}

async function loadSyncState(): Promise<SyncState> {
  try {
    const file = Bun.file(SYNC_STATE_FILE);
    if (await file.exists()) {
      return await file.json();
    }
  } catch {}
  return { lastSync: 0, mtimes: {} };
}

async function saveSyncState(state: SyncState): Promise<void> {
  await Bun.write(SYNC_STATE_FILE, JSON.stringify(state, null, 2));
}

/**
 * Recursively find all .md files in a directory.
 */
async function findMarkdownFiles(dir: string): Promise<string[]> {
  const results: string[] = [];
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      if (entry.isDirectory()) {
        // Skip hidden dirs except .claude
        if (entry.name.startsWith(".") && entry.name !== ".claude") continue;
        results.push(...(await findMarkdownFiles(fullPath)));
      } else if (entry.name.endsWith(".md")) {
        results.push(fullPath);
      }
    }
  } catch {}
  return results;
}

/**
 * Sync changed markdown files to R2.
 * Call after each claude -p turn. Safe to call concurrently — worst
 * case is a double-upload, which is harmless.
 */
export async function syncToR2(): Promise<void> {
  const client = getClient();
  if (!client || !bucket) {
    console.log("[sync] R2 not configured — skipping vault sync");
    return;
  }

  const state = await loadSyncState();
  const newMtimes: Record<string, number> = {};
  const toUpload: string[] = [];

  // Collect files from sync directories
  for (const dir of SYNC_DIRS) {
    const absDir = join(HOME, dir);
    const files = await findMarkdownFiles(absDir);
    for (const file of files) {
      const relPath = relative(HOME, file);
      const fileStat = await stat(file);
      const mtime = fileStat.mtimeMs;
      newMtimes[relPath] = mtime;

      if (!state.mtimes[relPath] || state.mtimes[relPath] < mtime) {
        toUpload.push(file);
      }
    }
  }

  // Check individual files
  for (const file of SYNC_FILES) {
    const absPath = join(HOME, file);
    try {
      const fileStat = await stat(absPath);
      const mtime = fileStat.mtimeMs;
      newMtimes[file] = mtime;

      if (!state.mtimes[file] || state.mtimes[file] < mtime) {
        toUpload.push(absPath);
      }
    } catch {}
  }

  if (toUpload.length === 0) {
    console.log("[sync] no changes to sync");
    return;
  }

  console.log(`[sync] uploading ${toUpload.length} file(s) to R2...`);

  let uploaded = 0;
  for (const filePath of toUpload) {
    const relPath = relative(HOME, filePath);
    // Remap .claude/memory/ → memory/ so Obsidian doesn't hide dotfolders
    const vaultPath = relPath.replace(/^\.claude\/memory\//, "memory/");
    const key = `${SPRITE_ID}/${vaultPath}`;

    try {
      const content = await Bun.file(filePath).text();
      const params: PutObjectCommandInput = {
        Bucket: bucket,
        Key: key,
        Body: content,
        ContentType: "text/markdown",
      };
      await client.send(new PutObjectCommand(params));
      uploaded++;
    } catch (err) {
      console.error(`[sync] failed to upload ${relPath}:`, err);
    }
  }

  // Save updated state
  state.lastSync = Date.now();
  state.mtimes = { ...state.mtimes, ...newMtimes };
  await saveSyncState(state);

  console.log(`[sync] done — ${uploaded}/${toUpload.length} files synced`);
}
