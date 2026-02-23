#!/usr/bin/env bun

/**
 * Briefing Commands
 * swain briefing list|get
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';
import { validateItems } from '@peteknowsai/briefing-schema';

/**
 * swain briefing list
 * List briefings (optionally filtered by user) via dashboard endpoint
 */
async function listBriefings(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const userId = params['user'] || params['user-id'];
  const limit = params['limit'] || '50';

  const result = await workerRequest(`/briefings/dashboard?limit=${limit}`);
  const grouped = result.data || [];

  // Flatten grouped data into a flat briefing list
  const briefings: any[] = [];
  for (const group of grouped) {
    for (const b of group.briefings || []) {
      briefings.push({
        ...b,
        userId: group.user?.id,
        captainName: group.user?.captainName,
      });
    }
  }

  // Filter by user if specified
  const filtered = userId
    ? briefings.filter(b => b.userId === userId)
    : briefings;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, briefings: filtered, count: filtered.length }, null, 2));
    return;
  }

  if (filtered.length === 0) {
    print(userId ? `No briefings found for user ${userId}` : 'No briefings found');
    return;
  }

  print(`\n${colors.bold}BRIEFINGS (${filtered.length})${colors.reset}${userId ? ` for ${userId}` : ''}\n`);
  print(`${'ID'.padEnd(38)} ${'DATE'.padEnd(12)} ${'CAPTAIN'.padEnd(12)} ${'ITEMS'.padEnd(6)} ${'TYPE'}`);
  print(`${'-'.repeat(38)} ${'-'.repeat(12)} ${'-'.repeat(12)} ${'-'.repeat(6)} ${'-'.repeat(12)}`);

  for (const b of filtered) {
    const onboarding = b.isOnboarding ? `${colors.cyan}onboarding${colors.reset}` : 'regular';
    print(`${(b.id || '').slice(0, 37).padEnd(38)} ${(b.date || '-').padEnd(12)} ${(b.captainName || b.userId || '-').slice(0, 11).padEnd(12)} ${String(b.itemCount || 0).padEnd(6)} ${onboarding}`);
  }
  print('');
}

/**
 * swain briefing get
 * Get briefing details
 */
async function getBriefing(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const briefingId = params['id'] || args[0];
  const jsonOutput = params['json'] === 'true';

  if (!briefingId || briefingId.startsWith('--')) {
    printError('Usage: swain briefing get <briefingId>');
    process.exit(1);
  }

  const result = await workerRequest(`/briefings/dashboard/${briefingId}`);
  const briefing = result.success ? result.data : null;

  if (!briefing) {
    printError('Briefing not found');
    process.exit(1);
  }

  const user = result.user;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, briefing, user }, null, 2));
    return;
  }

  print(`\n${colors.bold}BRIEFING: ${briefing.id}${colors.reset}\n`);
  print(`  User:       ${user?.captainName || briefing.userId} (${briefing.userId})`);
  print(`  Date:       ${briefing.date}`);
  print(`  Type:       ${briefing.agentType || '-'}`);
  print(`  Onboarding: ${briefing.isOnboarding ? 'Yes' : 'No'}`);
  print(`  Viewed:     ${briefing.viewedAt || 'Not yet'}`);
  print(`  Created:    ${briefing.createdAt || '-'}`);

  if (briefing.items && briefing.items.length > 0) {
    print(`\n${colors.bold}ITEMS (${briefing.items.length}):${colors.reset}`);
    for (let i = 0; i < briefing.items.length; i++) {
      const item = briefing.items[i];
      const typeColor = item.type === 'text' ? colors.dim :
                        item.type === 'image_card' ? colors.cyan : colors.yellow;
      print(`  ${i + 1}. ${typeColor}[${item.type}]${colors.reset}`);
      if (item.type === 'text') {
        print(`     ${item.content?.slice(0, 60) || ''}${(item.content?.length || 0) > 60 ? '...' : ''}`);
      } else if (item.type === 'image_card') {
        print(`     ${item.title || 'Untitled'}`);
        if (item.subtext) {
          print(`     ${colors.dim}${item.subtext.slice(0, 50)}${item.subtext.length > 50 ? '...' : ''}${colors.reset}`);
        }
      }
    }
  }
  print('');
}

/**
 * swain briefing create --user=<userId> [--date=YYYY-MM-DD]
 * Trigger briefing creation for a user
 */
async function createBriefing(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'];
  const date = params['date'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain briefing create --user=<userId> [--date=YYYY-MM-DD]');
    process.exit(1);
  }

  print(`Creating briefing for ${userId}${date ? ` on ${date}` : ''}...`);

  const body: Record<string, string> = {};
  if (date) body.date = date;

  const result = await workerRequest(`/users/${userId}/briefing`, {
    method: 'POST',
    body,
  });

  if (!result.success) {
    printError(result.error || 'Failed to create briefing');
    process.exit(1);
  }

  const b = result.briefing;

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.created) {
    printSuccess(`Briefing created: ${b.id}`);
  } else {
    print(`${colors.yellow}Briefing already exists for this date${colors.reset}`);
  }
  print(`  ID:     ${b.id}`);
  print(`  User:   ${b.userId}`);
  print(`  Date:   ${b.date}`);
  print(`  Items:  ${b.itemCount}`);
  print('');
}

/**
 * swain briefing previous --user=<userId>
 * Get summary of user's last briefing (card IDs + titles)
 */
async function previousBriefing(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'];
  const date = params['date'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain briefing previous --user=<userId> [--date=YYYY-MM-DD] [--json]');
    process.exit(1);
  }

  const qs = date ? `?date=${date}` : '';
  const result = await workerRequest(`/briefings/previous/${userId}${qs}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.briefingId) {
    print(`No previous briefing found for ${userId}`);
    return;
  }

  print(`\n${colors.bold}PREVIOUS BRIEFING${colors.reset}\n`);
  print(`  ID:     ${result.briefingId}`);
  print(`  Date:   ${result.date}`);
  print(`  Cards:  ${result.cardCount}`);

  if (result.cards && result.cards.length > 0) {
    print(`\n${colors.bold}CARDS:${colors.reset}`);
    for (const card of result.cards) {
      print(`  ${card.id}  ${card.title}  ${colors.dim}[${card.category}]${colors.reset}`);
    }
  }
  print('');
}

/**
 * swain briefing assemble --user=<userId> --items=<json>
 * Create briefing from advisor's selections (validates, hydrates, marks served)
 */
async function assembleBriefing(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'];
  const date = params['date'];
  const itemsJson = params['items'];
  const force = args.includes('--force');
  const jsonOutput = params['json'] === 'true';

  if (!userId || !itemsJson) {
    printError('Usage: swain briefing assemble --user=<userId> --items=\'<json>\' [--date=YYYY-MM-DD] [--json]');
    process.exit(1);
  }

  let items: any[];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    printError('Invalid JSON in --items parameter');
    process.exit(1);
  }

  const validation = validateItems(items);
  if (!validation.success) {
    printError('Briefing items failed schema validation:');
    for (const err of validation.errors) {
      print(`  ${colors.red}[${err.index}] ${err.error}${colors.reset}`);
    }
    process.exit(1);
  }

  const body: Record<string, any> = { userId, items };
  if (date) body.date = date;
  if (force) body.force = true;

  const result = await workerRequest('/briefings/assemble', {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to assemble briefing');
    if (result.invalidCards) {
      for (const ic of result.invalidCards) {
        print(`  ${colors.red}${ic.id}: ${ic.reason}${colors.reset}`);
      }
    }
    process.exit(1);
  }

  if (result.created) {
    printSuccess(`Briefing assembled: ${result.briefingId}`);
  } else {
    print(`${colors.yellow}Briefing already exists for this date${colors.reset}`);
  }
  print(`  ID:           ${result.briefingId}`);
  print(`  Items:        ${result.itemCount || '-'}`);
  print(`  Cards served: ${result.cardsServed || 0}`);
  print('');
}

/**
 * swain briefing history --user=<id> [--days=7] [--json]
 * Briefing history for a user over N days
 */
async function briefingHistory(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'];
  const days = params['days'] || '7';
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain briefing history --user=<userId> [--days=7] [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/briefings/history/${userId}?days=${days}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to fetch history');
    process.exit(1);
  }

  print(`\n${colors.bold}BRIEFING HISTORY${colors.reset} (last ${result.days} days for ${userId})\n`);

  if (result.briefings.length === 0) {
    print('  No briefings found in this period.');
    print('');
    return;
  }

  for (const b of result.briefings) {
    print(`  ${colors.bold}${b.date}${colors.reset}  ${b.briefingId}  ${colors.dim}(${b.cards.length} cards)${colors.reset}`);
    for (const card of b.cards) {
      print(`    ${card.id}  ${card.title}  ${colors.dim}[${card.category}]${colors.reset}`);
    }
  }

  if (result.categoryCounts && Object.keys(result.categoryCounts).length > 0) {
    print(`\n${colors.bold}CATEGORY COUNTS:${colors.reset}`);
    for (const [cat, count] of Object.entries(result.categoryCounts)) {
      print(`  ${cat}: ${count}`);
    }
  }

  print(`\n  Total unique cards: ${result.allCardIds?.length || 0}`);
  print('');
}

/**
 * swain briefing validate --user=<id> --items=<json> [--json]
 * Dry-run validation of briefing items
 */
async function validateBriefing(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'];
  const itemsJson = params['items'];
  const date = params['date'];
  const jsonOutput = params['json'] === 'true';

  if (!userId || !itemsJson) {
    printError('Usage: swain briefing validate --user=<userId> --items=\'<json>\' [--date=YYYY-MM-DD] [--json]');
    process.exit(1);
  }

  let items: any[];
  try {
    items = JSON.parse(itemsJson);
  } catch {
    printError('Invalid JSON in --items parameter');
    process.exit(1);
  }

  const validation = validateItems(items);
  if (!validation.success) {
    printError('Briefing items failed schema validation:');
    for (const err of validation.errors) {
      print(`  ${colors.red}[${err.index}] ${err.error}${colors.reset}`);
    }
    process.exit(1);
  }

  const body: Record<string, any> = { userId, items };
  if (date) body.date = date;

  const result = await workerRequest('/briefings/validate', {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Validation failed');
    process.exit(1);
  }

  const validLabel = result.valid
    ? `${colors.green}VALID${colors.reset}`
    : `${colors.red}INVALID${colors.reset}`;

  print(`\n${colors.bold}BRIEFING VALIDATION: ${validLabel}${colors.reset}\n`);
  print(`  Items:   ${result.itemCount}`);
  print(`  Cards:   ${result.cardCount}`);
  print(`  Weather: ${result.weatherIncluded ? 'Yes' : `${colors.yellow}No${colors.reset}`}`);
  print(`  Exists:  ${result.briefingExistsForDate ? `${colors.yellow}Yes (for this date)${colors.reset}` : 'No'}`);

  if (result.cards && result.cards.length > 0) {
    print(`\n${colors.bold}CARDS:${colors.reset}`);
    for (const card of result.cards) {
      const statusColor = card.status === 'ok' ? colors.green :
                          card.status === 'not_found' ? colors.red : colors.yellow;
      print(`  ${statusColor}[${card.status}]${colors.reset} ${card.id}${card.title ? ` — ${card.title}` : ''}`);
    }
  }

  if (result.overlapWithPrevious && result.overlapWithPrevious.length > 0) {
    print(`\n${colors.bold}OVERLAP WITH PREVIOUS:${colors.reset}`);
    for (const id of result.overlapWithPrevious) {
      print(`  ${colors.yellow}${id}${colors.reset}`);
    }
  }

  if (result.warnings && result.warnings.length > 0) {
    print(`\n${colors.bold}WARNINGS:${colors.reset}`);
    for (const w of result.warnings) {
      print(`  ${colors.yellow}${w}${colors.reset}`);
    }
  }

  if (result.errors && result.errors.length > 0) {
    print(`\n${colors.bold}ERRORS:${colors.reset}`);
    for (const e of result.errors) {
      print(`  ${colors.red}${e}${colors.reset}`);
    }
  }
  print('');
}

/**
 * swain briefing delete <briefingId> --confirm [--json]
 * Delete a briefing and un-serve its cards
 */
async function deleteBriefing(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const briefingId = params['id'] || args.find(a => !a.startsWith('--'));
  const confirm = args.includes('--confirm');
  const jsonOutput = params['json'] === 'true';

  if (!briefingId || briefingId.startsWith('--')) {
    printError('Usage: swain briefing delete <briefingId> --confirm [--json]');
    process.exit(1);
  }

  if (!confirm) {
    printError('This will permanently delete the briefing and un-serve its cards.');
    print('Add --confirm to proceed.');
    process.exit(1);
  }

  const result = await workerRequest(`/briefings/${briefingId}`, {
    method: 'DELETE',
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to delete briefing');
    process.exit(1);
  }

  printSuccess(`Briefing deleted: ${result.briefingId}`);
  print(`  Cards un-served: ${result.cardsUnserved}`);
  print('');
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain briefing${colors.reset} - User briefings

${colors.bold}COMMANDS${colors.reset}
  list                    List briefings
  get <id>                Get briefing details
  create                  Generate a briefing for a user
  previous                Get summary of user's last briefing
  history                 View briefing history over N days
  assemble                Create briefing from advisor's card selections
  validate                Dry-run validation of briefing items
  delete <id> --confirm   Delete a briefing and un-serve cards

${colors.bold}OPTIONS${colors.reset}
  --user=<id>             User ID (required for create/previous/assemble/history/validate)
  --id=<id>               Briefing ID (for get)
  --date=<YYYY-MM-DD>     Date (for create/assemble/previous/validate, default: today)
  --days=<n>              Number of days for history (default: 7)
  --items=<json>          JSON array of items (for assemble/validate)
  --force                 (deprecated, ignored) Briefings are append-only
  --confirm               Required for delete (safety net)
  --limit=<n>             Limit results (for list, default: 20)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain briefing list
  swain briefing list --user=user_abc123
  swain briefing get briefing_xyz789
  swain briefing create --user=user_abc123
  swain briefing previous --user=user_abc123
  swain briefing previous --user=user_abc123 --date=2026-02-05
  swain briefing history --user=user_abc123 --days=14
  swain briefing validate --user=user_abc123 --items='[{"type":"card","id":"card_abc"}]'
  swain briefing delete briefing_xyz789 --confirm
  swain briefing assemble --user=user_abc123 --items='[{"type":"text","content":"Morning!"},{"type":"card","id":"card_abc"}]'
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
        await listBriefings(commandArgs);
        break;
      case 'get':
        await getBriefing(commandArgs);
        break;
      case 'create':
        await createBriefing(commandArgs);
        break;
      case 'previous':
        await previousBriefing(commandArgs);
        break;
      case 'assemble':
        await assembleBriefing(commandArgs);
        break;
      case 'history':
        await briefingHistory(commandArgs);
        break;
      case 'validate':
        await validateBriefing(commandArgs);
        break;
      case 'delete':
        await deleteBriefing(commandArgs);
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
