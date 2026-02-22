#!/usr/bin/env bun

/**
 * Desk Commands
 * swain desk list|create|delete|pause|unpause
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

function getApiConfig(): { apiUrl: string; apiToken: string } {
  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';
  const apiToken = process.env.SWAIN_AGENT_API_TOKEN || '';
  if (!apiToken) {
    printError('SWAIN_AGENT_API_TOKEN env var required for desk management');
    process.exit(1);
  }
  return { apiUrl, apiToken };
}

function apiHeaders(token: string): Record<string, string> {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * swain desk list [--json]
 * List all content desk agents — prefers agent API (includes paused status),
 * falls back to Convex if no API token set.
 */
async function listDesks(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const apiToken = process.env.SWAIN_AGENT_API_TOKEN;
  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';

  let desks: any[];

  if (apiToken) {
    // Prefer agent API — has paused status
    const res = await fetch(`${apiUrl}/desks`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    const result = await res.json() as any;
    if (!res.ok) {
      printError(result.error || 'Failed to list desks from agent API');
      process.exit(1);
    }
    desks = result.desks || [];
  } else {
    // Fall back to Convex
    const result = await workerRequest('/agents?type=desk');
    desks = (result.agents || []).filter((a: any) => a.type === 'desk');
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, desks, count: desks.length }, null, 2));
    return;
  }

  if (desks.length === 0) {
    print('No content desks found');
    return;
  }

  print(`\n${colors.bold}CONTENT DESKS (${desks.length})${colors.reset}\n`);
  print(`${'AGENT ID'.padEnd(30)} ${'NAME'.padEnd(20)} ${'STATUS'.padEnd(10)} ${'REGION'}`);
  print(`${'-'.repeat(30)} ${'-'.repeat(20)} ${'-'.repeat(10)} ${'-'.repeat(30)}`);

  for (const d of desks) {
    const id = (d.id || d.agentId || d.agent_id || '').slice(0, 29).padEnd(30);
    const name = (d.name || '-').slice(0, 19).padEnd(20);
    const paused = d.paused;
    const status = paused
      ? `${colors.yellow}paused${colors.reset}`.padEnd(10 + colors.yellow.length + colors.reset.length)
      : `${colors.green}active${colors.reset}`.padEnd(10 + colors.green.length + colors.reset.length);
    const region = d.region || '-';
    print(`${id} ${name} ${status} ${region}`);
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

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks`, {
    method: 'POST',
    headers: apiHeaders(apiToken),
    body: JSON.stringify({ name, region }),
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || 'Failed to create desk');
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Created content desk: ${(result as any).agentId} (region: ${region})`);
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

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks/${name}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || `Failed to delete desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Deleted content desk: ${name}`);
  }
}

/**
 * swain desk pause <name> [--json]
 * Pause a content desk (remove heartbeat, keep agent registered)
 */
async function pauseDeskCmd(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk pause <name>');
    process.exit(1);
  }

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks/${name}/pause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || `Failed to pause desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Paused content desk: ${name}`);
  }
}

/**
 * swain desk unpause <name> [--json]
 * Unpause a content desk (restore 4h heartbeat)
 */
async function unpauseDeskCmd(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk unpause <name>');
    process.exit(1);
  }

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks/${name}/unpause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || `Failed to unpause desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Unpaused content desk: ${name}`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain desk${colors.reset} - Content desk management

${colors.bold}COMMANDS${colors.reset}
  list                    List all content desks (with status)
  create                  Provision a new content desk
  delete <name>           Delete a content desk
  pause <name>            Pause a desk (stops heartbeat, keeps agent)
  unpause <name>          Unpause a desk (restores 4h heartbeat)

${colors.bold}OPTIONS${colors.reset}
  --name=<slug>           Desk name slug (lowercase-hyphenated)
  --region=<description>  Region description (e.g., "Tampa Bay, FL")
  --json                  Output as JSON

${colors.bold}ENVIRONMENT${colors.reset}
  SWAIN_AGENT_API_TOKEN   Required for create/delete/pause/unpause (agent API auth)
  SWAIN_AGENT_API_URL     Override agent API URL (default: http://localhost:3847)

${colors.bold}EXAMPLES${colors.reset}
  swain desk list
  swain desk list --json
  swain desk create --name=mobile-bay --region="Mobile Bay, AL"
  swain desk pause mobile-bay
  swain desk unpause mobile-bay
  swain desk delete mobile-bay
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
      case 'pause':
        await pauseDeskCmd(commandArgs);
        break;
      case 'unpause':
      case 'resume':
        await unpauseDeskCmd(commandArgs);
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
