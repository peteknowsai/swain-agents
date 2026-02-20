#!/usr/bin/env bun

/**
 * Desk Commands
 * swain desk list|create|delete
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

/**
 * swain desk list [--json]
 * List all content desk agents via Convex
 */
async function listDesks(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/agents?type=desk');
  const desks = (result.agents || []).filter((a: any) => a.type === 'desk');

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, desks, count: desks.length }, null, 2));
    return;
  }

  if (desks.length === 0) {
    print('No content desks found');
    return;
  }

  print(`\n${colors.bold}CONTENT DESKS (${desks.length})${colors.reset}\n`);
  print(`${'AGENT ID'.padEnd(30)} ${'NAME'.padEnd(20)} ${'REGION'}`);
  print(`${'-'.repeat(30)} ${'-'.repeat(20)} ${'-'.repeat(30)}`);

  for (const d of desks) {
    print(`${(d.agentId || d.agent_id || '').slice(0, 29).padEnd(30)} ${(d.name || '-').slice(0, 19).padEnd(20)} ${d.region || '-'}`);
  }
  print('');
}

/**
 * swain desk create --name=<slug> --region=<description> [--json]
 * Provision a new content desk via the agent API
 */
async function createDesk(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = params['name'];
  const region = params['region'];

  if (!name || !region) {
    printError('Usage: swain desk create --name=<slug> --region=<description>');
    process.exit(1);
  }

  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';
  const apiToken = process.env.SWAIN_AGENT_API_TOKEN;
  if (!apiToken) {
    printError('SWAIN_AGENT_API_TOKEN env var required for desk management');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/desks`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, region }),
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: result.error }, null, 2));
    } else {
      printError(result.error || 'Failed to create desk');
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } else {
    printSuccess(`Created content desk: ${result.agentId} (region: ${region})`);
  }
}

/**
 * swain desk delete <name> [--json]
 * Delete a content desk via the agent API
 */
async function deleteDesk(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk delete <name>');
    process.exit(1);
  }

  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';
  const apiToken = process.env.SWAIN_AGENT_API_TOKEN;
  if (!apiToken) {
    printError('SWAIN_AGENT_API_TOKEN env var required for desk management');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/desks/${name}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: result.error }, null, 2));
    } else {
      printError(result.error || `Failed to delete desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } else {
    printSuccess(`Deleted content desk: ${name}`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain desk${colors.reset} - Content desk management

${colors.bold}COMMANDS${colors.reset}
  list                    List all content desks
  create                  Provision a new content desk
  delete <name>           Delete a content desk

${colors.bold}OPTIONS${colors.reset}
  --name=<slug>           Desk name slug (lowercase-hyphenated)
  --region=<description>  Region description (e.g., "Tampa Bay, FL")
  --json                  Output as JSON

${colors.bold}ENVIRONMENT${colors.reset}
  SWAIN_AGENT_API_TOKEN   Required for create/delete (agent API auth)
  SWAIN_AGENT_API_URL     Override agent API URL (default: http://localhost:3847)

${colors.bold}EXAMPLES${colors.reset}
  swain desk list
  swain desk list --json
  swain desk create --name=tampa-bay --region="Tampa Bay, FL"
  swain desk delete tampa-bay
`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'list':
        await listDesks(commandArgs);
        break;
      case 'create':
      case 'add':
        await createDesk(commandArgs);
        break;
      case 'delete':
      case 'remove':
        await deleteDesk(commandArgs);
        break;
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        showHelp();
        break;
      default:
        printError(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err: any) {
    printError(err.message);
    process.exit(1);
  }
}
