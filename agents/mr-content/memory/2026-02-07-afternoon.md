# 2026-02-07 Afternoon Session

## Stylist Agent Spec
- Spec at `~/Projects/skip/specs/auto-style-assignment.md` — on dev, pushed
- Stylist is a Claude Agent SDK agent (like beat reporters), NOT OpenClaw
- Advisors ARE OpenClaw agents — different architecture. Don't confuse them.
- Stylist responsibilities: pick style, generate image, pick dark background color (from image analysis)
- Background color: use Haiku vision to analyze the actual card image and pick a complementary dark color — NOT a static style-to-color map
- Variation tracking: check `usageCount` on styles + recent styled cards filter
- Worktree ready: `~/Projects/skip-worktrees/stylist-agent` on `feature/stylist-agent`
- Also `~/Projects/skip-worktrees/auto-style-assignment` on `feature/auto-style-assignment` (older, may be stale)

## Categories — Canonical 10 (SHIPPED to dev)
- `weather`, `fishing`, `safety`, `destinations`, `dining`, `events`, `maintenance`, `regulations`, `port32`, `lifestyle`
- Beat config auto-populates category server-side from agent ID prefix
- Briefing system checks `weather` (was `weather-tides`, updated everywhere)
- All 170 active cards recategorized, zero nulls
- PR #73 merged to dev, server restarted and confirmed working
- **Reporters can't override category with garbage anymore** — `autoPopulateCardMetadata` now handles category

## Style Fixes Done
- 41 cards had ghost style IDs (reporters hallucinated them) — all mapped to real styles
- 25 cards on "Classic Card" default — manually reassigned (earlier session)
- Ghost style `storm-drama` (missing `style_` prefix) fixed on crystal coast weather card

## Style Example Images
- 120/135 styles have Cloudflare-hosted example images
- 15 still need generation (NanoBanana was down — 404, cookies expired)
- Pete fixed NanoBanana with built-in fallback to Replicate
- Server bug: `regenerate-example` endpoint uses `nanobanana --json` without `-c` flag → saves to localhost. Fix needed: add `-c` and use `result.url` instead of constructing localhost URL. (2 lines in router.ts ~line 2177 and 2206)
- Upload script at `/tmp/upload-style-examples.sh` — uploads localhost images to CF and updates DB directly

## Background Colors
- Old fallback was `#FFFFFF` (white) in briefing assembly → changed to `#1E293B` on dev
- Pete wants colors picked from actual card image, not style-based mapping
- Haiku vision works for this — tested, returns unique hex per image
- Sub-agent `stylist-bg-colors` dispatched to process all 161 cards with real images
- For future: stylist agent should use Haiku to pick bg color after generating the image

## Beat Reporter Changes (SHIPPED to dev)
- Reporters run on Sonnet 4.5 (`claude-sonnet-4-5-20250929`) — keeping for now
- Beat toolkit rewritten: reporters own their beat, research independently, make editorial calls
- Reporters told NOT to pick styles or categories — server/stylist handle those
- `nanobanana -c` flag emphasized (always upload to Cloudflare)
- skip-cli skill updated: removed old category list, removed style-id from examples
- My dispatch philosophy changed: give direction not dictation. Less prescriptive prompts.
- All shared skills symlinked from `agents/_shared/skills/` — updating the shared copy updates everyone
- Provisioner creates symlinks automatically for new agents

## Weather Cards — Critical for Briefings
- Dispatched 5 fresh weather cards for all markets (Tampa Bay, SW FL, SE FL, NE FL, Crystal Coast)
- Tampa Bay weather card was expired — Bobby's briefing had zero weather
- Only 4 weather cards existed before dispatch; now have fresh ones for all 5 markets
- Daily weather production is critical — briefing system warns when `weather` category missing
- Need to ensure cron jobs fire daily for weather beats

## Server/Infra
- Dev server at localhost:8787 — goes down and needs restart periodically
- Commodore's briefing system v2 shipped (PR #72)
- Commodore already had `finalCategory` auto-populate and `weather` (not `weather-tides`) in his PR
- Server needs restart after code changes to pick up new beat-config.ts

## Commits on dev
- `071027e` — canonical categories, agentic reporter toolkit, stop reporters picking styles (PR #73)
- `df1145f` — dark fallback for card backgroundColor, add bg color to stylist spec
