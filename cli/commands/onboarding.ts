#!/usr/bin/env bun

/**
 * Onboarding Commands
 * swain onboarding list|seed
 *
 * Manage onboarding templates — seed from JSON files, list what's in Convex.
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { readFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

/**
 * Parse CLI arguments
 */
function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const [key, ...valueParts] = arg.slice(2).split('=');
      if (valueParts.length > 0) {
        parsed[key] = valueParts.join('=');
      } else if (i + 1 < args.length && !args[i + 1].startsWith('--')) {
        parsed[key] = args[++i];
      } else {
        parsed[key] = 'true';
      }
    }
  }
  return parsed;
}

/**
 * swain onboarding list [--json]
 * List all onboarding templates in Convex
 */
async function listTemplates(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/onboarding/templates');
  const templates = result.templates || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, templates, count: templates.length }, null, 2));
    return;
  }

  if (templates.length === 0) {
    print('No onboarding templates found.');
    return;
  }

  print(`\n${colors.bold}ONBOARDING TEMPLATES (${templates.length})${colors.reset}\n`);

  for (const t of templates) {
    const updated = new Date(t.updatedAt).toISOString().replace('T', ' ').slice(0, 19);
    print(`  ${colors.bold}${t.region}${colors.reset} — ${t.itemCount} items (updated ${updated})`);
  }
  print('');
}

/**
 * swain onboarding seed --file=<path> [--region=<name>]
 * swain onboarding seed --all --dir=<path>
 * Seed onboarding template(s) from JSON files into Convex
 */
async function seedTemplates(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  if (params['all'] === 'true') {
    // Seed all files in a directory
    const dir = params['dir'] || '.';
    const files = readdirSync(dir).filter(f => f.endsWith('.json'));

    if (files.length === 0) {
      printError(`No .json files found in ${dir}`);
      process.exit(1);
    }

    const results: any[] = [];
    for (const file of files) {
      const filePath = join(dir, file);
      const data = JSON.parse(readFileSync(filePath, 'utf-8'));
      const region = data.desk || data.region || basename(file, '.json');

      try {
        const result = await workerRequest('/onboarding/seed', {
          method: 'POST',
          body: { region, items: data.items },
        });

        if (jsonOutput) {
          results.push({ region, ...result });
        } else {
          printSuccess(`${region}: ${result.message}`);
        }
      } catch (err: any) {
        if (jsonOutput) {
          results.push({ region, error: err.message });
        } else {
          printError(`${region}: ${err.message}`);
        }
      }
    }

    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, results }, null, 2));
    }
    return;
  }

  // Single file
  const file = params['file'];
  if (!file) {
    printError('Usage: swain onboarding seed --file=<path> [--region=<name>]');
    printError('       swain onboarding seed --all --dir=<path>');
    process.exit(1);
  }

  const data = JSON.parse(readFileSync(file, 'utf-8'));
  const region = params['region'] || data.desk || data.region || basename(file, '.json');

  try {
    const result = await workerRequest('/onboarding/seed', {
      method: 'POST',
      body: { region, items: data.items },
    });

    if (jsonOutput) {
      console.log(JSON.stringify({ success: true, region, ...result }, null, 2));
    } else {
      printSuccess(`${region}: ${result.message}`);
    }
  } catch (err: any) {
    printError(`${region}: ${err.message}`);
    process.exit(1);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain onboarding${colors.reset} - Manage onboarding templates

${colors.bold}USAGE${colors.reset}
  swain onboarding list                         List templates in Convex
  swain onboarding seed --file=<path>           Seed one template
  swain onboarding seed --all --dir=<path>      Seed all templates in a directory

${colors.bold}OPTIONS${colors.reset}
  --file=<path>       Path to template JSON file
  --dir=<path>        Directory containing template JSON files
  --region=<name>     Override region name (default: from file's "desk" or filename)
  --all               Seed all .json files in --dir
  --json              Output as JSON

${colors.bold}TEMPLATE FORMAT${colors.reset}
  JSON files should have: { "desk": "region-name", "items": [...] }
  The "desk" field sets the region. If missing, filename is used.

${colors.bold}EXAMPLES${colors.reset}
  swain onboarding list
  swain onboarding seed --file=onboarding/tampa-bay.json
  swain onboarding seed --file=onboarding/tampa-bay-v2.json --region=tampa-bay
  swain onboarding seed --all --dir=onboarding/
`);
}

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'list':
      await listTemplates(subArgs);
      break;
    case 'seed':
      await seedTemplates(subArgs);
      break;
    case '--help':
    case '-h':
    case 'help':
    case undefined:
      showHelp();
      break;
    default:
      printError(`Unknown subcommand: ${subcommand}`);
      showHelp();
      process.exit(1);
  }
}
