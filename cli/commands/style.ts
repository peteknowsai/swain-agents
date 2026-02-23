#!/usr/bin/env bun

/**
 * Style Commands
 * swain style list|get|update
 *
 * Browse and manage image styles. Styles have a promptText field that gets
 * injected into image generation prompts automatically via --style.
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
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

  print(`${colors.dim}Pass --style=<id> to image commands. The style's promptText is injected automatically.${colors.reset}\n`);
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

/**
 * swain style update <styleId> --prompt-text="..." [--description="..."] [--name="..."] [--json]
 * Update a style's fields
 */
async function updateStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = args.find(a => !a.startsWith('--'));

  if (!styleId) {
    printError('Usage: swain style update <styleId> --prompt-text="..."');
    process.exit(1);
  }

  const body: Record<string, string> = {};
  if (params['prompt-text']) body.promptText = params['prompt-text'];
  if (params['description']) body.description = params['description'];
  if (params['name']) body.name = params['name'];

  if (Object.keys(body).length === 0) {
    printError('Nothing to update. Pass --prompt-text, --description, or --name.');
    process.exit(1);
  }

  const result = await workerRequest(`/styles/${styleId}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, style: result.style }, null, 2));
    return;
  }

  printSuccess(`Style ${styleId} updated`);
  if (body.promptText) {
    print(`  promptText: ${body.promptText.slice(0, 80)}${body.promptText.length > 80 ? '...' : ''}`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain style${colors.reset} - Browse and manage image styles

${colors.bold}USAGE${colors.reset}
  swain style list              List all available styles
  swain style get <styleId>     Get style details
  swain style update <styleId>  Update a style's fields

${colors.bold}OPTIONS${colors.reset}
  --json                        Output as JSON
  --prompt-text="..."           Style prompt injected into image generation
  --description="..."           Short human-readable description
  --name="..."                  Display name

${colors.bold}EXAMPLES${colors.reset}
  swain style list
  swain style list --json
  swain style get misty-fog
  swain style update cool-ocean-minimal --prompt-text="clean minimal illustration..."
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
    case 'update':
      await updateStyle(subArgs);
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
