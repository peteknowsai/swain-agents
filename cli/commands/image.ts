#!/usr/bin/env bun

/**
 * Image Commands
 * swain image queue|status|wait
 *
 * Async image generation for agents - queue images early and poll for completion
 */

import {
  workerRequest,
  print,
  printSuccess,
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
 * swain image queue "prompt" [--style=<styleId>] [--agent=<agentId>]
 * Queue an image generation job, returns immediately with jobId
 */
async function queueImage(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  // Find prompt (first non-flag argument)
  const prompt = args.find(arg => !arg.startsWith('--'));

  if (!prompt) {
    printError('Usage: swain image queue "prompt" [--style=<styleId>] [--agent=<agentId>]');
    process.exit(1);
  }

  try {
    const result = await workerRequest('/images/queue', {
      method: 'POST',
      body: {
        prompt,
        styleId: params['style'],
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
      if (result.styleId) print(`  Style:  ${result.styleId}`);
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
${colors.bold}swain image${colors.reset} - Async image generation

${colors.bold}Commands:${colors.reset}
  queue "prompt"    Queue image generation, returns jobId immediately
  status <jobId>    Check status of a job
  wait <jobId>      Wait for job to complete (with polling)

${colors.bold}Queue Options:${colors.reset}
  --style=<id>      Style ID (e.g., style_ocean-watercolor)
  --agent=<id>      Agent ID (or set AGENT_ID env var)
  --card-id=<id>    Card ID (optional, auto-generated if not provided)
  --json            Output as JSON

${colors.bold}Wait Options:${colors.reset}
  --timeout=<sec>   Max wait time in seconds (default: 120)
  --json            Output as JSON

${colors.bold}Examples:${colors.reset}
  # Queue an image and get jobId
  swain image queue "sheepshead near dock pilings" --style=style_ocean-watercolor

  # Check status
  swain image status img_abc123

  # Wait for completion
  swain image wait img_abc123 --timeout=60

  # Full workflow (agent use)
  JOB=$(swain image queue "fishing scene" --json | jq -r '.jobId')
  # ... do other work ...
  URL=$(swain image wait $JOB --json | jq -r '.url')

${colors.bold}Notes:${colors.reset}
  - Images generate in the background using nanobanana (FREE via Gemini)
  - Queue returns immediately; use wait to block until complete
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
