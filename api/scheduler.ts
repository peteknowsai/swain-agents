/**
 * Scheduler — runs inside the API server process.
 * Checks schedules every 60s, fires wake requests to sprites.
 */

import { appendFile } from "fs/promises";
import { loadRegistry } from "./shared";
import type { AgentEntry } from "./shared";
import { wakeAdvisor } from "./provision-sprite";
import { SCHEDULES, type ScheduleEntry } from "./schedules";
import { matchesCron, toLocalTime, formatMinuteKey } from "./cron-utils";

const LOG_FILE = process.env.CRON_LOG_FILE || "/root/swain-agent-api/cron-log.jsonl";
const RETRY_DELAY_MS = 5 * 60_000; // 5 minutes
const TICK_INTERVAL_MS = 60_000; // 1 minute

// --- State ---

interface RunRecord {
  ts: string;
  status: "success" | "failed" | "retry";
  error?: string;
  durationMs?: number;
}

const fired = new Set<string>();
const lastRuns = new Map<string, RunRecord>(); // "scheduleId:agentId" → last result
const retryQueue = new Map<string, { schedule: ScheduleEntry; agentId: string; at: number }>();

// --- Logging ---

interface LogEntry {
  ts: string;
  scheduleId: string;
  agentId: string;
  skill: string;
  status: "triggered" | "success" | "failed" | "retry";
  error?: string;
  durationMs?: number;
}

async function logCron(entry: LogEntry): Promise<void> {
  const key = `${entry.scheduleId}:${entry.agentId}`;
  lastRuns.set(key, { ts: entry.ts, status: entry.status as RunRecord["status"], error: entry.error, durationMs: entry.durationMs });
  try {
    await appendFile(LOG_FILE, JSON.stringify(entry) + "\n");
  } catch {
    // Log file write failure is non-fatal — VPS path may not exist in dev
  }
  const icon = entry.status === "success" ? "✓" : entry.status === "failed" ? "✗" : "↻";
  console.log(`[scheduler] ${icon} ${entry.scheduleId} → ${entry.agentId} (${entry.status}${entry.durationMs ? ` ${entry.durationMs}ms` : ""}${entry.error ? `: ${entry.error}` : ""})`);
}

// --- Core ---

function getMatchingAgents(schedule: ScheduleEntry): Array<[string, AgentEntry]> {
  // This is called synchronously per tick — registry is loaded once per tick
  return [];
}

async function fireWake(schedule: ScheduleEntry, agentId: string): Promise<void> {
  const ts = new Date().toISOString();
  const start = Date.now();

  try {
    const result = await wakeAdvisor(agentId, schedule.skill);
    const durationMs = Date.now() - start;

    if (result.ok) {
      await logCron({ ts, scheduleId: schedule.id, agentId, skill: schedule.skill, status: "success", durationMs });
    } else {
      await logCron({ ts, scheduleId: schedule.id, agentId, skill: schedule.skill, status: "failed", error: result.error, durationMs });
      enqueueRetry(schedule, agentId);
    }
  } catch (err: any) {
    const durationMs = Date.now() - start;
    await logCron({ ts, scheduleId: schedule.id, agentId, skill: schedule.skill, status: "failed", error: err.message, durationMs });
    enqueueRetry(schedule, agentId);
  }
}

function enqueueRetry(schedule: ScheduleEntry, agentId: string): void {
  const key = `${schedule.id}:${agentId}`;
  if (retryQueue.has(key)) return; // already queued
  retryQueue.set(key, { schedule, agentId, at: Date.now() + RETRY_DELAY_MS });
  console.log(`[scheduler] retry queued: ${key} in ${RETRY_DELAY_MS / 1000}s`);
}

async function processRetries(): Promise<void> {
  const now = Date.now();
  for (const [key, entry] of retryQueue) {
    if (now < entry.at) continue;
    retryQueue.delete(key);
    const ts = new Date().toISOString();
    await logCron({ ts, scheduleId: entry.schedule.id, agentId: entry.agentId, skill: entry.schedule.skill, status: "retry" });
    // Fire-and-forget, no second retry
    fireWake(entry.schedule, entry.agentId).catch(() => {});
  }
}

function cleanFired(now: Date): void {
  const twoMinAgo = formatMinuteKey(new Date(now.getTime() - 2 * 60_000));
  for (const key of fired) {
    if (key.split(":").slice(-1)[0] < twoMinAgo) {
      fired.delete(key);
    }
  }
}

async function tick(): Promise<void> {
  const now = new Date();
  cleanFired(now);
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
      ([_, e]) => e.type === schedule.agentType && e.status === "active" && e.spriteUrl,
    );

    for (let i = 0; i < agents.length; i++) {
      const [agentId, entry] = agents[i];

      // Resolve timezone
      const tz = schedule.timezone === "agent" ? (entry.timezone || "America/New_York") : schedule.timezone;
      const { hour, minute } = toLocalTime(now, tz);

      if (!matchesCron(schedule.cron, hour, minute)) continue;

      // Dedup
      const dedupKey = `${schedule.id}:${agentId}:${formatMinuteKey(now)}`;
      if (fired.has(dedupKey)) continue;
      fired.add(dedupKey);

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
      ([_, e]) => e.type === schedule.agentType && e.status === "active" && e.spriteUrl,
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
    pendingRetries: Array.from(retryQueue.keys()),
  };
}

/** Read recent log entries. */
export async function getSchedulerLog(options?: { limit?: number; agentId?: string; scheduleId?: string }): Promise<LogEntry[]> {
  const limit = options?.limit || 100;
  try {
    const { readFile } = await import("fs/promises");
    const raw = await readFile(LOG_FILE, "utf-8");
    let entries: LogEntry[] = raw
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line));

    if (options?.agentId) entries = entries.filter((e) => e.agentId === options.agentId);
    if (options?.scheduleId) entries = entries.filter((e) => e.scheduleId === options.scheduleId);

    return entries.slice(-limit);
  } catch {
    return [];
  }
}
