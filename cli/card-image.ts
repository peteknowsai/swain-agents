#!/usr/bin/env bun

/**
 * card-image CLI Tool
 *
 * Simple one-liner for generating card images:
 *   card-image "tarpon fishing at sunrise Tampa Bay"
 *   # Returns: https://imagedelivery.net/.../public
 *
 * With style:
 *   card-image "marina at sunset" --style=style_vintage-polaroid
 *   # Fetches style promptText, appends to image prompt
 *
 * Image generation uses nanobanana CLI (Gemini 3 Pro).
 * Contract: `nanobanana -c --json "prompt"` → JSON with Cloudflare Images URL.
 */

import { existsSync } from 'fs';
import { spawn } from 'bun';

// Environment URLs — Convex site URL for HTTP actions
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || 'https://calm-basilisk-210.convex.site';
const ENV_URLS: Record<string, string> = {
  local: CONVEX_SITE_URL,
  dev: CONVEX_SITE_URL,
  prod: process.env.SWAIN_API_URL || CONVEX_SITE_URL,
  production: process.env.SWAIN_API_URL || CONVEX_SITE_URL,
};

// Parse --env flag
function getWorkerUrl(): string {
  const envArg = process.argv.find(arg => arg.startsWith('--env='));
  if (envArg) {
    const env = envArg.split('=')[1];
    const url = ENV_URLS[env.toLowerCase()];
    if (!url) {
      console.error(`Unknown environment: ${env}. Valid: local, prod`);
      process.exit(1);
    }
    return url;
  }

  // Check SWAIN_API_URL env var
  let url = process.env.SWAIN_API_URL || ENV_URLS.prod;

  // Only do localhost replacement if running inside a container
  const isInContainer = existsSync('/.dockerenv') || process.env.HOSTNAME?.includes('container');
  if (isInContainer) {
    if (url.includes('localhost')) {
      url = url.replace('localhost', 'host.docker.internal');
    } else if (url.includes('127.0.0.1')) {
      url = url.replace('127.0.0.1', 'host.docker.internal');
    }
  }

  return url;
}

interface ImageResult {
  url: string;
  styleId?: string;
}

/**
 * Fetch style promptText from the API
 */
async function fetchStylePrompt(styleId: string, workerUrl: string): Promise<string | null> {
  try {
    const response = await fetch(`${workerUrl}/styles/${styleId}`);
    if (!response.ok) {
      console.error(`[CardImage] Failed to fetch style: ${response.status}`);
      return null;
    }
    const data = await response.json() as { success: boolean; style?: { promptText?: string } };
    return data.style?.promptText || null;
  } catch (error) {
    console.error('[CardImage] Error fetching style:', error);
    return null;
  }
}

/**
 * Generate image using nanobanana CLI (Gemini 3 Pro)
 */
async function generateWithNanobanana(prompt: string): Promise<string> {
  const proc = spawn(['nanobanana', '-c', '--json', prompt], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  const stderr = await new Response(proc.stderr).text();
  const exitCode = await proc.exited;

  if (stderr) {
    console.error(`[CardImage] nanobanana stderr: ${stderr}`);
  }

  if (exitCode !== 0) {
    throw new Error(`nanobanana failed with exit code ${exitCode}: ${stderr || output}`);
  }

  let result: { status: string; url?: string; error?: string };
  try {
    result = JSON.parse(output);
  } catch {
    throw new Error(`nanobanana returned invalid JSON: ${output}`);
  }

  if (result.status !== 'complete') {
    throw new Error(result.error || 'nanobanana image generation failed');
  }

  if (!result.url) {
    throw new Error('nanobanana did not return URL');
  }

  return result.url;
}

async function generateImage(description: string, styleId?: string): Promise<ImageResult> {
  const workerUrl = getWorkerUrl();

  // Image context guidance
  const imageGuidance = 'This image accompanies a story card - the headline is added separately. Do not include title text, labels, or captions in the image. Text naturally part of the scene (boat name, marina sign) is fine.';

  let prompt = `${imageGuidance}\n\n${description}`;

  // If style provided, fetch promptText and append
  if (styleId) {
    console.error(`[CardImage] Fetching style "${styleId}"...`);
    const stylePrompt = await fetchStylePrompt(styleId, workerUrl);
    if (stylePrompt) {
      prompt = `${prompt}. Style: ${stylePrompt}`;
      console.error(`[CardImage] Applied style prompt`);
    } else {
      console.error('[CardImage] No style promptText found, proceeding without style');
    }
  }

  const imageUrl = await generateWithNanobanana(prompt);
  console.error('[CardImage] Success!');
  return { url: imageUrl, styleId };
}

// Main
let args = process.argv.slice(2);

// Handle --local flag (legacy support)
if (args.includes('--local')) {
  process.argv.push('--env=local');
  args = args.filter(arg => arg !== '--local');
}

// Parse flags
const styleArg = args.find(arg => arg.startsWith('--style='));
const jsonOutput = args.includes('--json');

// Filter out flags from description
const filteredArgs = args.filter(arg =>
  !arg.startsWith('--env=') &&
  !arg.startsWith('--style=') &&
  arg !== '--json'
);

if (filteredArgs.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
card-image - Generate card images with consistent design language

Usage:
  card-image "description of the scene"
  card-image "description" --style=style_vintage-polaroid

Examples:
  card-image "sheepshead fish near bridge pilings underwater"
  card-image "marina at sunset" --style=style_warm-watercolor
  card-image "redfish tailing on grass flats" --env=local

Options:
  --style=<id>      Style ID — appends style promptText to image prompt
  --env=<env>       Environment: local, prod (default: prod)
  --json            Output as JSON
  --local           Alias for --env=local
`);
  process.exit(0);
}

const description = filteredArgs.join(' ');
const styleId = styleArg?.split('=')[1];

try {
  const result = await generateImage(description, styleId);
  if (jsonOutput) {
    console.log(JSON.stringify(result));
  } else {
    console.log(result.url);
    console.log(`STYLE_ID=${result.styleId || 'none'}`);
  }
} catch (err: any) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
