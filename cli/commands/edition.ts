#!/usr/bin/env bun

/**
 * Edition Commands
 * swain edition list|get|create
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
 * swain edition list
 * List editions
 */
async function listEditions(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const limit = params['limit'] || '20';

  const result = await workerRequest(`/editions?limit=${limit}`);
  const editions = result.editions || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, editions, count: editions.length }, null, 2));
    return;
  }

  if (editions.length === 0) {
    print('No editions found');
    return;
  }

  print(`\n${colors.bold}EDITIONS (${editions.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(25)} ${'DATE'.padEnd(12)} ${'CARDS'.padEnd(8)} ${'CURATOR'}`);
  print(`${'-'.repeat(25)} ${'-'.repeat(12)} ${'-'.repeat(8)} ${'-'.repeat(25)}`);

  for (const edition of editions) {
    const cardCount = edition.cardIds?.length || 0;
    print(`${(edition.id || '').slice(0, 24).padEnd(25)} ${(edition.editionDate || '-').padEnd(12)} ${String(cardCount).padEnd(8)} ${edition.curatorAgentId || '-'}`);
  }
  print('');
}

/**
 * swain edition get
 * Get edition details with cards
 */
async function getEdition(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const editionId = params['id'] || args[0];
  const jsonOutput = params['json'] === 'true';
  const latest = params['latest'] === 'true';

  // If --latest flag, use latest endpoint
  const endpoint = latest ? '/editions/latest' : `/editions/${editionId}`;

  if (!latest && (!editionId || editionId.startsWith('--'))) {
    printError('Usage: swain edition get <editionId> or --latest');
    process.exit(1);
  }

  const result = await workerRequest(endpoint);
  const edition = result.edition;

  if (!edition) {
    printError('Edition not found');
    process.exit(1);
  }

  // Cards are now inside edition object
  const selectedCards = edition.selectedCards || [];
  const rejectedCards = edition.rejectedCards || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, edition }, null, 2));
    return;
  }

  print(`\n${colors.bold}EDITION: ${edition.id}${colors.reset}\n`);
  print(`  Date:      ${edition.editionDate}`);
  print(`  Curator:   ${edition.curatorAgentId}`);
  print(`  Selected:  ${selectedCards.length}`);
  print(`  Rejected:  ${rejectedCards.length}`);
  print(`  Created:   ${edition.createdAt || '-'}`);

  if (selectedCards.length > 0) {
    print(`\n${colors.bold}SELECTED CARDS:${colors.reset}`);
    for (const card of selectedCards) {
      const pos = card.position ? `[${card.position}]` : '';
      print(`  ${colors.green}✓${colors.reset} ${pos} ${colors.cyan}${card.id}${colors.reset} - ${card.title}`);
      if (card.editorialComment) {
        print(`    ${colors.dim}${card.editorialComment.slice(0, 70)}${card.editorialComment.length > 70 ? '...' : ''}${colors.reset}`);
      }
    }
  }

  if (rejectedCards.length > 0) {
    print(`\n${colors.bold}REJECTED CARDS:${colors.reset}`);
    for (const card of rejectedCards) {
      print(`  ${colors.red}✗${colors.reset} ${colors.cyan}${card.id}${colors.reset} - ${card.title}`);
      if (card.editorialComment) {
        print(`    ${colors.dim}${card.editorialComment.slice(0, 70)}${card.editorialComment.length > 70 ? '...' : ''}${colors.reset}`);
      }
    }
  }
  print('');
}

/**
 * swain edition create
 * Create a new edition
 */
async function createEdition(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const date = params['date'];
  const cardIdsStr = params['card-ids'] || params['cards'];
  const curator = params['curator'];
  const selectionsStr = params['selections'];

  if (!date || !cardIdsStr || !curator) {
    printError('Usage: swain edition create --date=YYYY-MM-DD --card-ids="card_a,card_b" --curator=<agentId>');
    printError('       Optional: --selections=\'[{"cardId":"card_a","selected":true,"position":1,"editorialComment":"..."}]\'');
    process.exit(1);
  }

  // Parse card IDs (comma-separated)
  const cardIds = cardIdsStr.split(',').map((id: string) => id.trim()).filter(Boolean);

  if (cardIds.length === 0) {
    printError('At least one card ID is required');
    process.exit(1);
  }

  // Parse selections if provided
  let selections = null;
  if (selectionsStr) {
    try {
      selections = JSON.parse(selectionsStr);
    } catch (e) {
      printError('Invalid JSON for --selections');
      process.exit(1);
    }
  }

  try {
    const result = await workerRequest('/editions', {
      method: 'POST',
      body: {
        editionDate: date,
        cardIds,
        curatorAgentId: curator,
        selections,
      },
    });

    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, editionId: result.editionId }, null, 2));
    } else {
      printSuccess(`Edition created: ${result.editionId}`);
      print(`  Date:      ${date}`);
      print(`  Cards:     ${cardIds.length}`);
      print(`  Curator:   ${curator}`);
    }
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: err.message }, null, 2));
    } else {
      printError(`Failed to create edition: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain edition${colors.reset} - Daily editions

${colors.bold}COMMANDS${colors.reset}
  list                    List editions
  get <id>                Get edition details with cards
  create                  Create a new edition

${colors.bold}OPTIONS${colors.reset}
  --id=<id>               Edition ID (for get)
  --latest                Get latest edition (for get)
  --limit=<n>             Limit results (for list, default: 20)
  --date=<YYYY-MM-DD>     Edition date (for create)
  --card-ids=<ids>        Comma-separated card IDs (for create)
  --curator=<agentId>     Curator agent ID (for create)
  --selections=<json>     Selection data as JSON (for create, optional)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain edition list
  swain edition list --limit=10
  swain edition get edition_abc123
  swain edition get --latest
  swain edition create --date="2025-02-02" --card-ids="card_a,card_b" --curator="editor-tierra-verde"
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
        await listEditions(commandArgs);
        break;
      case 'get':
        await getEdition(commandArgs);
        break;
      case 'create':
        await createEdition(commandArgs);
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
