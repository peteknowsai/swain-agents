#!/usr/bin/env bun

/**
 * Knowledge Commands
 * swain knowledge ask|store|list|stats|init
 *
 * Agent interface to the local Stoolap vector database.
 * Each agent workspace has its own knowledge.db with boat scan
 * extractions and observations, embedded via Gemini text-embedding-004.
 */

import {
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';
import { embedText } from '../lib/gemini-embed';
import {
  resolveDbPath,
  dbExists,
  stoolapInstalled,
  stoolapQuery,
  stoolapExec,
  ensureSchema,
  escapeSQL,
  vectorToSQL,
} from '../lib/stoolap';

function isJsonMode(params: Record<string, string>): boolean {
  return params['json'] === 'true' || !process.stdout.isTTY;
}

function ensureStoolap(): void {
  if (!stoolapInstalled()) {
    printError('stoolap binary not found at /usr/local/bin/stoolap');
    printError('Install with: cargo install stoolap --features "cli,semantic"');
    process.exit(1);
  }
}

function ensureDb(dbPath: string, command: string): void {
  if (!dbExists(dbPath)) {
    printError(`No knowledge database found at ${dbPath}`);
    printError(`Run "swain knowledge init" first, or use "swain knowledge store" which auto-initializes.`);
    process.exit(1);
  }
}

/**
 * swain knowledge ask "question" [--boat=<boatId>] [--limit=5] [--threshold=0.3] [--db=<path>] [--json]
 */
async function askKnowledge(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const question = args.find(a => !a.startsWith('--'));
  const boatId = params['boat'] || params['boat-id'];
  const limit = parseInt(params['limit'] || '5', 10);
  const threshold = parseFloat(params['threshold'] || '0.3');
  const dbPath = resolveDbPath(params['db']);

  if (!question) {
    printError('Usage: swain knowledge ask "question" [--boat=<boatId>] [--limit=5] [--json]');
    process.exit(1);
  }

  ensureStoolap();
  ensureDb(dbPath, 'ask');

  // Embed the question
  const queryVec = await embedText(question, 'RETRIEVAL_QUERY');

  // Build query
  const whereClause = boatId ? `WHERE boat_id = '${escapeSQL(boatId)}'` : '';
  const sql = `
    SELECT id, boat_id, dimension, prompt_id, wave, category, content,
           VEC_DISTANCE_COSINE(embedding, ${vectorToSQL(queryVec)}) AS distance
    FROM knowledge
    ${whereClause}
    ORDER BY distance
    LIMIT ${limit};
  `;

  const rows = await stoolapQuery(dbPath, sql);

  // Convert distance to score and filter by threshold
  const results = rows
    .map(r => ({
      id: parseInt(r.id, 10),
      boatId: r.boat_id,
      dimension: r.dimension || null,
      promptId: r.prompt_id || null,
      wave: r.wave ? parseInt(r.wave, 10) : null,
      category: r.category,
      content: r.content,
      score: parseFloat((1 - parseFloat(r.distance || '1')).toFixed(4)),
    }))
    .filter(r => r.score >= threshold);

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, query: question, results, count: results.length }, null, 2));
    return;
  }

  if (results.length === 0) {
    print(`No relevant knowledge found for: "${question}"`);
    return;
  }

  print(`\n${colors.bold}KNOWLEDGE RESULTS${colors.reset} for "${question}"\n`);
  for (const r of results) {
    const scoreColor = r.score > 0.7 ? colors.green : r.score > 0.5 ? colors.yellow : colors.dim;
    const dimLabel = r.dimension ? ` ${colors.dim}[${r.dimension}]${colors.reset}` : '';
    print(`  ${scoreColor}${(r.score * 100).toFixed(0)}%${colors.reset}${dimLabel} ${r.content.slice(0, 100)}${r.content.length > 100 ? '...' : ''}`);
  }
  print('');
}

/**
 * swain knowledge store --boat=<boatId> --content="text" [--dimension=<dim>] [--category=<cat>] [--session=<id>] [--prompt=<id>] [--wave=N] [--db=<path>] [--json]
 */
async function storeKnowledge(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const boatId = params['boat'] || params['boat-id'];
  const content = params['content'];
  const dimension = params['dimension'];
  const category = params['category'] || 'scan_extraction';
  const sessionId = params['session'] || params['session-id'];
  const promptId = params['prompt'] || params['prompt-id'];
  const wave = params['wave'];
  const dbPath = resolveDbPath(params['db']);

  if (!boatId || !content) {
    printError('Usage: swain knowledge store --boat=<boatId> --content="text" [--dimension=<dim>] [--category=<cat>] [--json]');
    process.exit(1);
  }

  ensureStoolap();

  // Auto-init DB if it doesn't exist
  if (!dbExists(dbPath)) {
    await ensureSchema(dbPath);
  }

  // Embed the content
  const embedding = await embedText(content, 'RETRIEVAL_DOCUMENT');

  // Build INSERT
  const columns = ['boat_id', 'content', 'category', 'embedding'];
  const values = [
    `'${escapeSQL(boatId)}'`,
    `'${escapeSQL(content)}'`,
    `'${escapeSQL(category)}'`,
    vectorToSQL(embedding),
  ];

  if (sessionId) {
    columns.push('session_id');
    values.push(`'${escapeSQL(sessionId)}'`);
  }
  if (dimension) {
    columns.push('dimension');
    values.push(`'${escapeSQL(dimension)}'`);
  }
  if (promptId) {
    columns.push('prompt_id');
    values.push(`'${escapeSQL(promptId)}'`);
  }
  if (wave) {
    columns.push('wave');
    values.push(wave);
  }

  const sql = `INSERT INTO knowledge (${columns.join(', ')}) VALUES (${values.join(', ')});`;
  await stoolapExec(dbPath, sql);

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, boatId, category, dimension: dimension || null }, null, 2));
    return;
  }

  printSuccess('Knowledge stored');
  print(`  Boat: ${boatId}`);
  print(`  Category: ${category}`);
  if (dimension) print(`  Dimension: ${dimension}`);
  print(`  Content: ${content.slice(0, 80)}${content.length > 80 ? '...' : ''}`);
  print('');
}

/**
 * swain knowledge list [--boat=<boatId>] [--dimension=<dim>] [--category=<cat>] [--limit=20] [--db=<path>] [--json]
 */
async function listKnowledge(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const boatId = params['boat'] || params['boat-id'];
  const dimension = params['dimension'];
  const category = params['category'];
  const limit = parseInt(params['limit'] || '20', 10);
  const dbPath = resolveDbPath(params['db']);

  ensureStoolap();
  ensureDb(dbPath, 'list');

  const conditions: string[] = [];
  if (boatId) conditions.push(`boat_id = '${escapeSQL(boatId)}'`);
  if (dimension) conditions.push(`dimension = '${escapeSQL(dimension)}'`);
  if (category) conditions.push(`category = '${escapeSQL(category)}'`);

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const sql = `SELECT id, boat_id, dimension, prompt_id, wave, category, content, created_at FROM knowledge ${whereClause} ORDER BY created_at DESC LIMIT ${limit};`;

  const rows = await stoolapQuery(dbPath, sql);

  if (jsonOutput) {
    const entries = rows.map(r => ({
      id: parseInt(r.id, 10),
      boatId: r.boat_id,
      dimension: r.dimension || null,
      promptId: r.prompt_id || null,
      wave: r.wave ? parseInt(r.wave, 10) : null,
      category: r.category,
      content: r.content,
      createdAt: r.created_at,
    }));
    console.log(JSON.stringify({ success: true, entries, count: entries.length }, null, 2));
    return;
  }

  if (rows.length === 0) {
    print('No knowledge entries found');
    return;
  }

  print(`\n${colors.bold}KNOWLEDGE (${rows.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(6)} ${'DIMENSION'.padEnd(14)} ${'CATEGORY'.padEnd(18)} ${'CONTENT'}`);
  print(`${'-'.repeat(6)} ${'-'.repeat(14)} ${'-'.repeat(18)} ${'-'.repeat(50)}`);

  for (const r of rows) {
    const content = (r.content || '').slice(0, 50) + ((r.content || '').length > 50 ? '...' : '');
    print(`${(r.id || '').padEnd(6)} ${(r.dimension || '-').padEnd(14)} ${(r.category || '-').padEnd(18)} ${content}`);
  }
  print('');
}

/**
 * swain knowledge stats [--boat=<boatId>] [--db=<path>] [--json]
 */
async function statsKnowledge(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const boatId = params['boat'] || params['boat-id'];
  const dbPath = resolveDbPath(params['db']);

  ensureStoolap();
  ensureDb(dbPath, 'stats');

  const boatFilter = boatId ? `WHERE boat_id = '${escapeSQL(boatId)}'` : '';

  // Total count
  const totalRows = await stoolapQuery(dbPath, `SELECT COUNT(*) AS total FROM knowledge ${boatFilter};`);
  const total = parseInt(totalRows[0]?.total || '0', 10);

  // By dimension
  const dimRows = await stoolapQuery(dbPath, `SELECT dimension, COUNT(*) AS count FROM knowledge ${boatFilter} GROUP BY dimension ORDER BY count DESC;`);

  // By category
  const catRows = await stoolapQuery(dbPath, `SELECT category, COUNT(*) AS count FROM knowledge ${boatFilter} GROUP BY category ORDER BY count DESC;`);

  // By boat (if no filter)
  let boatRows: Record<string, string>[] = [];
  if (!boatId) {
    boatRows = await stoolapQuery(dbPath, `SELECT boat_id, COUNT(*) AS count FROM knowledge GROUP BY boat_id ORDER BY count DESC;`);
  }

  if (jsonOutput) {
    const stats: Record<string, any> = {
      success: true,
      total,
      byDimension: Object.fromEntries(dimRows.map(r => [r.dimension || 'null', parseInt(r.count, 10)])),
      byCategory: Object.fromEntries(catRows.map(r => [r.category, parseInt(r.count, 10)])),
    };
    if (boatId) stats.boatId = boatId;
    if (boatRows.length > 0) {
      stats.byBoat = Object.fromEntries(boatRows.map(r => [r.boat_id, parseInt(r.count, 10)]));
    }
    console.log(JSON.stringify(stats, null, 2));
    return;
  }

  print(`\n${colors.bold}KNOWLEDGE STATS${colors.reset}${boatId ? ` for ${boatId}` : ''}\n`);
  print(`  Total entries: ${total}`);

  if (dimRows.length > 0) {
    print(`\n  ${colors.bold}By Dimension:${colors.reset}`);
    for (const r of dimRows) {
      print(`    ${(r.dimension || 'unset').padEnd(20)} ${r.count}`);
    }
  }

  if (catRows.length > 0) {
    print(`\n  ${colors.bold}By Category:${colors.reset}`);
    for (const r of catRows) {
      print(`    ${(r.category || 'unset').padEnd(20)} ${r.count}`);
    }
  }

  if (boatRows.length > 0) {
    print(`\n  ${colors.bold}By Boat:${colors.reset}`);
    for (const r of boatRows) {
      print(`    ${(r.boat_id || 'unset').padEnd(30)} ${r.count}`);
    }
  }

  print('');
}

/**
 * swain knowledge init [--db=<path>] [--json]
 */
async function initKnowledge(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const dbPath = resolveDbPath(params['db']);

  ensureStoolap();

  const existed = dbExists(dbPath);
  await ensureSchema(dbPath);

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, dbPath, created: !existed }, null, 2));
    return;
  }

  if (existed) {
    printSuccess(`Knowledge DB already exists: ${dbPath}`);
  } else {
    printSuccess(`Knowledge DB initialized: ${dbPath}`);
  }
  print('');
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain knowledge${colors.reset} - Agent knowledge database (Stoolap + Gemini embeddings)

${colors.bold}COMMANDS${colors.reset}
  ask "question"          Semantic search against your knowledge base
  store                   Store new knowledge (auto-embeds via Gemini)
  list                    Browse knowledge entries
  stats                   Summary of what's in the DB
  init                    Initialize the knowledge database

${colors.bold}OPTIONS${colors.reset}
  --boat=<id>             Boat ID (required for store, optional filter for ask/list/stats)
  --content="..."         Knowledge text to store (for store)
  --dimension=<dim>       Scan dimension (boat_itself, how_it_runs, whats_aboard, life_aboard)
  --category=<cat>        Category (default: scan_extraction)
  --session=<id>          Session ID (for store)
  --prompt=<id>           Prompt ID (for store)
  --wave=N                Wave number (for store)
  --limit=N               Max results (default: 5 for ask, 20 for list)
  --threshold=N           Min relevance score 0-1 (default: 0.3, for ask)
  --db=<path>             Override DB path (default: ./knowledge.db)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain knowledge ask "what condition are the zincs?" --boat=boat_123 --json
  swain knowledge ask "any engine concerns?" --json
  swain knowledge store --boat=boat_123 --content="Zincs 60% worn, replace within 50 hours" --dimension=how_it_runs --json
  swain knowledge store --boat=boat_123 --content="Captain prefers DIY maintenance" --category=captain_preference --json
  swain knowledge list --boat=boat_123 --dimension=boat_itself --json
  swain knowledge stats --boat=boat_123 --json
  swain knowledge init --json
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
      case 'ask':
        await askKnowledge(commandArgs);
        break;
      case 'store':
        await storeKnowledge(commandArgs);
        break;
      case 'list':
        await listKnowledge(commandArgs);
        break;
      case 'stats':
        await statsKnowledge(commandArgs);
        break;
      case 'init':
        await initKnowledge(commandArgs);
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
