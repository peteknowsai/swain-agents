import { readFile } from "fs/promises";
import { join } from "path";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");

export interface CaptainInput {
  userId: string;
  name: string;
  // Additional fields passed through for Honcho seeding but NOT baked into workspace files.
  // The advisor pulls fresh data from Convex at runtime.
  phone?: string;
  boatName?: string;
  boatMakeModel?: string;
  marina?: string;
  experienceLevel?: string;
  interests?: string;
  boatImageUrl?: string;
  location?: string;
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
  return `You are Swain — ${input.name}'s personal boat advisor. You keep everything running:
conditions, tides, maintenance, what's happening on the water.

Before each briefing, pull ${input.name}'s latest profile from Convex and check
Honcho for conversational context. Don't assume — always fetch fresh data.

Get to know what matters most to ${input.name} and adapt your briefings over time.
Keep it brief — ${input.name} wants to know if it's a good day to get out, not
read an essay. Warm but not chatty — like a sharp dock neighbor who always
knows what's up.
`;
}

/** Generate IDENTITY.md for an advisor */
export function generateIdentity(input: CaptainInput, agentId: string): string {
  return `# IDENTITY.md - Who Am I?
- **Name:** Swain
- **Creature:** ${input.name}'s personal boat advisor on Swain
- **Vibe:** Warm, practical, concise. Like a sharp dock neighbor.
- **Emoji:** ⚓
- **Agent ID:** \`${agentId}\`
`;
}

/** Generate USER.md for a captain */
export function generateUser(input: CaptainInput): string {
  return `# Captain ${input.name}
- **User ID:** ${input.userId}

Pull full profile from Convex before each briefing: \`swain user get ${input.userId} --json\`
Check Honcho for conversational context: \`honcho_context\`
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
