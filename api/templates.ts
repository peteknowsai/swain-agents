import { readdir, readFile, stat } from "fs/promises";
import { join, relative } from "path";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");

export interface CaptainInput {
  userId: string;
  name: string;
  phone?: string;
  boatName?: string;
}

/** Generate a URL-safe slug from captain name + userId prefix */
export function makeSlug(name: string, userId: string): string {
  const namePart = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
  const idPart = userId.replace(/^user_/, "").slice(0, 6).toLowerCase();
  return `advisor-${namePart}-${idPart}`;
}

/** Replace {{placeholders}} in template content */
function render(content: string, vars: Record<string, string>): string {
  let result = content;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

/** Generate SOUL.md for an advisor */
export function generateSoul(input: CaptainInput): string {
  return `You are Skip — ${input.name}'s personal boat advisor. You keep everything running:
conditions, tides, maintenance, what's happening on the water.

Get to know what matters most to ${input.name} and adapt your briefings over time.
Keep it brief — ${input.name} wants to know if it's a good day to get out, not
read an essay. Warm but not chatty — like a sharp dock neighbor who always
knows what's up.
`;
}

/** Generate IDENTITY.md for an advisor */
export function generateIdentity(input: CaptainInput, agentId: string): string {
  return `# IDENTITY.md - Who Am I?
- **Name:** Skip
- **Creature:** ${input.name}'s personal boat advisor on Hey Skip
- **Vibe:** Warm, practical, concise. Like a sharp dock neighbor.
- **Emoji:** ⚓
- **Agent ID:** \`${agentId}\`
`;
}

/** Generate USER.md for a captain */
export function generateUser(input: CaptainInput): string {
  return `# Captain ${input.name}
- **User ID:** ${input.userId}
- **Boat:** ${input.boatName || "Unknown"}
- **Phone:** ${input.phone || "Unknown"}
- **Marina:** Not yet set (will be learned during onboarding)
`;
}

/** Read a template file and render placeholders */
export async function renderTemplate(
  filename: string,
  vars: Record<string, string>
): Promise<string> {
  const content = await readFile(join(TEMPLATES_DIR, filename), "utf-8");
  return render(content, vars);
}

/** Recursively collect all files under a directory */
async function collectFiles(dir: string, base: string = dir): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectFiles(full, base)));
    } else {
      files.push(relative(base, full));
    }
  }
  return files;
}

/** List all template files with last-modified timestamps */
export async function listTemplates(): Promise<
  Array<{ filename: string; lastModified: string }>
> {
  const files = await collectFiles(TEMPLATES_DIR);
  const results = await Promise.all(
    files.map(async (f) => {
      const s = await stat(join(TEMPLATES_DIR, f));
      return { filename: f, lastModified: s.mtime.toISOString() };
    })
  );
  return results.sort((a, b) => a.filename.localeCompare(b.filename));
}

/** Read a specific template file (raw, no rendering) */
export async function getTemplate(filename: string): Promise<string> {
  // Prevent path traversal
  const resolved = join(TEMPLATES_DIR, filename);
  if (!resolved.startsWith(TEMPLATES_DIR)) {
    throw new Error("Invalid template path");
  }
  return readFile(resolved, "utf-8");
}

/** Write a template file */
export async function putTemplate(filename: string, content: string): Promise<void> {
  const resolved = join(TEMPLATES_DIR, filename);
  if (!resolved.startsWith(TEMPLATES_DIR)) {
    throw new Error("Invalid template path");
  }
  await Bun.write(resolved, content);
}

/** Preview rendered workspace files for a captain (without provisioning) */
export async function previewWorkspace(input: CaptainInput) {
  const agentId = makeSlug(input.name, input.userId);
  const vars = { userId: input.userId };

  const [agentsMd, toolsMd, heartbeatMd] = await Promise.all([
    renderTemplate("AGENTS.md", vars),
    renderTemplate("TOOLS.md", vars),
    renderTemplate("HEARTBEAT.md", vars),
  ]);

  return {
    agentId,
    files: {
      "SOUL.md": generateSoul(input),
      "IDENTITY.md": generateIdentity(input, agentId),
      "USER.md": generateUser(input),
      "AGENTS.md": agentsMd,
      "TOOLS.md": toolsMd,
      "HEARTBEAT.md": heartbeatMd,
      "MEMORY.md": "",
    },
  };
}
