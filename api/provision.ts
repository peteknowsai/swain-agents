import { mkdir, cp, readFile, writeFile, rm, symlink } from "fs/promises";
import { join } from "path";
import {
  type CaptainInput,
  generateSoul,
  generateIdentity,
  generateUser,
  renderTemplate,
  render,
} from "./templates";

const WORKSPACES_ROOT = "/root/workspaces";
const AUTH_SOURCE = "/root/.openclaw/agents/main/agent/auth-profiles.json";
const POOL_STATE_FILE = "/root/swain-agent-api/pool-state.json";
const REGISTRY_FILE = "/root/swain-agent-api/registry.json";
const OPENCLAW_CONFIG = "/root/.openclaw/openclaw.json";
const POOL_SIZE = 20;

// Skills symlinked into each advisor workspace
const SKILLS_ROOT = "/root/clawd/swain-agents/skills";
const ALL_SKILLS = ["swain-onboarding", "swain-briefing", "swain-profile", "swain-boat-art", "swain-cli", "swain-card-create", "swain-library", "firecrawl"];
const STYLIST_SKILLS = ["swain-stylist", "swain-cli", "swain-library"];
const STYLIST_TEMPLATES = "/root/clawd/swain-agents/templates/stylist";
const DESK_SKILLS = ["swain-content-desk", "swain-card-create", "swain-cli", "swain-library", "firecrawl"];
const DESK_TEMPLATES = "/root/clawd/swain-agents/templates/content-desk";

// --- Helpers ---

function normalizePhone(phone: string): string {
  // Expect E.164 from the frontend (e.g., +526692766911, +14156239773)
  // Just ensure the + prefix is present
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/**
 * Convert E.164 phone to WhatsApp's internal format.
 * Mexico: +52 + 10 digits → +521 + 10 digits (WhatsApp kept the old mobile prefix)
 * Everyone else: pass through as-is.
 */
function toWhatsAppPhone(e164Phone: string): string {
  const phone = e164Phone.startsWith("+") ? e164Phone : `+${e164Phone}`;
  // Mexican mobiles: +52XXXXXXXXXX (13 chars) → +521XXXXXXXXXX
  if (/^\+52\d{10}$/.test(phone)) {
    return `+521${phone.slice(3)}`;
  }
  return phone;
}

function phoneToBindingPeerId(e164Phone: string): string {
  return toWhatsAppPhone(e164Phone);
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

  // Prime new agents — boot their main session so it's warm for assignment
  if (created > 0) {
    await Bun.sleep(2000); // let gateway hot-reload the new agent configs
    const newAgents = state.agents.filter((a: PoolAgent) => a.status === "available");
    for (const agent of newAgents) {
      try {
        await openclaw([
          "agent",
          "--agent", agent.agentId,
          "--message", "You are a Swain advisor agent. You'll be assigned a captain soon. Read your workspace files to understand your role, then stand by.",
        ]);
        console.log(`Primed ${agent.agentId}`);
      } catch (err) {
        console.error(`Failed to prime ${agent.agentId} (non-fatal): ${err}`);
      }
    }
  }

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
  const waPhone = phone ? toWhatsAppPhone(phone) : "";
  const jid = waPhone ? waPhone.replace(/^\+/, "") + "@s.whatsapp.net" : "";

  // 1. Personalize workspace (use WhatsApp-format phone in templates)
  for (const file of ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"]) {
    const rendered = await renderTemplate(file, { userId: input.userId, phone: waPhone, jid, captainName: input.name });
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
  if (waPhone) {
    const config = await readConfig();
    if (!config.channels) config.channels = {};
    if (!config.channels.whatsapp) config.channels.whatsapp = {};
    const allowFrom: string[] = config.channels.whatsapp.allowFrom ?? [];
    if (!allowFrom.includes(waPhone)) {
      allowFrom.push(waPhone);
      config.channels.whatsapp.allowFrom = allowFrom;
    }
    if (!config.bindings) config.bindings = [];
    const peerId = phoneToBindingPeerId(waPhone);
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
  if (waPhone) {
    try { await createDailyBriefingCron(input, agentId); }
    catch (err) { console.error(`Daily briefing cron failed (non-fatal): ${err}`); }

    // Wait for config hot-reload to process binding/allowFrom changes
    await Bun.sleep(2000);

    // Synchronous intro via main session (blocks until agent completes turn)
    try { await triggerIntro(agentId, input, waPhone); }
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
    "--system-event", `It's briefing time. Build today's daily briefing for ${input.name} using the swain-briefing skill. You have full conversation context — use anything ${input.name} has mentioned recently to personalize card selection. Check MEMORY.md for their interests and recent topics. Include today's boat art card. If a briefing already exists for today, reply HEARTBEAT_OK.`,
    "--wake", "next-heartbeat",
  ]);

  console.log(`Daily briefing cron created for ${agentId}: ${minuteOffset} 11 * * * UTC`);
}

// --- Delete advisor (full removal from pool) ---

export async function deleteAdvisor(agentId: string): Promise<void> {
  if (!agentId.startsWith("advisor-")) throw new Error("Can only delete advisor agents");

  const state = await loadPoolState();
  const config = await readConfig();
  const workspace = join(WORKSPACES_ROOT, agentId);

  // Remove bindings for this agent
  if (config.bindings) {
    config.bindings = config.bindings.filter((b: any) => b.agentId !== agentId);
  }

  // Remove from gateway agent list
  if (config.agents?.list) {
    config.agents.list = config.agents.list.filter((a: any) => a.id !== agentId);
  }

  await writeConfig(config);

  // Remove cron jobs via CLI
  try {
    const cronOutput = await openclaw(["cron", "list", "--json"]);
    const cronData = JSON.parse(cronOutput);
    const jobs = cronData.jobs || cronData;
    for (const job of (Array.isArray(jobs) ? jobs : [])) {
      if (job.agentId === agentId) {
        await openclaw(["cron", "rm", job.id, "--json"]);
        console.log(`Removed cron job: ${job.name} (${job.id})`);
      }
    }
  } catch (err) {
    console.warn(`Cron cleanup for ${agentId}: ${err}`);
  }

  // Delete workspace
  await rm(workspace, { recursive: true, force: true });

  // Delete agent sessions/state dir
  await rm(join("/root/.openclaw/agents", agentId), { recursive: true, force: true });

  // Delete fallback symlink
  await rm(join("/root/.openclaw", `workspace-${agentId}`), { recursive: true, force: true });

  // Remove from pool state
  state.agents = state.agents.filter((a: PoolAgent) => a.agentId !== agentId);
  await savePoolState(state);

  // Remove from registry
  const reg = await loadRegistry();
  for (const [uid, aid] of Object.entries(reg)) {
    if (aid === agentId) delete reg[uid];
  }
  await saveRegistry(reg);

  console.log(`Advisor ${agentId} deleted (removed from pool, gateway, workspace)`);
}

// --- Stylist provisioning (one-off system agent) ---

export async function provisionStylist(): Promise<{ agentId: string; workspace: string }> {
  const agentId = "stylist";
  const workspace = join(WORKSPACES_ROOT, agentId);
  const config = await readConfig();
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // Check if already provisioned
  if (config.agents.list.find((a: any) => a.id === agentId)) {
    throw new Error("Stylist agent already provisioned");
  }

  // 1. Create workspace and copy template files
  await mkdir(workspace, { recursive: true });
  for (const file of ["AGENTS.md", "HEARTBEAT.md", "TOOLS.md", "SOUL.md"]) {
    const content = await readFile(join(STYLIST_TEMPLATES, file), "utf-8");
    await writeFile(join(workspace, file), content);
  }

  // 2. Symlink skills
  const skillsDest = join(workspace, "skills");
  await mkdir(skillsDest, { recursive: true });
  for (const skill of STYLIST_SKILLS) {
    const target = join(skillsDest, skill);
    try { await rm(target, { recursive: true, force: true }); } catch {}
    await symlink(join(SKILLS_ROOT, skill), target);
  }

  // 3. Register in gateway config with 30-min heartbeat
  config.agents.list.push({
    id: agentId,
    name: "stylist",
    workspace,
    agentDir: `/root/.openclaw/agents/${agentId}/agent`,
    model: { primary: "anthropic/claude-sonnet-4-6" },
    heartbeat: { every: "30m" },
    subagents: { allowAgents: [] },
  });
  await writeConfig(config);

  // 4. Copy auth profile
  await copyAuthProfile(agentId);

  // 5. Fallback workspace symlink
  try { await symlink(workspace, join("/root/.openclaw", `workspace-${agentId}`)); } catch {}

  console.log(`Stylist agent provisioned at ${workspace}`);
  return { agentId, workspace };
}

// --- Content desk provisioning ---

export async function provisionContentDesk({ name, region }: { name: string; region: string }): Promise<{ agentId: string; workspace: string }> {
  // Validate name slug
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Desk name must be a lowercase-hyphenated slug (e.g., tampa-bay)");
  }

  const agentId = `${name}-desk`;
  const workspace = join(WORKSPACES_ROOT, agentId);
  const config = await readConfig();
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // Check for duplicates
  if (config.agents.list.find((a: any) => a.id === agentId)) {
    throw new Error(`Desk agent ${agentId} already exists`);
  }

  // 1. Create workspace and render templates
  await mkdir(workspace, { recursive: true });
  const vars = { deskName: name, region };
  for (const file of ["AGENTS.md", "HEARTBEAT.md", "TOOLS.md", "SOUL.md"]) {
    const content = await readFile(join(DESK_TEMPLATES, file), "utf-8");
    await writeFile(join(workspace, file), render(content, vars));
  }

  // 2. Symlink skills
  const skillsDest = join(workspace, "skills");
  await mkdir(skillsDest, { recursive: true });
  for (const skill of DESK_SKILLS) {
    const target = join(skillsDest, skill);
    try { await rm(target, { recursive: true, force: true }); } catch {}
    await symlink(join(SKILLS_ROOT, skill), target);
  }

  // 3. Register in gateway config
  config.agents.list.push({
    id: agentId,
    name: agentId,
    workspace,
    agentDir: `/root/.openclaw/agents/${agentId}/agent`,
    model: { primary: "anthropic/claude-sonnet-4-6" },
    heartbeat: { every: "4h" },
    subagents: { allowAgents: [] },
  });
  await writeConfig(config);

  // 4. Copy auth profile
  await copyAuthProfile(agentId);

  // 5. Fallback workspace symlink
  try { await symlink(workspace, join("/root/.openclaw", `workspace-${agentId}`)); } catch {}

  // 6. Register in Convex
  try {
    const proc = Bun.spawn([
      "swain", "agent", "create",
      `--agent=${agentId}`, "--type=desk",
      `--name=${name}`, `--region=${region}`,
      "--json",
    ], { stdout: "pipe", stderr: "pipe" });
    const stdout = await new Response(proc.stdout).text();
    await proc.exited;
    console.log(`Desk registered in Convex: ${stdout.trim().slice(0, 200)}`);
  } catch (err) {
    console.error(`Convex registration failed (non-fatal): ${err}`);
  }

  // 7. Prime the agent
  await Bun.sleep(2000);
  try {
    await openclaw([
      "agent",
      "--agent", agentId,
      "--message", `You are a content desk for ${region}. Read your workspace files (AGENTS.md, HEARTBEAT.md, TOOLS.md, SOUL.md) to understand your role, then read the swain-content-desk skill. Stand by for your first heartbeat.`,
    ]);
    console.log(`Primed ${agentId}`);
  } catch (err) {
    console.error(`Failed to prime ${agentId} (non-fatal): ${err}`);
  }

  console.log(`Content desk ${agentId} provisioned at ${workspace} (region: ${region})`);
  return { agentId, workspace };
}

export async function listDesks(): Promise<unknown[]> {
  const config = await readConfig();
  return (config.agents?.list ?? [])
    .filter((a: any) => (a.id || "").endsWith("-desk"))
    .map((a: any) => ({ ...a, paused: !a.heartbeat }));
}

export async function pauseDesk(name: string): Promise<void> {
  const agentId = `${name}-desk`;
  const config = await readConfig();
  const agent = (config.agents?.list ?? []).find((a: any) => a.id === agentId);
  if (!agent) throw new Error(`Desk agent ${agentId} not found`);
  delete agent.heartbeat;
  await writeConfig(config);
  console.log(`Content desk ${agentId} paused (heartbeat removed)`);
}

export async function unpauseDesk(name: string): Promise<void> {
  const agentId = `${name}-desk`;
  const config = await readConfig();
  const agent = (config.agents?.list ?? []).find((a: any) => a.id === agentId);
  if (!agent) throw new Error(`Desk agent ${agentId} not found`);
  agent.heartbeat = { every: "4h" };
  await writeConfig(config);
  console.log(`Content desk ${agentId} unpaused (heartbeat: 4h)`);
}

export async function deleteDesk(name: string): Promise<void> {
  const agentId = `${name}-desk`;
  const workspace = join(WORKSPACES_ROOT, agentId);
  const config = await readConfig();

  // Remove from gateway agent list
  if (config.agents?.list) {
    config.agents.list = config.agents.list.filter((a: any) => a.id !== agentId);
  }
  await writeConfig(config);

  // Remove cron jobs
  try {
    const cronOutput = await openclaw(["cron", "list", "--json"]);
    const cronData = JSON.parse(cronOutput);
    const jobs = cronData.jobs || cronData;
    for (const job of (Array.isArray(jobs) ? jobs : [])) {
      if (job.agentId === agentId) {
        await openclaw(["cron", "rm", job.id, "--json"]);
        console.log(`Removed cron job: ${job.name} (${job.id})`);
      }
    }
  } catch (err) {
    console.warn(`Cron cleanup for ${agentId}: ${err}`);
  }

  // Delete workspace
  await rm(workspace, { recursive: true, force: true });

  // Delete agent sessions/state dir
  await rm(join("/root/.openclaw/agents", agentId), { recursive: true, force: true });

  // Delete fallback symlink
  await rm(join("/root/.openclaw", `workspace-${agentId}`), { recursive: true, force: true });

  // Unregister from Convex
  try {
    const proc = Bun.spawn([
      "swain", "agent", "delete",
      `--agent=${agentId}`, "--force", "--json",
    ], { stdout: "pipe", stderr: "pipe" });
    await proc.exited;
    console.log(`Desk unregistered from Convex: ${agentId}`);
  } catch (err) {
    console.error(`Convex unregistration failed (non-fatal): ${err}`);
  }

  console.log(`Content desk ${agentId} deleted (removed from gateway, workspace, Convex)`);
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
