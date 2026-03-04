#!/usr/bin/env bun

/**
 * Card Commands
 * swain card list|get|create|check|update|audit|archive|unarchive|image|boat-art
 */

import {
  workerRequest,
  print,
  printSuccess,
  printWarning,
  printError,
  colors
} from '../lib/worker-client';
import { generate, PROMPT_FULL_BLEED, PROMPT_CARD_CONTEXT, ART_STYLES } from '../lib/image';
import { ensureCardContrast } from '../lib/color';

/**
 * Run a --bg-color value through contrast enforcement.
 * Logs a warning (to stderr) when the color gets darkened.
 */
function safeBgColor(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const { hex, darkened } = ensureCardContrast(raw);
  if (darkened) {
    console.error(`${colors.dim}bg-color ${raw} too light — darkened to ${hex}${colors.reset}`);
  }
  return hex;
}

/**
 * Get today's date in Eastern Time (YYYY-MM-DD format)
 */
function getTodayDate(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
}

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
  // Unescape common escape sequences in text fields (content, title, subtext)
  for (const key of ['content', 'title', 'subtext']) {
    if (parsed[key]) {
      parsed[key] = parsed[key]
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t');
    }
  }
  return parsed;
}

/**
 * Get desk from args (primary identifier for new cards)
 */
function getDesk(params: Record<string, string>): string {
  const desk = params['desk'] || process.env.SWAIN_DESK;
  if (!desk) {
    printError('Desk required. Use --desk=<name> or set SWAIN_DESK env var');
    process.exit(1);
  }
  return desk;
}

/**
 * Get agent ID from env or args (optional, for legacy/audit)
 */
function getAgentId(params: Record<string, string>): string | undefined {
  return params['agent-id'] || params['agent'] || process.env.AGENT_ID || undefined;
}

/**
 * swain card pull
 * Pull lightweight card candidates for a user (advisor toolkit)
 */
async function pullCards(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || params['user-id'];
  const jsonOutput = params['json'] === 'true';
  const excludeServed = params['exclude-served'] === 'true';
  const includeNoImage = params['include-no-image'] === 'true';
  const category = params['category'];
  const limit = params['limit'];

  if (!userId) {
    printError('Usage: swain card pull --user=<userId> [--exclude-served] [--category=<cat>] [--limit=<n>] [--include-no-image] [--json]');
    process.exit(1);
  }

  const queryParams = new URLSearchParams();
  if (excludeServed) queryParams.append('exclude-served', 'true');
  if (category) queryParams.append('category', category);
  if (limit) queryParams.append('limit', limit);

  const result = await workerRequest(`/cards/pull/${userId}?${queryParams}`);

  let cards = result.cards || [];

  // Filter out cards with no image (or placeholder images) by default
  if (!includeNoImage) {
    cards = cards.filter((c: any) =>
      c.image && !c.image.includes('placehold') && !c.image.includes('placeholder')
    );
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ ...result, cards, count: cards.length }, null, 2));
    return;
  }
  if (cards.length === 0) {
    print(`No card candidates found for ${userId}`);
    return;
  }

  print(`\n${colors.bold}CARD CANDIDATES (${cards.length})${colors.reset} for ${userId}\n`);
  print(`${'ID'.padEnd(28)} ${'TITLE'.padEnd(30)} ${'CATEGORY'.padEnd(18)} ${'FRESH'.padEnd(10)} ${'EXPIRES'}`);
  print(`${'-'.repeat(28)} ${'-'.repeat(30)} ${'-'.repeat(18)} ${'-'.repeat(10)} ${'-'.repeat(12)}`);

  for (const card of cards) {
    const title = (card.title || '-').slice(0, 28);
    const cat = (card.category || '-').slice(0, 16);
    const fresh = card.freshness || '-';
    const expires = card.expires_at
      ? new Date(card.expires_at * 1000).toLocaleDateString('en-US', { timeZone: 'America/New_York' })
      : '-';
    print(`${(card.id || '').padEnd(28)} ${title.padEnd(30)} ${cat.padEnd(18)} ${fresh.padEnd(10)} ${expires}`);
  }

  if (result.stats) {
    print(`\n${colors.dim}Stats: ${result.stats.fresh} fresh, ${result.stats.resurfaced} resurfaced${colors.reset}`);
  }
  print('');
}

/**
 * swain card list
 * List/query cards
 */
async function listCards(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const unstyledOnly = params['unstyled'] === 'true';

  const queryParams = new URLSearchParams();
  if (params['desk']) queryParams.append('desk', params['desk']);
  if (params['category']) queryParams.append('category', params['category']);
  if (params['limit'] && !unstyledOnly) queryParams.append('limit', params['limit']);

  const result = await workerRequest(`/cards?${queryParams}`);
  let cards = result.cards || [];

  // Filter to unstyled cards (no image or placeholder image)
  if (unstyledOnly) {
    cards = cards.filter((c: any) =>
      !c.image || c.image.includes('placehold') || c.image.includes('placeholder')
    );
    if (params['limit']) {
      cards = cards.slice(0, parseInt(params['limit'], 10));
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, cards, count: cards.length }, null, 2));
    return;
  }

  if (cards.length === 0) {
    print('No cards found');
    return;
  }

  print(`\n${colors.bold}CARDS (${cards.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(15)} ${'TITLE'.padEnd(30)} ${'AGENT'.padEnd(20)} ${'CREATED'}`);
  print(`${'-'.repeat(15)} ${'-'.repeat(30)} ${'-'.repeat(20)} ${'-'.repeat(20)}`);

  for (const card of cards) {
    const title = (card.title || '-').slice(0, 28);
    print(`${(card.id || '').slice(0, 15).padEnd(15)} ${title.padEnd(30)} ${(card.agentId || '-').padEnd(20)} ${card.createdAt || '-'}`);
  }
  print('');
}

/**
 * swain card get
 * Get card details
 */
async function getCard(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const cardId = params['card'] || params['id'] || args[0];
  const jsonOutput = params['json'] === 'true';

  if (!cardId || cardId.startsWith('--')) {
    printError('Usage: swain card get <cardId> or --card=<id>');
    process.exit(1);
  }

  const result = await workerRequest(`/cards/${cardId}`);
  const card = result.card;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, card }, null, 2));
    return;
  }

  if (!card) {
    printError(`Card not found: ${cardId}`);
    process.exit(1);
  }

  print(`\n${colors.bold}CARD: ${card.id}${colors.reset}\n`);
  print(`  Title:      ${card.title || '-'}`);
  print(`  Subtext:    ${card.subtext || '-'}`);
  print(`  Agent:      ${card.agentId || '-'}`);
  print(`  Task:       ${card.taskId || '-'}`);
  print(`  Type:       ${card.type || '-'}`);
  print(`  Created:    ${card.createdAt || '-'}`);
  if (card.image) print(`  Image:      ${card.image}`);
  if (card.backgroundColor) print(`  BG Color:   ${card.backgroundColor}`);
  if (card.content) {
    print(`\n${colors.bold}Content:${colors.reset}`);
    print(card.content.slice(0, 500) + (card.content.length > 500 ? '...' : ''));
  }
  print('');
}

/**
 * swain card list-today
 * List all cards created today (Eastern Time)
 */
async function listTodayCards(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const result = await workerRequest('/cards/today');
  const cards = result.cards || [];
  const date = result.date;

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, cards, date, count: cards.length }, null, 2));
    return;
  }

  if (cards.length === 0) {
    print(`\nNo cards found for today (${date})\n`);
    return;
  }

  print(`\n${colors.bold}TODAY'S CARDS - ${date} (${cards.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(28)} ${'TITLE'.padEnd(35)} ${'AGENT'}`);
  print(`${'-'.repeat(28)} ${'-'.repeat(35)} ${'-'.repeat(30)}`);

  for (const card of cards) {
    const title = (card.title || '-').slice(0, 33);
    print(`${(card.id || '').padEnd(28)} ${title.padEnd(35)} ${card.agentId || '-'}`);
  }
  print('');
}

/**
 * swain card check
 * Check if a card exists for desk on a given date
 */
async function checkCard(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const desk = params['desk'];
  const agentId = getAgentId(params);
  const date = params['date'] || getTodayDate();

  if (!desk && !agentId) {
    printError('Usage: swain card check --desk=<name> [--date=YYYY-MM-DD] [--json]');
    process.exit(1);
  }

  const queryParams = new URLSearchParams();
  if (desk) queryParams.append('desk', desk);
  if (agentId) queryParams.append('agentId', agentId);
  queryParams.append('date', date);

  const result = await workerRequest(`/cards/check?${queryParams}`);

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      exists: result.exists,
      desk,
      date,
      card: result.card,
    }, null, 2));
    return;
  }

  const label = desk || agentId || 'unknown';
  if (result.exists) {
    print(`\n${colors.bold}Card exists for ${label} on ${date}${colors.reset}\n`);
    print(`  ID:       ${result.card.cardId}`);
    print(`  Title:    ${result.card.title}`);
    print('');
  } else {
    print(`\nNo card found for ${label} on ${date}\n`);
  }
}

/**
 * swain card coverage
 * Show card coverage by category for a desk
 */
async function coverageReport(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const desk = params['desk'];

  const queryParams = new URLSearchParams();
  if (desk) queryParams.append('desk', desk);

  const result = await workerRequest(`/cards/coverage?${queryParams}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  print(`\n${colors.bold}COVERAGE: ${result.desk}${colors.reset}  (${result.totalActive} active cards)\n`);

  const categories = result.categories || {};
  const sorted = Object.entries(categories).sort((a, b) => (b[1] as number) - (a[1] as number));

  print(`${'CATEGORY'.padEnd(25)} ${'COUNT'}`);
  print(`${'-'.repeat(25)} ${'-'.repeat(8)}`);
  for (const [cat, count] of sorted) {
    print(`${cat.padEnd(25)} ${String(count)}`);
  }

  const gaps = result.gaps || [];
  if (gaps.length > 0) {
    print(`\n${colors.yellow}GAPS (no cards):${colors.reset}`);
    for (const gap of gaps) {
      print(`  - ${gap}`);
    }
  }
  print('');
}

/**
 * swain card create
 * Create a content card
 */
async function createCard(args: string[]): Promise<void> {
  const params = parseArgs(args);

  // Handle help before requiring agent ID
  if (params['help'] === 'true' || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }

  const jsonOutput = params['json'] === 'true';
  const desk = getDesk(params);
  const marina = params['marina'] || undefined;
  const userId = params['user'] || params['user-id'] || undefined;
  const agentId = getAgentId(params) || `${desk}-desk`;

  const title = params['title'];
  const subtext = params['subtext'];
  const content = params['content'];
  const imageUrl = params['image'];

  // Validate required fields
  if (!title) {
    printError('--title is required');
    process.exit(1);
  }
  if (!subtext) {
    printError('--subtext is required');
    process.exit(1);
  }
  if (!content) {
    printError('--content is required');
    process.exit(1);
  }

  // Image handling: null if not provided (unstyled)
  const finalImage = imageUrl || undefined;
  if (!imageUrl) {
    console.error(`${colors.dim}No --image provided, card will be unstyled${colors.reset}`);
  }

  const summary = params['summary'] || undefined;

  // Parse expires-at: convert ISO date string to unix timestamp
  let expiresAt: number | undefined = undefined;
  if (params['expires-at']) {
    const raw = params['expires-at'];
    const parsed = Number(raw);
    if (!isNaN(parsed) && parsed > 1000000000) {
      expiresAt = parsed;
    } else {
      const date = new Date(raw);
      if (!isNaN(date.getTime())) {
        expiresAt = Math.floor(date.getTime() / 1000);
      } else {
        printError(`Invalid --expires-at value: ${raw}. Use ISO 8601 date or Unix timestamp.`);
        process.exit(1);
      }
    }
  }

  // Build card data (camelCase for Convex)
  const cardData: any = {
    agentId,
    desk,
    marina: marina || undefined,
    userId: userId || undefined,
    type: 'card',
    summary,
    image: finalImage,
    title,
    subtext,
    contentMarkdown: content,
    backgroundColor: safeBgColor(params['bg-color']),
    styleId: params['style-id'] || undefined,
    category: params['category'] || undefined,
    cardDate: params['date'] || getTodayDate(),
    freshness: params['freshness'] || undefined,
    expiresAt,
  };

  // Add structured data if provided
  if (params['data']) {
    try {
      cardData.contentJson = JSON.parse(params['data']);
    } catch (e) {
      printError('Invalid JSON in --data parameter');
      process.exit(1);
    }
  }

  const result = await workerRequest('/cards', {
    method: 'POST',
    body: cardData
  });

  if (jsonOutput) {
    console.log(JSON.stringify({
      success: true,
      cardId: result.cardId,
    }, null, 2));
  } else {
    printSuccess(`Card ${result.cardId} created`);
  }
}

/**
 * swain card update <cardId>
 * Update card fields
 */
async function updateCard(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const cardId = args[0];
  const jsonOutput = params['json'] === 'true';

  if (!cardId || cardId.startsWith('--')) {
    printError('Usage: swain card update <cardId> --field=value');
    process.exit(1);
  }

  // Build update body — only send non-null fields
  const body: Record<string, any> = {};
  if (params['title']) body.title = params['title'];
  if (params['subtext']) body.subtext = params['subtext'];
  if (params['image']) {
    let imageUrl = params['image'];
    // Fix malformed Cloudflare variant paths (e.g. /card/card → /public)
    if (imageUrl.includes('imagedelivery.net/') && !imageUrl.endsWith('/public')) {
      imageUrl = imageUrl.replace(/\/[^/]+\/[^/]+$/, '/public');
    }
    body.image = imageUrl;
  }
  if (params['bg-color']) body.backgroundColor = safeBgColor(params['bg-color']);
  if (params['style-id']) body.styleId = params['style-id'];
  if (params['category']) body.category = params['category'];
  if (params['content']) body.contentMarkdown = params['content'];
  if (params['desk']) body.desk = params['desk'];
  if (params['marina']) body.marina = params['marina'];
  if (params['location']) body.location = params['location'];
  if (params['freshness']) body.freshness = params['freshness'];

  if (params['expires-at']) {
    const raw = params['expires-at'];
    const parsed = Number(raw);
    if (!isNaN(parsed) && parsed > 1000000000) {
      body.expires_at = parsed;
    } else {
      const date = new Date(raw);
      if (!isNaN(date.getTime())) {
        body.expires_at = Math.floor(date.getTime() / 1000);
      } else {
        printError(`Invalid --expires-at value: ${raw}. Use ISO 8601 date or Unix timestamp.`);
        process.exit(1);
      }
    }
  }

  if (Object.keys(body).length === 0) {
    printError('No fields to update. Use --title=X, --location=X, --style-id=X, etc.');
    process.exit(1);
  }

  const result = await workerRequest(`/cards/${cardId}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSuccess(`Card ${cardId} updated`);
    if (result.card) {
      const c = result.card;
      if (c.styleId) print(`  Style:    ${c.styleName || c.styleId}`);
      if (c.category) print(`  Category: ${c.category}`);
      if (c.location) print(`  Location: ${c.location}`);
      if (c.freshness) print(`  Freshness: ${c.freshness}`);
    }
  }
}

/**
 * swain card audit
 * Audit cards for issues
 */
async function auditCards(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const queryParams = new URLSearchParams();
  if (params['agent']) queryParams.append('agentId', params['agent']);
  if (params['location']) queryParams.append('location', params['location']);

  const result = await workerRequest(`/cards/audit?${queryParams}`);
  const { issues, totals } = result;

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (totals.total === 0) {
    printSuccess('No issues found — all cards look good!');
    return;
  }

  print(`\n${colors.bold}CARD AUDIT${colors.reset}  (${totals.total} issues)\n`);

  if (issues.missingLocation.length > 0) {
    print(`${colors.yellow}Missing Location (${issues.missingLocation.length})${colors.reset}`);
    for (const c of issues.missingLocation) {
      print(`  ${c.id}  ${(c.title || '-').slice(0, 40)}  [${c.agentId}]`);
    }
    print('');
  }

  if (issues.missingStyle.length > 0) {
    print(`${colors.yellow}Missing/Default Style (${issues.missingStyle.length})${colors.reset}`);
    for (const c of issues.missingStyle) {
      print(`  ${c.id}  ${(c.title || '-').slice(0, 40)}  style=${c.styleId || 'null'}`);
    }
    print('');
  }

  if (issues.expiredActive.length > 0) {
    print(`${colors.red}Expired but Active (${issues.expiredActive.length})${colors.reset}`);
    for (const c of issues.expiredActive) {
      print(`  ${c.id}  ${(c.title || '-').slice(0, 40)}  expired=${c.expiresAt || '-'}`);
    }
    print('');
  }

  if (issues.missingImage.length > 0) {
    print(`${colors.yellow}Missing/Placeholder Image (${issues.missingImage.length})${colors.reset}`);
    for (const c of issues.missingImage) {
      print(`  ${c.id}  ${(c.title || '-').slice(0, 40)}  image=${(c.image || 'null').slice(0, 30)}`);
    }
    print('');
  }

  print(`${colors.dim}Fix: swain card update <id> --location=X --style-id=X${colors.reset}`);
  print(`${colors.dim}Archive expired: swain card archive <id>${colors.reset}\n`);
}

/**
 * swain card archive <cardId>
 * Soft-archive a card
 */
async function archiveCard(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const cardId = args[0];
  const jsonOutput = params['json'] === 'true';

  if (!cardId || cardId.startsWith('--')) {
    printError('Usage: swain card archive <cardId>');
    process.exit(1);
  }

  const result = await workerRequest(`/cards/${cardId}/archive`, { method: 'POST' });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSuccess(`Card ${cardId} archived at ${result.archivedAt}`);
  }
}

/**
 * swain card unarchive <cardId>
 * Restore an archived card
 */
async function unarchiveCard(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const cardId = args[0];
  const jsonOutput = params['json'] === 'true';

  if (!cardId || cardId.startsWith('--')) {
    printError('Usage: swain card unarchive <cardId>');
    process.exit(1);
  }

  const result = await workerRequest(`/cards/${cardId}/unarchive`, { method: 'POST' });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    printSuccess(`Card ${cardId} unarchived`);
  }
}

/**
 * swain card image <cardId>
 * Generate (or regenerate) card image
 */
async function generateImage(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const cardId = args[0];
  const jsonOutput = params['json'] === 'true';

  if (!cardId || cardId.startsWith('--')) {
    printError('Usage: swain card image <cardId> [--prompt="..."] [--style=X]');
    process.exit(1);
  }

  // 1. Fetch card for context
  const cardResult = await workerRequest(`/cards/${cardId}`);
  const card = cardResult.card;
  if (!card) {
    printError(`Card not found: ${cardId}`);
    process.exit(1);
  }

  const agentPrompt = params['prompt'] || `${card.title}. ${card.subtext}`;
  const styleId = params['style'] || card.styleId || null;
  const aspectRatio = params['aspect-ratio'];
  const resolution = params['resolution'];

  // Build full prompt: agent prompt + style prompt
  let stylePrompt: string | null = null;
  const artStyle = styleId ? ART_STYLES.find((s) => s.id === styleId) : null;
  if (artStyle) {
    stylePrompt = artStyle.prompt;
  } else if (styleId) {
    // Fall back to Convex style catalog
    try {
      const convexStyle = await workerRequest(`/styles/${styleId}`);
      if (convexStyle?.style?.promptText) {
        stylePrompt = convexStyle.style.promptText;
      } else if (convexStyle?.style?.description) {
        stylePrompt = convexStyle.style.description;
      }
    } catch { /* style not found — proceed without */ }
  }
  const combinedPrompt = [agentPrompt, stylePrompt].filter(Boolean).join('. ');

  // Content cards use PROMPT_CARD_CONTEXT (no baked-in title text); styled/art cards use PROMPT_FULL_BLEED
  const suffix = stylePrompt ? PROMPT_FULL_BLEED : PROMPT_CARD_CONTEXT;

  if (!jsonOutput) {
    print(`${colors.dim}Generating image for "${card.title}"...${colors.reset}`);
    print(`${colors.dim}Prompt: ${combinedPrompt.slice(0, 80)}${combinedPrompt.length > 80 ? '...' : ''}${colors.reset}`);
  }

  // 2. Generate image via unified image library
  const result = await generate(combinedPrompt, { suffix, aspectRatio, resolution });
  const imageUrl = result.url;
  const patchBody: Record<string, any> = { image: imageUrl };
  if (params['bg-color']) patchBody.backgroundColor = safeBgColor(params['bg-color']);
  if (styleId) patchBody.styleId = styleId;

  await workerRequest(`/cards/${cardId}`, {
    method: 'PATCH',
    body: patchBody,
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, cardId, imageUrl, replicateId: result.replicateId }, null, 2));
  } else {
    printSuccess(`Card ${cardId} image updated`);
    print(`  Image: ${imageUrl}`);
  }
}

/**
 * swain card boat-art --user=<userId> [--style=<styleId>] [--sampler] [--json]
 *
 * Generate boat art card(s) for a user.
 *   --sampler    Generate a 2-style sampler (onboarding)
 *   --style=X    Generate one image in a specific style
 *   (no flags)   Generate one image in a random style
 *
 * Uses the user's boat photo if available, otherwise text-to-image.
 */
async function boatArt(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['user'];
  const jsonOutput = params['json'] === 'true';
  const isSampler = params['sampler'] === 'true';
  const isBest = params['best'] === 'true';
  const styleParam = params['style'];

  if (!userId) {
    printError('Usage: swain card boat-art --user=<userId> [--style=<styleId>] [--best] [--sampler] [--json]');
    process.exit(1);
  }

  // Dynamic import of image lib
  const {
    ART_STYLES,
    buildBoatArtPrompt,
    generate: generateImg,
    pickRandomStyle,
    pickBestStyle,
    getSamplerStyles,
  } = await import('../lib/image');

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
  const boatImageUrl = boat.primaryPhotoUrl || boat.imageUrl || undefined;
  const hasPhoto = !!boatImageUrl;

  if (!jsonOutput) {
    print(`${colors.dim}Boat: ${boatName} (${boatMakeModel || boatType || 'boat'})${colors.reset}`);
    print(`${colors.dim}Photo: ${hasPhoto ? 'yes' : 'no (text-to-image)'}${colors.reset}`);
  }

  // 2. Determine styles to generate
  let styles: typeof ART_STYLES[number][];
  if (isSampler) {
    styles = getSamplerStyles();
    if (!jsonOutput) print(`${colors.dim}Generating ${styles.length}-style sampler...${colors.reset}`);
  } else if (styleParam) {
    const found = ART_STYLES.find((s: any) => s.id === styleParam);
    if (!found) {
      printError(`Unknown style: ${styleParam}. Available: ${ART_STYLES.map((s: any) => s.id).join(', ')}`);
      process.exit(1);
    }
    styles = [found];
  } else if (isBest) {
    const best = pickBestStyle(boatType, boatMakeModel);
    styles = [best];
    if (!jsonOutput) print(`${colors.dim}Best style for ${boatMakeModel || boatType || 'boat'}: ${best.name}${colors.reset}`);
  } else {
    styles = [pickRandomStyle()];
  }

  // 3. Generate images
  const results: { style: string; styleName: string; image: string; boatName: string }[] = [];

  for (const style of styles) {
    if (!jsonOutput) {
      process.stderr.write(`  ${style.name}...`);
    }

    try {
      const prompt = buildBoatArtPrompt({
        boatName,
        boatType,
        boatMakeModel,
        boatColor,
        style,
        hasPhoto,
      });

      const result = await generateImg(prompt, {
        imageInputUrl: hasPhoto ? boatImageUrl : undefined,
        aspectRatio: '1:1',
      });

      results.push({ style: style.id, styleName: style.name, image: result.url, boatName });

      if (!jsonOutput) {
        print(` ✓ ${style.name}`);
      }
    } catch (err: any) {
      if (!jsonOutput) {
        print(` ✗ ${err.message}`);
      } else {
        results.push({ style: style.id, styleName: style.name, image: '', boatName });
      }
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, boatName, hasPhoto, results }, null, 2));
  } else {
    const successCount = results.filter((r) => r.image).length;
    printSuccess(`Generated ${successCount}/${styles.length} boat art image(s)`);
  }
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain card${colors.reset} - Content cards

${colors.bold}COMMANDS${colors.reset}
  pull                    Pull card candidates for a user (images only by default)
  list                    List/query cards
  list-today              List all cards created today (Eastern Time)
  get <id>                Get card details
  create                  Create a content card
  check                   Check if card exists for desk on date
  update <id>             Update card fields
  audit                   Audit cards for issues
  coverage                Card coverage by category per desk
  archive <id>            Soft-archive a card
  unarchive <id>          Restore an archived card
  image <id>              Generate (or regenerate) card image
  boat-art                Generate boat art card(s) for a user

${colors.bold}OPTIONS (pull)${colors.reset}
  --user=<userId>         User ID (required)
  --exclude-served        Exclude already-served cards
  --category=<name>       Filter by category
  --limit=<n>             Limit results
  --include-no-image      Include cards without images (excluded by default)
  --json                  Output as JSON

${colors.bold}OPTIONS (list)${colors.reset}
  --desk=<name>           Filter by desk (e.g., tampa-bay)
  --category=<name>       Filter by category
  --unstyled              Only show cards with no image (unstyled)
  --limit=<n>             Limit results
  --json                  Output as JSON

${colors.bold}OPTIONS (check)${colors.reset}
  --desk=<name>           Desk name (required)
  --date=<YYYY-MM-DD>     Date to check (defaults to today in Eastern Time)
  --json                  Output as JSON

${colors.bold}OPTIONS (create)${colors.reset}
  --desk=<name>           Desk name (required, or set SWAIN_DESK env var)
  --marina=<string>       Marina/location within desk territory
  --title=<text>          Short headline, 3-6 words (required)
  --subtext=<text>        Preview text, 2-3 sentences (required)
  --content=<markdown>    Full markdown content (required)
  --image=<url>           Image URL (null/unstyled if not provided)
  --date=<YYYY-MM-DD>     Card date (defaults to today in Eastern Time)
  --summary=<text>        Internal description
  --bg-color=<hex>        Background color (e.g., #4A5568)
  --style-id=<id>         Style ID for categorization
  --category=<name>       Bookmark category (weather-tides, fishing, etc.)
  --freshness=<type>      Content freshness: timely or evergreen
  --expires-at=<value>    Expiration (ISO 8601 date or Unix timestamp)
  --data=<json>           Structured JSON data
  --user=<userId>         Tag card for a specific user (advisor-created cards)
  --agent-id=<id>         Agent ID override (defaults to {desk}-desk)
  --json                  Output as JSON

${colors.bold}OPTIONS (update)${colors.reset}
  --title=<text>          Update title
  --subtext=<text>        Update subtext
  --image=<url>           Update image URL
  --bg-color=<hex>        Update background color
  --style-id=<id>         Update style
  --category=<name>       Update category
  --content=<markdown>    Update content markdown
  --desk=<name>           Update desk
  --marina=<string>       Update marina
  --freshness=<type>      Update freshness (timely|evergreen)
  --expires-at=<value>    Update expiration
  --json                  Output as JSON

${colors.bold}OPTIONS (audit)${colors.reset}
  --json                  Output as JSON

${colors.bold}OPTIONS (coverage)${colors.reset}
  --desk=<name>           Filter by desk
  --json                  Output as JSON

${colors.bold}OPTIONS (boat-art)${colors.reset}
  --user=<userId>         User ID (required)
  --best                  Pick ideal style for boat type (use for first briefing)
  --style=<id>            Specific style (30 available; invalid id shows full list)
  --sampler               Generate 2-style sampler
  --agent-id=<id>         Agent ID (defaults to AGENT_ID env var)
  --json                  Output as JSON

${colors.bold}OPTIONS (image)${colors.reset}
  --prompt=<text>             Custom image prompt (default: title + subtext)
  --style=<id>                Style ID (prompt appended automatically)
  --aspect-ratio=<ratio>      Aspect ratio (e.g., 4:3, 16:9, 1:1)
  --resolution=<res>          Resolution: 0.5K, 1K, 2K, 4K (default: 1K)
  --bg-color=<hex>            Set background color along with image
  --json                      Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain card list --desk=tampa-bay
  swain card list --desk=tampa-bay --category=fishing --limit=10
  swain card get card_abc123

  swain card check --desk=tampa-bay --date=2026-02-09 --json
  swain card coverage --desk=tampa-bay --json

  swain card create \\
    --desk=tampa-bay \\
    --marina=tierra-verde \\
    --title="Perfect Boating Weekend" \\
    --subtext="Light winds and calm seas through Sunday." \\
    --content="## Weather Forecast\\n\\nConditions are excellent..." \\
    --image="https://example.com/image.jpg" \\
    --category=weather-tides \\
    --freshness=timely \\
    --expires-at="2026-02-12T00:00:00Z"
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
      case 'pull':
        await pullCards(commandArgs);
        break;
      case 'list':
        await listCards(commandArgs);
        break;
      case 'get':
        await getCard(commandArgs);
        break;
      case 'create':
        await createCard(commandArgs);
        break;
      case 'check':
        await checkCard(commandArgs);
        break;
      case 'list-today':
        await listTodayCards(commandArgs);
        break;
      case 'update':
        await updateCard(commandArgs);
        break;
      case 'audit':
        await auditCards(commandArgs);
        break;
      case 'archive':
        await archiveCard(commandArgs);
        break;
      case 'unarchive':
        await unarchiveCard(commandArgs);
        break;
      case 'coverage':
        await coverageReport(commandArgs);
        break;
      case 'image':
      case 'regen-image':
        await generateImage(commandArgs);
        break;
      case 'boat-art':
        await boatArt(commandArgs);
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
