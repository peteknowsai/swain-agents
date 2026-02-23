#!/usr/bin/env bun
/**
 * One-off script to backfill promptText for 13 Convex styles that have
 * descriptions but empty promptText. Run from cli/:
 *
 *   bun scripts/backfill-style-prompts.ts [--dry-run]
 *
 * Uses `swain style update` under the hood.
 */

import { workerRequest, print, printError, printSuccess, colors } from '../lib/worker-client';

const BACKFILL: Record<string, string> = {
  'default': 'mid-century modern illustration with warm muted colors, clean geometric shapes, retro travel poster aesthetic with soft grain texture and limited color palette',

  'style_cool-ocean-minimal': 'clean minimal illustration with cool ocean blues and seafoam greens, simple geometric shapes, lots of negative space, soft matte finish with subtle paper texture',

  'style_earth-tone-detailed': 'richly detailed illustration in warm natural earth tones — umber, sienna, olive, ochre — with fine linework, naturalist style, textured paper background',

  'style_grainy-earth': 'risograph-style print with earthy warm palette — terracotta, sage green, dusty gold — heavy grain texture, overlapping color layers, slight misregistration',

  'style_kids-boat-adventure': 'children\'s crayon and marker illustration style, bright cheerful colors, wobbly hand-drawn lines, playful and whimsical with thick outlines and imperfect fills',

  'style_line-art-sunset': 'clean continuous line drawing with warm sunset palette — coral, amber, soft pink — minimal fills, elegant single-weight strokes on cream background',

  'style_marina-crowd-scene': 'densely packed Where\'s Waldo style illustration of a busy marina, dozens of tiny detailed characters and boats, vibrant colors, overhead perspective, humorous hidden details',

  'style_minimal-line-earth': 'minimal single-line art in earth tones, sparse elegant strokes, lots of white space, occasional muted color accent, Japanese sumi-e influenced simplicity',

  'style_ocean-watercolor': 'flowing wet-on-wet watercolor in ocean blues and teals, soft bleeding edges, transparent color washes layered over pencil sketch, dreamy coastal atmosphere',

  'style_risograph-ocean': 'risograph print aesthetic in cool ocean tones — navy, teal, cyan — heavy halftone grain, two-color overprint, retro zine feel with slight misregistration',

  'style_textured-sunset': 'golden hour illustration with visible paper texture, warm amber and burnt orange palette, screenprint-style layered colors, soft atmospheric depth',

  'style_warm-watercolor': 'soft watercolor painting in warm sunset colors — peach, coral, golden yellow — gentle color bleeds, visible brushstrokes, cotton paper texture, luminous light',

  'style_watercolor-daylight': 'airy watercolor in natural daylight colors — soft greens, sky blue, warm white — light transparent washes, pencil underdrawing showing through, fresh and bright',
};

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  if (dryRun) {
    print(`\n${colors.bold}DRY RUN — no changes will be made${colors.reset}\n`);
  }

  let updated = 0;
  let failed = 0;

  for (const [styleId, promptText] of Object.entries(BACKFILL)) {
    print(`${colors.dim}${styleId}${colors.reset}`);
    print(`  → ${promptText.slice(0, 80)}...`);

    if (dryRun) {
      print(`  ${colors.dim}(skipped — dry run)${colors.reset}\n`);
      continue;
    }

    try {
      await workerRequest(`/styles/${styleId}`, {
        method: 'PATCH',
        body: { promptText },
      });
      printSuccess(`  updated\n`);
      updated++;
    } catch (err: any) {
      printError(`  FAILED: ${err.message}\n`);
      failed++;
    }
  }

  print(`\n${colors.bold}Done.${colors.reset} Updated: ${updated}, Failed: ${failed}, Total: ${Object.keys(BACKFILL).length}`);
}

main().catch((err) => {
  printError(err.message);
  process.exit(1);
});
