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

type Registry = Record<string, string>; // userId → agentId

/** Normalize a US phone number to E.164 (+1XXXXXXXXXX) */
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  // Already has country code or non-US — return with + prefix
  return phone.startsWith("+") ? phone : `+${digits}`;
}

/** Format phone for WhatsApp binding peer ID.
 * OpenClaw's routing normalizes inbound peers through normalizeE164() which
 * always adds a + prefix. The binding peer ID must match that format exactly.
 * E.164 format: +14156239773 */
function phoneToBindingPeerId(e164Phone: string): string {
  // Ensure + prefix (normalizeE164 always adds it)
  return e164Phone.startsWith("+") ? e164Phone : `+${e164Phone}`;
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

  // Binding peer ID must use E.164 with + prefix to match OpenClaw's
  // normalizeE164() which always adds + to inbound peer IDs.
  const peerId = phoneToBindingPeerId(phone);
  if (!config.bindings) config.bindings = [];
  const existing = config.bindings.find(
    (b: any) => b.match?.peer?.id === peerId && b.match?.channel === "whatsapp"
  );
  if (!existing) {
    config.bindings.push({
      agentId,
      match: { channel: "whatsapp", peer: { kind: "direct", id: peerId } },
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

/** Build a human-readable Honcho peer ID for a captain.
 * Format: captain-{name}-{shortId} — matches advisor naming from makeSlug().
 * e.g., captain-pete-4f58e4 */
/** Seed MEMORY.md with captain facts from onboarding data */
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

/** Create cron jobs for a new advisor: one-shot intro + daily briefing */
async function createAdvisorCronJobs(
  input: CaptainInput,
  agentId: string,
  phone: string
): Promise<void> {
  const jid = phone.replace(/^\+/, "") + "@s.whatsapp.net";
  // Read existing cron jobs
  let cronData: { version: number; jobs: any[] };
  try {
    cronData = JSON.parse(await readFile(CRON_JOBS_FILE, "utf-8"));
  } catch {
    cronData = { version: 1, jobs: [] };
  }

  const now = Date.now();

  // 1. One-shot intro message — fires 30 seconds from now
  // Runs in isolated session. Reads the swain-onboarding skill Phase 1 for guidance.
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
      message: `You just got provisioned as ${input.name}'s personal boat advisor. Send your intro message on WhatsApp now. Read the swain-onboarding skill for Phase 1 instructions — follow them exactly. Captain info: name="${input.name}", boat="${input.boatName || "boat"}", marina="${input.marina || "unknown"}", phone="${phone}", userId="${input.userId}". After sending and updating onboarding step, reply NO_REPLY.`,
      timeoutSeconds: 120,
    },
  });

  // 2. Safety-net — fires 30 minutes after intro
  // If the captain replied and the inline briefing build succeeded, onboardingStep
  // will be "done" and this no-ops. If something went wrong (turn crashed, captain
  // didn't reply, briefing build failed), this picks up the pieces.
  const safetyNetAt = new Date(now + 30 * 60_000).toISOString();
  cronData.jobs.push({
    id: randomUUID(),
    agentId,
    name: `Onboarding safety net - ${input.name}`,
    enabled: true,
    deleteAfterRun: true,
    createdAtMs: now,
    updatedAtMs: now,
    schedule: { kind: "at", at: safetyNetAt },
    sessionTarget: "isolated",
    delivery: { mode: "none" },
    payload: {
      kind: "agentTurn",
      message: `Safety net: check if ${input.name}'s onboarding was completed.

1. Run: swain user get ${input.userId} --json
2. If onboardingStep is already "done", reply NO_REPLY (nothing to do).
3. If onboardingStep is "contacting" — the captain may not have replied yet, or
   the inline briefing build may have failed. Check MEMORY.md for any conversation
   notes. If there's context from a conversation, build the briefing now:
   - Read the swain-onboarding skill (Phase 2, steps 2b-2h) for the build workflow
   - Read the swain-boat-art skill for art generation
   - userId=${input.userId}, phone=${phone}
   - Send notification via: message action=send channel=whatsapp target="${phone}"
   - Mark complete: swain user update ${input.userId} --onboardingStep=done --onboardingStatus=completed --json
4. If no conversation happened yet (MEMORY.md only has initial seed data), build a
   general first briefing based on their profile data anyway. Better to deliver
   something than nothing.`,
      timeoutSeconds: 600,
    },
  });

  // 3. Daily briefing — stagger by hashing agentId to spread across 11:00-11:20 UTC
  // Runs in MAIN session (systemEvent) so the advisor has full conversation context.
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
    sessionTarget: "main",
    wakeMode: "next-heartbeat",
    payload: {
      kind: "systemEvent",
      text: `It's briefing time. Build today's daily briefing for ${input.name} using the swain-advisor skill. You have full conversation context — use anything ${input.name} has mentioned recently to personalize card selection. Check MEMORY.md for their interests and recent topics. Include today's boat art card. If a briefing already exists for today, reply HEARTBEAT_OK.`,
    },
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
  const phone = input.phone ? normalizePhone(input.phone) : "";
  const jid = phone ? phone.replace(/^\+/, "") + "@s.whatsapp.net" : "";
  for (const file of ["AGENTS.md", "TOOLS.md", "HEARTBEAT.md"]) {
    const rendered = await renderTemplate(file, {
      userId: input.userId,
      phone,
      jid,
      captainName: input.name,
    });
    await writeFile(join(workspace, file), rendered);
  }

  // 3. Copy skills
  await copySkills(workspace);

  // 4. Render placeholders in all copied files (skills, etc.)
  await renderDir(workspace, {
    userId: input.userId,
    phone,
    captainName: input.name,
  });

  // 5. Generate dynamic files
  await writeFile(join(workspace, "SOUL.md"), generateSoul(input));
  await writeFile(join(workspace, "IDENTITY.md"), generateIdentity(input, agentId));
  await writeFile(join(workspace, "USER.md"), generateUser(input));
  await writeFile(join(workspace, "MEMORY.md"), generateMemorySeed(input));
  await mkdir(join(workspace, "memory"), { recursive: true });

  // 6. Register with openclaw (with heartbeat for main-session continuity)
  await openclaw([
    "agents",
    "add",
    agentId,
    "--workspace",
    workspace,
    "--non-interactive",
  ]);

  // 6b. Patch agent config to add heartbeat and subagents
  // Read current config, find the agent entry, add heartbeat
  try {
    const cfg = JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));
    const agentList: any[] = cfg.agents?.list ?? [];
    const entry = agentList.find((a: any) => a.id === agentId);
    if (entry) {
      entry.heartbeat = { every: "1h" };
      if (!entry.subagents) {
        entry.subagents = { allowAgents: ["*"] };
      }
      await writeFile(OPENCLAW_CONFIG, JSON.stringify(cfg, null, 2));
      console.log(`Heartbeat (1h) added to agent ${agentId}`);
    }
  } catch (err) {
    console.error(`Failed to add heartbeat config (non-fatal): ${err}`);
  }

  // 7. Copy auth profile
  await copyAuthProfile(agentId);

  // 8. Register userId → agentId mapping
  const reg = await loadRegistry();
  reg[input.userId] = agentId;
  await saveRegistry(reg);

  // 9. Route captain's WhatsApp messages to this advisor
  if (input.phone) {
    try {
      await setupWhatsAppRouting(normalizePhone(input.phone), agentId);
    } catch (err) {
      console.error(`WhatsApp routing setup failed (non-fatal): ${err}`);
    }
  }

  // 10. Create cron jobs: one-shot WhatsApp intro + daily briefing
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

/** Delete an advisor agent — full cascade cleanup */
export async function deleteAdvisor(agentId: string): Promise<void> {
  // Validate agentId format
  if (!agentId.startsWith("advisor-")) {
    throw new Error("Can only delete advisor agents");
  }

  // 1. Remove from openclaw config (agent entry + binding)
  try {
    await openclaw(["agents", "delete", agentId, "--force"]);
  } catch (err) {
    // Agent may already be removed from config — continue cleanup
    console.warn(`openclaw agents delete ${agentId}: ${err}`);
  }

  // 2. Remove workspace
  const workspace = join(WORKSPACES_ROOT, agentId);
  await rm(workspace, { recursive: true, force: true });

  // 3. Remove agent sessions/state dir
  const agentDir = join("/root/.openclaw/agents", agentId);
  await rm(agentDir, { recursive: true, force: true });

  // 4. Remove cron jobs for this agent
  try {
    const cronData = JSON.parse(await readFile(CRON_JOBS_FILE, "utf-8"));
    const before = cronData.jobs.length;
    cronData.jobs = cronData.jobs.filter((j: any) => j.agentId !== agentId);
    if (cronData.jobs.length < before) {
      await writeFile(CRON_JOBS_FILE, JSON.stringify(cronData, null, 2));
      console.log(`Removed ${before - cronData.jobs.length} cron job(s) for ${agentId}`);
    }
  } catch (err) {
    console.warn(`Cron cleanup for ${agentId}: ${err}`);
  }

  // 5. Remove WhatsApp binding + allowFrom phone from openclaw config
  try {
    const cfg = JSON.parse(await readFile(OPENCLAW_CONFIG, "utf-8"));
    let changed = false;

    // Find and remove bindings, extract phone numbers to remove from allowlist
    const bindings: any[] = cfg.bindings || [];
    const phonesToRemove: string[] = [];
    const beforeBindings = bindings.length;
    cfg.bindings = bindings.filter((b: any) => {
      if (b.agentId === agentId) {
        // Extract phone from binding peer ID (e.g. "+14156239773")
        const peerId = b.match?.peer?.id;
        if (peerId) phonesToRemove.push(peerId);
        return false;
      }
      return true;
    });
    if (cfg.bindings.length < beforeBindings) changed = true;

    // Remove phone(s) from WhatsApp allowFrom (skip owner numbers)
    const ownerNumbers = ["+14156239773", "+5216692766911"];
    if (phonesToRemove.length > 0 && cfg.channels?.whatsapp?.allowFrom) {
      const allowFrom: string[] = cfg.channels.whatsapp.allowFrom;
      cfg.channels.whatsapp.allowFrom = allowFrom.filter(
        (p: string) => !phonesToRemove.includes(p) || ownerNumbers.includes(p)
      );
      if (cfg.channels.whatsapp.allowFrom.length < allowFrom.length) changed = true;
    }

    if (changed) {
      await writeFile(OPENCLAW_CONFIG, JSON.stringify(cfg, null, 2));
      console.log(`Removed WhatsApp binding + allowFrom for ${agentId} (phones: ${phonesToRemove.join(", ")})`);
    }
  } catch (err) {
    console.warn(`Binding cleanup for ${agentId}: ${err}`);
  }

  // 6. Remove from registry
  const reg = await loadRegistry();
  for (const [uid, aid] of Object.entries(reg)) {
    if (aid === agentId) delete reg[uid];
  }
  await saveRegistry(reg);

  console.log(`Advisor ${agentId} fully deleted (workspace, agent dir, crons, bindings, registry)`);
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