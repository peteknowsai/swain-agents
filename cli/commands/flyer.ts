#!/usr/bin/env bun

/**
 * Flyer Commands
 * swain flyer batch|list|run-start|run-update
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

const VALID_CATEGORIES = [
  'events', 'gear', 'dining', 'services', 'deals', 'marina', 'fishing', 'lifestyle'
] as const;

const IMAGE_DELIVERY_PREFIX = 'https://imagedelivery.net/';

function isJsonMode(params: Record<string, string>): boolean {
  return params['json'] === 'true' || !process.stdout.isTTY;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

interface FlyerItem {
  imageUrl: string;
  meta: {
    title: string;
    category: string;
    description?: string;
    businessName?: string;
    url?: string;
    address?: string;
    priceRange?: string;
    validUntil?: string;
  };
}

/**
 * Validate a flyers array locally. Returns null if valid, or an array of error strings.
 */
function validateFlyers(flyers: any[]): string[] | null {
  const errors: string[] = [];

  if (!Array.isArray(flyers)) {
    return ['--flyers must be a JSON array'];
  }

  if (flyers.length === 0) {
    return ['--flyers array is empty'];
  }

  if (flyers.length > 50) {
    errors.push(`batch contains ${flyers.length} flyers, max is 50`);
  }

  for (let i = 0; i < flyers.length; i++) {
    const f = flyers[i];
    const prefix = `flyer[${i}]`;

    if (!f || typeof f !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    if (!f.imageUrl || typeof f.imageUrl !== 'string') {
      errors.push(`${prefix}: imageUrl is required and must be a string`);
    } else if (!f.imageUrl.startsWith(IMAGE_DELIVERY_PREFIX)) {
      errors.push(`${prefix}: imageUrl must be a Cloudflare Images delivery URL (https://imagedelivery.net/...)`);
    }

    if (!f.meta || typeof f.meta !== 'object') {
      errors.push(`${prefix}: meta object is required`);
      continue;
    }

    if (!f.meta.title || typeof f.meta.title !== 'string' || f.meta.title.trim() === '') {
      errors.push(`${prefix}: meta.title is required and must be a non-empty string`);
    }

    if (!f.meta.category || typeof f.meta.category !== 'string') {
      errors.push(`${prefix}: meta.category is required`);
    } else if (!VALID_CATEGORIES.includes(f.meta.category as any)) {
      errors.push(`${prefix}: meta.category "${f.meta.category}" is not valid. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * swain flyer batch --user=<userId>|--desk=<deskName> --date=<YYYY-MM-DD> --flyers='<json>' [--dry-run] --json
 */
async function batchFlyers(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const userId = params['user'] || params['user-id'];
  const desk = params['desk'];
  const date = params['date'] || todayISO();
  const flyersJson = params['flyers'];
  const dryRun = args.includes('--dry-run');

  if ((!userId && !desk) || !flyersJson) {
    printError("Usage: swain flyer batch --user=<userId>|--desk=<deskName> --date=<YYYY-MM-DD> --flyers='<json>' [--dry-run] [--json]");
    process.exit(1);
  }

  if (userId && desk) {
    printError('Specify --user or --desk, not both');
    process.exit(1);
  }

  let flyers: any[];
  try {
    flyers = JSON.parse(flyersJson);
  } catch {
    printError('Invalid JSON in --flyers parameter');
    process.exit(1);
  }

  const validationErrors = validateFlyers(flyers);
  if (validationErrors) {
    for (const err of validationErrors) {
      console.error(`${colors.red}${err}${colors.reset}`);
    }
    process.exit(1);
  }

  if (dryRun) {
    const result = { success: true, valid: true, count: flyers.length };
    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSuccess(`Validation passed: ${flyers.length} flyers`);
    }
    return;
  }

  const body: Record<string, any> = { batchDate: date, flyers };
  if (desk) body.deskName = desk;
  else body.userId = userId;

  const result = await workerRequest('/flyers/batch', {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to create flyer batch');
    process.exit(1);
  }

  printSuccess(`Batch created: ${result.count || result.flyerIds?.length || 0} flyers`);
  if (result.flyerIds) {
    for (const id of result.flyerIds) {
      print(`  ${id}`);
    }
  }
  print('');
}

/**
 * swain flyer list [--user=<userId>] [--desk=<deskName>] [--status=<status>] [--date=<YYYY-MM-DD>] [--limit=<n>] --json
 */
async function listFlyers(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const userId = params['user'] || params['user-id'];
  const desk = params['desk'];
  const status = params['status'];
  const date = params['date'];
  const limit = params['limit'];

  const queryParts: string[] = [];
  if (userId) queryParts.push(`userId=${userId}`);
  if (desk) queryParts.push(`deskName=${desk}`);
  if (status) queryParts.push(`status=${status}`);
  if (date) queryParts.push(`batchDate=${date}`);
  if (limit) queryParts.push(`limit=${limit}`);
  const qs = queryParts.length > 0 ? `?${queryParts.join('&')}` : '';

  const result = await workerRequest(`/flyers${qs}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const flyers = result.flyers || result.data || [];

  if (flyers.length === 0) {
    print('No flyers found');
    return;
  }

  print(`\n${colors.bold}FLYERS (${flyers.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(38)} ${'TITLE'.padEnd(24)} ${'CATEGORY'.padEnd(12)} ${'STATUS'.padEnd(10)} ${'DATE'}`);
  print(`${'-'.repeat(38)} ${'-'.repeat(24)} ${'-'.repeat(12)} ${'-'.repeat(10)} ${'-'.repeat(12)}`);

  for (const f of flyers) {
    const title = (f.meta?.title || f.title || '-').slice(0, 23).padEnd(24);
    const category = (f.meta?.category || f.category || '-').padEnd(12);
    const st = (f.status || '-').padEnd(10);
    const d = f.batchDate || f.date || '-';
    print(`${(f.id || f._id || '').slice(0, 37).padEnd(38)} ${title} ${category} ${st} ${d}`);
  }
  print('');
}

/**
 * swain flyer run-start --user=<userId>|--desk=<deskName> --date=<YYYY-MM-DD> --agent=<agentId> [--meta='<json>'] --json
 */
async function runStart(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const userId = params['user'] || params['user-id'];
  const desk = params['desk'];
  const date = params['date'] || todayISO();
  const agentId = params['agent'] || params['agent-id'];
  const metaJson = params['meta'];

  if ((!userId && !desk) || !agentId) {
    printError('Usage: swain flyer run-start --user=<userId>|--desk=<deskName> --date=<YYYY-MM-DD> --agent=<agentId> [--meta=\'<json>\'] [--json]');
    process.exit(1);
  }

  if (userId && desk) {
    printError('Specify --user or --desk, not both');
    process.exit(1);
  }

  const body: Record<string, any> = { date, agentId };
  if (desk) body.deskName = desk;
  else body.userId = userId;

  if (metaJson) {
    try {
      body.meta = JSON.parse(metaJson);
    } catch {
      printError('Invalid JSON in --meta parameter');
      process.exit(1);
    }
  }

  const result = await workerRequest('/flyers/runs', {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to start flyer run');
    process.exit(1);
  }

  printSuccess(`Flyer run started: ${result.runId}`);
  print('');
}

/**
 * swain flyer run-update <runId> --status=<completed|failed> [--flyer-count=<n>] [--error="<msg>"] --json
 */
async function runUpdate(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const runId = args.find(a => !a.startsWith('--'));
  const status = params['status'];
  const flyerCount = params['flyer-count'];
  const errorMsg = params['error'];

  if (!runId || !status) {
    printError('Usage: swain flyer run-update <runId> --status=<completed|failed> [--flyer-count=<n>] [--error="<msg>"] [--json]');
    process.exit(1);
  }

  if (status !== 'completed' && status !== 'failed') {
    printError(`--status must be "completed" or "failed", got "${status}"`);
    process.exit(1);
  }

  const body: Record<string, any> = { status };
  if (flyerCount) body.flyerCount = parseInt(flyerCount, 10);
  if (errorMsg) body.error = errorMsg;

  const result = await workerRequest(`/flyers/runs/${runId}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to update flyer run');
    process.exit(1);
  }

  printSuccess(`Flyer run updated: ${status}`);
  print('');
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain flyer${colors.reset} - Flyer management

${colors.bold}COMMANDS${colors.reset}
  batch                   Submit a batch of flyers
  list                    List flyers with optional filters
  run-start               Log start of a flyer generation run
  run-update <runId>      Update run status (completed/failed)

${colors.bold}OPTIONS${colors.reset}
  --user=<id>             User ID (use --user or --desk, not both)
  --desk=<name>           Desk name (use --desk or --user, not both)
  --date=<YYYY-MM-DD>     Date (default: today)
  --flyers=<json>         JSON array of flyer objects (for batch)
  --dry-run               Validate flyers locally without submitting (for batch)
  --agent=<id>            Agent ID (for run-start)
  --meta=<json>           Freeform metadata JSON (for run-start)
  --status=<s>            Filter by status (list) or set status (run-update)
  --flyer-count=<n>       Number of flyers created (for run-update completed)
  --error="<msg>"         Error message (for run-update failed)
  --limit=<n>             Limit results (for list)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain flyer batch --desk=nyc-harbor --flyers='[{"imageUrl":"https://imagedelivery.net/xxx/yyy/public","meta":{"title":"Marina Deal","category":"marina"}}]' --dry-run --json
  swain flyer batch --desk=nyc-harbor --date=2026-03-12 --flyers='[...]' --json
  swain flyer batch --user=user_abc --date=2026-03-12 --flyers='[...]' --json
  swain flyer list --desk=nyc-harbor --date=2026-03-12 --json
  swain flyer list --user=user_abc --status=liked --json
  swain flyer list --status=active --limit=20 --json
  swain flyer run-start --desk=nyc-harbor --agent=nyc-harbor-desk --json
  swain flyer run-start --user=user_abc --agent=pool-05 --json
  swain flyer run-update run_abc123 --status=completed --flyer-count=12 --json
  swain flyer run-update run_abc123 --status=failed --error="API rate limited" --json
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
      case 'batch':
        await batchFlyers(commandArgs);
        break;
      case 'list':
        await listFlyers(commandArgs);
        break;
      case 'run-start':
        await runStart(commandArgs);
        break;
      case 'run-update':
        await runUpdate(commandArgs);
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
