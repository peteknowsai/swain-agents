#!/usr/bin/env bun

/**
 * Swain CLI
 * Command-line interface for the Swain platform
 *
 * Usage:
 *   swain agent list|get|create|update|delete
 *   swain card list|get|create
 *   swain edition list|get
 *   swain briefing list|get|assemble
 *   swain user list|get|update
 */

import { run as runAgent } from './commands/agent';
import { run as runCard } from './commands/card';
import { run as runEdition } from './commands/edition';
import { run as runBriefing } from './commands/briefing';
import { run as runImage } from './commands/image';
import { run as runStyle } from './commands/style';
import { run as runOnboarding } from './commands/onboarding';
import { run as runUser } from './commands/user';
import { run as runAdvisor } from './commands/advisor';
import { run as runMessage } from './commands/message';
import { print, colors } from './lib/worker-client';

const VERSION = '0.5.0';

function showVersion(): void {
  print(`swain v${VERSION}`);
}

function showHelp(): void {
  print(`
${colors.bold}swain${colors.reset} - Swain CLI v${VERSION}

${colors.bold}USAGE${colors.reset}
  swain <command> [subcommand] [options]

${colors.bold}COMMANDS${colors.reset}
  agent                   Manage agents (list, get, create, update, delete)
  card                    Content cards (list, get, create, coverage, audit)
  edition                 Daily editions (list, get)
  briefing                User briefings (list, get, assemble, validate)
  user                    User management (list, get, update, onboard-status, upload-boat-image)
  advisor                 Advisor agents (list, memories, pool)
  message                 Send iMessage/SMS (send)
  style                   Browse image styles (list, get)
  onboarding              Onboarding templates (list, seed)
  image                   Image generation (generate, queue, status, wait)

${colors.bold}GLOBAL OPTIONS${colors.reset}
  --help, -h              Show help
  --version, -v           Show version
  --json                  Output as JSON (for programmatic use)
  --env=<env>             Environment: local, prod (default: auto-detect)

${colors.bold}ENVIRONMENTS${colors.reset}
  prod (default):  https://wandering-sparrow-224.convex.site
  dev/local:       https://calm-basilisk-210.convex.site
  Override with SWAIN_API_URL or --env=local|prod

${colors.bold}ENVIRONMENT VARIABLES${colors.reset}
  SWAIN_API_URL            Override API URL (takes precedence over --env)
  SWAIN_API_TOKEN          Admin token for authenticated API access

${colors.bold}EXAMPLES${colors.reset}
  swain agent list                           List all agents
  swain card list --desk=tampa-bay           List cards by desk
  swain card coverage --desk=tampa-bay       Show coverage report
  swain briefing list --user=user_abc        List briefings for user
  swain user get user_bobby_b08861b8         Get user details

${colors.bold}MORE INFO${colors.reset}
  swain <command> --help                     Show command-specific help
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0];
  const subArgs = args.slice(1);

  // Handle global flags
  if (!command || command === '--help' || command === '-h' || command === 'help') {
    showHelp();
    process.exit(0);
  }

  if (command === '--version' || command === '-v') {
    showVersion();
    process.exit(0);
  }

  // Route to subcommand
  switch (command) {
    case 'agent':
      await runAgent(subArgs);
      break;
    case 'card':
      await runCard(subArgs);
      break;
    case 'edition':
      await runEdition(subArgs);
      break;
    case 'briefing':
      await runBriefing(subArgs);
      break;
    case 'onboarding':
      await runOnboarding(subArgs);
      break;
    case 'style':
      await runStyle(subArgs);
      break;
    case 'image':
      await runImage(subArgs);
      break;
    case 'user':
      await runUser(subArgs);
      break;
    case 'advisor':
      await runAdvisor(subArgs);
      break;
    case 'message':
      await runMessage(subArgs);
      break;
    default:
      print(`${colors.red}Unknown command: ${command}${colors.reset}`);
      showHelp();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error:${colors.reset} ${err.message}`);
  process.exit(1);
});
