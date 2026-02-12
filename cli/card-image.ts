#!/usr/bin/env bun

/**
 * card-image CLI Tool
 *
 * Simple one-liner for generating card images:
 *   card-image "tarpon fishing at sunrise Tampa Bay"
 *   # Returns: https://imagedelivery.net/.../public
 *
 * Image generation uses Replicate API (lucataco/nano-banana-txt2img)
 * and uploads to Cloudflare Images.
 */

import { generateImage } from './lib/replicate-image';

// Parse args
const args = process.argv.slice(2);

// Parse flags
const jsonOutput = args.includes('--json');

// Filter out flags from description
const filteredArgs = args.filter(arg =>
  !arg.startsWith('--env=') &&
  arg !== '--json'
);

if (filteredArgs.length === 0 || args[0] === '--help' || args[0] === '-h') {
  console.log(`
card-image - Generate card images via Replicate + Cloudflare Images

Usage:
  card-image "description of the scene"

Examples:
  card-image "sheepshead fish near bridge pilings underwater"
  card-image "marina at sunset, warm watercolor style"
  card-image "redfish tailing on grass flats" --json

Options:
  --json            Output as JSON

Notes:
  Include style/composition details directly in the prompt.
  Requires REPLICATE_API_TOKEN and CLOUDFLARE_IMAGES_API_TOKEN env vars.
`);
  process.exit(0);
}

const description = filteredArgs.join(' ');

// Image context guidance
const imageGuidance = 'This image accompanies a story card - the headline is added separately. Do not include title text, labels, or captions in the image. Text naturally part of the scene (boat name, marina sign) is fine.';

const prompt = `${imageGuidance}\n\n${description}`;

try {
  const result = await generateImage(prompt);

  if (jsonOutput) {
    console.log(JSON.stringify({ url: result.url, imageId: result.imageId }));
  } else {
    console.log(result.url);
  }
} catch (err: any) {
  if (jsonOutput) {
    console.log(JSON.stringify({ error: err.message }));
  } else {
    console.error(`Error: ${err.message}`);
  }
  process.exit(1);
}
