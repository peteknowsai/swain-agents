import { readdir, stat, readFile, realpath } from "fs/promises";
import { join, resolve } from "path";
import {
  WORKSPACES_ROOT,
  readConfig,
  writeConfig,
  openclaw,
  loadRegistry,
  saveRegistry,
  type AgentEntry,
  type AgentRegistry,
} from "./shared";
import { deleteAdvisor, deleteDesk } from "./provision";

const MAX_FILE_SIZE = 1_048_576; // 1MB

// --- Helpers ---

function getWorkspace(agentId: string): string {
  return join(WORKSPACES_ROOT, agentId);
}

async function getLastActivityAt(agentId: string): Promise<string | null> {
  try {
    const memoryPath = join(getWorkspace(agentId), "MEMORY.md");
    const s = await stat(memoryPath);
    return s.mtime.toISOString();
  } catch {
    return null;
  }
}

async function getCronJobs(agentId?: string): Promise<any[]> {
  try {
    const output = await openclaw(["cron", "list", "--json"]);
    const data = JSON.parse(output);
    const jobs: any[] = data.jobs || data;
    if (!Array.isArray(jobs)) return [];
    return agentId ? jobs.filter((j: any) => j.agentId === agentId) : jobs;
  } catch {
    return [];
  }
}

// --- List agents ---

interface ListFilters {
  type?: "advisor" | "desk";
  status?: "available" | "active" | "paused";
}

export async function listAgents(filters?: ListFilters): Promise<any[]> {
  const registry = await loadRegistry();
  const allCrons = await getCronJobs();

  const results: any[] = [];
  for (const [agentId, entry] of Object.entries(registry.agents)) {
    if (filters?.type && entry.type !== filters.type) continue;
    if (filters?.status && entry.status !== filters.status) continue;

    const cronCount = allCrons.filter((j: any) => j.agentId === agentId).length;
    const lastActivityAt = await getLastActivityAt(agentId);

    const agent: any = {
      agentId,
      type: entry.type,
      status: entry.status,
      cronCount,
      lastActivityAt,
    };

    if (entry.type === "advisor") {
      if (entry.captainName) agent.captainName = entry.captainName;
      if (entry.userId) agent.userId = entry.userId;
      if (entry.assignedAt) agent.assignedAt = entry.assignedAt;
      if (entry.poolIndex !== undefined) agent.poolIndex = entry.poolIndex;
    }

    if (entry.type === "desk") {
      if (entry.region) agent.region = entry.region;
    }

    results.push(agent);
  }

  return results;
}

// --- Get agent detail ---

export async function getAgent(agentId: string): Promise<any> {
  const registry = await loadRegistry();
  const entry = registry.agents[agentId];
  if (!entry) throw new Error(`Agent ${agentId} not found`);

  const crons = await getCronJobs(agentId);
  const lastActivityAt = await getLastActivityAt(agentId);
  const files = await listAgentFilesInternal(agentId);

  // Get gateway config for this agent
  let gatewayConfig: any = null;
  try {
    const config = await readConfig();
    const agentConfig = (config.agents?.list ?? []).find((a: any) => a.id === agentId);
    if (agentConfig) {
      gatewayConfig = {
        model: agentConfig.model,
        subagents: agentConfig.subagents,
      };
    }
  } catch {}

  const result: any = {
    agentId,
    type: entry.type,
    status: entry.status,
    crons: crons.map((c: any) => ({
      id: c.id,
      name: c.name,
      cron: c.cron,
      timezone: c.timezone || c.tz,
      session: c.session,
    })),
    lastActivityAt,
    workspaceFiles: files,
  };

  if (gatewayConfig) result.gatewayConfig = gatewayConfig;

  // Type-specific fields
  if (entry.type === "advisor") {
    if (entry.captainName) result.captainName = entry.captainName;
    if (entry.userId) result.userId = entry.userId;
    if (entry.timezone) result.timezone = entry.timezone;
    if (entry.assignedAt) result.assignedAt = entry.assignedAt;
    if (entry.poolIndex !== undefined) result.poolIndex = entry.poolIndex;
    if (entry.phone) result.phone = entry.phone;
  }

  if (entry.type === "desk") {
    if (entry.region) result.region = entry.region;
  }

  if (entry.pausedAt) result.pausedAt = entry.pausedAt;

  return result;
}

// --- Pause agent ---

export async function pauseAgent(agentId: string): Promise<any> {
  const registry = await loadRegistry();
  const entry = registry.agents[agentId];
  if (!entry) throw new Error(`Agent ${agentId} not found`);
  if (entry.status === "paused") throw new Error("Agent is already paused");

  // 1. Snapshot crons
  const crons = await getCronJobs(agentId);
  const cronSnapshots = crons.map((c: any) => ({
    name: c.name,
    cron: c.cron,
    timezone: c.timezone || c.tz || "UTC",
    session: c.session || "main",
    systemEvent: c.systemEvent || c.system_event || "",
  }));

  // 2. Delete cron jobs
  for (const cron of crons) {
    try {
      await openclaw(["cron", "rm", cron.id, "--json"]);
      console.log(`Removed cron: ${cron.name} (${cron.id})`);
    } catch (err) {
      console.warn(`Failed to remove cron ${cron.id}: ${err}`);
    }
  }

  // 3. Update registry
  entry.pauseSnapshot = {
    previousStatus: entry.status as "available" | "active",
    crons: cronSnapshots,
  };
  entry.status = "paused";
  entry.pausedAt = new Date().toISOString();
  await saveRegistry(registry);

  console.log(`Agent ${agentId} paused (${cronSnapshots.length} crons snapshotted)`);
  return { agentId, status: "paused", action: "paused" };
}

// --- Resume agent ---

export async function resumeAgent(agentId: string): Promise<any> {
  const registry = await loadRegistry();
  const entry = registry.agents[agentId];
  if (!entry) throw new Error(`Agent ${agentId} not found`);
  if (entry.status !== "paused") throw new Error("Agent is not paused");

  const snapshot = entry.pauseSnapshot;
  if (!snapshot) throw new Error("No pause snapshot found — cannot restore");

  // 1. Recreate crons
  let cronCount = 0;
  for (const cron of snapshot.crons) {
    try {
      const args = [
        "cron", "add",
        "--agent", agentId,
        "--name", cron.name,
        "--cron", cron.cron,
        "--tz", cron.timezone,
        "--session", cron.session,
      ];
      if (cron.systemEvent) {
        args.push("--system-event", cron.systemEvent);
      }
      await openclaw(args);
      cronCount++;
      console.log(`Restored cron: ${cron.name}`);
    } catch (err) {
      console.error(`Failed to restore cron "${cron.name}": ${err}`);
    }
  }

  // 3. Update registry — restore pre-pause status
  entry.status = snapshot.previousStatus || "active";
  delete entry.pausedAt;
  delete entry.pauseSnapshot;
  await saveRegistry(registry);

  console.log(`Agent ${agentId} resumed (${cronCount}/${snapshot.crons.length} crons restored)`);
  return {
    agentId,
    status: "active",
    action: "resumed",
    restored: { crons: cronCount },
  };
}

// --- Delete agent ---

export async function deleteAgent(agentId: string): Promise<void> {
  const registry = await loadRegistry();
  const entry = registry.agents[agentId];
  if (!entry) throw new Error(`Agent ${agentId} not found`);

  if (entry.type === "advisor") {
    await deleteAdvisor(agentId);
  } else if (entry.type === "desk") {
    // Extract desk name from agentId (e.g., "tampa-bay-desk" → "tampa-bay")
    const name = agentId.replace(/-desk$/, "");
    await deleteDesk(name);
  } else {
    throw new Error(`Unknown agent type: ${entry.type}`);
  }
}

// --- File listing ---

async function listAgentFilesInternal(agentId: string): Promise<Array<{ name: string; size: number; modifiedAt: string }>> {
  const workspace = getWorkspace(agentId);
  const files: Array<{ name: string; size: number; modifiedAt: string }> = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    let entries;
    try { entries = await readdir(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      // Skip skills/ directory — it's all symlinks to shared skill definitions
      if (entry.name === "skills" && prefix === "") continue;

      const fullPath = join(dir, entry.name);
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        await walk(fullPath, name);
      } else if (entry.isFile() || entry.isSymbolicLink()) {
        try {
          const s = await stat(fullPath);
          files.push({ name, size: s.size, modifiedAt: s.mtime.toISOString() });
        } catch {}
      }
    }
  }

  await walk(workspace, "");
  return files;
}

export async function listAgentFiles(agentId: string): Promise<any> {
  const registry = await loadRegistry();
  if (!registry.agents[agentId]) throw new Error(`Agent ${agentId} not found`);

  const workspace = getWorkspace(agentId);
  const files = await listAgentFilesInternal(agentId);

  return { agentId, workspace, files };
}

// --- File reading ---

export async function readAgentFile(agentId: string, filename: string): Promise<any> {
  const registry = await loadRegistry();
  if (!registry.agents[agentId]) throw new Error(`Agent ${agentId} not found`);

  const workspace = getWorkspace(agentId);
  const requestedPath = resolve(workspace, filename);

  // Path traversal guard: resolve symlinks and verify real path is within workspace
  let realPath: string;
  try {
    realPath = await realpath(requestedPath);
  } catch {
    throw new Error(`File not found: ${filename}`);
  }

  const realWorkspace = await realpath(workspace);
  if (!realPath.startsWith(realWorkspace + "/")) {
    throw new Error("Access denied: path outside workspace");
  }

  const s = await stat(realPath);
  if (s.size > MAX_FILE_SIZE) {
    throw new Error(`File too large: ${s.size} bytes (max ${MAX_FILE_SIZE})`);
  }

  const content = await readFile(realPath, "utf-8");
  return {
    agentId,
    filename,
    content,
    size: s.size,
    modifiedAt: s.mtime.toISOString(),
  };
}

// --- Cron listing ---

export async function listAgentCrons(agentId: string): Promise<any> {
  const registry = await loadRegistry();
  if (!registry.agents[agentId]) throw new Error(`Agent ${agentId} not found`);

  const crons = await getCronJobs(agentId);
  return {
    agentId,
    crons: crons.map((c: any) => ({
      id: c.id,
      name: c.name,
      cron: c.cron,
      timezone: c.timezone || c.tz,
      session: c.session,
    })),
  };
}
