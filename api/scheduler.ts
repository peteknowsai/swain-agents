/**
 * Scheduler — runs inside the API server process.
 * Checks schedules every 60s, fires wake requests to sprites.
 *
 * State (fired dedup, retries, logs) is persisted in SQLite via db.ts.
 */

import { loadRegistry } from "./shared";
import type { AgentEntry } from "./shared";
import { wakeAgent } from "./provision-sprite";
import { SCHEDULES, type ScheduleEntry } from "./schedules";
import { matchesCron, toLocalTime, formatMinuteKey } from "./cron-utils";
import {
  markFired,
  isFired,
  addRetry,
  getPendingRetries,
  clearRetry,
  cleanOldFiredEntries,
  logCron as dbLogCron,
  getCronLog,
  type CronLogEntry,
} from "./db";

const RETRY_DELAY_MS = 5 * 60_000; // 5 minutes
const TICK_INTERVAL_MS = 60_000; // 1 minute
const FIRED_TTL_MS = 2 * 60 * 60_000; // 2 hours

// --- State (in-memory cache for lastRuns, DB is source of truth for everything else) ---

interface RunRecord {
  ts: string;
  status: "success" | "failed" | "retry";
  error?: string;
  durationMs?: number;
}

const lastRuns = new Map<string, RunRecord>(); // "scheduleId:agentId" → last result (cache)

// --- Logging ---

function logCronEntry(entry: CronLogEntry): void {
  const key = `${entry.schedule_id}:${entry.agent_id}`;
  lastRuns.set(key, { ts: entry.ts, status: entry.status as RunRecord["status"], error: entry.error, durationMs: entry.duration_ms });
  dbLogCron(entry);
  const icon = entry.status === "success" ? "✓" : entry.status === "failed" ? "✗" : "↻";
  console.log(`[scheduler] ${icon} ${entry.schedule_id} → ${entry.agent_id} (${entry.status}${entry.duration_ms ? ` ${entry.duration_ms}ms` : ""}${entry.error ? `: ${entry.error}` : ""})`);
}

// --- Core ---

async function fireWake(schedule: ScheduleEntry, agentId: string, options?: { noRetry?: boolean }): Promise<void> {
  const ts = new Date().toISOString();
  const start = Date.now();

  try {
    const result = await wakeAgent(agentId, schedule.skill);
    const durationMs = Date.now() - start;

    if (result.ok) {
      logCronEntry({ ts, schedule_id: schedule.id, agent_id: agentId, skill: schedule.skill, status: "success", duration_ms: durationMs });
    } else {
      logCronEntry({ ts, schedule_id: schedule.id, agent_id: agentId, skill: schedule.skill, status: "failed", error: result.error, duration_ms: durationMs });
      if (!options?.noRetry) enqueueRetry(schedule, agentId);
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    logCronEntry({ ts, schedule_id: schedule.id, agent_id: agentId, skill: schedule.skill, status: "failed", error: err.message, duration_ms: durationMs });
    if (!options?.noRetry) enqueueRetry(schedule, agentId);
  }
}

function enqueueRetry(schedule: ScheduleEntry, agentId: string): void {
  const key = `${schedule.id}:${agentId}`;
  // Check if already queued in DB
  const pending = getPendingRetries();
  if (pending.some((r) => r.key === key)) return;
  addRetry(key, Date.now() + RETRY_DELAY_MS);
  console.log(`[scheduler] retry queued: ${key} in ${RETRY_DELAY_MS / 1000}s`);
}

async function processRetries(): Promise<void> {
  const now = Date.now();
  for (const entry of getPendingRetries()) {
    if (now < entry.retry_at) continue;
    clearRetry(entry.key);

    // Parse key back to scheduleId:agentId
    const parts = entry.key.split(":");
    const agentId = parts.pop()!;
    const scheduleId = parts.join(":");
    const schedule = SCHEDULES.find((s) => s.id === scheduleId);
    if (!schedule) continue;

    const ts = new Date().toISOString();
    logCronEntry({ ts, schedule_id: scheduleId, agent_id: agentId, skill: schedule.skill, status: "retry" });
    // Fire-and-forget, no second retry — noRetry prevents infinite retry loops
    fireWake(schedule, agentId, { noRetry: true }).catch(() => {});
  }
}

function cleanFired(): void {
  const cutoff = new Date(Date.now() - FIRED_TTL_MS).toISOString();
  cleanOldFiredEntries(cutoff);
}

async function tick(): Promise<void> {
  const now = new Date();
  cleanFired();
  await processRetries();

  let registry;
  try {
    registry = await loadRegistry();
  } catch {
    return;
  }

  for (const schedule of SCHEDULES) {
    // Find matching agents
    const agents = Object.entries(registry.agents).filter(
      ([_, e]) => e.type === schedule.agentType && e.status === "active" && e.spriteName,
    );

    for (let i = 0; i < agents.length; i++) {
      const [agentId, entry] = agents[i];

      // Resolve timezone
      const tz = schedule.timezone === "agent" ? (entry.timezone || "America/New_York") : schedule.timezone;
      const { hour, minute } = toLocalTime(now, tz);

      if (!matchesCron(schedule.cron, hour, minute)) continue;

      // Dedup
      const dedupKey = `${schedule.id}:${agentId}:${formatMinuteKey(now)}`;
      if (isFired(dedupKey)) continue;
      markFired(dedupKey);

      // Stagger
      const delayMs = (schedule.stagger || 0) * i * 60_000;

      if (delayMs > 0) {
        setTimeout(() => fireWake(schedule, agentId).catch(() => {}), delayMs);
      } else {
        fireWake(schedule, agentId).catch(() => {});
      }
    }
  }
}

// --- Public API ---

export function startScheduler(): void {
  console.log(`[scheduler] started with ${SCHEDULES.length} schedules`);
  // Run first tick immediately to catch anything due right now
  tick().catch((err) => console.error("[scheduler] tick error:", err));
  setInterval(() => tick().catch((err) => console.error("[scheduler] tick error:", err)), TICK_INTERVAL_MS);
}

/** Manual trigger — bypasses cron check, fires immediately. */
export async function triggerSchedule(scheduleId: string, agentId?: string): Promise<{ triggered: string[] }> {
  const schedule = SCHEDULES.find((s) => s.id === scheduleId);
  if (!schedule) throw new Error(`Schedule "${scheduleId}" not found`);

  const registry = await loadRegistry();
  let agents: Array<[string, AgentEntry]>;

  if (agentId) {
    const entry = registry.agents[agentId];
    if (!entry) throw new Error(`Agent "${agentId}" not found`);
    agents = [[agentId, entry]];
  } else {
    agents = Object.entries(registry.agents).filter(
      ([_, e]) => e.type === schedule.agentType && e.status === "active" && e.spriteName,
    );
  }

  const triggered: string[] = [];
  for (const [id] of agents) {
    fireWake(schedule, id).catch(() => {});
    triggered.push(id);
  }

  return { triggered };
}

/** Status for observability endpoint. */
export function getSchedulerStatus(): {
  schedules: Array<{ id: string; skill: string; agentType: string; cron: string; timezone: string; description: string }>;
  lastRuns: Record<string, RunRecord>;
  pendingRetries: string[];
} {
  const runs: Record<string, RunRecord> = {};
  for (const [key, val] of lastRuns) {
    runs[key] = val;
  }

  return {
    schedules: SCHEDULES.map((s) => ({
      id: s.id,
      skill: s.skill,
      agentType: s.agentType,
      cron: s.cron,
      timezone: s.timezone === "agent" ? "agent (per-advisor)" : s.timezone,
      description: s.description,
    })),
    lastRuns: runs,
    pendingRetries: getPendingRetries().map((r) => r.key),
  };
}

/** Read recent log entries. */
export async function getSchedulerLog(options?: { limit?: number; agentId?: string; scheduleId?: string }): Promise<CronLogEntry[]> {
  return getCronLog({
    limit: options?.limit || 100,
    agentId: options?.agentId,
    scheduleId: options?.scheduleId,
  });
}
