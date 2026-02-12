#!/usr/bin/env bun

/**
 * Image Commands
 * swain image generate|queue|status|wait
 *
 * Image generation for agents — synchronous via Replicate, or async via Convex jobs
 */

import {
  workerRequest,
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
 * swain image queue "prompt" [--agent=<agentId>]
 * Queue an image generation job, returns immediately with jobId
 */
async function queueImage(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  // Find prompt (first non-flag argument)
  const prompt = args.find(arg => !arg.startsWith('--'));

  if (!prompt) {
    printError('Usage: swain image queue "prompt" [--agent=<agentId>]');
    process.exit(1);
  }

  try {
    const result = await workerRequest('/images/queue', {
      method: 'POST',
      body: {
        prompt,
        agentId: params['agent'] || params['agent-id'] || process.env.AGENT_ID,
        cardId: params['card-id'],
      },
    });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSuccess(`Queued image job: ${result.jobId}`);
      print(`  Status: ${result.status}`);
      print(`  Poll:   ${result.pollUrl}`);
      print(`\nUse 'swain image status ${result.jobId}' to check status`);
      print(`Or  'swain image wait ${result.jobId}' to wait for completion`);
    }
  } catch (err: any) {
    printError(`Failed to queue image: ${err.message}`);
    process.exit(1);
  }
}

/**
 * swain image status <jobId>
 * Check status of an image generation job
 */
async function statusImage(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  // Find jobId (first non-flag argument)
  const jobId = args.find(arg => !arg.startsWith('--'));

  if (!jobId) {
    printError('Usage: swain image status <jobId>');
    process.exit(1);
  }

  try {
    const result = await workerRequest(`/images/${jobId}`);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      print(`\n${colors.bold}Image Job: ${result.jobId}${colors.reset}\n`);
      print(`  Status: ${colorStatus(result.status)}`);
      if (result.url) print(`  URL:    ${result.url}`);
      if (result.error) print(`  Error:  ${colors.red}${result.error}${colors.reset}`);
      print('');
    }
  } catch (err: any) {
    printError(`Failed to get status: ${err.message}`);
    process.exit(1);
  }
}

/**
 * swain image wait <jobId> [--timeout=120]
 * Wait for an image generation job to complete, polling until done
 */
async function waitImage(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const timeout = parseInt(params['timeout'] || '120', 10) * 1000; // Default 120s
  const pollInterval = 2000; // Poll every 2 seconds

  // Find jobId (first non-flag argument)
  const jobId = args.find(arg => !arg.startsWith('--'));

  if (!jobId) {
    printError('Usage: swain image wait <jobId> [--timeout=120]');
    process.exit(1);
  }

  const startTime = Date.now();
  let lastStatus = '';

  if (!jsonOutput) {
    print(`Waiting for job ${jobId}...`);
  }

  while (Date.now() - startTime < timeout) {
    try {
      const result = await workerRequest(`/images/${jobId}`);

      // Log status changes (non-JSON mode)
      if (!jsonOutput && result.status !== lastStatus) {
        print(`  Status: ${colorStatus(result.status)}`);
        lastStatus = result.status;
      }

      // Check for terminal states
      if (result.status === 'complete') {
        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printSuccess(`Image ready: ${result.url}`);
        }
        return;
      }

      if (result.status === 'failed') {
        if (jsonOutput) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          printError(`Image generation failed: ${result.error || 'Unknown error'}`);
        }
        process.exit(1);
      }

      // Still pending or processing - wait and poll again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    } catch (err: any) {
      // Transient error - keep trying
      if (!jsonOutput) {
        print(`  Poll error: ${err.message}, retrying...`);
      }
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
  }

  // Timeout
  printError(`Timeout waiting for image after ${timeout / 1000}s`);
  process.exit(1);
}

/**
 * Color status for display
 */
function colorStatus(status: string): string {
  switch (status) {
    case 'complete':
      return `${colors.green}${status}${colors.reset}`;
    case 'failed':
      return `${colors.red}${status}${colors.reset}`;
    case 'processing':
      return `${colors.yellow}${status}${colors.reset}`;
    default:
      return `${colors.dim}${status}${colors.reset}`;
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain image${colors.reset} - Image generation

${colors.bold}Commands:${colors.reset}
  generate "prompt"   Generate image synchronously (Replicate → CF Images)
  queue "prompt"      Queue image generation, returns jobId immediately
  status <jobId>      Check status of a job
  wait <jobId>        Wait for job to complete (with polling)

${colors.bold}Generate Options:${colors.reset}
  --style=<id>        Style ID for cataloging (NOT sent to model)
  --json              Output as JSON

${colors.bold}Queue Options:${colors.reset}
  --agent=<id>        Agent ID (or set AGENT_ID env var)
  --card-id=<id>      Card ID (optional, auto-generated if not provided)
  --json              Output as JSON

${colors.bold}Wait Options:${colors.reset}
  --timeout=<sec>     Max wait time in seconds (default: 120)
  --json              Output as JSON

${colors.bold}Examples:${colors.reset}
  # Generate an image (prompt is wrapped with technical boilerplate automatically)
  swain image generate "sheepshead near dock pilings, soft watercolor wash"

  # Generate with style cataloging
  swain image generate "fishing scene at sunset, warm golden haze" --style=golden-hour

  # JSON output (for agents)
  swain image generate "fishing scene at sunset" --json

  # Queue an image job (async)
  swain image queue "fishing scene"

  # Check status
  swain image status img_abc123

  # Wait for completion
  swain image wait img_abc123 --timeout=60

${colors.bold}Notes:${colors.reset}
  - 'generate' uses Replicate API (lucataco/nano-banana-txt2img)
  - Your prompt is the creative vision — aspect ratio, bleed, no-text are added automatically
  - Use 'swain style list' to browse styles, then infuse the style into your prompt
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
      case 'queue':
        await queueImage(commandArgs);
        break;
      case 'status':
        await statusImage(commandArgs);
        break;
      case 'wait':
        await waitImage(commandArgs);
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
