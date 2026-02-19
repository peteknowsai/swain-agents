#!/usr/bin/env bun

/**
 * Advisor Commands
 * swain advisor list|delete
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
 * swain advisor list
 * List all advisor agents
 */
async function listAdvisors(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/agents?type=advisor');
  const agents = (result.agents || []).filter((a: any) => a.type === 'advisor' || a.agentId?.startsWith('advisor-'));

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, advisors: agents, count: agents.length }, null, 2));
    return;
  }

  if (agents.length === 0) {
    print('No advisor agents found');
    return;
  }

  print(`\n${colors.bold}ADVISORS (${agents.length})${colors.reset}\n`);
  print(`${'AGENT ID'.padEnd(35)} ${'NAME'.padEnd(20)} ${'OWNER'}`);
  print(`${'-'.repeat(35)} ${'-'.repeat(20)} ${'-'.repeat(20)}`);

  for (const a of agents) {
    print(`${(a.agentId || a.agent_id || '').slice(0, 34).padEnd(35)} ${(a.name || '-').slice(0, 19).padEnd(20)} ${a.ownerId || a.owner_id || '-'}`);
  }
  print('');
}

/**
 * swain advisor delete <agentId> [--json]
 * Delete an advisor agent via the Swain Agent API
 */
async function deleteAdvisor(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const agentId = args.find(a => !a.startsWith('--'));

  if (!agentId) {
    printError('Usage: swain advisor delete <agentId>');
    process.exit(1);
  }

  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';
  const apiToken = process.env.SWAIN_AGENT_API_TOKEN;
  if (!apiToken) {
    printError('SWAIN_AGENT_API_TOKEN env var required for advisor management');
    process.exit(1);
  }

  const res = await fetch(`${apiUrl}/advisors/${agentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: result.error }, null, 2));
    } else {
      printError(result.error || `Failed to delete ${agentId}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } else {
    printSuccess(`Deleted advisor ${agentId}`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain advisor${colors.reset} - Advisor agent management

${colors.bold}COMMANDS${colors.reset}
  list                    List all advisor agents
  delete <agentId>        Delete an advisor agent

${colors.bold}OPTIONS${colors.reset}
  --json                  Output as JSON

${colors.bold}ENVIRONMENT${colors.reset}
  SWAIN_AGENT_API_TOKEN   Required for delete (agent API auth)
  SWAIN_AGENT_API_URL     Override agent API URL (default: http://localhost:3847)

${colors.bold}EXAMPLES${colors.reset}
  swain advisor list
  swain advisor list --json
  swain advisor delete advisor-bob-39xwgb
`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'list':
        await listAdvisors(commandArgs);
        break;
      case 'delete':
      case 'remove':
        await deleteAdvisor(commandArgs);
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
