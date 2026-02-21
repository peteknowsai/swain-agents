#!/usr/bin/env bun

/**
 * Image Commands
 * swain image generate
 *
 * Image generation for agents — synchronous via Replicate → Cloudflare Images
 */

import {
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { generateImage } from '../lib/replicate-image';

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
 * Append technical requirements to the agent's creative prompt.
 * Aspect ratio is handled by the model parameter, not the prompt.
 */
function wrapPrompt(creativePrompt: string): string {
  return `${creativePrompt.trim()}. Full-bleed, no text or labels.`;
}

/**
 * swain image generate "prompt" [--style=<styleId>] [--json]
 * Synchronous image generation via Replicate → Cloudflare Images.
 * The --style flag is stored as metadata (cataloging) but NOT sent to the model.
 * The prompt is wrapped with technical boilerplate (aspect ratio, bleed, no-text).
 */
async function generateImageCommand(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = params['style'];

  // Find prompt (first non-flag argument)
  const prompt = args.find(arg => !arg.startsWith('--'));

  if (!prompt) {
    printError('Usage: swain image generate "prompt" [--style=<styleId>] [--json]');
    process.exit(1);
  }

  try {
    if (!jsonOutput) {
      print('Generating image via Replicate...');
      if (styleId) print(`  Style (catalog): ${styleId}`);
    }

    // Wrap the agent's creative prompt with technical boilerplate
    const fullPrompt = wrapPrompt(prompt);
    const result = await generateImage(fullPrompt);

    if (jsonOutput) {
      console.log(JSON.stringify({
        status: 'complete',
        url: result.url,
        imageId: result.imageId,
        replicateId: result.replicateId,
        ...(styleId ? { styleId } : {}),
      }, null, 2));
    } else {
      printSuccess(`Image ready: ${result.url}`);
      if (styleId) print(`  Style: ${styleId}`);
    }
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({
        status: 'failed',
        error: err.message,
      }, null, 2));
    } else {
      printError(`Image generation failed: ${err.message}`);
    }
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain image${colors.reset} - Image generation

${colors.bold}Commands:${colors.reset}
  generate "prompt"   Generate image (Replicate → Cloudflare Images)

${colors.bold}Options:${colors.reset}
  --style=<id>        Style ID for cataloging (NOT sent to model)
  --json              Output as JSON

${colors.bold}Examples:${colors.reset}
  swain image generate "sheepshead near dock pilings, soft watercolor wash"
  swain image generate "fishing scene at sunset" --style=golden-hour --json

${colors.bold}Notes:${colors.reset}
  - Uses Replicate API (nano-banana model) → uploads to Cloudflare Images
  - Your prompt is the creative vision — aspect ratio, bleed, no-text are added automatically
  - Pass --style=<id> to catalog which style was used (metadata only)
  - Typical generation time: 10-30 seconds
`);
}

/**
 * Main command router
 */
export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'generate':
        await generateImageCommand(commandArgs);
        break;
      case '--help':
      case '-h':
      case 'help':
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
