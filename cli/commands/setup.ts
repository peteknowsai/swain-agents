/**
 * Setup Command
 * swain setup [--dir=<path>] [--json]
 *
 * Detects environment, unpacks embedded skills to the right place.
 */

import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { SKILLS } from "../lib/skills-data";
import { parseArgs } from "../lib/args";
import { print, printSuccess, printError, colors } from "../lib/worker-client";

type Environment = "openclaw" | "standalone";

function detectEnvironment(): { env: Environment; dir: string } {
  // OpenClaw workspace: AGENTS.md in CWD
  if (existsSync(join(process.cwd(), "AGENTS.md"))) {
    return { env: "openclaw", dir: join(process.cwd(), "skills") };
  }

  // Fallback: standalone
  return { env: "standalone", dir: join(homedir(), ".swain", "skills") };
}

export async function run(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params["json"] === "true";
  const dirOverride = params["dir"];

  const detected = detectEnvironment();
  const targetDir = dirOverride || detected.dir;
  const env = dirOverride ? "standalone" : detected.env;

  const skillNames = Object.keys(SKILLS);
  const installed: string[] = [];

  for (const name of skillNames) {
    const skillDir = join(targetDir, name);
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, "SKILL.md"), SKILLS[name]);
    installed.push(name);
  }

  if (jsonOutput) {
    console.log(
      JSON.stringify(
        {
          success: true,
          environment: env,
          skillsDir: targetDir,
          skills: installed,
        },
        null,
        2
      )
    );
    return;
  }

  printSuccess(`Skills installed to ${targetDir}`);
  print(`  Environment: ${colors.bold}${env}${colors.reset}`);
  print(`  Skills (${installed.length}):`);
  for (const name of installed) {
    print(`    ${colors.dim}•${colors.reset} ${name}`);
  }
}
