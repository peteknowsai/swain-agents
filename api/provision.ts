import { mkdir, cp, readdir, readFile, writeFile, rm } from "fs/promises";
import { join } from "path";
import { randomUUID } from "crypto";
import {
  type CaptainInput,
  makeSlug,
  generateSoul,
  generateIdentity,
  generateUser,
  renderTemplate,
} from "./templates";

const WORKSPACES_ROOT = "/root/workspaces";
const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");
const AUTH_SOURCE = "/root/.openclaw/agents/main/agent/auth-profiles.json";
const REGISTRY_FILE = "/root/swain-agent-api/registry.json";
const OPENCLAW_CONFIG = "/root/.openclaw/openclaw.json";
const CRON_JOBS_FILE = "/root/.openclaw/cron/jobs.json";

// Honcho configuration
const HONCHO_API_KEY = process.env.HONCHO_API_KEY;
const HONCHO_BASE_URL = process.env.HONCHO_BASE_URL || "https://api.honcho.dev";
const HONCHO_WORKSPACE_ID = process.env.HONCHO_WORKSPACE_ID || "swain";

type Registry = Record<string, string>; // userId → agentId

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already has country code or non-US — return with + prefix
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/** Strip + prefix from E.164 for WhatsApp JID format (digits only) */
function phoneToWhatsAppJid(e164Phone: string): string {
  return e164Phone.replace(/^\+/, "");
}

async function loadRegistry(): Promise<Registry> {
  try {
    return JSON.parse(await readFile(REGISTRY_FILE, "utf-8"));
  } catch {
    return {};
  }
}

async function saveRegistry(reg: Registry): Promise<void> {
  await writeFile(REGISTRY_FILE, JSON.stringify(reg, null, 2));
}

/** Look up an advisor agentId by userId */
export async function lookupByUserId(userId: string): Promise<string | null> {
  const reg = await loadRegistry();
  return reg[userId] || null;
}

interface ProvisionResult {
  agentId: string;
  status: "provisioned";
  workspace: string;
}

/** Copy template skills into workspace */
async function copySkills(workspaceDir: string): Promise<void> {
  const skillsSrc = join(TEMPLATES_DIR, "skills");
  const skillsDest = join(workspaceDir, "skills");
  await cp(skillsSrc, skillsDest, { recursive: true });
}

/** Copy the shared auth profile to a new agent */
async function copyAuthProfile(agentId: string): Promise<void> {
  const destDir = `/root/.openclaw/agents/${agentId}/agent`;
  await mkdir(destDir, { recursive: true });
  await cp(AUTH_SOURCE, join(destDir, "auth-profiles.json"));
}

/** Replace {{placeholders}} in all files in a directory (recursive) */
async function renderDir(dir: string, vars: Record<string, string>): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await renderDir(full, vars);
    } else if (entry.name.endsWith(".md")) {
      let content = await readFile(full, "utf-8");
      for (const [key, value] of Object.entries(vars)) {
        content = content.replaceAll(`{{${key}}}`, value);
      }
      await writeFile(full, content);
    }
  }
}

/** Run an openclaw CLI command and return stdout */
async function openclaw(args: string[]): Promise<string> {
  const proc = Bun.spawn(["openclaw", ...args], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    throw new Error(`openclaw ${args.join(" ")} failed (exit ${exitCode}): ${stderr}`);
  }
  return stdout.trim();
}

/** Add a captain's phone to the WhatsApp allowlist and route it to their advisor agent */
async function setupWhatsAppRouting(phone: string, agentId: string): Promise<void> {
  const config = JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));

  // allowFrom uses E.164 format (+14156239773)
  const allowFrom: string[] = config.channels?.whatsapp?.allowFrom ?? [];
  if (!allowFrom.includes(phone)) {
    allowFrom.push(phone);
    config.channels.whatsapp.allowFrom = allowFrom;
  }

  // Binding peer ID uses WhatsApp JID format (digits only, no +)
  const jid = phoneToWhatsAppJid(phone);
  if (!config.bindings) config.bindings = [];
  const existing = config.bindings.find(
    (b: any) => b.match?.peer?.id === jid && b.match?.channel === "whatsapp"
  );
  if (!existing) {
    config.bindings.push({
      agentId,
      match: { channel: "whatsapp", peer: { kind: "direct", id: jid } },
    });
  }

  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));

  // Restart gateway via system-level systemd (not openclaw gateway restart,
  // which tries systemctl --user and fails for root system services)
  const restart = Bun.spawn(["systemctl", "restart", "openclaw"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const restartExit = await restart.exited;
  if (restartExit !== 0) {
    const stderr = await new Response(restart.stderr).text();
    throw new Error(`systemctl restart openclaw failed (exit ${restartExit}): ${stderr}`);
  }
  console.log(`WhatsApp routing: ${phone} → ${agentId}, gateway restarted`);
}

/** Seed Honcho with captain and advisor peers + initial conclusions */
async function seedHoncho(input: CaptainInput, agentId: string): Promise<void> {
  if (!HONCHO_API_KEY) {
    console.warn("HONCHO_API_KEY not set — skipping Honcho seeding");
    return;
  }

  const captainPeerId = `captain-${input.userId}`;
  const advisorPeerId = `advisor-${input.userId}`;

  const headers = {
    "Authorization": `Bearer ${HONCHO_API_KEY}`,
    "Content-Type": "application/json",
  };
  const base = `${HONCHO_BASE_URL}/v2/workspaces/${HONCHO_WORKSPACE_ID}`;

  // Ensure workspace exists
  const wsRes = await fetch(`${HONCHO_BASE_URL}/v2/workspaces`, {
    method: "POST",
    headers,
    body: JSON.stringify({ id: HONCHO_WORKSPACE_ID }),
  });
  if (!wsRes.ok && wsRes.status !== 409) {
    console.warn(`Honcho workspace create returned ${wsRes.status}`);
  }

  // Create captain peer (observe_me: true so Honcho reasons about them)
  await fetch(`${base}/peers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: captainPeerId,
      metadata: {
        userId: input.userId,
        name: input.name,
        boatName: input.boatName || null,
        phone: input.phone || null,
        role: "captain",
      },
    }),
  });

  // Create advisor peer (observe_me: true, will observe captain in sessions)
  await fetch(`${base}/peers`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      id: advisorPeerId,
      metadata: {
        agentId,
        captainUserId: input.userId,
        role: "advisor",
      },
    }),
  });

  // Seed initial conclusions about the captain from onboarding data
  const conclusions: Array<{ content: string; observer_id: string; observed_id: string }> = [];

  conclusions.push({
    content: `Captain's name is ${input.name}.`,
    observer_id: advisorPeerId,
    observed_id: captainPeerId,
  });

  if (input.boatName) {
    conclusions.push({
      content: `Captain's boat is named "${input.boatName}".`,
      observer_id: advisorPeerId,
      observed_id: captainPeerId,
    });
  }

  if (input.boatMakeModel) {
    conclusions.push({
      content: `Captain's boat is a ${input.boatMakeModel}.`,
      observer_id: advisorPeerId,
      observed_id: captainPeerId,
    });
  }

  if (input.marina) {
    conclusions.push({
      content: `Captain keeps their boat at ${input.marina}.`,
      observer_id: advisorPeerId,
      observed_id: captainPeerId,
    });
  }

  if (input.experienceLevel) {
    conclusions.push({
      content: `Captain is a ${input.experienceLevel} boater.`,
      observer_id: advisorPeerId,
      observed_id: captainPeerId,
    });
  }

  if (input.interests) {
    conclusions.push({
      content: `Captain's main interests: ${input.interests}.`,
      observer_id: advisorPeerId,
      observed_id: captainPeerId,
    });
  }

  if (conclusions.length > 0) {
    await fetch(`${base}/conclusions`, {
      method: "POST",
      headers,
      body: JSON.stringify({ conclusions }),
    });
  }

  console.log(`Honcho seeded: captain=${captainPeerId} advisor=${advisorPeerId} conclusions=${conclusions.length}`);
}

/** Create cron jobs for a new advisor: one-shot intro + daily briefing */
async function createAdvisorCronJobs(
  input: CaptainInput,
  agentId: string,
  phone: string
): Promise<void> {
  // Read existing cron jobs
  let cronData: { version: number; jobs: any[] };
  try {
    cronData = JSON.parse(await readFile(CRON_JOBS_FILE, "utf-8"));
  } catch {
    cronData = { version: 1, jobs: [] };
  }

  const now = Date.now();

  // 1. One-shot intro message — fires 30 seconds from now
  const introAt = new Date(now + 30_000).toISOString();
  cronData.jobs.push({
    id: randomUUID(),
    agentId,
    name: `Advisor intro - ${input.name}`,
    enabled: true,
    deleteAfterRun: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "at", at: introAt },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message: `You just got provisioned as ${input.name}'s personal boat advisor. Introduce yourself on WhatsApp right now. Use the message tool: action="send", channel="whatsapp", target="${phone}". Keep it warm and brief — mention their boat "${input.boatName || "boat"}" by name, say you're their Swain, and you'll keep them posted on conditions and what's happening on the water. Like a sharp dock neighbor saying hey for the first time. Don't be corporate. After sending, reply NO_REPLY.`,
    },
  });

  // 2. Daily briefing — stagger by hashing agentId to spread across 11:00-11:20 UTC
  const hash = agentId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const minuteOffset = hash % 20; // 0-19 minutes past 11:00 UTC
  cronData.jobs.push({
    id: randomUUID(),
    agentId,
    name: `Daily briefing - ${input.name}`,
    enabled: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "cron", expr: `${minuteOffset} 11 * * *`, tz: "UTC" },
    sessionTarget: "isolated",
    wakeMode: "now",
    payload: {
      kind: "agentTurn",
      message: `Generate today's daily briefing using the swain-advisor skill. Pull ${input.name}'s profile from Convex, check available cards, avoid yesterday's topics, and assemble a personalized briefing. Use --force if one already exists for today.`,
    },
    delivery: { mode: "announce" },
  });

  await writeFile(CRON_JOBS_FILE, JSON.stringify(cronData, null, 2));
  console.log(
    `Cron jobs created for ${agentId}: intro at ${introAt}, daily briefing at ${minuteOffset} 11 * * * UTC`
  );
}

/** Provision a new advisor agent */
export async function provisionAdvisor(input: CaptainInput): Promise<ProvisionResult> {
  const agentId = makeSlug(input.name, input.userId);
  const workspace = join(WORKSPACES_ROOT, agentId);

  // 1. Create workspace directory
  await mkdir(workspace, { recursive: true });

  // 2. Copy template files (AGENTS.md, TOOLS.md, HEARTBEAT.md)
  for (const file of ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"]) {
    const rendered = await renderTemplate(file, { userId: input.userId });
    await writeFile(join(workspace, file), rendered);
  }

  // 3. Copy skills
  await copySkills(workspace);

  // 4. Render placeholders in all copied files
  await renderDir(workspace, { userId: input.userId });

  // 5. Generate dynamic files
  await writeFile(join(workspace, "SOUL.md"), generateSoul(input));
  await writeFile(join(workspace, "IDENTITY.md"), generateIdentity(input, agentId));
  await writeFile(join(workspace, "USER.md"), generateUser(input));
  await writeFile(join(workspace, "MEMORY.md"), "");

  // 6. Register with openclaw
  await openclaw([
    "agents",
    "add",
    agentId,
    "--workspace",
    workspace,
    "--non-interactive",
  ]);

  // 7. Copy auth profile
  await copyAuthProfile(agentId);

  // 8. Register userId → agentId mapping
  const reg = await loadRegistry();
  reg[input.userId] = agentId;
  await saveRegistry(reg);

  // 9. Write .honcho.json for plugin peer resolution
  await writeFile(join(workspace, ".honcho.json"), JSON.stringify({
    peerId: `captain-${input.userId}`,
    selfPeerId: `advisor-${input.userId}`,
  }, null, 2));

  // 10. Route captain's WhatsApp messages to this advisor
  if (input.phone) {
    try {
      await setupWhatsAppRouting(normalizePhone(input.phone), agentId);
    } catch (err) {
      console.error(`WhatsApp routing setup failed (non-fatal): ${err}`);
    }
  }

  // 11. Seed Honcho with captain/advisor peers and initial conclusions
  try {
    await seedHoncho(input, agentId);
  } catch (err) {
    console.error(`Honcho seeding failed (non-fatal): ${err}`);
  }

  // 12. Create cron jobs: one-shot WhatsApp intro + daily briefing
  if (input.phone) {
    try {
      await createAdvisorCronJobs(input, agentId, normalizePhone(input.phone));
    } catch (err) {
      console.error(`Cron job creation failed (non-fatal): ${err}`);
    }
  }

  console.log(`Advisor ${agentId} provisioned with WhatsApp intro + daily briefing crons.`);

  return { agentId, status: "provisioned", workspace };
}

/** Delete an advisor agent */
export async function deleteAdvisor(agentId: string): Promise<void> {
  // Validate agentId format
  if (!agentId.startsWith("advisor-")) {
    throw new Error("Can only delete advisor agents");
  }

  // Remove from openclaw
  await openclaw(["agents", "delete", agentId, "--force"]);

  // Remove workspace
  const workspace = join(WORKSPACES_ROOT, agentId);
  await rm(workspace, { recursive: true, force: true });

  // Remove from registry
  const reg = await loadRegistry();
  for (const [uid, aid] of Object.entries(reg)) {
    if (aid === agentId) delete reg[uid];
  }
  await saveRegistry(reg);
}

/** List all advisor agents */
export async function listAdvisors(): Promise<unknown[]> {
  const output = await openclaw(["agents", "list", "--json"]);
  const agents = JSON.parse(output);
  // Filter to advisor-* agents
  if (Array.isArray(agents)) {
    return agents.filter(
      (a: { name?: string; id?: string }) =>
        (a.name || a.id || "").startsWith("advisor-")
    );
  }
  return [];
}