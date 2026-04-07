#!/usr/bin/env bun

/**
 * Image Commands
 * swain image generate
 *
 * Image generation for agents — synchronous via Gemini → Cloudflare Images
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { generate, fetchImageAsBase64, PROMPT_FULL_BLEED } from '../lib/image';

const PROMPT_FLYER = 'Include bold promotional text, headlines, and graphic design elements. This is a flyer — make it look like a designed promotional piece with visual hierarchy, not a photograph.';

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
 * swain image generate "prompt" [--style=<styleId>] [--aspect-ratio=<ratio>] [--resolution=<res>] [--json]
 * Synchronous image generation via Gemini → Cloudflare Images.
 * The --style flag is stored as metadata (cataloging) but NOT sent to the model.
 * The prompt is wrapped with technical boilerplate (aspect ratio, bleed, no-text).
 */
async function generateImageCommand(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const styleId = params['style'];
  const aspectRatio = params['aspect-ratio'];
  const resolution = params['resolution'];
  const mode = params['mode'];

  // Find prompt (first non-flag argument)
  const prompt = args.find(arg => !arg.startsWith('--'));

  if (!prompt) {
    printError('Usage: swain image generate "prompt" [--style=<styleId>] [--aspect-ratio=<ratio>] [--resolution=<res>] [--mode=flyer] [--json]');
    process.exit(1);
  }

  // Select suffix based on mode
  const suffix = mode === 'flyer' ? PROMPT_FLYER : undefined;

  try {
    if (!jsonOutput) {
      print(`Generating ${mode === 'flyer' ? 'flyer ' : ''}image via Gemini...`);
      if (styleId) print(`  Style (catalog): ${styleId}`);
    }

    const result = await generate(prompt, { aspectRatio, resolution, suffix });

    if (jsonOutput) {
      console.log(JSON.stringify({
        status: 'complete',
        url: result.url,
        imageId: result.imageId,
        generationId: result.generationId,
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
 * swain image upload --url=<imageUrl> [--filename=<name>] [--json]
 * swain image upload --file=<path> [--filename=<name>] [--json]
 * Upload an image to Cloudflare via the Convex API. Returns a public CDN URL.
 */
async function uploadImageCommand(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const source = params['url'] || params['file'];
  const filenameOverride = params['filename'];
  const jsonOutput = params['json'] === 'true';

  if (!source) {
    printError('Usage: swain image upload --url=<imageUrl> [--filename=<name>] [--json]');
    process.exit(1);
  }

  let base64: string;
  let filename: string | undefined = filenameOverride;
  try {
    const fetched = await fetchImageAsBase64(source);
    base64 = fetched.base64;
    if (!filename) filename = fetched.filename;
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: `Failed to fetch image: ${err.message}` }));
    } else {
      printError(`Failed to fetch image: ${err.message}`);
    }
    process.exit(1);
  }

  const body: any = { image: base64 };
  if (filename) body.filename = filename;

  const result = await workerRequest('/images/upload', { method: 'POST', body });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.imageId) {
    printSuccess(`Image uploaded: ${result.imageUrl}`);
    print(`  ID: ${result.imageId}`);
  } else {
    printError(result.error || 'Upload failed');
    process.exit(1);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain image${colors.reset} - Image generation & upload

${colors.bold}Commands:${colors.reset}
  generate "prompt"          Generate image (Gemini → Cloudflare Images)
  upload --url=<url>         Upload an existing image to Cloudflare

${colors.bold}Options:${colors.reset}
  --style=<id>              Style ID for cataloging (NOT sent to model)
  --aspect-ratio=<ratio>    Aspect ratio (e.g., 4:3, 16:9, 1:1; default: 4:3)
  --resolution=<res>        Resolution: 0.5K, 1K, 2K, 4K (default: 1K)
  --mode=flyer              Generate a flyer (promotional graphic with text/layout)
  --filename=<name>         Override filename (upload only)
  --json                    Output as JSON

${colors.bold}Examples:${colors.reset}
  swain image generate "sheepshead near dock pilings, soft watercolor wash"
  swain image generate "fishing scene at sunset" --style=golden-hour --json
  swain image generate "marina at dawn" --aspect-ratio=16:9 --resolution=2K --json
  swain image generate "Port 32 Tampa spring storage special, marina with boats" --mode=flyer --aspect-ratio=4:5 --json
  swain image upload --url=http://localhost:8765/photo.jpg --json
  swain image upload --file=/tmp/screenshot.png --json

${colors.bold}Notes:${colors.reset}
  - generate: Uses Gemini API → Cloudflare Images. 10-30 seconds.
  - upload: Fetches from any URL or local file, uploads to Cloudflare via Convex API.
  - Your prompt is the creative vision — aspect ratio, bleed, no-text are added automatically
  - Pass --style=<id> to catalog which style was used (metadata only)
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
      case 'upload':
        await uploadImageCommand(commandArgs);
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
