#!/usr/bin/env bun

/**
 * Boat Art Commands
 * swain boat-art create|list
 *
 * Generate boat art and persist it as a shareable record.
 * Unlike `swain card boat-art` (which just generates an image),
 * this creates a boatArt record with a shareable URL.
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import {
  ART_STYLES,
  buildBoatArtPrompt,
  generate,
  pickRandomStyle,
  pickBestStyle,
} from '../lib/image';

const SHARE_BASE_URL = 'https://www.heyswain.com/art';

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
 * swain boat-art create --user=<userId> [--style=<styleId>] [--best] [--json]
 *
 * Generate boat art, persist it, and return the shareable URL.
 */
async function createBoatArt(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['user'];
  const jsonOutput = params['json'] === 'true';
  const isBest = params['best'] === 'true';
  const styleParam = params['style'];

  if (!userId) {
    printError('Usage: swain boat-art create --user=<userId> [--style=<styleId>] [--best] [--json]');
    process.exit(1);
  }

  // 1. Fetch user profile + boats in parallel
  const [userResult, boatsResult] = await Promise.all([
    workerRequest(`/users/${userId}`),
    workerRequest(`/boats?userId=${userId}`),
  ]);
  const user = userResult.user || userResult;
  const boats = boatsResult.boats || [];
  const boat = boats.find((b: any) => b.isPrimary) || boats[0] || null;
  if (!user || !boat?.name) {
    printError(`User ${userId} not found or has no boat`);
    process.exit(1);
  }

  const boatName = boat.name;
  const boatType = boat.type || undefined;
  const boatMakeModel = boat.makeModel || undefined;
  const boatColor = undefined;
  const boatImageUrl = boat.imageUrl || undefined;
  const hasPhoto = !!boatImageUrl;

  // 2. Determine style
  let style: (typeof ART_STYLES)[number];
  if (styleParam) {
    const found = ART_STYLES.find((s) => s.id === styleParam);
    if (!found) {
      printError(`Unknown style: ${styleParam}. Available: ${ART_STYLES.map((s) => s.id).join(', ')}`);
      process.exit(1);
    }
    style = found;
  } else if (isBest) {
    style = pickBestStyle(boatType, boatMakeModel);
  } else {
    style = pickRandomStyle();
  }

  if (!jsonOutput) {
    print(`${colors.dim}Boat: ${boatName} (${boatMakeModel || boatType || 'boat'})${colors.reset}`);
    print(`${colors.dim}Style: ${style.name}${colors.reset}`);
    print(`${colors.dim}Photo: ${hasPhoto ? 'yes' : 'no (text-to-image)'}${colors.reset}`);
    process.stderr.write(`Generating...`);
  }

  // 3. Generate image
  const prompt = buildBoatArtPrompt({
    boatName,
    boatType,
    boatMakeModel,
    boatColor,
    style,
    hasPhoto,
  });

  const result = await generate(prompt, { imageInputUrl: hasPhoto ? boatImageUrl : undefined });

  if (!jsonOutput) {
    print(` done`);
    process.stderr.write(`Saving...`);
  }

  // 4. Persist to boat-art endpoint
  const artResult = await workerRequest('/boat-art', {
    method: 'POST',
    body: {
      userId,
      imageUrl: result.url,
      styleId: style.id,
      styleName: style.name,
      source: 'agent',
      prompt: prompt,
    },
  });

  const artId = artResult.artId;
  const shareUrl = `${SHARE_BASE_URL}/${artId}`;

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      artId,
      image: result.url,
      styleId: style.id,
      styleName: style.name,
      boatName,
      shareUrl,
    }, null, 2));
  } else {
    print(` done`);
    printSuccess(`Boat art created`);
    print(`  Art ID:  ${artId}`);
    print(`  Style:   ${style.name}`);
    print(`  Image:   ${result.url}`);
    print(`  Share:   ${shareUrl}`);
  }
}

/**
 * swain boat-art list --user=<userId> [--json]
 *
 * List all boat art for a user.
 */
async function listBoatArt(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['user'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain boat-art list --user=<userId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/boat-art?userId=${userId}`);
  const arts = result.arts || result.boatArts || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, arts, count: arts.length }, null, 2));
    return;
  }

  if (arts.length === 0) {
    print(`No boat art found for ${userId}`);
    return;
  }

  print(`\n${colors.bold}BOAT ART (${arts.length})${colors.reset} for ${userId}\n`);
  print(`${'ID'.padEnd(20)} ${'STYLE'.padEnd(25)} ${'SHARE URL'}`);
  print(`${'-'.repeat(20)} ${'-'.repeat(25)} ${'-'.repeat(40)}`);

  for (const art of arts) {
    const id = (art.artId || art._id || '').slice(0, 18);
    const styleName = (art.styleName || '-').slice(0, 23);
    const shareUrl = `${SHARE_BASE_URL}/${art.artId || art._id}`;
    print(`${id.padEnd(20)} ${styleName.padEnd(25)} ${shareUrl}`);
  }
  print('');
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain boat-art${colors.reset} - Generate and manage boat art

${colors.bold}COMMANDS${colors.reset}
  create                  Generate boat art and save it (with shareable URL)
  list                    List all boat art for a user

${colors.bold}OPTIONS (create)${colors.reset}
  --user=<userId>         User ID (required)
  --style=<styleId>       Specific art style (30 available)
  --best                  Auto-pick ideal style for boat type
  --json                  Output as JSON

${colors.bold}OPTIONS (list)${colors.reset}
  --user=<userId>         User ID (required)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain boat-art create --user=usr_abc123 --style=pop-art --json
  swain boat-art create --user=usr_abc123 --best --json
  swain boat-art list --user=usr_abc123 --json

${colors.bold}SHARE URLS${colors.reset}
  Every piece of art gets a shareable URL:
  https://www.heyswain.com/art/{artId}
`);
}

/**
 * Main entry point
 */
export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'create':
        await createBoatArt(commandArgs);
        break;
      case 'list':
        await listBoatArt(commandArgs);
        break;
      case 'help':
      case '--help':
      case '-h':
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
