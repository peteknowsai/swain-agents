import { mkdir, cp, readFile, writeFile, rm, symlink } from "fs/promises";
import { join } from "path";
import {
  type CaptainInput,
  generateSoul,
  generateIdentity,
  generateUser,
  renderTemplate,
} from "./templates";

const WORKSPACES_ROOT = "/root/workspaces";
const AUTH_SOURCE = "/root/.openclaw/agents/main/agent/auth-profiles.json";
const POOL_STATE_FILE = "/root/swain-agent-api/pool-state.json";
const REGISTRY_FILE = "/root/swain-agent-api/registry.json";
const OPENCLAW_CONFIG = "/root/.openclaw/openclaw.json";
const CRON_JOBS_FILE = "/root/.openclaw/cron/jobs.json";
const POOL_SIZE = 10;

// Skills symlinked into each advisor workspace
const SKILLS_ROOT = "/root/clawd/swain-agents/skills";
const ALL_SKILLS = ["swain-onboarding", "swain-advisor", "swain-boat-art", "swain-cli", "swain-card-create", "swain-library"];

// --- Helpers ---

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function phoneToBindingPeerId(e164Phone: string): string {
  return e164Phone.startsWith("+") ? e164Phone : `+${e164Phone}`;
}

function poolAgentId(index: number): string {
  return `advisor-pool-${String(index).padStart(2, "0")}`;
}

type Registry = Record<string, string>;

async function loadRegistry(): Promise<Registry> {
  try { return JSON.parse(await readFile(REGISTRY_FILE, "utf-8")); }
  catch { return {}; }
}

async function saveRegistry(reg: Registry): Promise<void> {
  await writeFile(REGISTRY_FILE, JSON.stringify(reg, null, 2));
}

interface PoolAgent {
  agentId: string;
  index: number;
  status: "available" | "assigned";
  userId?: string;
  captainName?: string;
  assignedAt?: string;
}

interface PoolState {
  version: number;
  agents: PoolAgent[];
}

async function loadPoolState(): Promise<PoolState> {
  try { return JSON.parse(await readFile(POOL_STATE_FILE, "utf-8")); }
  catch { return { version: 1, agents: [] }; }
}

async function savePoolState(state: PoolState): Promise<void> {
  await writeFile(POOL_STATE_FILE, JSON.stringify(state, null, 2));
}

async function readConfig(): Promise<any> {
  return JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));
}

async function writeConfig(config: any): Promise<void> {
  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
}

async function copyAuthProfile(agentId: string): Promise<void> {
  const destDir = `/root/.openclaw/agents/${agentId}/agent`;
  await mkdir(destDir, { recursive: true });
  await cp(AUTH_SOURCE, join(destDir, "auth-profiles.json"));
}

async function setupAdvisorSkills(workspaceDir: string): Promise<void> {
  const skillsDest = join(workspaceDir, "skills");
  await mkdir(skillsDest, { recursive: true });
  for (const skill of ALL_SKILLS) {
    const target = join(skillsDest, skill);
    try { await rm(target, { recursive: true, force: true }); } catch {}
    await symlink(join(SKILLS_ROOT, skill), target);
  }
}

async function openclaw(args: string[]): Promise<string> {
  const proc = Bun.spawn(["openclaw", ...args], { stdout: "pipe", stderr: "pipe" });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`openclaw ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`);
  }
  return stdout.trim();
}

function generateMemorySeed(input: CaptainInput): string {
  const lines: string[] = [`# MEMORY.md — Captain ${input.name}`, "", "## Captain"];
  lines.push(`- **Name:** ${input.name}`);
  lines.push(`- **User ID:** ${input.userId}`);
  if (input.phone) lines.push(`- **Phone:** ${normalizePhone(input.phone)}`);
  if (input.boatName) lines.push(`- **Boat:** ${input.boatName}${input.boatMakeModel ? ` (${input.boatMakeModel})` : ""}`);
  if (input.marina) lines.push(`- **Marina:** ${input.marina}`);
  if (input.experienceLevel) lines.push(`- **Experience:** ${input.experienceLevel}`);
  if (input.interests) lines.push(`- **Interests:** ${input.interests}`);
  lines.push("", "## Notes", "- Onboarding in progress");
  return lines.join("\n") + "\n";
}

// --- Pool provisioning (create blank agents) ---

export async function provisionPool(): Promise<{ created: number; existing: number }> {
  const state = await loadPoolState();
  const config = await readConfig();
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];
  let created = 0;
  let existing = 0;

  for (let i = 1; i <= POOL_SIZE; i++) {
    const agentId = poolAgentId(i);
    const workspace = join(WORKSPACES_ROOT, agentId);

    if (state.agents.find((a: PoolAgent) => a.agentId === agentId)) {
      existing++;
      continue;
    }

    await mkdir(workspace, { recursive: true });

    // Write placeholder templates (placeholders stay as-is until assignment)
    for (const file of ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"]) {
      const rendered = await renderTemplate(file, {
        userId: "{{userId}}", phone: "{{phone}}", jid: "{{jid}}", captainName: "{{captainName}}",
      });
      await writeFile(join(workspace, file), rendered);
    }
    await setupAdvisorSkills(workspace);
    await writeFile(join(workspace, "SOUL.md"), "# Swain\n\nAwaiting captain assignment.\n");
    await writeFile(join(workspace, "IDENTITY.md"), "# Identity\n\nAwaiting captain assignment.\n");
    await writeFile(join(workspace, "USER.md"), "# Captain\n\nNo captain assigned yet.\n");
    await writeFile(join(workspace, "MEMORY.md"), "# MEMORY.md\n\nNo captain assigned.\n");
    await mkdir(join(workspace, "memory"), { recursive: true });

    // Add to gateway config if missing
    if (!config.agents.list.find((a: any) => a.id === agentId)) {
      config.agents.list.push({
        id: agentId, name: agentId, workspace,
        agentDir: `/root/.openclaw/agents/${agentId}/agent`,
        model: { primary: "anthropic/claude-sonnet-4-6" },
        heartbeat: { every: "1h" },
        subagents: { allowAgents: ["*"] },
      });
    }

    await copyAuthProfile(agentId);

    // Fallback workspace symlink
    try { await symlink(workspace, join("/root/.openclaw", `workspace-${agentId}`)); } catch {}

    state.agents.push({ agentId, index: i, status: "available" });
    created++;
    console.log(`Pool agent ${agentId} created`);
  }

  if (created > 0) {
    await writeConfig(config);
    console.log(`Gateway config updated with ${created} new pool agents`);
  }
  await savePoolState(state);
  return { created, existing };
}

// --- Assign advisor from pool ---

export async function provisionAdvisor(input: CaptainInput): Promise<{ agentId: string; status: string; workspace: string }> {
  const state = await loadPoolState();
  const phone = input.phone ? normalizePhone(input.phone) : "";

  const available = state.agents.find((a: PoolAgent) => a.status === "available");
  if (!available) throw new Error("No available agents in pool. Run provisionPool() to add more.");

  const agentId = available.agentId;
  const workspace = join(WORKSPACES_ROOT, agentId);
  const jid = phone ? phone.replace(/^\+/, "") + "@s.whatsapp.net" : "";

  // 1. Personalize workspace
  for (const file of ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"]) {
    const rendered = await renderTemplate(file, { userId: input.userId, phone, jid, captainName: input.name });
    await writeFile(join(workspace, file), rendered);
  }
  await setupAdvisorSkills(workspace);
  await writeFile(join(workspace, "SOUL.md"), generateSoul(input));
  await writeFile(join(workspace, "IDENTITY.md"), generateIdentity(input, agentId));
  await writeFile(join(workspace, "USER.md"), generateUser(input));
  await writeFile(join(workspace, "MEMORY.md"), generateMemorySeed(input));

  // 2. Create boat in Convex
  if (input.boatName) {
    try {
      const proc = Bun.spawn([
        "swain", "boat", "create",
        `--user=${input.userId}`, `--name=${input.boatName}`,
        ...(input.boatMakeModel ? [`--makeModel=${input.boatMakeModel}`] : []),
        ...(input.marina ? [`--homePort=${input.marina}`] : []),
        "--isPrimary", "--json",
      ], { stdout: "pipe", stderr: "pipe" });
      const stdout = await new Response(proc.stdout).text();
      await proc.exited;
      console.log(`Boat created: ${JSON.parse(stdout).boatId} (${input.boatName})`);
    } catch (err) {
      console.error(`Boat creation failed (non-fatal): ${err}`);
    }
  }

  // 3. WhatsApp routing (config write only — no gateway restart)
  if (phone) {
    const config = await readConfig();
    if (!config.channels) config.channels = {};
    if (!config.channels.whatsapp) config.channels.whatsapp = {};
    const allowFrom: string[] = config.channels.whatsapp.allowFrom ?? [];
    if (!allowFrom.includes(phone)) {
      allowFrom.push(phone);
      config.channels.whatsapp.allowFrom = allowFrom;
    }
    if (!config.bindings) config.bindings = [];
    const peerId = phoneToBindingPeerId(phone);
    if (!config.bindings.find((b: any) => b.match?.peer?.id === peerId && b.match?.channel === "whatsapp")) {
      config.bindings.push({
        agentId,
        match: { channel: "whatsapp", peer: { kind: "direct", id: peerId } },
      });
    }
    await writeConfig(config);
  }

  // 4. Update pool state + registry
  available.status = "assigned";
  available.userId = input.userId;
  available.captainName = input.name;
  available.assignedAt = new Date().toISOString();
  await savePoolState(state);

  const reg = await loadRegistry();
  reg[input.userId] = agentId;
  await saveRegistry(reg);

  // 5. Create daily briefing cron + trigger intro
  if (phone) {
    try { await createDailyBriefingCron(input, agentId); }
    catch (err) { console.error(`Daily briefing cron failed (non-fatal): ${err}`); }

    // Wait for config hot-reload to process binding/allowFrom changes
    await Bun.sleep(2000);

    // Synchronous intro via main session (blocks until agent completes turn)
    try { await triggerIntro(agentId, input, phone); }
    catch (err) { console.error(`Intro trigger failed (non-fatal): ${err}`); }
  }

  console.log(`Advisor ${agentId} assigned to ${input.name} (${input.userId})`);
  return { agentId, status: "assigned", workspace };
}

// --- Intro: synchronous via main session ---
// Uses `openclaw agent --agent --message` to run intro in the agent's main session.
// Main session has full tool access (message tool, etc). Blocks until complete.

async function triggerIntro(agentId: string, input: CaptainInput, phone: string): Promise<void> {
  const output = await openclaw([
    "agent",
    "--agent", agentId,
    "--message", `You've been assigned as ${input.name}'s advisor. Read the swain-onboarding skill for Phase 1 instructions and send your intro message on WhatsApp now. Captain info: name="${input.name}", boat="${input.boatName || "boat"}", marina="${input.marina || "unknown"}", phone="${phone}", userId="${input.userId}".`,
  ]);
  console.log(`Intro triggered for ${agentId}: ${output.slice(0, 200)}`);
}

// --- Daily briefing cron via CLI ---

async function createDailyBriefingCron(input: CaptainInput, agentId: string): Promise<void> {
  const hash = agentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const minuteOffset = hash % 20; // spread 11:00–11:19 UTC

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `Daily briefing - ${input.name}`,
    "--cron", `${minuteOffset} 11 * * *`,
    "--tz", "UTC",
    "--session", "main",
    "--system-event", `It's briefing time. Build today's daily briefing for ${input.name} using the swain-advisor skill. You have full conversation context — use anything ${input.name} has mentioned recently to personalize card selection. Check MEMORY.md for their interests and recent topics. Include today's boat art card. If a briefing already exists for today, reply HEARTBEAT_OK.`,
    "--wake", "next-heartbeat",
  ]);

  console.log(`Daily briefing cron created for ${agentId}: ${minuteOffset} 11 * * * UTC`);
}

// --- Release advisor back to pool ---

export async function deleteAdvisor(agentId: string): Promise<void> {
  if (!agentId.startsWith("advisor-")) throw new Error("Can only delete advisor agents");

  const state = await loadPoolState();
  const agent = state.agents.find((a: PoolAgent) => a.agentId === agentId);

  if (!agent) {
    // Legacy (non-pool) advisor — full delete
    await deleteLegacyAdvisor(agentId);
    return;
  }

  const workspace = join(WORKSPACES_ROOT, agentId);
  const config = await readConfig();

  // Remove bindings for this agent
  if (config.bindings) {
    config.bindings = config.bindings.filter((b: any) => b.agentId !== agentId);
  }
  await writeConfig(config);

  // Remove cron jobs
  try {
    const cronData = JSON.parse(await readFile(CRON_JOBS_FILE, "utf-8"));
    const before = cronData.jobs.length;
    cronData.jobs = cronData.jobs.filter((j: any) => j.agentId !== agentId);
    if (cronData.jobs.length < before) {
      await writeFile(CRON_JOBS_FILE, JSON.stringify(cronData, null, 2));
    }
  } catch {}

  // Reset workspace to blank
  for (const file of ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"]) {
    const rendered = await renderTemplate(file, {
      userId: "{{userId}}", phone: "{{phone}}", jid: "{{jid}}", captainName: "{{captainName}}",
    });
    await writeFile(join(workspace, file), rendered);
  }
  await writeFile(join(workspace, "SOUL.md"), "# Swain\n\nAwaiting captain assignment.\n");
  await writeFile(join(workspace, "IDENTITY.md"), "# Identity\n\nAwaiting captain assignment.\n");
  await writeFile(join(workspace, "USER.md"), "# Captain\n\nNo captain assigned yet.\n");
  await writeFile(join(workspace, "MEMORY.md"), "# MEMORY.md\n\nNo captain assigned.\n");
  await setupAdvisorSkills(workspace);

  // Clear memory + sessions
  await rm(join(workspace, "memory"), { recursive: true, force: true });
  await mkdir(join(workspace, "memory"), { recursive: true });
  const sessionsDir = `/root/.openclaw/agents/${agentId}/sessions`;
  await rm(sessionsDir, { recursive: true, force: true });
  await mkdir(sessionsDir, { recursive: true });

  // Clear fallback symlink
  await rm(join("/root/.openclaw", `workspace-${agentId}`), { recursive: true, force: true });

  // Update pool state
  agent.status = "available";
  delete agent.userId;
  delete agent.captainName;
  delete agent.assignedAt;
  await savePoolState(state);

  // Update registry
  const reg = await loadRegistry();
  for (const [uid, aid] of Object.entries(reg)) {
    if (aid === agentId) delete reg[uid];
  }
  await saveRegistry(reg);

  console.log(`Advisor ${agentId} released back to pool`);
}

async function deleteLegacyAdvisor(agentId: string): Promise<void> {
  const config = await readConfig();
  if (config.agents?.list) {
    config.agents.list = config.agents.list.filter((a: any) => a.id !== agentId);
  }
  if (config.bindings) {
    config.bindings = config.bindings.filter((b: any) => b.agentId !== agentId);
  }
  await writeConfig(config);
  await rm(join(WORKSPACES_ROOT, agentId), { recursive: true, force: true });
  await rm(join("/root/.openclaw/agents", agentId), { recursive: true, force: true });
  await rm(join("/root/.openclaw", `workspace-${agentId}`), { recursive: true, force: true });
  try {
    const cronData = JSON.parse(await readFile(CRON_JOBS_FILE, "utf-8"));
    cronData.jobs = cronData.jobs.filter((j: any) => j.agentId !== agentId);
    await writeFile(CRON_JOBS_FILE, JSON.stringify(cronData, null, 2));
  } catch {}
  const reg = await loadRegistry();
  for (const [uid, aid] of Object.entries(reg)) {
    if (aid === agentId) delete reg[uid];
  }
  await saveRegistry(reg);
  console.log(`Legacy advisor ${agentId} deleted`);
}

// --- Queries ---

export async function lookupByUserId(userId: string): Promise<string | null> {
  const reg = await loadRegistry();
  return reg[userId] || null;
}

export async function listAdvisors(): Promise<unknown[]> {
  const config = await readConfig();
  return (config.agents?.list ?? []).filter((a: any) => (a.id || "").startsWith("advisor-"));
}

export async function getPoolStatus(): Promise<PoolState> {
  return loadPoolState();
}
