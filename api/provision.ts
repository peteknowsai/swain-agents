import { mkdir, cp, readdir, readFile, writeFile, rm } from "fs/promises";
import { join } from "path";
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

// Honcho configuration
const HONCHO_API_KEY = process.env.HONCHO_API_KEY;
const HONCHO_BASE_URL = process.env.HONCHO_BASE_URL || "https://api.honcho.dev";
const HONCHO_WORKSPACE_ID = process.env.HONCHO_WORKSPACE_ID || "swain";

type Registry = Record<string, string>; // userId → agentId

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

/** Add a phone number to the WhatsApp allowFrom list and restart the gateway */
async function allowWhatsApp(phone: string): Promise<void> {
  const config = JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));
  const allowFrom: string[] = config.channels?.whatsapp?.allowFrom ?? [];
  if (allowFrom.includes(phone)) return;
  allowFrom.push(phone);
  config.channels.whatsapp.allowFrom = allowFrom;
  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
  await openclaw(["gateway", "restart"]);
  console.log(`WhatsApp allowFrom: added ${phone}, gateway restarted`);
}

/** Remove a phone number from the WhatsApp allowFrom list */
async function disallowWhatsApp(phone: string): Promise<void> {
  const config = JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));
  const allowFrom: string[] = config.channels?.whatsapp?.allowFrom ?? [];
  const idx = allowFrom.indexOf(phone);
  if (idx === -1) return;
  allowFrom.splice(idx, 1);
  config.channels.whatsapp.allowFrom = allowFrom;
  await writeFile(OPENCLAW_CONFIG, JSON.stringify(config, null, 2));
  console.log(`WhatsApp allowFrom: removed ${phone}`);
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

  // 10. Add captain's phone to WhatsApp allowlist
  if (input.phone) {
    try {
      await allowWhatsApp(input.phone);
    } catch (err) {
      console.error(`WhatsApp allowlist update failed (non-fatal): ${err}`);
    }
  }

  // 11. Seed Honcho with captain/advisor peers and initial conclusions
  try {
    await seedHoncho(input, agentId);
  } catch (err) {
    console.error(`Honcho seeding failed (non-fatal): ${err}`);
  }

  // 12. Don't wake the advisor here.
  // The daily briefing cron (sessions_send) or Mr. Content's heartbeat safety
  // net will trigger the first briefing on the next pass. The openclaw agent
  // CLI is unreliable for this — fights with the gateway over session locks.
  console.log(`Advisor ${agentId} provisioned. First briefing will be triggered by daily cron or Mr. Content safety net.`);

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