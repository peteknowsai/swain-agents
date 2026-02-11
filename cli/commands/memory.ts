#!/usr/bin/env bun

/**
 * Memory Commands
 * skip memory list|add|update|forget
 *
 * Manages advisor memories for users
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

/**
 * skip memory list
 * List memories for a user
 */
async function listMemories(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const userId = params['user'] || params['user-id'];

  if (!userId) {
    printError('Usage: skip memory list --user=<userId>');
    process.exit(1);
  }

  const result = await workerRequest(`/memories?userId=${encodeURIComponent(userId)}`);
  const memories = result.memories || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, memories, count: memories.length }, null, 2));
    return;
  }

  if (memories.length === 0) {
    print(`No memories found for user ${userId}`);
    return;
  }

  print(`\n${colors.bold}MEMORIES (${memories.length})${colors.reset} for ${userId}\n`);
  print(`${'ID'.padEnd(25)} ${'CATEGORY'.padEnd(15)} ${'CONTENT'.padEnd(50)} ${'CREATED'}`);
  print(`${'-'.repeat(25)} ${'-'.repeat(15)} ${'-'.repeat(50)} ${'-'.repeat(20)}`);

  for (const memory of memories) {
    const content = (memory.content || '').slice(0, 48);
    const contentDisplay = content + (memory.content?.length > 48 ? '..' : '');
    print(`${(memory.id || '').slice(0, 24).padEnd(25)} ${(memory.category || '-').padEnd(15)} ${contentDisplay.padEnd(50)} ${memory.createdAt || '-'}`);
  }
  print('');
}

/**
 * skip memory get
 * Get memory details
 */
async function getMemory(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const memoryId = params['id'] || args[0];
  const jsonOutput = params['json'] === 'true';

  if (!memoryId || memoryId.startsWith('--')) {
    printError('Usage: skip memory get <memoryId> or --id=<id>');
    process.exit(1);
  }

  const result = await workerRequest(`/memories/${memoryId}`);
  const memory = result.memory;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, memory }, null, 2));
    return;
  }

  if (!memory) {
    printError(`Memory not found: ${memoryId}`);
    process.exit(1);
  }

  print(`\n${colors.bold}MEMORY: ${memory.id}${colors.reset}\n`);
  print(`  User:       ${memory.userId}`);
  print(`  Agent:      ${memory.agentId || '-'}`);
  print(`  Category:   ${memory.category || '-'}`);
  print(`  Source:     ${memory.source || '-'}`);
  print(`  Confidence: ${memory.confidence ?? '-'}`);
  print(`  Created:    ${memory.createdAt || '-'}`);
  print(`  Updated:    ${memory.updatedAt || '-'}`);
  print(`\n${colors.bold}Content:${colors.reset}`);
  print(memory.content || '(empty)');
  print('');
}

/**
 * skip memory add
 * Add a new memory
 */
async function addMemory(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const userId = params['user'] || params['user-id'];
  const category = params['category'];
  const content = params['content'];
  const source = params['source'] || 'cli';
  const confidence = params['confidence'] ? parseFloat(params['confidence']) : 1.0;

  if (!userId) {
    printError('--user=<userId> is required');
    process.exit(1);
  }
  if (!category) {
    printError('--category is required (e.g., preference, goal, context, schedule)');
    process.exit(1);
  }
  if (!content) {
    printError('--content is required');
    process.exit(1);
  }

  const result = await workerRequest('/memories', {
    method: 'POST',
    body: {
      userId,
      category,
      content,
      source,
      confidence,
    }
  });

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      memoryId: result.memoryId,
    }, null, 2));
  } else {
    printSuccess(`Memory ${result.memoryId} created`);
  }
}

/**
 * skip memory update
 * Update an existing memory
 */
async function updateMemory(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const memoryId = params['id'];
  const content = params['content'];
  const category = params['category'];
  const confidence = params['confidence'] ? parseFloat(params['confidence']) : undefined;

  if (!memoryId) {
    printError('--id=<memoryId> is required');
    process.exit(1);
  }
  if (!content && !category && confidence === undefined) {
    printError('At least one of --content, --category, or --confidence is required');
    process.exit(1);
  }

  const body: Record<string, any> = {};
  if (content) body.content = content;
  if (category) body.category = category;
  if (confidence !== undefined) body.confidence = confidence;

  const result = await workerRequest(`/memories/${memoryId}`, {
    method: 'PATCH',
    body
  });

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      memoryId: result.memoryId,
    }, null, 2));
  } else {
    printSuccess(`Memory ${result.memoryId} updated`);
  }
}

/**
 * skip memory forget
 * Archive (soft delete) a memory
 */
async function forgetMemory(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const memoryId = params['id'] || args[0];

  if (!memoryId || memoryId.startsWith('--')) {
    printError('Usage: skip memory forget <memoryId> or --id=<id>');
    process.exit(1);
  }

  const result = await workerRequest(`/memories/${memoryId}`, {
    method: 'DELETE'
  });

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      memoryId: result.memoryId,
      message: 'Memory archived',
    }, null, 2));
  } else {
    printSuccess(`Memory ${result.memoryId} archived`);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}skip memory${colors.reset} - Advisor memories

${colors.bold}COMMANDS${colors.reset}
  list                    List memories for a user
  get <id>                Get memory details
  add                     Add a new memory
  update                  Update an existing memory
  forget <id>             Archive (soft delete) a memory

${colors.bold}OPTIONS (list)${colors.reset}
  --user=<id>             User ID (required)
  --json                  Output as JSON

${colors.bold}OPTIONS (add)${colors.reset}
  --user=<id>             User ID (required)
  --category=<cat>        Category: preference, goal, context, schedule (required)
  --content="..."         Memory content (required)
  --source=<src>          Source of memory (default: cli)
  --confidence=<0-1>      Confidence score (default: 1.0)
  --json                  Output as JSON

${colors.bold}OPTIONS (update)${colors.reset}
  --id=<memoryId>         Memory ID (required)
  --content="..."         New content
  --category=<cat>        New category
  --confidence=<0-1>      New confidence score
  --json                  Output as JSON

${colors.bold}OPTIONS (forget)${colors.reset}
  --id=<memoryId>         Memory ID (or positional arg)
  --json                  Output as JSON

${colors.bold}MEMORY CATEGORIES${colors.reset}
  preference              User preferences (e.g., "Prefers detailed forecasts")
  goal                    Goals and plans (e.g., "Planning Keys trip in March")
  context                 Background info (e.g., "New to offshore fishing")
  schedule                Schedule patterns (e.g., "Usually fishes weekends")

${colors.bold}EXAMPLES${colors.reset}
  skip memory list --user=user_pete_abc123
  skip memory get mem_xyz789

  skip memory add --user=user_pete_abc123 \\
    --category=preference \\
    --content="Prefers detailed weather forecasts"

  skip memory update --id=mem_xyz789 \\
    --content="Updated: Now prefers brief summaries"

  skip memory forget mem_xyz789
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
        await listMemories(commandArgs);
        break;
      case 'get':
        await getMemory(commandArgs);
        break;
      case 'add':
        await addMemory(commandArgs);
        break;
      case 'update':
        await updateMemory(commandArgs);
        break;
      case 'forget':
        await forgetMemory(commandArgs);
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
