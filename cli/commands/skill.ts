/**
 * Skill Command
 * swain skill list [--json]
 * swain skill show <name> [--json]
 *
 * Read-only access to embedded skills.
 */

import { SKILLS } from "../lib/skills-data";
import { parseArgs } from "../lib/args";
import { print, printError, colors } from "../lib/worker-client";

function list(args: string[]): void {
  const params = parseArgs(args);
  const jsonOutput = params["json"] === "true";
  const names = Object.keys(SKILLS);

  if (jsonOutput) {
    console.log(JSON.stringify({ skills: names }));
    return;
  }

  print(`${colors.bold}Bundled skills (${names.length}):${colors.reset}`);
  for (const name of names) {
    print(`  ${colors.dim}•${colors.reset} ${name}`);
  }
}

function show(args: string[]): void {
  const params = parseArgs(args);
  const jsonOutput = params["json"] === "true";
  const name = args.find((a) => !a.startsWith("--"));

  if (!name) {
    printError("Usage: swain skill show <name>");
    process.exit(1);
  }

  const content = SKILLS[name];
  if (!content) {
    printError(`Unknown skill: ${name}`);
    printError(`Available: ${Object.keys(SKILLS).join(", ")}`);
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ name, content }));
    return;
  }

  print(content);
}

export async function run(args: string[]): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case "list":
      list(subArgs);
      break;
    case "show":
      show(subArgs);
      break;
    case "--help":
    case "-h":
    case undefined:
      print(`
${colors.bold}swain skill${colors.reset} — Embedded skill reference

${colors.bold}SUBCOMMANDS${colors.reset}
  list [--json]         List all bundled skills
  show <name> [--json]  Output full SKILL.md content
`);
      break;
    default:
      printError(`Unknown subcommand: ${sub}`);
      process.exit(1);
  }
}
