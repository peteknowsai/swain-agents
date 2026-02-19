#!/usr/bin/env bun

/**
 * Agent Commands
 * swain agent list|get|create|update|delete|run
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

interface Agent {
  agentId: string;
  type: string;
  name: string;
  model: string;
  description?: string;
}

/**
 * swain agent list
 * List all agents from registry
 */
async function listAgents(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const typeFilter = params['type'];

  const endpoint = typeFilter ? `/agents?type=${encodeURIComponent(typeFilter)}` : '/agents';
  const result = await workerRequest(endpoint);
  const agents: Agent[] = result.agents || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, agents }, null, 2));
    return;
  }

  if (agents.length === 0) {
    print('No agents found');
    return;
  }

  print(`\n${colors.bold}AGENTS (${agents.length})${colors.reset}\n`);
  print(`${'AGENT ID'.padEnd(30)} ${'TYPE'.padEnd(15)} ${'MODEL'.padEnd(30)}`);
  print(`${'-'.repeat(30)} ${'-'.repeat(15)} ${'-'.repeat(30)}`);

  for (const agent of agents) {
    print(`${agent.agentId.padEnd(30)} ${(agent.type || '-').padEnd(15)} ${(agent.model || '-').padEnd(30)}`);
  }
  print('');
}

/**
 * swain agent get
 * Get detailed agent metadata
 */
async function getAgent(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const agentId = params['agent'] || args[0];
  const jsonOutput = params['json'] === 'true';

  if (!agentId || agentId.startsWith('--')) {
    printError('Usage: swain agent get <agentId> or --agent=<id>');
    process.exit(1);
  }

  const result = await workerRequest(`/agents/${agentId}`);
  const agent = result.agent;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, agent }, null, 2));
    return;
  }

  if (!agent) {
    printError(`Agent not found: ${agentId}`);
    process.exit(1);
  }

  print(`\n${colors.bold}AGENT: ${agent.agent_id}${colors.reset}\n`);
  print(`  Type:        ${agent.type || '-'}`);
  print(`  Name:        ${agent.name || '-'}`);
  print(`  Model:       ${agent.model || '-'}`);
  print(`  Description: ${agent.description || '-'}`);
  print(`  Region:      ${agent.region || '-'}`);
  print(`  Beat:        ${agent.beat || '-'}`);
  print(`  Created:     ${agent.created_at || '-'}`);
  print('');
}

/**
 * swain agent create
 * Create a new agent in registry
 */
async function createAgent(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const agentId = params['agent'];
  const type = params['type'] || 'agent';
  const name = params['name'];
  const model = params['model'] || 'claude-sonnet-4-20250514';
  const description = params['description'];
  const region = params['region'];
  const beat = params['beat'];
  const jsonOutput = params['json'] === 'true';

  if (!agentId) {
    printError('Usage: swain agent create --agent=<id> [--type=<type>] [--name=<name>] [--model=<model>]');
    process.exit(1);
  }

  try {
    const result = await workerRequest('/agents', {
      method: 'POST',
      body: { agentId, type, name, model, description, region, beat }
    });

    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, agentId, ...result }, null, 2));
    } else {
      printSuccess(`Agent ${agentId} created`);
    }
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    } else {
      printError(`Failed to create agent: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * swain agent update
 * Update agent metadata
 */
async function updateAgent(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const agentId = params['agent'];
  const jsonOutput = params['json'] === 'true';

  if (!agentId) {
    printError('Usage: swain agent update --agent=<id> [--name=...] [--model=...] [--description=...]');
    process.exit(1);
  }

  const body: Record<string, string> = {};
  if (params['name']) body.name = params['name'];
  if (params['model']) body.model = params['model'];
  if (params['description']) body.description = params['description'];
  if (params['type']) body.type = params['type'];
  if (params['region']) body.region = params['region'];
  if (params['beat']) body.beat = params['beat'];

  if (Object.keys(body).length === 0) {
    printError('No fields to update. Use --name, --model, --description, etc.');
    process.exit(1);
  }

  const result = await workerRequest(`/agents/${agentId}`, {
    method: 'PATCH',
    body
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
  } else {
    printSuccess(`Agent ${agentId} updated`);
  }
}

/**
 * swain agent delete
 * Delete an agent from registry
 */
async function deleteAgent(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const agentId = params['agent'];
  const force = params['force'] === 'true';
  const jsonOutput = params['json'] === 'true';

  if (!agentId) {
    printError('Usage: swain agent delete --agent=<id> [--force]');
    process.exit(1);
  }

  if (!force) {
    print(`${colors.yellow}Warning:${colors.reset} This will delete agent '${agentId}'.`);
    print(`Run with --force to confirm.`);
    process.exit(1);
  }

  try {
    const result = await workerRequest(`/agents/${agentId}`, {
      method: 'DELETE'
    });

    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, agentId, ...result }, null, 2));
    } else {
      printSuccess(`Agent ${agentId} deleted`);
    }
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    } else {
      printError(`Failed to delete agent: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain agent${colors.reset} - Manage agents

${colors.bold}COMMANDS${colors.reset}
  list                    List all agents (use --type to filter)
  get <id>                Get agent details
  create                  Create a new agent
  update                  Update agent metadata
  delete                  Delete an agent

${colors.bold}OPTIONS${colors.reset}
  --agent=<id>            Agent ID
  --json                  Output as JSON
  --type=<type>           Agent type (for create/update)
  --name=<name>           Agent display name (for create/update)
  --model=<model>         Model ID (for create/update/run)
  --description=<desc>    Agent description (for create/update)
  --region=<region>       Agent region (for create/update)
  --beat=<beat>           Agent beat (for create/update)
  --force                 Force delete without confirmation

${colors.bold}EXAMPLES${colors.reset}
  swain agent list
  swain agent list --type=advisor
  swain agent list --type=advisor --json
  swain agent get advisor-pete-usr_34
  swain agent create --agent=my-agent --type=desk --name="My Agent"
  swain agent update --agent=my-agent --name="New Name"
  swain agent delete --agent=my-agent --force
`);
}

/**
 * Main entry point
 */
export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'list':
        await listAgents(commandArgs);
        break;
      case 'get':
        await getAgent(commandArgs);
        break;
      case 'create':
        await createAgent(commandArgs);
        break;
      case 'update':
        await updateAgent(commandArgs);
        break;
      case 'delete':
        await deleteAgent(commandArgs);
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
