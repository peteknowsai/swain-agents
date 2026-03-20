import { readFile, writeFile } from "fs/promises";
import { join } from "path";

// --- Constants ---

export const WORKSPACES_ROOT = "/root/workspaces";
export const OPENCLAW_CONFIG = "/root/.openclaw/openclaw.json";
export const REGISTRY_FILE = "/root/swain-agent-api/registry.json";
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

// --- Unified registry ---

export async function loadRegistry(): Promise<AgentRegistry> {
  try {
    return JSON.parse(await readFile(REGISTRY_FILE, "utf-8"));
  } catch {
    return { agents: {}, pool: { size: 0, version: 1 } };
  }
}

export async function saveRegistry(reg: AgentRegistry): Promise<void> {
  await writeFile(REGISTRY_FILE, JSON.stringify(reg, null, 2));
}

export function lookupByUserId(registry: AgentRegistry, userId: string): string | null {
  for (const [agentId, entry] of Object.entries(registry.agents)) {
    if (entry.userId === userId) return agentId;
  }
  return null;
}

export function poolAgentId(index: number): string {
  return `advisor-pool-${String(index).padStart(2, "0")}`;
}
