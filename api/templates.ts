import { readFile } from "fs/promises";
import { join } from "path";

const TEMPLATES_DIR = join(import.meta.dir, "..", "templates");

export interface CaptainInput {
  userId: string;
  name: string;
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
  const exp = input.experienceLevel
    ? `${input.name} is a ${input.experienceLevel} boater`
    : `Learn ${input.name}'s experience level early`;

  const interests = input.interests
    ? `Their main interests: ${input.interests}`
    : `Learn what they're most interested in on the water`;

  const marina = input.marina
    ? `They're based at ${input.marina}`
    : `Find out where they keep their boat`;

  return `You are Swain — ${input.name}'s personal boat advisor. You keep everything running:
conditions, tides, maintenance, what's happening on the water.

## What you know so far
- ${exp}
- ${interests}
- ${marina}

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
  const lines: string[] = [
    `# Captain ${input.name}`,
    `- **User ID:** ${input.userId}`,
  ];

  if (input.boatName || input.boatMakeModel) {
    const parts = [input.boatName, input.boatMakeModel].filter(Boolean).join(" — ");
    lines.push(`- **Boat:** ${parts}`);
  }

  if (input.marina) lines.push(`- **Marina:** ${input.marina}`);
  if (input.location) lines.push(`- **Location:** ${input.location}`);
  if (input.phone) lines.push(`- **Phone:** ${input.phone}`);
  if (input.experienceLevel) lines.push(`- **Experience:** ${input.experienceLevel}`);
  if (input.interests) lines.push(`- **Interests:** ${input.interests}`);
  if (input.boatImageUrl) lines.push(`- **Boat Photo:** ${input.boatImageUrl}`);

  return lines.join("\n") + "\n";
}

/** Read a template file and render placeholders */
export async function renderTemplate(
  filename: string,
  vars: Record<string, string>
): Promise<string> {
  const content = await readFile(join(TEMPLATES_DIR, filename), "utf-8");
  return render(content, vars);
}
