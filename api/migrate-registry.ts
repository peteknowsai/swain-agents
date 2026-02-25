/**
 * One-time migration: merge old pool-state.json + registry.json into the new
 * unified AgentRegistry format.
 *
 * Run on VPS before deploying:
 *   cd /root/clawd/swain-agents/api && bun run migrate-registry.ts
 *
 * Safe to run multiple times — skips agents already in the new format.
 */

import { readFile, writeFile, stat } from "fs/promises";
import { join } from "path";
import {
  REGISTRY_FILE,
  WORKSPACES_ROOT,
  readConfig,
  type AgentRegistry,
  type AgentEntry,
} from "./shared";

const POOL_STATE_FILE = "/root/swain-agent-api/pool-state.json";
const OLD_REGISTRY_FILE = "/root/swain-agent-api/registry.json";

interface OldPoolAgent {
  agentId: string;
  index: number;
  status: "available" | "assigned";
  userId?: string;
  captainName?: string;
  assignedAt?: string;
}

interface OldPoolState {
  version: number;
  agents: OldPoolAgent[];
}

async function loadOldPoolState(): Promise<OldPoolState | null> {
  try {
    return JSON.parse(await readFile(POOL_STATE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

async function loadOldRegistry(): Promise<Record<string, string> | null> {
  try {
    const data = JSON.parse(await readFile(OLD_REGISTRY_FILE, "utf-8"));
    // If it already has the new format (has "agents" key), skip
    if (data.agents && data.pool) return null;
    return data;
  } catch {
    return null;
  }
}

async function migrate() {
  console.log("=== Registry Migration ===\n");

  // Check if registry already has the new format
  try {
    const existing = JSON.parse(await readFile(REGISTRY_FILE, "utf-8"));
    if (existing.agents && existing.pool) {
      console.log("Registry already in unified format. Nothing to do.");
      console.log(`  ${Object.keys(existing.agents).length} agents, pool size: ${existing.pool.size}`);
      return;
    }
  } catch {}

  const oldPool = await loadOldPoolState();
  const oldRegistry = await loadOldRegistry();

  if (!oldPool && !oldRegistry) {
    console.log("No old data found. Nothing to do.");
    return;
  }

  const config = await readConfig();
  const gatewayAgents: any[] = config.agents?.list ?? [];

  const newRegistry: AgentRegistry = {
    agents: {},
    pool: { size: 0, version: oldPool?.version ?? 1 },
  };

  // Migrate pool agents (advisors)
  if (oldPool) {
    console.log(`Found ${oldPool.agents.length} pool agents in pool-state.json`);
    for (const agent of oldPool.agents) {
      const entry: AgentEntry = {
        type: "advisor",
        status: agent.status === "assigned" ? "active" : "available",
        createdAt: agent.assignedAt || new Date().toISOString(),
        heartbeatInterval: "1h",
        poolIndex: agent.index,
      };

      if (agent.userId) entry.userId = agent.userId;
      if (agent.captainName) entry.captainName = agent.captainName;
      if (agent.assignedAt) entry.assignedAt = agent.assignedAt;

      // Try to get timezone from old registry or gateway config
      if (oldRegistry && agent.userId) {
        // Old registry was userId→agentId, no timezone stored there
      }

      newRegistry.agents[agent.agentId] = entry;
    }
  }

  // Discover desk agents from gateway config (not in old pool/registry)
  for (const ga of gatewayAgents) {
    const id = ga.id || "";
    if (id.endsWith("-desk") && !newRegistry.agents[id]) {
      console.log(`Found desk agent in gateway config: ${id}`);

      // Try to extract region from workspace SOUL.md
      let region: string | undefined;
      try {
        const soulPath = join(WORKSPACES_ROOT, id, "SOUL.md");
        const soul = await readFile(soulPath, "utf-8");
        const regionMatch = soul.match(/content desk for (.+?)[\.\n]/i);
        if (regionMatch) region = regionMatch[1];
      } catch {}

      const entry: AgentEntry = {
        type: "desk",
        status: ga.heartbeat ? "active" : "paused",
        createdAt: new Date().toISOString(),
        heartbeatInterval: ga.heartbeat?.every || "4h",
      };
      if (region) entry.region = region;

      newRegistry.agents[id] = entry;
    }
  }

  newRegistry.pool.size = Object.values(newRegistry.agents).filter(a => a.type === "advisor").length;

  // Write the new registry
  console.log(`\nWriting unified registry with ${Object.keys(newRegistry.agents).length} agents:`);
  console.log(`  - Advisors: ${Object.values(newRegistry.agents).filter(a => a.type === "advisor").length}`);
  console.log(`  - Desks: ${Object.values(newRegistry.agents).filter(a => a.type === "desk").length}`);

  // Backup old files
  if (oldPool) {
    await writeFile(POOL_STATE_FILE + ".bak", JSON.stringify(oldPool, null, 2));
    console.log(`  Backed up pool-state.json → pool-state.json.bak`);
  }
  if (oldRegistry) {
    await writeFile(OLD_REGISTRY_FILE + ".bak", JSON.stringify(oldRegistry, null, 2));
    console.log(`  Backed up registry.json → registry.json.bak`);
  }

  await writeFile(REGISTRY_FILE, JSON.stringify(newRegistry, null, 2));
  console.log(`\nDone! New registry written to ${REGISTRY_FILE}`);
  console.log(JSON.stringify(newRegistry, null, 2));
}

migrate().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
