import { readFile, writeFile } from "fs/promises";
import { join } from "path";
import {
  listAgents,
  upsertAgent,
  deleteAgentRecord,
  findAgentByUserId,
  getPoolSize,
  type Agent,
} from "./db";

// --- Constants ---

export const WORKSPACES_ROOT = "/root/workspaces";
export const OPENCLAW_CONFIG = "/root/.openclaw/openclaw.json";
export const REGISTRY_FILE = "/root/swain-agent-api/registry.json"; // legacy, kept for reference
export const CONVEX_BASE_URL = "https://wandering-sparrow-224.convex.site";
export const CONVEX_TOKEN = process.env.SWAIN_API_TOKEN;

export const SKILLS_ROOT = process.env.SKILLS_ROOT || "/root/.swain/skills";
export const AUTH_SOURCE = "/root/.openclaw/agents/main/agent/auth-profiles.json";
export const ALL_SKILLS = ["swain-onboarding", "swain-briefing", "swain-profile", "swain-boat-art", "swain-cli", "swain-card-create", "swain-library", "firecrawl"];
export const DESK_SKILLS = ["swain-content-desk", "swain-card-create", "swain-cli", "swain-library", "firecrawl", "swain-flyer"];
export const DESK_TEMPLATES = "/root/clawd/swain-agents/templates/content-desk";

// --- Types ---

export interface AgentEntry {
  type: "advisor" | "desk";
  status: "available" | "active" | "paused";
  createdAt: string;

  // Advisor-specific
  poolIndex?: number;
  userId?: string;
  captainName?: string;
  timezone?: string;
  assignedAt?: string;
  phone?: string;

  // Desk-specific
  region?: string;

  // Sprite fields
  spriteName?: string;    // e.g. "advisor-pool-01"
  spriteUrl?: string;     // e.g. "https://advisor-pool-01-xxx.sprites.app"

  // Pause state
  pausedAt?: string;
  pauseSnapshot?: {
    previousStatus: "available" | "active";
    crons: Array<{
      name: string;
      cron: string;
      timezone: string;
      session: string;
      systemEvent: string;
    }>;
  };
}

export interface AgentRegistry {
  agents: Record<string, AgentEntry>;
  pool: { size: number; version: number };
}

// --- Gateway config ---

export async function readConfig(): Promise<any> {
  return JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));
}

export async function writeConfig(config: any): Promise<void> {
  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}

// --- OpenClaw CLI wrapper ---

export async function openclaw(args: string[]): Promise<string> {
  const proc = Bun.spawn(["openclaw", ...args], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`openclaw ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`);
  }
  return stdout.trim();
}

// --- Convex HTTP client ---

export async function convexRequest(method: string, path: string, data?: unknown): Promise<any> {
  const url = `${CONVEX_BASE_URL}/api${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(CONVEX_TOKEN ? { Authorization: `Bearer ${CONVEX_TOKEN}` } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Convex ${method} ${path} failed [${res.status}]: ${text}`);
  }
  return res.json();
}

// --- Unified registry (backed by SQLite via db.ts) ---

function agentToEntry(a: Agent): AgentEntry {
  return {
    type: a.type as AgentEntry["type"],
    status: a.status as AgentEntry["status"],
    createdAt: a.created_at || "",
    poolIndex: a.pool_index ?? undefined,
    userId: a.user_id ?? undefined,
    captainName: a.captain_name ?? undefined,
    timezone: a.timezone ?? undefined,
    assignedAt: a.assigned_at ?? undefined,
    phone: a.phone ?? undefined,
    region: a.region ?? undefined,
    spriteName: a.sprite_name ?? undefined,
    spriteUrl: a.sprite_url ?? undefined,
    pausedAt: a.paused_at ?? undefined,
  };
}

function entryToAgent(id: string, e: AgentEntry): Agent {
  return {
    id,
    type: e.type,
    status: e.status,
    sprite_name: e.spriteName ?? null,
    sprite_url: e.spriteUrl ?? null,
    pool_index: e.poolIndex ?? null,
    user_id: e.userId ?? null,
    captain_name: e.captainName ?? null,
    phone: e.phone ?? null,
    timezone: e.timezone ?? null,
    region: e.region ?? null,
    created_at: e.createdAt || null,
    assigned_at: e.assignedAt ?? null,
    paused_at: e.pausedAt ?? null,
  };
}

export async function loadRegistry(): Promise<AgentRegistry> {
  const agents: Record<string, AgentEntry> = {};
  for (const a of listAgents()) {
    agents[a.id] = agentToEntry(a);
  }
  return {
    agents,
    pool: { size: getPoolSize(), version: 1 },
  };
}

export async function saveRegistry(reg: AgentRegistry): Promise<void> {
  // Determine which IDs are in the DB but not in the registry (deleted)
  const dbAgents = new Set(listAgents().map((a) => a.id));
  const regIds = new Set(Object.keys(reg.agents));

  // Upsert all entries from the registry
  for (const [id, entry] of Object.entries(reg.agents)) {
    upsertAgent(entryToAgent(id, entry));
  }

  // Delete agents that were removed from the registry object
  for (const dbId of dbAgents) {
    if (!regIds.has(dbId)) {
      deleteAgentRecord(dbId);
    }
  }
}

export function lookupByUserId(registry: AgentRegistry, userId: string): string | null {
  // Fast path: query DB directly (ignores the in-memory registry object)
  const agent = findAgentByUserId(userId);
  if (agent) return agent.id;
  return null;
}

export function poolAgentId(index: number): string {
  return `advisor-pool-${String(index).padStart(2, "0")}`;
}
