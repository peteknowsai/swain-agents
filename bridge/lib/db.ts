/**
 * Bridge DB — thin wrapper over the shared SQLite database.
 *
 * Opens the same swain.db that the API server uses. WAL mode allows
 * concurrent readers, so both processes can hit it simultaneously.
 *
 * Only exposes the functions the Bridge needs: sessions, catchup, routes.
 */

import { Database } from "bun:sqlite";

const DB_PATH = process.env.SWAIN_DB ?? "/root/swain-agent-api/swain.db";

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA busy_timeout=5000");

// --- Types ---

export interface BridgeRoute {
  agent_id: string;
  name: string;
  url: string;
  phone_numbers: string[];
  discord_channel_ids: string[];
  allow_dms: boolean;
}

// --- Session Operations ---

const stmtGetSession = db.prepare("SELECT session_id FROM sessions WHERE chat_id = ?");
const stmtUpsertSession = db.prepare(`
  INSERT INTO sessions (chat_id, session_id, agent_id, updated_at)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(chat_id) DO UPDATE SET session_id=excluded.session_id, agent_id=excluded.agent_id, updated_at=excluded.updated_at
`);
const stmtDeleteSession = db.prepare("DELETE FROM sessions WHERE chat_id = ?");

export function getSession(chatId: string): string | null {
  const row = stmtGetSession.get(chatId) as { session_id: string } | null;
  return row?.session_id ?? null;
}

export function saveSession(chatId: string, sessionId: string, agentId?: string): void {
  stmtUpsertSession.run(chatId, sessionId, agentId ?? null, new Date().toISOString());
}

export function deleteSession(chatId: string): void {
  stmtDeleteSession.run(chatId);
}

// --- Catchup Operations ---

export function getLastProcessed(): number {
  const row = db.prepare("SELECT timestamp_ms FROM catchup WHERE key = 'last_processed'").get() as { timestamp_ms: number } | null;
  return row?.timestamp_ms ?? Date.now();
}

export function setLastProcessed(ts: number): void {
  db.prepare(`
    INSERT INTO catchup (key, timestamp_ms) VALUES ('last_processed', ?)
    ON CONFLICT(key) DO UPDATE SET timestamp_ms=excluded.timestamp_ms
  `).run(ts);
}

// --- Bridge Route Operations ---

const stmtListRoutes = db.prepare("SELECT * FROM bridge_routes");

function parseRoute(row: any): BridgeRoute {
  return {
    ...row,
    phone_numbers: JSON.parse(row.phone_numbers || "[]"),
    discord_channel_ids: JSON.parse(row.discord_channel_ids || "[]"),
    allow_dms: !!row.allow_dms,
  };
}

export function listRoutes(): BridgeRoute[] {
  return (stmtListRoutes.all() as any[]).map(parseRoute);
}

export function findRouteByPhone(phone: string): BridgeRoute | null {
  const normalized = phone.replace(/[\s\-()]/g, "");
  const routes = listRoutes();
  return routes.find((r) =>
    r.phone_numbers.some((p) => p.replace(/[\s\-()]/g, "") === normalized)
  ) ?? null;
}

export function findRouteByChannel(channelId: string): BridgeRoute | null {
  const routes = listRoutes();
  return routes.find((r) => r.discord_channel_ids.includes(channelId)) ?? null;
}

export function findRouteForDM(): BridgeRoute | null {
  const routes = listRoutes();
  return routes.find((r) => r.allow_dms) ?? null;
}

// --- Summaries ---

const stmtAddSummary = db.prepare(
  "INSERT INTO summaries (agent_id, session_id, summary, ts) VALUES (?, ?, ?, ?)"
);

export function addSummary(agentId: string, summary: string, sessionId?: string, ts?: string): void {
  stmtAddSummary.run(agentId, sessionId || null, summary, ts || new Date().toISOString());
}
