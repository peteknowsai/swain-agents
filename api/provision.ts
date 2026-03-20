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
import {
  WORKSPACES_ROOT,
  AUTH_SOURCE,
  SKILLS_ROOT,
  ALL_SKILLS,
  DESK_SKILLS,
  DESK_TEMPLATES,
  OPENCLAW_CONFIG,
  readConfig,
  writeConfig,
  openclaw,
  convexRequest,
  loadRegistry,
  saveRegistry,
  lookupByUserId as registryLookup,
  poolAgentId,
  type AgentRegistry,
  type AgentEntry,
} from "./shared";

const POOL_SIZE = 20;
const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

export interface DeskProvisionInput {
  name: string;
  region: string;
  lat: number;
  lon: number;
  scope?: string;
  description?: string;
  createdByLocation?: string;
  bounds?: { ne: { lat: number; lon: number }; sw: { lat: number; lon: number } };
}

// --- Local helpers (not shared) ---

async function geocodeBounds(region: string): Promise<{ ne: { lat: number; lon: number }; sw: { lat: number; lon: number } }> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error("GOOGLE_PLACES_API_KEY required for geocoding bounds");
  }
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(region)}&key=${GOOGLE_PLACES_API_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.results?.[0]?.geometry?.viewport) {
      const vp = data.results[0].geometry.viewport;
      return {
        ne: { lat: vp.northeast.lat, lon: vp.northeast.lng },
        sw: { lat: vp.southwest.lat, lon: vp.southwest.lng },
      };
    }
  } catch (err) {
    console.warn(`Geocoding failed for "${region}", using default bounds: ${err}`);
  }
  throw new Error(`Could not geocode "${region}" for bounds`);
}

function defaultBounds(lat: number, lon: number): { ne: { lat: number; lon: number }; sw: { lat: number; lon: number } } {
  return {
    ne: { lat: lat + 0.36, lon: lon + 0.45 },
    sw: { lat: lat - 0.36, lon: lon - 0.45 },
  };
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+") ? phone : `+${digits}`;
}

function toWhatsAppPhone(e164Phone: string): string {
  const phone = e164Phone.startsWith("+") ? e164Phone : `+${e164Phone}`;
  if (/^\+52\d{10}$/.test(phone)) {
    return `+521${phone.slice(3)}`;
  }
  return phone;
}

function phoneToBindingPeerId(e164Phone: string): string {
  return toWhatsAppPhone(e164Phone);
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

async function provisionPoolAgents(
  registry: AgentRegistry,
  config: any,
  startIndex: number,
  count: number,
): Promise<{ created: number; existing: number }> {
  let created = 0;
  let existing = 0;

  for (let i = startIndex; i < startIndex + count; i++) {
    const agentId = poolAgentId(i);
    const workspace = join(WORKSPACES_ROOT, agentId);

    if (registry.agents[agentId]) {
      existing++;
      continue;
    }

    await mkdir(workspace, { recursive: true });

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

    if (!config.agents.list.find((a: any) => a.id === agentId)) {
      config.agents.list.push({
        id: agentId, name: agentId, workspace,
        agentDir: `/root/.openclaw/agents/${agentId}/agent`,
        model: { primary: "anthropic/claude-sonnet-4-6" },
        subagents: { allowAgents: ["*"] },
      });
    }

    await copyAuthProfile(agentId);
    try { await symlink(workspace, join("/root/.openclaw", `workspace-${agentId}`)); } catch {}

    registry.agents[agentId] = {
      type: "advisor",
      status: "available",
      createdAt: new Date().toISOString(),
      poolIndex: i,
    };
    created++;
    console.log(`Pool agent ${agentId} created`);
  }

  return { created, existing };
}

export async function provisionPool(): Promise<{ created: number; existing: number }> {
  const registry = await loadRegistry();
  const config = await readConfig();
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  const result = await provisionPoolAgents(registry, config, 1, POOL_SIZE);

  if (result.created > 0) {
    await writeConfig(config);
    registry.pool.size = Object.values(registry.agents).filter(a => a.type === "advisor").length;
    await saveRegistry(registry);
    console.log(`Gateway config updated with ${result.created} new pool agents`);

    // Prime new agents
    await Bun.sleep(2000);
    for (const [agentId, entry] of Object.entries(registry.agents)) {
      if (entry.type === "advisor" && entry.status === "available") {
        try {
          await openclaw([
            "agent", "--agent", agentId,
            "--message", "You are a Swain advisor agent. You'll be assigned a captain soon. Read your workspace files to understand your role, then stand by.",
          ]);
          console.log(`Primed ${agentId}`);
        } catch (err) {
          console.error(`Failed to prime ${agentId} (non-fatal): ${err}`);
        }
      }
    }
  } else {
    await saveRegistry(registry);
  }

  return result;
}

// --- Expand pool ---

export async function expandPool(count: number = 20): Promise<{ created: number; nextIndex: number; totalAvailable: number }> {
  const registry = await loadRegistry();
  const config = await readConfig();
  if (!config.agents) config.agents = {};
  if (!config.agents.list) config.agents.list = [];

  // Find max poolIndex across all advisor entries
  let maxIndex = 0;
  for (const entry of Object.values(registry.agents)) {
    if (entry.type === "advisor" && entry.poolIndex !== undefined && entry.poolIndex > maxIndex) {
      maxIndex = entry.poolIndex;
    }
  }
  const startIndex = maxIndex + 1;

  const result = await provisionPoolAgents(registry, config, startIndex, count);

  if (result.created > 0) {
    await writeConfig(config);
    registry.pool.size = Object.values(registry.agents).filter(a => a.type === "advisor").length;
    await saveRegistry(registry);

    // Prime new agents
    await Bun.sleep(2000);
    for (let i = startIndex; i < startIndex + count; i++) {
      const agentId = poolAgentId(i);
      const entry = registry.agents[agentId];
      if (entry?.status === "available") {
        try {
          await openclaw([
            "agent", "--agent", agentId,
            "--message", "You are a Swain advisor agent. You'll be assigned a captain soon. Read your workspace files to understand your role, then stand by.",
          ]);
          console.log(`Primed ${agentId}`);
        } catch (err) {
          console.error(`Failed to prime ${agentId} (non-fatal): ${err}`);
        }
      }
    }
  } else {
    await saveRegistry(registry);
  }

  const totalAvailable = Object.values(registry.agents).filter(a => a.type === "advisor" && a.status === "available").length;
  return { created: result.created, nextIndex: startIndex + count, totalAvailable };
}

// --- Assign advisor from pool ---

export async function provisionAdvisor(input: CaptainInput): Promise<{ agentId: string; status: string; workspace: string }> {
  const registry = await loadRegistry();
  const phone = input.phone ? normalizePhone(input.phone) : "";

  // Phone uniqueness: reject if phone already assigned to an active agent
  if (phone) {
    const conflict = Object.entries(registry.agents).find(
      ([_, e]) => e.type === "advisor" && e.status === "active" && e.phone === phone
    );
    if (conflict) {
      throw new Error(`Phone ${phone} already assigned to ${conflict[0]} (${conflict[1].captainName})`);
    }
  }

  // Find first available pool agent
  const available = Object.entries(registry.agents)
    .filter(([_, e]) => e.type === "advisor" && e.status === "available")
    .sort((a, b) => (a[1].poolIndex ?? 0) - (b[1].poolIndex ?? 0))[0];

  if (!available) throw new Error("No available agents in pool. Run provisionPool() or expandPool() to add more.");

  const [agentId, entry] = available;
  const workspace = join(WORKSPACES_ROOT, agentId);
  const waPhone = phone ? toWhatsAppPhone(phone) : "";
  const jid = waPhone ? waPhone.replace(/^\+/, "") + "@s.whatsapp.net" : "";

  // Binding uniqueness: reject if WhatsApp binding already exists for this phone
  if (waPhone) {
    const config = await readConfig();
    const peerId = phoneToBindingPeerId(waPhone);
    const existing = config.bindings?.find(
      (b: any) => b.match?.peer?.id === peerId && b.match?.channel === "whatsapp"
    );
    if (existing) {
      throw new Error(`Phone ${waPhone} already bound to agent ${existing.agentId}`);
    }
  }

  // 1. Personalize workspace
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
  let boatId: string | undefined;
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
      const boatResult = JSON.parse(stdout);
      boatId = boatResult.boatId;
      console.log(`Boat created: ${boatId} (${input.boatName})`);
    } catch (err) {
      console.error(`Boat creation failed (non-fatal): ${err}`);
    }
  }

  // 3. WhatsApp routing
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

  // 4. Update registry
  entry.status = "active";
  entry.userId = input.userId;
  entry.captainName = input.name;
  entry.timezone = input.timezone;
  entry.phone = phone || undefined;
  entry.assignedAt = new Date().toISOString();
  await saveRegistry(registry);

  // 5. Initialize knowledge DB (Stoolap)
  try {
    const initProc = Bun.spawn([
      "swain", "knowledge", "init",
      `--db=${join(workspace, "knowledge.db")}`, "--json",
    ], { stdout: "pipe", stderr: "pipe" });
    await initProc.exited;
    console.log(`Knowledge DB initialized for ${agentId}`);
  } catch (err) {
    console.error(`Knowledge DB init failed (non-fatal): ${err}`);
  }

  // 6. Initialize boat scan progression
  if (boatId) {
    try {
      const scanProc = Bun.spawn([
        "swain", "scan", "initialize",
        `--user=${input.userId}`,
        `--boat=${boatId}`,
        "--json",
      ], { stdout: "pipe", stderr: "pipe" });
      const scanStdout = await new Response(scanProc.stdout).text();
      const scanExitCode = await scanProc.exited;
      if (scanExitCode === 0) {
        console.log(`Scan initialized for ${agentId}: ${scanStdout.trim().slice(0, 200)}`);
      } else {
        const scanStderr = await new Response(scanProc.stderr).text();
        console.error(`Scan init failed (non-fatal, exit ${scanExitCode}): ${scanStderr.trim().slice(0, 200)}`);
      }
    } catch (err) {
      console.error(`Scan initialization failed (non-fatal): ${err}`);
    }
  }

  // 7. Create crons + trigger intro
  if (waPhone) {
    try { await createDailyBriefingCron(input, agentId); }
    catch (err) { console.error(`Daily briefing cron failed (non-fatal): ${err}`); }

    try { await createBriefingWatchdog(input, agentId); }
    catch (err) { console.error(`Briefing watchdog cron failed (non-fatal): ${err}`); }

    try { await createLikedFlyersCheckCron(input, agentId); }
    catch (err) { console.error(`Liked flyers check cron failed (non-fatal): ${err}`); }

    try { await createProfileMaintenanceCron(input, agentId); }
    catch (err) { console.error(`Profile maintenance cron failed (non-fatal): ${err}`); }

    await Bun.sleep(2000);
    triggerIntro(agentId, input, waPhone);
  }

  console.log(`Advisor ${agentId} assigned to ${input.name} (${input.userId})`);
  return { agentId, status: "assigned", workspace };
}

// --- Intro: fire-and-forget via main session ---

function triggerIntro(agentId: string, input: CaptainInput, phone: string): void {
  const proc = Bun.spawn([
    "openclaw", "agent",
    "--agent", agentId,
    "--message", `You've been assigned as ${input.name}'s advisor. Read the swain-onboarding skill for Phase 1 instructions and send your intro message on WhatsApp now. Captain info: name="${input.name}", boat="${input.boatName || "boat"}", marina="${input.marina || "unknown"}", phone="${phone}", userId="${input.userId}".`,
  ], { stdout: "pipe", stderr: "pipe" });

  proc.exited.then(async (exitCode) => {
    if (exitCode === 0) {
      const stdout = await new Response(proc.stdout).text();
      console.log(`Intro completed for ${agentId}: ${stdout.trim().slice(0, 200)}`);
    } else {
      const stderr = await new Response(proc.stderr).text();
      console.error(`Intro failed for ${agentId} (exit ${exitCode}): ${stderr.trim().slice(0, 200)}`);
    }
  }).catch((err) => {
    console.error(`Intro process error for ${agentId}: ${err}`);
  });
}

// --- Daily briefing cron ---

async function createDailyBriefingCron(input: CaptainInput, agentId: string): Promise<void> {
  const hash = agentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const minuteOffset = hash % 20;
  const tz = input.timezone || "America/New_York";

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `Daily briefing - ${input.name}`,
    "--cron", `${minuteOffset} 6 * * *`,
    "--tz", tz,
    "--session", "main",
    "--system-event", `It's briefing time. Build today's daily briefing for ${input.name} using the swain-briefing skill. You have full conversation context — use anything ${input.name} has mentioned recently to personalize card selection. Check MEMORY.md for their interests and recent topics. Include today's boat art card. If a briefing already exists for today, reply NO_REPLY.`,
  ]);

  console.log(`Daily briefing cron created for ${agentId}: ${minuteOffset} 6 * * * ${tz}`);
}

async function createBriefingWatchdog(input: CaptainInput, agentId: string): Promise<void> {
  const hash = agentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const minuteOffset = hash % 20;
  const tz = input.timezone || "America/New_York";
  const watchdogMinute = minuteOffset + 30 >= 60 ? minuteOffset - 30 : minuteOffset + 30;
  const watchdogHour = minuteOffset + 30 >= 60 ? 7 : 6;

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `Briefing watchdog - ${input.name}`,
    "--cron", `${watchdogMinute} ${watchdogHour} * * *`,
    "--tz", tz,
    "--session", "main",
    "--system-event", `Briefing watchdog: check if today's briefing exists. Run swain briefing list --user=${input.userId} --json. If no briefing for today, build it now using the swain-briefing skill. If it already exists, reply NO_REPLY.`,
  ]);

  console.log(`Briefing watchdog cron created for ${agentId}: ${watchdogMinute} ${watchdogHour} * * * ${tz}`);
}

async function createLikedFlyersCheckCron(input: CaptainInput, agentId: string): Promise<void> {
  const tz = input.timezone || "America/New_York";

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `Liked flyers check - ${input.name}`,
    "--cron", "0 8,12,16,20 * * *",
    "--tz", tz,
    "--session", "main",
    "--system-event", `Check for liked flyers using the swain-briefing skill step 3. If any liked flyers exist, create personalized cards. Then NO_REPLY.`,
  ]);

  console.log(`Liked flyers check cron created for ${agentId}: 0 8,12,16,20 * * * ${tz}`);
}

async function createProfileMaintenanceCron(input: CaptainInput, agentId: string): Promise<void> {
  const tz = input.timezone || "America/New_York";

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `Profile maintenance - ${input.name}`,
    "--cron", "0 14 * * *",
    "--tz", tz,
    "--session", "main",
    "--system-event", `Review your captain's profile completeness. Run swain boat profile --user=${input.userId} --json. Plan follow-up questions for tomorrow's briefing. NO_REPLY.`,
  ]);

  console.log(`Profile maintenance cron created for ${agentId}: 0 14 * * * ${tz}`);
}

// --- Delete advisor ---

export async function deleteAdvisor(agentId: string): Promise<void> {
  if (!agentId.startsWith("advisor-")) throw new Error("Can only delete advisor agents");

  const registry = await loadRegistry();
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

  // Tell gateway to unload agent
  try {
    await openclaw(["agents", "delete", agentId, "--force"]);
  } catch (err) {
    console.warn(`Gateway agent removal for ${agentId}: ${err}`);
  }

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

  // Remove from registry
  delete registry.agents[agentId];
  registry.pool.size = Object.values(registry.agents).filter(a => a.type === "advisor").length;
  await saveRegistry(registry);

  console.log(`Advisor ${agentId} deleted (removed from registry, gateway, workspace)`);
}

// --- Content desk provisioning ---

export async function provisionContentDesk(input: DeskProvisionInput): Promise<{ agentId: string; workspace: string; name: string; deskId?: string }> {
  const { name, region, lat, lon, scope, description, createdByLocation } = input;

  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) {
    throw new Error("Desk name must be a lowercase-hyphenated slug (e.g., tampa-bay)");
  }

  const agentId = `${name}-desk`;
  const workspace = join(WORKSPACES_ROOT, agentId);
  // Check if agent already exists in gateway
  const config = await readConfig();
  if (config.agents?.list?.find((a: any) => a.id === agentId)) {
    throw new Error(`Desk agent ${agentId} already exists`);
  }

  // 1. Create workspace and render templates
  await mkdir(workspace, { recursive: true });
  const vars = { deskName: name, region, lat: String(lat), lon: String(lon), scope: scope ?? "" };
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

  // 3. Register in gateway via CLI (hot-add to running gateway)
  await openclaw([
    "agents", "add", agentId,
    "--workspace", workspace,
    "--model", "anthropic/claude-sonnet-4-6",
    "--non-interactive",
    "--json",
  ]);

  // 4. Create task crons
  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `desk-requests-${name}`,
    "--cron", "0 6,12,18,0 * * *",
    "--tz", "UTC",
    "--session", "main",
    "--system-event", `Check editorial requests: swain desk requests --desk=${name} --status=pending --json. Fulfill any you can with existing cards or create new ones (max 2). Use swain-content-desk skill. NO_REPLY.`,
    "--json",
  ]);

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `desk-cards-${name}`,
    "--cron", "0 10 * * *",
    "--tz", "UTC",
    "--session", "main",
    "--system-event", `Run gap analysis: swain card coverage --desk=${name} --json. Create up to 3 cards for uncovered categories or stale content. Use swain-content-desk skill. NO_REPLY.`,
    "--json",
  ]);

  await openclaw([
    "cron", "add",
    "--agent", agentId,
    "--name", `desk-flyers-${name}`,
    "--cron", "0 8 * * *",
    "--tz", "UTC",
    "--session", "main",
    "--system-event", `Generate today's flyer batch for your region. Use the swain-flyer skill. NO_REPLY.`,
    "--wake", "now",
    "--json",
  ]);

  // 5. Copy auth profile
  await copyAuthProfile(agentId);

  // 6. Fallback workspace symlink
  try { await symlink(workspace, join("/root/.openclaw", `workspace-${agentId}`)); } catch {}

  // 7. Register in unified registry
  const registry = await loadRegistry();
  registry.agents[agentId] = {
    type: "desk",
    status: "active",
    createdAt: new Date().toISOString(),
    region,
  };
  await saveRegistry(registry);

  // 8. Create Convex desk record
  let deskId: string | undefined;
  try {
    let bounds = input.bounds;
    if (!bounds) {
      try {
        bounds = await geocodeBounds(region);
      } catch {
        bounds = defaultBounds(lat, lon);
        console.warn(`Using default bounds for "${region}" (geocoding failed)`);
      }
    }

    const convexResult = await convexRequest("POST", "/desks", {
      name, region,
      description: description ?? "",
      scope: scope ?? "",
      center: { lat, lon },
      bounds,
      createdByLocation: createdByLocation ?? region,
    });
    deskId = convexResult.id;
    console.log(`Desk registered in Convex: ${name} (${deskId})`);
  } catch (err) {
    console.error(`Convex registration failed (non-fatal): ${err}`);
  }

  // 9. Prime the agent
  await Bun.sleep(2000);
  try {
    await openclaw([
      "agent", "--agent", agentId,
      "--message", `You are a content desk for ${region}. Read your workspace files (AGENTS.md, TOOLS.md, SOUL.md) to understand your role, then read the swain-content-desk skill. Your crons will trigger your work on schedule.`,
    ]);
    console.log(`Primed ${agentId}`);
  } catch (err) {
    console.error(`Failed to prime ${agentId} (non-fatal): ${err}`);
  }

  console.log(`Content desk ${agentId} provisioned at ${workspace} (region: ${region})`);
  return { agentId, workspace, name, deskId };
}

export async function listDesks(): Promise<unknown[]> {
  const config = await readConfig();
  return (config.agents?.list ?? [])
    .filter((a: any) => (a.id || "").endsWith("-desk"));
}

export async function pauseDesk(name: string): Promise<void> {
  const { pauseAgent } = await import("./agents");
  await pauseAgent(`${name}-desk`);
}

export async function unpauseDesk(name: string): Promise<void> {
  const { resumeAgent } = await import("./agents");
  await resumeAgent(`${name}-desk`);
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

  // Tell gateway to unload agent
  try {
    await openclaw(["agents", "delete", agentId, "--force"]);
  } catch (err) {
    console.warn(`Gateway agent removal for ${agentId}: ${err}`);
  }

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

  // Remove from registry
  const registry = await loadRegistry();
  delete registry.agents[agentId];
  await saveRegistry(registry);

  // Delete Convex desk record
  try {
    await convexRequest("DELETE", `/desks/${name}`);
    console.log(`Desk Convex record deleted: ${name}`);
  } catch (err) {
    console.error(`Convex desk deletion failed (non-fatal): ${err}`);
  }

  console.log(`Content desk ${agentId} deleted (removed from gateway, workspace, Convex)`);
}

// --- Queries ---

export async function lookupByUserId(userId: string): Promise<string | null> {
  const registry = await loadRegistry();
  return registryLookup(registry, userId);
}

export async function listAdvisors(): Promise<unknown[]> {
  const config = await readConfig();
  return (config.agents?.list ?? []).filter((a: any) => (a.id || "").startsWith("advisor-"));
}

export async function getPoolStatus(): Promise<{
  size: number;
  available: number;
  assigned: number;
  agents: Array<{
    agentId: string;
    status: string;
    poolIndex?: number;
    captainName?: string;
    userId?: string;
    assignedAt?: string;
  }>;
}> {
  const registry = await loadRegistry();
  const advisors = Object.entries(registry.agents)
    .filter(([_, e]) => e.type === "advisor")
    .sort((a, b) => (a[1].poolIndex ?? 0) - (b[1].poolIndex ?? 0));

  const available = advisors.filter(([_, e]) => e.status === "available").length;
  const assigned = advisors.filter(([_, e]) => e.status !== "available").length;

  return {
    size: advisors.length,
    available,
    assigned,
    agents: advisors.map(([agentId, e]) => ({
      agentId,
      status: e.status,
      poolIndex: e.poolIndex,
      captainName: e.captainName,
      userId: e.userId,
      assignedAt: e.assignedAt,
    })),
  };
}
