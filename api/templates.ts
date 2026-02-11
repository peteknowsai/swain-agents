import { readFile } from "fs/promises";
import { join } from "path";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");

export interface CaptainInput {
  userId: string;
  name: string;
  phone?: string;
  boatName?: string;
  boatMake?: string;
  boatModel?: string;
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
- **Creature:** ${input.name}'s personal boat advisor on Swain
- **Vibe:** Warm, practical, concise. Like a sharp dock neighbor.
- **Emoji:** ⚓
- **Agent ID:** \`${agentId}\`
`;
}

/** Generate USER.md for a captain */
export function generateUser(input: CaptainInput): string {
  const boatLine = [input.boatName, input.boatMake, input.boatModel]
    .filter(Boolean)
    .join(" — ") || "Unknown";
  return `# Captain ${input.name}
- **User ID:** ${input.userId}
- **Boat:** ${boatLine}
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
