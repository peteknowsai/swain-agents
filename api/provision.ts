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
const REGISTRY_FILE = "/root/skip-agent-api/registry.json";

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

  return { agentId, status: "provisioned", workspace };
}

/** Delete an advisor agent */
export async function deleteAdvisor(agentId: string): Promise<void> {
  // Validate agentId format
  if (!agentId.startsWith("advisor-")) {
    throw new Error("Can only delete advisor agents");
  }

  // Remove from openclaw
  await openclaw(["agents", "delete", agentId]);

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

/** Send a message to an advisor */
export async function messageAdvisor(
  agentId: string,
  text: string
): Promise<string> {
  if (!agentId.startsWith("advisor-")) {
    throw new Error("Can only message advisor agents");
  }
  return openclaw(["agent", "--agent", agentId, "--message", text, "--json"]);
}
