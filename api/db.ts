/**
 * Swain DB — single SQLite database for all VPS state.
 *
 * Replaces: registry.json, bridge/registry.json, chat-sessions/*.session,
 * cron-log.jsonl, last-processed.json, and in-memory scheduler state.
 *
 * Uses Bun's built-in SQLite (bun:sqlite) with WAL mode for concurrent
 * readers (API + Bridge processes on the same VPS).
 */

import { Database } from "bun:sqlite";

const DB_PATH = process.env.SWAIN_DB ?? "/root/swain-agent-api/swain.db";

const db = new Database(DB_PATH, { create: true });
db.exec("PRAGMA journal_mode=WAL");
db.exec("PRAGMA busy_timeout=5000");

// --- Schema ---

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    sprite_name TEXT,
    sprite_url TEXT,
    pool_index INTEGER,
    user_id TEXT,
    captain_name TEXT,
    phone TEXT,
    timezone TEXT,
    region TEXT,
    created_at TEXT,
    assigned_at TEXT,
    paused_at TEXT
  );

  CREATE TABLE IF NOT EXISTS bridge_routes (
    agent_id TEXT PRIMARY KEY,
    name TEXT,
    url TEXT,
    phone_numbers TEXT DEFAULT '[]',
    discord_channel_ids TEXT DEFAULT '[]',
    allow_dms INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS sessions (
    chat_id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL,
    agent_id TEXT,
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS cron_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts TEXT NOT NULL,
    schedule_id TEXT NOT NULL,
    agent_id TEXT NOT NULL,
    skill TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    duration_ms INTEGER
  );

  CREATE TABLE IF NOT EXISTS cron_state (
    key TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    retry_at INTEGER,
    created_at TEXT
  );

  CREATE TABLE IF NOT EXISTS catchup (
    key TEXT PRIMARY KEY DEFAULT 'last_processed',
    timestamp_ms INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_agents_type_status ON agents(type, status);
  CREATE INDEX IF NOT EXISTS idx_agents_phone ON agents(phone);
  CREATE INDEX IF NOT EXISTS idx_agents_user_id ON agents(user_id);
  CREATE INDEX IF NOT EXISTS idx_bridge_routes_phones ON bridge_routes(phone_numbers);
  CREATE TABLE IF NOT EXISTS daily_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    report TEXT NOT NULL,
    ts TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_cron_log_ts ON cron_log(ts);
  CREATE INDEX IF NOT EXISTS idx_cron_state_type ON cron_state(type);
  CREATE INDEX IF NOT EXISTS idx_reports_agent ON daily_reports(agent_id, ts);
`);

export { db };

// --- Types ---

export interface Agent {
  id: string;
  type: "advisor" | "desk";
  status: "available" | "active" | "paused";
  sprite_name: string | null;
  sprite_url: string | null;
  pool_index: number | null;
  user_id: string | null;
  captain_name: string | null;
  phone: string | null;
  timezone: string | null;
  region: string | null;
  created_at: string | null;
  assigned_at: string | null;
  paused_at: string | null;
}

export interface BridgeRoute {
  agent_id: string;
  name: string;
  url: string;
  phone_numbers: string[];
  discord_channel_ids: string[];
  allow_dms: boolean;
}

export interface CronLogEntry {
  ts: string;
  schedule_id: string;
  agent_id: string;
  skill: string;
  status: "triggered" | "success" | "failed" | "retry";
  error?: string;
  duration_ms?: number;
}

// --- Agent Operations ---

const stmtGetAgent = db.prepare("SELECT * FROM agents WHERE id = ?");
const stmtListAgents = db.prepare("SELECT * FROM agents");
const stmtListAgentsByTypeStatus = db.prepare("SELECT * FROM agents WHERE type = ? AND status = ?");
const stmtListAgentsByType = db.prepare("SELECT * FROM agents WHERE type = ?");
const stmtFindAgentByPhone = db.prepare("SELECT * FROM agents WHERE phone = ? AND status = 'active' AND type = 'advisor'");
const stmtFindAgentByUserId = db.prepare("SELECT * FROM agents WHERE user_id = ?");
const stmtCountAgentsByTypeStatus = db.prepare("SELECT COUNT(*) as count FROM agents WHERE type = ? AND status = ?");

export function getAgent(id: string): Agent | null {
  return stmtGetAgent.get(id) as Agent | null;
}

export function listAgents(filter?: { type?: string; status?: string }): Agent[] {
  if (filter?.type && filter?.status) {
    return stmtListAgentsByTypeStatus.all(filter.type, filter.status) as Agent[];
  }
  if (filter?.type) {
    return stmtListAgentsByType.all(filter.type) as Agent[];
  }
  return stmtListAgents.all() as Agent[];
}

export function findAgentByPhone(phone: string): Agent | null {
  return stmtFindAgentByPhone.get(phone) as Agent | null;
}

export function findAgentByUserId(userId: string): Agent | null {
  return stmtFindAgentByUserId.get(userId) as Agent | null;
}

export function countAgents(type: string, status: string): number {
  const row = stmtCountAgentsByTypeStatus.get(type, status) as { count: number };
  return row.count;
}

const stmtUpsertAgent = db.prepare(`
  INSERT INTO agents (id, type, status, sprite_name, sprite_url, pool_index, user_id, captain_name, phone, timezone, region, created_at, assigned_at, paused_at)
  VALUES ($id, $type, $status, $sprite_name, $sprite_url, $pool_index, $user_id, $captain_name, $phone, $timezone, $region, $created_at, $assigned_at, $paused_at)
  ON CONFLICT(id) DO UPDATE SET
    type=excluded.type, status=excluded.status, sprite_name=excluded.sprite_name, sprite_url=excluded.sprite_url,
    pool_index=excluded.pool_index, user_id=excluded.user_id, captain_name=excluded.captain_name, phone=excluded.phone,
    timezone=excluded.timezone, region=excluded.region, created_at=excluded.created_at, assigned_at=excluded.assigned_at,
    paused_at=excluded.paused_at
`);

export function upsertAgent(agent: Agent): void {
  stmtUpsertAgent.run({
    $id: agent.id,
    $type: agent.type,
    $status: agent.status,
    $sprite_name: agent.sprite_name,
    $sprite_url: agent.sprite_url,
    $pool_index: agent.pool_index,
    $user_id: agent.user_id,
    $captain_name: agent.captain_name,
    $phone: agent.phone,
    $timezone: agent.timezone,
    $region: agent.region,
    $created_at: agent.created_at,
    $assigned_at: agent.assigned_at,
    $paused_at: agent.paused_at,
  });
}

export function updateAgentFields(id: string, fields: Partial<Agent>): void {
  const agent = getAgent(id);
  if (!agent) return;
  upsertAgent({ ...agent, ...fields });
}

export function deleteAgentRecord(id: string): void {
  db.prepare("DELETE FROM agents WHERE id = ?").run(id);
}

// Pool helpers
export function getPoolSize(): number {
  const row = db.prepare("SELECT COUNT(*) as count FROM agents WHERE type = 'advisor'").get() as { count: number };
  return row.count;
}

export function getMaxPoolIndex(): number {
  const row = db.prepare("SELECT MAX(pool_index) as max_idx FROM agents WHERE type = 'advisor'").get() as { max_idx: number | null };
  return row.max_idx ?? 0;
}

export function getFirstAvailableAdvisor(): Agent | null {
  return db.prepare("SELECT * FROM agents WHERE type = 'advisor' AND status = 'available' ORDER BY pool_index ASC LIMIT 1").get() as Agent | null;
}

// --- Bridge Route Operations ---

const stmtGetRoute = db.prepare("SELECT * FROM bridge_routes WHERE agent_id = ?");
const stmtListRoutes = db.prepare("SELECT * FROM bridge_routes");

export function getRoute(agentId: string): BridgeRoute | null {
  const row = stmtGetRoute.get(agentId) as any;
  if (!row) return null;
  return {
    ...row,
    phone_numbers: JSON.parse(row.phone_numbers || "[]"),
    discord_channel_ids: JSON.parse(row.discord_channel_ids || "[]"),
    allow_dms: !!row.allow_dms,
  };
}

export function listRoutes(): BridgeRoute[] {
  return (stmtListRoutes.all() as any[]).map((row) => ({
    ...row,
    phone_numbers: JSON.parse(row.phone_numbers || "[]"),
    discord_channel_ids: JSON.parse(row.discord_channel_ids || "[]"),
    allow_dms: !!row.allow_dms,
  }));
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

const stmtUpsertRoute = db.prepare(`
  INSERT INTO bridge_routes (agent_id, name, url, phone_numbers, discord_channel_ids, allow_dms)
  VALUES ($agent_id, $name, $url, $phone_numbers, $discord_channel_ids, $allow_dms)
  ON CONFLICT(agent_id) DO UPDATE SET
    name=excluded.name, url=excluded.url, phone_numbers=excluded.phone_numbers,
    discord_channel_ids=excluded.discord_channel_ids, allow_dms=excluded.allow_dms
`);

export function upsertRoute(route: BridgeRoute): void {
  stmtUpsertRoute.run({
    $agent_id: route.agent_id,
    $name: route.name,
    $url: route.url,
    $phone_numbers: JSON.stringify(route.phone_numbers),
    $discord_channel_ids: JSON.stringify(route.discord_channel_ids),
    $allow_dms: route.allow_dms ? 1 : 0,
  });
}

export function updateRoutePhone(agentId: string, phone: string, name?: string): void {
  const route = getRoute(agentId);
  if (!route) return;
  if (!route.phone_numbers.includes(phone)) {
    route.phone_numbers.push(phone);
  }
  if (name) route.name = name;
  upsertRoute(route);
}

export function removeRoutePhone(agentId: string, phone: string): void {
  const route = getRoute(agentId);
  if (!route) return;
  route.phone_numbers = route.phone_numbers.filter((p) => p !== phone);
  route.name = `Pool ${agentId}`;
  upsertRoute(route);
}

export function deleteRoute(agentId: string): void {
  db.prepare("DELETE FROM bridge_routes WHERE agent_id = ?").run(agentId);
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

// --- Cron Operations ---

const stmtLogCron = db.prepare(`
  INSERT INTO cron_log (ts, schedule_id, agent_id, skill, status, error, duration_ms)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

export function logCron(entry: CronLogEntry): void {
  stmtLogCron.run(entry.ts, entry.schedule_id, entry.agent_id, entry.skill, entry.status, entry.error ?? null, entry.duration_ms ?? null);
}

export function getCronLog(options?: { limit?: number; agentId?: string; scheduleId?: string; since?: string }): CronLogEntry[] {
  let sql = "SELECT * FROM cron_log WHERE 1=1";
  const params: any[] = [];
  if (options?.agentId) { sql += " AND agent_id = ?"; params.push(options.agentId); }
  if (options?.scheduleId) { sql += " AND schedule_id = ?"; params.push(options.scheduleId); }
  if (options?.since) { sql += " AND ts >= ?"; params.push(options.since); }
  sql += " ORDER BY id DESC";
  if (options?.limit) { sql += " LIMIT ?"; params.push(options.limit); }
  return db.prepare(sql).all(...params) as CronLogEntry[];
}

const stmtMarkFired = db.prepare(`
  INSERT OR REPLACE INTO cron_state (key, type, created_at) VALUES (?, 'fired', ?)
`);
const stmtIsFired = db.prepare("SELECT 1 FROM cron_state WHERE key = ? AND type = 'fired'");
const stmtAddRetry = db.prepare(`
  INSERT OR REPLACE INTO cron_state (key, type, retry_at, created_at) VALUES (?, 'retry', ?, ?)
`);
const stmtGetRetries = db.prepare("SELECT key, retry_at FROM cron_state WHERE type = 'retry'");
const stmtClearRetry = db.prepare("DELETE FROM cron_state WHERE key = ?");
const stmtCleanOldFired = db.prepare("DELETE FROM cron_state WHERE type = 'fired' AND created_at < ?");

export function markFired(key: string): void {
  stmtMarkFired.run(key, new Date().toISOString());
}

export function isFired(key: string): boolean {
  return !!stmtIsFired.get(key);
}

export function addRetry(key: string, retryAt: number): void {
  stmtAddRetry.run(key, retryAt, new Date().toISOString());
}

export function getPendingRetries(): Array<{ key: string; retry_at: number }> {
  return stmtGetRetries.all() as Array<{ key: string; retry_at: number }>;
}

export function clearRetry(key: string): void {
  stmtClearRetry.run(key);
}

export function cleanOldFiredEntries(olderThan: string): void {
  stmtCleanOldFired.run(olderThan);
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

// --- Daily Reports ---

export interface DailyReport {
  id: number;
  agent_id: string;
  report: string;
  ts: string;
}

const stmtAddReport = db.prepare(
  "INSERT INTO daily_reports (agent_id, report, ts) VALUES (?, ?, ?)"
);

export function addReport(agentId: string, report: string, ts?: string): void {
  stmtAddReport.run(agentId, report, ts || new Date().toISOString());
}

export function getReports(options?: { agentId?: string; limit?: number }): DailyReport[] {
  let sql = "SELECT * FROM daily_reports WHERE 1=1";
  const params: any[] = [];
  if (options?.agentId) { sql += " AND agent_id = ?"; params.push(options.agentId); }
  sql += " ORDER BY id DESC";
  sql += ` LIMIT ${options?.limit || 30}`;
  return db.prepare(sql).all(...params) as DailyReport[];
}

// --- Transactions ---

export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}
