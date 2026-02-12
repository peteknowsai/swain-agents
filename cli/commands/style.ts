#!/usr/bin/env bun

/**
 * Style Commands
 * swain style list|get
 *
 * Browse available image styles. Agents pick a style, then craft the full
 * creative prompt infused with that style's vibe. The styleId gets stored
 * with the image for cataloging but is NOT passed to the image generator.
 */

import {
  workerRequest,
  print,
  printError,
  colors
} from '../lib/worker-client';

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
 * swain style list [--json]
 * List all available styles with their descriptions
 */
async function listStyles(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/styles');
  const styles = result.styles || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, styles, count: styles.length }, null, 2));
    return;
  }

  if (styles.length === 0) {
    print('No styles found. Create styles in the Convex dashboard.');
    return;
  }

  print(`\n${colors.bold}AVAILABLE STYLES (${styles.length})${colors.reset}\n`);

  for (const style of styles) {
    print(`${colors.bold}${style.styleId}${colors.reset} — ${style.name}`);
    if (style.description) {
      print(`  ${colors.dim}${style.description}${colors.reset}`);
    }
    print('');
  }

  print(`${colors.dim}Pick a style, then craft your image prompt infused with that vibe.${colors.reset}`);
  print(`${colors.dim}Pass --style=<id> to 'swain image generate' for cataloging.${colors.reset}\n`);
}

/**
 * swain style get <styleId> [--json]
 * Get a single style's details
 */
async function getStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = args.find(a => !a.startsWith('--'));

  if (!styleId) {
    printError('Usage: swain style get <styleId>');
    process.exit(1);
  }

  const result = await workerRequest(`/styles/${styleId}`);
  const style = result.style;

  if (!style) {
    printError(`Style not found: ${styleId}`);
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, style }, null, 2));
    return;
  }

  print(`\n${colors.bold}${style.styleId}${colors.reset} — ${style.name}\n`);
  if (style.description) {
    print(`  ${style.description}`);
  }
  if (style.exampleImageUrl) {
    print(`  Example: ${style.exampleImageUrl}`);
  }
  print('');
}

function showHelp(): void {
  print(`
${colors.bold}swain style${colors.reset} - Browse image styles

${colors.bold}USAGE${colors.reset}
  swain style list              List all available styles
  swain style get <styleId>     Get style details

${colors.bold}OPTIONS${colors.reset}
  --json                        Output as JSON

${colors.bold}HOW IT WORKS${colors.reset}
  1. Browse styles with 'swain style list'
  2. Pick a style that fits the card's vibe
  3. Craft your image prompt infused with that style
  4. Generate: swain image generate "your prompt" --style=<styleId>

  The style ID is stored with the image for cataloging.
  The style does NOT get passed to the image generator —
  you bake the style into your prompt.

${colors.bold}EXAMPLES${colors.reset}
  swain style list
  swain style list --json
  swain style get misty-fog
`);
}

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'list':
      await listStyles(subArgs);
      break;
    case 'get':
      await getStyle(subArgs);
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
