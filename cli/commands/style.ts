#!/usr/bin/env bun

/**
 * Style Commands
 * swain style list|get|create|update|delete|restore|regen-example
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
 * swain style list
 * List all available styles
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
    print('No styles found');
    return;
  }

  print(`\n${colors.bold}STYLES (${styles.length})${colors.reset}\n`);

  for (const style of styles) {
    print(`${colors.bold}${style.name}${colors.reset} (${style.id})`);
    if (style.description) {
      print(`  ${style.description}`);
    }
    if (style.promptText) {
      print(`  ${colors.dim}Prompt: ${style.promptText}${colors.reset}`);
    }
    print('');
  }
}

/**
 * swain style get <styleId>
 * Get style details
 */
async function getStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const styleId = params['style'] || params['id'] || args[0];
  const jsonOutput = params['json'] === 'true';

  if (!styleId || styleId.startsWith('--')) {
    printError('Usage: swain style get <styleId> or --style=<id>');
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

  print(`\n${colors.bold}STYLE: ${style.name}${colors.reset}\n`);
  print(`ID:          ${style.id}`);
  print(`Name:        ${style.name}`);
  print(`Description: ${style.description || '-'}`);
  if (style.promptText) {
    print(`Prompt:      ${style.promptText}`);
  }
  print(`Visual:      ${style.visualId}`);
  print(`Texture:     ${style.textureId}`);
  print(`Mood:        ${style.moodId}`);
  print(`Layout:      ${style.layoutId}`);
  print(`Detail:      ${style.detailId}`);
  if (style.exampleImageUrl) {
    print(`Example:     ${style.exampleImageUrl}`);
  }
  print(`Active:      ${style.active ? 'Yes' : 'No'}`);
  print(`Default:     ${style.isDefault ? 'Yes' : 'No'}`);
  print(`Usage:       ${style.usageCount || 0} cards`);
  print('');
}

/**
 * swain style create --name="..." --prompt="..." [--description="..."]
 */
async function createStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const name = params['name'];
  const promptText = params['prompt'];
  const description = params['description'];

  if (!name) {
    printError('--name is required');
    printError('Usage: swain style create --name="Warm Watercolor" --prompt="Warm watercolor..."');
    process.exit(1);
  }

  if (!promptText) {
    printError('--prompt is required');
    printError('Usage: swain style create --name="Warm Watercolor" --prompt="Warm watercolor..."');
    process.exit(1);
  }

  const body: Record<string, any> = { name, promptText };
  if (description) body.description = description;

  const result = await workerRequest('/styles', { method: 'POST', body });
  const style = result.style;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, style }, null, 2));
    return;
  }

  printSuccess(`Created style: ${style.name} (${style.id})`);
  if (style.promptText) {
    print(`  ${colors.dim}Prompt: ${style.promptText}${colors.reset}`);
  }
}

/**
 * swain style update <styleId> [--name=X] [--prompt=X] [--description=X] [--active=true|false]
 */
async function updateStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = args.find(a => !a.startsWith('--'));

  if (!styleId) {
    printError('Usage: swain style update <styleId> [--name=X] [--prompt=X] [--description=X] [--active=true|false]');
    process.exit(1);
  }

  const body: Record<string, any> = {};
  if (params['name']) body.name = params['name'];
  if (params['prompt']) body.promptText = params['prompt'];
  if (params['description']) body.description = params['description'];
  if (params['active'] !== undefined) body.active = params['active'] === 'true';

  if (Object.keys(body).length === 0) {
    printError('No fields to update. Provide at least one of: --name, --prompt, --description, --active');
    process.exit(1);
  }

  const result = await workerRequest(`/styles/${styleId}`, { method: 'PATCH', body });
  const style = result.style;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, style }, null, 2));
    return;
  }

  printSuccess(`Updated style: ${style.name} (${style.id})`);
}

/**
 * swain style delete <styleId>
 */
async function deleteStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = args.find(a => !a.startsWith('--'));

  if (!styleId) {
    printError('Usage: swain style delete <styleId>');
    process.exit(1);
  }

  const result = await workerRequest(`/styles/${styleId}`, { method: 'DELETE' });

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, id: styleId }, null, 2));
    return;
  }

  printSuccess(`Deleted style: ${styleId}`);
}

/**
 * swain style restore <styleId>
 */
async function restoreStyle(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = args.find(a => !a.startsWith('--'));

  if (!styleId) {
    printError('Usage: swain style restore <styleId>');
    process.exit(1);
  }

  const result = await workerRequest(`/styles/${styleId}/restore`, { method: 'POST' });
  const style = result.style;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, style }, null, 2));
    return;
  }

  printSuccess(`Restored style: ${style.name} (${style.id})`);
}

/**
 * swain style regen-example <styleId>
 */
async function regenExample(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = args.find(a => !a.startsWith('--'));

  if (!styleId) {
    printError('Usage: swain style regen-example <styleId>');
    process.exit(1);
  }

  const result = await workerRequest(`/styles/${styleId}/regenerate-example`, { method: 'POST' });
  const style = result.style;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, style }, null, 2));
    return;
  }

  printSuccess(`Regenerated example for: ${style.name} (${style.id})`);
  if (style.exampleImageUrl) {
    print(`  Example: ${style.exampleImageUrl}`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain style${colors.reset} - Style management

${colors.bold}USAGE${colors.reset}
  swain style <subcommand> [options]

${colors.bold}SUBCOMMANDS${colors.reset}
  list                  List all available styles
  get <styleId>         Get style details
  create                Create a new style
  update <styleId>      Update a style
  delete <styleId>      Soft-delete a style
  restore <styleId>     Restore a deleted style
  regen-example <id>    Regenerate example image

${colors.bold}OPTIONS${colors.reset}
  --json                Output as JSON
  --name=<name>         Style name (create, update)
  --prompt=<text>       Prompt text (create, update)
  --description=<text>  Description (create, update)
  --active=true|false   Active status (update)

${colors.bold}EXAMPLES${colors.reset}
  swain style list
  swain style create --name="Bold Graphic" --prompt="Bold graphic illustration"
  swain style update style_abc123 --description="Updated desc"
  swain style delete style_abc123
  swain style restore style_abc123
  swain style regen-example style_abc123
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
    case 'create':
      await createStyle(subArgs);
      break;
    case 'update':
      await updateStyle(subArgs);
      break;
    case 'delete':
      await deleteStyle(subArgs);
      break;
    case 'restore':
      await restoreStyle(subArgs);
      break;
    case 'regen-example':
      await regenExample(subArgs);
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
