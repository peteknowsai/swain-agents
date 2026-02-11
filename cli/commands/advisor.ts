#!/usr/bin/env bun

/**
 * Advisor Commands
 * skip advisor list|memories|pool
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
 * skip advisor list
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
 * skip advisor memories --user=<userId>
 * Read advisor memories for a user
 */
async function readMemories(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'] || (args[0] && !args[0].startsWith('--') ? args[0] : null);
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: skip advisor memories --user=<userId>');
    print('  Get user IDs with: skip user list');
    process.exit(1);
  }

  // Use dashboard endpoint which includes memories
  const result = await workerRequest(`/dashboard/users/${userId}`);

  if (!result.success || !result.user) {
    printError(`User not found: ${userId}`);
    process.exit(1);
  }

  const memories = result.memories || [];
  const user = result.user;

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      userId,
      captainName: user.captainName,
      advisorAgentId: user.advisorAgentId,
      memories,
      count: memories.length,
    }, null, 2));
    return;
  }

  print(`\n${colors.bold}ADVISOR MEMORIES${colors.reset} for ${user.captainName || userId}`);
  print(`  Advisor: ${user.advisorAgentId || 'none'}`);
  print(`  Location: ${user.marinaLocation || user.location || '-'}\n`);

  if (memories.length === 0) {
    print('  No memories recorded yet.');
    print('');
    return;
  }

  for (const m of memories) {
    const cat = `${colors.cyan}[${m.category || 'general'}]${colors.reset}`;
    const confidence = m.confidence ? ` ${colors.dim}(${m.confidence})${colors.reset}` : '';
    print(`  ${cat} ${m.content}${confidence}`);
  }
  print(`\n  Total: ${memories.length} memories\n`);
}

/**
 * skip advisor pool create [--count=5]
 * Pre-provision pool advisors
 */
async function poolCreate(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const count = parseInt(params['count'] || '5', 10);

  print(`Creating ${count} pool advisors...`);

  const result = await workerRequest('/advisors/pool/create', {
    method: 'POST',
    body: { count },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    printSuccess(`Created ${result.created} pool advisors (total available: ${result.total})`);
    for (const r of result.results || []) {
      if (r.created) {
        print(`  ${colors.green}+${colors.reset} ${r.advisorId}`);
      } else if (r.error) {
        print(`  ${colors.red}x${colors.reset} ${r.error}`);
      }
    }
  } else {
    printError(result.error || 'Failed to create pool advisors');
  }
  print('');
}

/**
 * skip advisor pool list
 * List pool advisors (available + assigned)
 */
async function poolList(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/agents?type=advisor');
  const agents = (result.agents || []).filter((a: any) => a.type === 'advisor' || a.agentId?.startsWith('advisor-'));
  const pool = agents.filter((a: any) => !a.ownerId && !a.owner_id);
  const assigned = agents.filter((a: any) => a.ownerId || a.owner_id);

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, available: pool, assigned, totalAvailable: pool.length, totalAssigned: assigned.length }, null, 2));
    return;
  }

  print(`\n${colors.bold}ADVISOR POOL${colors.reset}\n`);

  if (pool.length > 0) {
    print(`${colors.green}Available (${pool.length})${colors.reset}`);
    for (const a of pool) {
      print(`  ${a.agentId || a.agent_id}`);
    }
  } else {
    print(`${colors.yellow}No available pool advisors${colors.reset}`);
  }

  if (assigned.length > 0) {
    print(`\n${colors.blue}Assigned (${assigned.length})${colors.reset}`);
    for (const a of assigned) {
      print(`  ${(a.agentId || a.agent_id || '').padEnd(35)} → ${a.ownerId || a.owner_id}`);
    }
  }
  print('');
}

/**
 * skip advisor pool status
 * Pool availability summary
 */
async function poolStatus(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/advisors/pool/status');

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    print(`\n${colors.bold}ADVISOR POOL STATUS${colors.reset}\n`);
    print(`  Available:  ${colors.green}${result.available}${colors.reset}`);
    print(`  Assigned:   ${colors.blue}${result.assigned}${colors.reset}`);
    print(`  Total:      ${result.total}`);
    print('');
  } else {
    printError(result.error || 'Failed to get pool status');
  }
}

/**
 * skip advisor pool <subcommand>
 */
async function poolCommand(args: string[]): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case 'create':
      await poolCreate(subArgs);
      break;
    case 'list':
      await poolList(subArgs);
      break;
    case 'status':
      await poolStatus(subArgs);
      break;
    default:
      print(`
${colors.bold}skip advisor pool${colors.reset} - Advisor pool management

${colors.bold}COMMANDS${colors.reset}
  create [--count=5]    Pre-provision pool advisors
  list                  List available and assigned advisors
  status                Pool availability summary

${colors.bold}EXAMPLES${colors.reset}
  skip advisor pool create --count=3
  skip advisor pool list
  skip advisor pool status --json
`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}skip advisor${colors.reset} - Advisor agent management

${colors.bold}COMMANDS${colors.reset}
  list                    List all advisor agents
  memories                Read advisor memories for a user
  pool                    Pool management (create, list, status)

${colors.bold}OPTIONS${colors.reset}
  --user=<id>             User ID (required for memories)
  --count=<n>             Number to create (for pool create, default: 5)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  skip advisor list
  skip advisor list --json
  skip advisor memories --user=user_abc123
  skip advisor pool create --count=5
  skip advisor pool list
  skip advisor pool status
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
      case 'memories':
      case 'memory':
        await readMemories(commandArgs);
        break;
      case 'pool':
        await poolCommand(commandArgs);
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
