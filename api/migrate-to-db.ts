#!/usr/bin/env bun
/**
 * One-time migration: JSON files → SQLite DB.
 *
 * Run on VPS: cd /root/clawd/swain-agents/api && bun run migrate-to-db.ts
 *
 * Safe to run multiple times — uses INSERT OR REPLACE.
 */

import { readFile, readdir } from "fs/promises";
import {
  db,
  upsertAgent,
  upsertRoute,
  saveSession,
  logCron,
  setLastProcessed,
  type Agent,
  type BridgeRoute,
} from "./db";

const REGISTRY_FILE = "/root/swain-agent-api/registry.json";
const BRIDGE_REGISTRY_FILE = "/root/clawd/swain-agents/bridge/registry.json";
const SESSION_DIR = "/root/swain-agent-api/chat-sessions";
const CRON_LOG_FILE = "/root/swain-agent-api/cron-log.jsonl";
const CATCHUP_FILE = "/root/clawd/swain-agents/bridge/last-processed.json";

let total = 0;

// --- Migrate Agent Registry ---
try {
  const raw = await readFile(REGISTRY_FILE, "utf-8");
  const registry = JSON.parse(raw);

  for (const [id, entry] of Object.entries(registry.agents) as any) {
    upsertAgent({
      id,
      type: entry.type,
      status: entry.status,
      sprite_name: entry.spriteName ?? null,
      sprite_url: entry.spriteUrl ?? null,
      pool_index: entry.poolIndex ?? null,
      user_id: entry.userId ?? null,
      captain_name: entry.captainName ?? null,
      phone: entry.phone ?? null,
      timezone: entry.timezone ?? null,
      region: entry.region ?? null,
      created_at: entry.createdAt ?? null,
      assigned_at: entry.assignedAt ?? null,
      paused_at: entry.pausedAt ?? null,
    });
    total++;
  }
  console.log(`✓ Agents: ${Object.keys(registry.agents).length} migrated`);
} catch (err) {
  console.log(`⚠ Agents: skipped (${err})`);
}

// --- Migrate Bridge Registry ---
try {
  const raw = await readFile(BRIDGE_REGISTRY_FILE, "utf-8");
  const entries = JSON.parse(raw) as any[];

  for (const entry of entries) {
    upsertRoute({
      agent_id: entry.id,
      name: entry.name ?? "",
      url: entry.url ?? "",
      phone_numbers: entry.phoneNumbers ?? [],
      discord_channel_ids: entry.discordChannelIds ?? [],
      allow_dms: entry.allowDMs ?? false,
    });
    total++;
  }
  console.log(`✓ Bridge routes: ${entries.length} migrated`);
} catch (err) {
  console.log(`⚠ Bridge routes: skipped (${err})`);
}

// --- Migrate Chat Sessions ---
try {
  const files = await readdir(SESSION_DIR);
  const sessionFiles = files.filter((f) => f.endsWith(".session"));
  let count = 0;

  for (const file of sessionFiles) {
    const chatId = file.replace(".session", "").replace(/_/g, ":").replace(/\+/g, "+");
    const sessionId = (await readFile(`${SESSION_DIR}/${file}`, "utf-8")).trim();
    if (sessionId) {
      saveSession(chatId, sessionId);
      count++;
    }
  }
  console.log(`✓ Sessions: ${count} migrated`);
  total += count;
} catch (err) {
  console.log(`⚠ Sessions: skipped (${err})`);
}

// --- Migrate Cron Log ---
try {
  const raw = await readFile(CRON_LOG_FILE, "utf-8");
  const lines = raw.split("\n").filter(Boolean);
  let count = 0;

  for (const line of lines) {
    try {
      const entry = JSON.parse(line);
      logCron({
        ts: entry.ts,
        schedule_id: entry.scheduleId,
        agent_id: entry.agentId,
        skill: entry.skill,
        status: entry.status,
        error: entry.error,
        duration_ms: entry.durationMs,
      });
      count++;
    } catch {}
  }
  console.log(`✓ Cron log: ${count} entries migrated`);
  total += count;
} catch (err) {
  console.log(`⚠ Cron log: skipped (${err})`);
}

// --- Migrate Catchup Timestamp ---
try {
  const raw = await readFile(CATCHUP_FILE, "utf-8");
  const data = JSON.parse(raw);
  if (data.timestamp) {
    setLastProcessed(data.timestamp);
    console.log(`✓ Catchup: timestamp ${new Date(data.timestamp).toISOString()}`);
    total++;
  }
} catch (err) {
  console.log(`⚠ Catchup: skipped (${err})`);
}

console.log(`\nDone. ${total} total records migrated to ${db.filename}`);
