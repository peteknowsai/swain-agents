/**
 * Sprite-based advisor provisioning.
 * Replaces OpenClaw provisioning with Sprite microVMs on sprites.dev.
 */

import { readFile, writeFile } from "fs/promises";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { type CaptainInput, render } from "./templates";
import {
  REGISTRY_FILE,
  loadRegistry,
  saveRegistry,
  lookupByUserId as registryLookup,
  type AgentRegistry,
} from "./shared";
import {
  createSprite,
  execOnSprite,
  writeToSprite,
  getSpriteUrl,
  makePublic,
  createService,
} from "./sprite";

// --- Constants ---

const __dirname = dirname(fileURLToPath(import.meta.url));
const BRIDGE_REGISTRY_FILE = "/root/clawd/swain-agents/bridge/registry.json";
const BRIDGE_RELOAD_URL = "http://localhost:3848/registry/reload";
const SPRITE_TEMPLATES_DIR = join(__dirname, "..", "sprite", "templates");
const SKILLS_DIR = join(__dirname, "..", "skills");
const CHANNEL_DIR = join(__dirname, "..", "sprite", "channel");

// Env vars that get baked into each sprite's launcher script
const SPRITE_ENV_VARS = {
  CLAUDE_CODE_OAUTH_TOKEN: process.env.CLAUDE_CODE_OAUTH_TOKEN || "",
  BRIDGE_URL: process.env.BRIDGE_URL || "http://76.13.106.143:3848",
  SWAIN_API_TOKEN: process.env.SWAIN_API_TOKEN || "",
  R2_ACCESS_KEY_ID: process.env.R2_ACCESS_KEY_ID || "a18dd41e124527b88c6f76255c8ce27e",
  R2_SECRET_ACCESS_KEY: process.env.R2_SECRET_ACCESS_KEY || "c722f4980f2977a03c5d1952949452d3e2167848bfdbc2f8fb979f2bd886d8ef",
  R2_ENDPOINT: process.env.R2_ENDPOINT || "https://5a6fef07a998d84ec047ef43d0543342.r2.cloudflarestorage.com",
  R2_BUCKET: process.env.R2_BUCKET || "swain-vaults",
};

// --- Pool provisioning ---

function poolSpriteName(index: number): string {
  return `advisor-pool-${index}`;
}

/**
 * Pre-provision blank advisor sprites into the pool.
 * Slow operation (~2-3 min per sprite). Run ahead of time.
 */
export async function provisionSpritePool(count: number = 1): Promise<{
  created: number;
  failed: number;
  sprites: Array<{ name: string; url: string; error?: string }>;
}> {
  const registry = await loadRegistry();
  const results: Array<{ name: string; url: string; error?: string }> = [];
  let created = 0;
  let failed = 0;

  // Find next available pool index
  let maxIndex = 0;
  for (const entry of Object.values(registry.agents)) {
    if (entry.type === "advisor" && entry.poolIndex !== undefined && entry.poolIndex > maxIndex) {
      maxIndex = entry.poolIndex;
    }
  }

  for (let i = 0; i < count; i++) {
    const index = maxIndex + 1 + i;
    const name = poolSpriteName(index);

    if (registry.agents[name]) {
      console.log(`Pool sprite ${name} already exists, skipping`);
      continue;
    }

    try {
      console.log(`Creating pool sprite ${name}...`);
      await setupSprite(name);
      const url = await getSpriteUrl(name);

      // Register in agent registry
      registry.agents[name] = {
        type: "advisor",
        status: "available",
        createdAt: new Date().toISOString(),
        poolIndex: index,
        spriteName: name,
        spriteUrl: url,
      };

      // Register in bridge registry (no phone yet — just URL for health checks)
      await addToBridgeRegistry({
        id: name,
        name: `Pool ${name}`,
        url,
        phoneNumbers: [],
        discordChannelIds: [],
        allowDMs: false,
      });

      results.push({ name, url });
      created++;
      console.log(`Pool sprite ${name} ready at ${url}`);
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      console.error(`Failed to create pool sprite ${name}: ${error}`);
      results.push({ name, url: "", error });
      failed++;
    }
  }

  if (created > 0) {
    registry.pool.size = Object.values(registry.agents).filter(a => a.type === "advisor").length;
    await saveRegistry(registry);
    await reloadBridgeRegistry();
  }

  return { created, failed, sprites: results };
}

/**
 * Set up a fresh sprite with channel server, skills, and tools.
 */
async function setupSprite(name: string): Promise<void> {
  // 1. Create the sprite (with console init workaround)
  await createSprite(name);

  // 2. Create directory structure
  await execOnSprite(name, "mkdir -p /home/sprite/channel /home/sprite/.claude-sessions /home/sprite/.claude/memory/yearnings /home/sprite/.claude/memory/notes");

  // 3. Copy channel server files
  const serverTs = await readFile(join(CHANNEL_DIR, "server.ts"), "utf-8");
  const syncTs = await readFile(join(CHANNEL_DIR, "sync.ts"), "utf-8");
  const packageJson = await readFile(join(CHANNEL_DIR, "package.json"), "utf-8");

  await writeToSprite(name, "/home/sprite/channel/server.ts", serverTs);
  await writeToSprite(name, "/home/sprite/channel/sync.ts", syncTs);
  await writeToSprite(name, "/home/sprite/channel/package.json", packageJson);

  // 4. Install channel server dependencies
  await execOnSprite(name, "cd /home/sprite/channel && bun install");

  // 5. Copy skills to .claude/skills/ (Claude Code auto-discovery)
  const SPRITE_SKILLS_DIR = join(__dirname, "..", "sprite", "skills");
  const skillDirs = [
    "onboarding", "briefing", "profile", "card-create", "boat-art",
    "boat-scan", "knowledge", "obsidian-vault", "memory", "dream",
    "library", "swain-cli", "firecrawl", "goplaces",
  ];

  for (const skillDir of skillDirs) {
    const skillPath = join(SPRITE_SKILLS_DIR, skillDir);
    try {
      // Create skill directory on sprite
      await execOnSprite(name, `mkdir -p /home/sprite/.claude/skills/${skillDir}`);

      // Copy SKILL.md
      const skillMd = await readFile(join(skillPath, "SKILL.md"), "utf-8");
      await writeToSprite(name, `/home/sprite/.claude/skills/${skillDir}/SKILL.md`, skillMd);

      // Copy reference.md if it exists
      try {
        const refMd = await readFile(join(skillPath, "reference.md"), "utf-8");
        await writeToSprite(name, `/home/sprite/.claude/skills/${skillDir}/reference.md`, refMd);
      } catch {}
    } catch {
      console.warn(`Skill ${skillDir} not found, skipping`);
    }
  }

  // 6. Install/update CLIs
  await execOnSprite(name, [
    "curl -fsSL -o /usr/local/bin/swain",
    "https://github.com/peteknowsai/swain-agents/releases/latest/download/swain-linux-x64",
    "&& chmod +x /usr/local/bin/swain",
  ].join(" "));

  // Update Claude Code to latest
  await execOnSprite(name, "curl -fsSL https://claude.ai/install.sh | bash").catch(
    (err) => console.warn(`Claude Code update failed (non-fatal): ${err}`),
  );

  // 7. Create launcher script with env vars
  const launcherScript = generateLauncherScript(name);
  await writeToSprite(name, "/home/sprite/start.sh", launcherScript);
  await execOnSprite(name, "chmod +x /home/sprite/start.sh");

  // 8. Write pool CLAUDE.md (gets overwritten with captain-specific version on assignment)
  const poolClaudeMd = await readFile(join(SPRITE_TEMPLATES_DIR, "CLAUDE.md.pool"), "utf-8");
  await writeToSprite(name, "/home/sprite/CLAUDE.md", poolClaudeMd);

  // 8a. Seed MEMORY.md index and implant starter yearnings
  const yearningLines: string[] = [];
  const YEARNINGS_TEMPLATE_DIR = join(SPRITE_TEMPLATES_DIR, "yearnings");
  try {
    const { readdir } = await import("fs/promises");
    const yearningFiles = await readdir(YEARNINGS_TEMPLATE_DIR);
    const today = new Date().toISOString().split("T")[0];
    for (const file of yearningFiles) {
      if (!file.endsWith(".md")) continue;
      let content = await readFile(join(YEARNINGS_TEMPLATE_DIR, file), "utf-8");
      content = content.replaceAll("{{today}}", today);
      await writeToSprite(name, `/home/sprite/.claude/memory/yearnings/${file}`, content);
      const subject = content.match(/subject: "(.+?)"/)?.[1] || file.replace(".md", "");
      yearningLines.push(`- [yearnings/${file}](yearnings/${file}) — ${subject}`);
    }
  } catch (err) {
    console.warn(`Yearning seeding failed (non-fatal): ${err}`);
  }

  await writeToSprite(name, "/home/sprite/.claude/memory/MEMORY.md", [
    "# MEMORY.md",
    "",
    "## Confirmed",
    "",
    "No captain assigned yet.",
    "",
    "## Yearnings",
    "",
    ...(yearningLines.length > 0 ? yearningLines : ["No yearnings yet."]),
    "",
    "## Daily Notes",
    "",
    "No conversations yet.",
  ].join("\n"));

  // 8b. Generate about.md — sprite manifest with tools, versions, environment
  try {
    const aboutInfo = await execOnSprite(name, [
      'echo "---"',
      'echo "type: sprite"',
      `echo "name: ${name}"`,
      'echo "updated: $(date +%Y-%m-%d)"',
      'echo "tags: [sprite, system]"',
      'echo "---"',
      'echo ""',
      `echo "# ${name}"`,
      'echo ""',
      'echo "## System"',
      'echo "- **OS:** $(lsb_release -d 2>/dev/null | cut -f2 || echo unknown)"',
      'echo "- **Arch:** $(uname -m)"',
      'echo "- **Sprite:** $(cat /.sprite/version 2>/dev/null || echo unknown)"',
      'echo ""',
      'echo "## CLIs"',
      'echo "| Tool | Path | Version |"',
      'echo "|------|------|---------|"',
      'echo "| claude | $(which claude 2>/dev/null || echo not found) | $(claude --version 2>/dev/null || echo -) |"',
      'echo "| swain | $(which swain 2>/dev/null || echo not found) | $(swain --version 2>/dev/null || echo -) |"',
      'echo "| bun | $(which bun 2>/dev/null || echo not found) | $(bun --version 2>/dev/null || echo -) |"',
      'echo "| node | $(which node 2>/dev/null || echo not found) | $(node --version 2>/dev/null || echo -) |"',
      'echo "| python3 | $(which python3 2>/dev/null || echo not found) | $(python3 --version 2>/dev/null | cut -d\" \" -f2 || echo -) |"',
      'echo "| firecrawl | $(which firecrawl 2>/dev/null || echo not found) | $(firecrawl --version 2>/dev/null || echo -) |"',
      'echo "| goplaces | $(which goplaces 2>/dev/null || echo not found) | $(goplaces --version 2>/dev/null || echo -) |"',
      'echo "| git | $(which git 2>/dev/null || echo not found) | $(git --version 2>/dev/null | cut -d\" \" -f3 || echo -) |"',
      'echo "| curl | $(which curl 2>/dev/null || echo not found) | $(curl --version 2>/dev/null | head -1 | cut -d\" \" -f2 || echo -) |"',
      'echo ""',
      'echo "## Services"',
      'echo "$(sprite-env services list 2>/dev/null | python3 -c "import json,sys; services=json.load(sys.stdin); [print(f\\"- **{s[\\\\\"name\\\\\"]}** — {s[\\\\\"cmd\\\\\"]} (port {s.get(\\\\\"http_port\\\\\",\\\\\"-\\\\\")})\\" ) for s in services]" 2>/dev/null || echo "- none")"',
      'echo ""',
      'echo "## Skills"',
      'echo "$(ls /home/sprite/.claude/skills/ 2>/dev/null | while read d; do desc=$(head -3 /home/sprite/.claude/skills/$d/SKILL.md 2>/dev/null | grep description | cut -d\\\" -f2 | head -c 80); echo "- **$d** — $desc"; done)"',
      'echo ""',
      'echo "## MCPs"',
      'echo "$(cat /home/sprite/.mcp.json 2>/dev/null | python3 -c "import json,sys; cfg=json.load(sys.stdin); servers=cfg.get(\\\"mcpServers\\\",{}); [print(f\\"- **{name}** — {s.get(\\\\\"command\\\\\",\\\\\"?\\\\\")}\\" ) for name,s in servers.items()]" 2>/dev/null || echo "- none configured")"',
      'echo ""',
      'echo "## Storage"',
      'echo "- **Disk:** $(df -h /home/sprite 2>/dev/null | tail -1 | awk \"{print \\$3\\\"/\\\"\\$2\\\" used\"}\")"',
    ].join(" && "));
    await writeToSprite(name, "/home/sprite/about.md", aboutInfo);
  } catch (err) {
    console.warn(`About generation failed (non-fatal): ${err}`);
  }

  // 9. Create channel service (auto-starts on HTTP request)
  await createService(name, "channel", {
    cmd: "/home/sprite/start.sh",
    httpPort: 8080,
    dir: "/home/sprite",
  });

  // 10. Make URL public
  await makePublic(name);

  // 11. Wait for health check
  const url = await getSpriteUrl(name);
  await waitForSpriteHealth(url, 60_000);

  // 12. Trigger initial vault sync so files appear in Obsidian immediately
  try {
    await fetch(`${url}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Stand by. Do not respond with any text. Output nothing.",
        chatId: "system-init",
      }),
      signal: AbortSignal.timeout(60_000),
    });
  } catch {
    console.warn(`Initial sync trigger failed for ${name} (non-fatal)`);
  }
}

function generateLauncherScript(spriteName: string, vaultPrefix?: string): string {
  const envLines = Object.entries(SPRITE_ENV_VARS)
    .filter(([_, v]) => v)
    .map(([k, v]) => `export ${k}="${v}"`)
    .join("\n");

  return `#!/bin/bash
${envLines}
export SPRITE_ID="${spriteName}"
export VAULT_PREFIX="${vaultPrefix || spriteName}"
export SPRITE_URL="$(sprite url -s ${spriteName} 2>/dev/null || echo '')"
export CHANNEL_PORT="8080"
export CLAUDE_PATH="/home/sprite/.local/bin/claude"
cd /home/sprite/channel
exec bun run server.ts
`;
}

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

// --- Advisor assignment ---

/**
 * Assign an available pool sprite to a captain.
 * Renders CLAUDE.md with captain data, updates routing, triggers intro.
 */
export async function provisionSpriteAdvisor(input: CaptainInput): Promise<{
  agentId: string;
  status: string;
  spriteUrl: string;
}> {
  const registry = await loadRegistry();
  const phone = input.phone ? normalizePhone(input.phone) : "";

  // Phone uniqueness check
  if (phone) {
    const conflict = Object.entries(registry.agents).find(
      ([_, e]) => e.type === "advisor" && e.status === "active" && e.phone === phone,
    );
    if (conflict) {
      throw new Error(`Phone ${phone} already assigned to ${conflict[0]} (${conflict[1].captainName})`);
    }
  }

  // Idempotency: if userId already assigned, return existing
  const existingId = registryLookup(registry, input.userId);
  if (existingId) {
    const existing = registry.agents[existingId];
    if (existing?.spriteUrl) {
      return { agentId: existingId, status: existing.status, spriteUrl: existing.spriteUrl };
    }
  }

  // Grab first available pool sprite
  const available = Object.entries(registry.agents)
    .filter(([_, e]) => e.type === "advisor" && e.status === "available" && e.spriteName)
    .sort((a, b) => (a[1].poolIndex ?? 0) - (b[1].poolIndex ?? 0))[0];

  if (!available) {
    throw new Error("No available advisor sprites in pool. Run provisionSpritePool() first.");
  }

  const [agentId, entry] = available;
  const spriteName = entry.spriteName!;
  const spriteUrl = entry.spriteUrl!;

  // 1. Render CLAUDE.md with captain data
  const templateContent = await readFile(join(SPRITE_TEMPLATES_DIR, "CLAUDE.md.template"), "utf-8");
  const claudeMd = render(templateContent, {
    captainName: input.name,
    userId: input.userId,
    phone: phone || "not provided",
    boatName: input.boatName || "their boat",
    boatType: input.boatMakeModel || "boat",
    marina: input.marina || "unknown",
    waters: input.location || "local waters",
    primaryUse: input.interests || "cruising",
    experienceLevel: input.experienceLevel || "unknown",
    timezone: input.timezone || "America/New_York",
    desk: "",
  });

  // 2. Push CLAUDE.md to sprite
  await writeToSprite(spriteName, "/home/sprite/CLAUDE.md", claudeMd);

  // 2b. Update launcher script with captain's vault prefix
  const vaultPrefix = slugify(input.name);
  const launcherScript = generateLauncherScript(spriteName, vaultPrefix);
  await writeToSprite(spriteName, "/home/sprite/start.sh", launcherScript);
  await execOnSprite(spriteName, "chmod +x /home/sprite/start.sh");

  // 3. Create boat in Convex
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

  // 4. Update agent registry
  entry.status = "active";
  entry.userId = input.userId;
  entry.captainName = input.name;
  entry.phone = phone || undefined;
  entry.timezone = input.timezone;
  entry.assignedAt = new Date().toISOString();
  await saveRegistry(registry);

  // 5. Update bridge registry with phone routing
  if (phone) {
    await updateBridgeRegistryPhone(agentId, phone, input.name);
    await reloadBridgeRegistry();
  }

  // 6. Trigger intro message (fire-and-forget)
  if (phone) {
    triggerIntro(spriteUrl, agentId, input, phone);
  }

  console.log(`Advisor ${agentId} assigned to ${input.name} (${input.userId}) on sprite ${spriteName}`);
  return { agentId, status: "assigned", spriteUrl };
}

// --- Delete / release advisor ---

/**
 * Release an advisor back to the pool. Resets CLAUDE.md and clears captain data.
 * Does NOT destroy the sprite — recycles it.
 */
export async function deleteSpriteAdvisor(agentId: string): Promise<void> {
  const registry = await loadRegistry();
  const entry = registry.agents[agentId];
  if (!entry) throw new Error(`Agent ${agentId} not found`);
  if (!entry.spriteName) throw new Error(`Agent ${agentId} is not a sprite-based advisor`);

  const spriteName = entry.spriteName;

  // 1. Reset CLAUDE.md to pool version
  const poolClaudeMd = await readFile(join(SPRITE_TEMPLATES_DIR, "CLAUDE.md.pool"), "utf-8");
  await writeToSprite(spriteName, "/home/sprite/CLAUDE.md", poolClaudeMd);

  // 2. Clear session data
  try {
    await execOnSprite(spriteName, "rm -f /home/sprite/.claude-sessions/sessions.json");
  } catch {
    console.warn(`Session cleanup failed for ${spriteName} (non-fatal)`);
  }

  // 3. Clear memory files
  try {
    await execOnSprite(spriteName, "rm -rf /home/sprite/.claude/memory/*");
  } catch {
    console.warn(`Memory cleanup failed for ${spriteName} (non-fatal)`);
  }

  // 4. Remove phone from bridge registry
  if (entry.phone) {
    await removeBridgeRegistryPhone(agentId, entry.phone);
    await reloadBridgeRegistry();
  }

  // 5. Reset agent registry entry
  entry.status = "available";
  delete entry.userId;
  delete entry.captainName;
  delete entry.phone;
  delete entry.timezone;
  delete entry.assignedAt;
  await saveRegistry(registry);

  console.log(`Advisor ${agentId} released back to pool (sprite ${spriteName} recycled)`);
}

// --- Queries ---

export async function lookupByUserId(userId: string): Promise<string | null> {
  const registry = await loadRegistry();
  return registryLookup(registry, userId);
}

export async function listAdvisors(): Promise<unknown[]> {
  const registry = await loadRegistry();
  return Object.entries(registry.agents)
    .filter(([_, e]) => e.type === "advisor" && e.spriteName)
    .map(([id, e]) => ({ agentId: id, ...e }));
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
    spriteUrl?: string;
  }>;
}> {
  const registry = await loadRegistry();
  const advisors = Object.entries(registry.agents)
    .filter(([_, e]) => e.type === "advisor" && e.spriteName)
    .sort((a, b) => (a[1].poolIndex ?? 0) - (b[1].poolIndex ?? 0));

  return {
    size: advisors.length,
    available: advisors.filter(([_, e]) => e.status === "available").length,
    assigned: advisors.filter(([_, e]) => e.status === "active").length,
    agents: advisors.map(([id, e]) => ({
      agentId: id,
      status: e.status,
      poolIndex: e.poolIndex,
      captainName: e.captainName,
      userId: e.userId,
      spriteUrl: e.spriteUrl,
    })),
  };
}

// --- Wake / cron triggers ---

/**
 * Wake an advisor sprite and trigger a skill.
 * Used by Convex crons to trigger daily briefings, watchdogs, etc.
 */
export async function wakeAdvisor(
  agentId: string,
  skill: string,
  options?: { message?: string; chatId?: string },
): Promise<{ ok: boolean; error?: string }> {
  const registry = await loadRegistry();
  const entry = registry.agents[agentId];

  if (!entry) throw new Error(`Agent ${agentId} not found`);
  if (!entry.spriteUrl) throw new Error(`Agent ${agentId} has no sprite URL`);
  if (entry.status !== "active") throw new Error(`Agent ${agentId} is not active (status: ${entry.status})`);

  const spriteUrl = entry.spriteUrl;

  // If a custom message is provided, use /message endpoint (for ad-hoc triggers)
  // Otherwise use /cron endpoint (for scheduled skill execution)
  if (options?.message) {
    const res = await fetch(`${spriteUrl}/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: options.message,
        chatId: options.chatId || `cron:${skill}`,
        userId: entry.userId,
      }),
      signal: AbortSignal.timeout(180_000),
    });
    return { ok: res.ok };
  }

  // Standard cron trigger — runs the skill in its own session
  const res = await fetch(`${spriteUrl}/cron`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ skill, name: `${skill} for ${entry.captainName}` }),
    signal: AbortSignal.timeout(180_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Sprite returned ${res.status}: ${text}` };
  }

  return { ok: true };
}

/**
 * Wake all active advisors with a skill trigger.
 * Used for batch operations like "run all morning briefings."
 */
export async function wakeAllAdvisors(
  skill: string,
): Promise<{ triggered: number; failed: number; results: Array<{ agentId: string; ok: boolean; error?: string }> }> {
  const registry = await loadRegistry();
  const active = Object.entries(registry.agents)
    .filter(([_, e]) => e.type === "advisor" && e.status === "active" && e.spriteUrl);

  const results: Array<{ agentId: string; ok: boolean; error?: string }> = [];
  let triggered = 0;
  let failed = 0;

  for (const [agentId] of active) {
    try {
      const result = await wakeAdvisor(agentId, skill);
      results.push({ agentId, ...result });
      if (result.ok) triggered++;
      else failed++;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ agentId, ok: false, error });
      failed++;
    }
  }

  return { triggered, failed, results };
}

// --- Bridge registry helpers ---

interface BridgeRegistryEntry {
  id: string;
  name: string;
  url: string;
  phoneNumbers: string[];
  discordChannelIds: string[];
  allowDMs: boolean;
}

async function loadBridgeRegistry(): Promise<BridgeRegistryEntry[]> {
  try {
    const content = await readFile(BRIDGE_REGISTRY_FILE, "utf-8");
    return JSON.parse(content);
  } catch {
    return [];
  }
}

async function saveBridgeRegistry(entries: BridgeRegistryEntry[]): Promise<void> {
  await writeFile(BRIDGE_REGISTRY_FILE, JSON.stringify(entries, null, 2));
}

async function addToBridgeRegistry(entry: BridgeRegistryEntry): Promise<void> {
  const entries = await loadBridgeRegistry();
  const existing = entries.findIndex(e => e.id === entry.id);
  if (existing >= 0) {
    entries[existing] = entry;
  } else {
    entries.push(entry);
  }
  await saveBridgeRegistry(entries);
}

async function updateBridgeRegistryPhone(agentId: string, phone: string, name: string): Promise<void> {
  const entries = await loadBridgeRegistry();
  const entry = entries.find(e => e.id === agentId);
  if (entry) {
    entry.name = `${name}'s Advisor`;
    if (!entry.phoneNumbers.includes(phone)) {
      entry.phoneNumbers.push(phone);
    }
    await saveBridgeRegistry(entries);
  }
}

async function removeBridgeRegistryPhone(agentId: string, phone: string): Promise<void> {
  const entries = await loadBridgeRegistry();
  const entry = entries.find(e => e.id === agentId);
  if (entry) {
    entry.phoneNumbers = entry.phoneNumbers.filter(p => p !== phone);
    entry.name = `Pool ${agentId}`;
    await saveBridgeRegistry(entries);
  }
}

async function reloadBridgeRegistry(): Promise<void> {
  try {
    const res = await fetch(BRIDGE_RELOAD_URL, { method: "POST" });
    if (!res.ok) {
      console.warn(`Bridge registry reload failed: ${res.status}`);
    }
  } catch (err) {
    console.warn(`Bridge registry reload error (bridge may not be running): ${err}`);
  }
}

// --- Intro message ---

function triggerIntro(spriteUrl: string, agentId: string, input: CaptainInput, phone: string): void {
  const introPrompt = [
    `You've just been assigned as ${input.name}'s advisor.`,
    `Read your CLAUDE.md for full context about who you are and how to communicate.`,
    `Send a warm, brief intro message — 1-2 sentences max. You're texting via iMessage.`,
    `Captain info: name="${input.name}", boat="${input.boatName || "their boat"}", phone="${phone}", userId="${input.userId}".`,
    `Don't mention anything about being assigned or activated. Just be natural — like a dock neighbor saying hey for the first time.`,
  ].join(" ");

  fetch(`${spriteUrl}/message`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: introPrompt,
      chatId: `im:${phone}`,
      userId: input.userId,
    }),
    signal: AbortSignal.timeout(180_000),
  }).then(async (res) => {
    if (res.ok) {
      console.log(`Intro triggered for ${agentId}`);
    } else {
      console.error(`Intro failed for ${agentId}: ${res.status}`);
    }
  }).catch((err) => {
    console.error(`Intro error for ${agentId}: ${err}`);
  });
}

// --- Helpers ---

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return phone.startsWith("+") ? phone : `+${digits}`;
}

async function waitForSpriteHealth(url: string, timeoutMs: number): Promise<void> {
  const start = Date.now();
  let attempt = 0;
  while (Date.now() - start < timeoutMs) {
    attempt++;
    try {
      const res = await fetch(`${url}/health`, { signal: AbortSignal.timeout(10_000) });
      if (res.ok) return;
    } catch {}
    const delay = attempt <= 5 ? 2000 : 5000;
    await Bun.sleep(delay);
  }
  throw new Error(`Sprite at ${url} did not become healthy within ${timeoutMs}ms`);
}
