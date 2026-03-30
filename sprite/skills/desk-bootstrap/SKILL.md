---
name: desk-bootstrap
description: "First-run self-population for content desks. Discovers marinas, facilities, and microlocations in the desk's coverage area using Places API and web research, then pushes to Convex. Idempotent — exits if already populated."
user-invocable: false
---

# Desk Bootstrap

First-run setup for a new content desk. Discovers your coverage area and populates Convex with microlocations and marinas so advisors can match captains to your region.

## Step 1: Check if needed

```bash
swain desk get <your-desk> --json
```

If `microlocations` is non-empty, you're already bootstrapped. **Stop here** — return to whatever skill triggered you.

## Step 2: Discover facilities

Use your desk's center coordinates from CLAUDE.md. Search for facilities in your coverage area:

```bash
goplaces search "marina" --lat=<lat> --lng=<lon> --radius-m=25000 --json
goplaces search "boat ramp" --lat=<lat> --lng=<lon> --radius-m=25000 --json
goplaces search "yacht club" --lat=<lat> --lng=<lon> --radius-m=15000 --json
goplaces search "fuel dock" --lat=<lat> --lng=<lon> --radius-m=25000 --json
```

If `goplaces` is not installed, use WebSearch instead: search for "marinas near [region]", "boat ramps [region]", etc.

## Step 3: Research context

Use WebSearch and firecrawl to learn about your region:
- Local boating regulations and no-wake zones
- Tide and weather patterns (tidal range, prevailing winds, seasons)
- Seasonal fishing — what species, when, where
- Notable anchorages, cruising routes, hazards
- Local events, regattas, festivals

Keep it practical — you're building baseline knowledge, not writing a book.

## Step 4: Compile microlocations

From your research, build a list of distinct geographic features within your coverage area — the neighborhoods of your beat:

- Harbors and ports
- Islands and keys
- Towns and waterfront neighborhoods
- Inlets, passes, and channels
- Bays, coves, and anchorages
- Rivers, creeks, and canals

Each microlocation: `{ "name": "...", "type": "...", "notes": "..." }`

Aim for 5-15 microlocations. These are the places captains actually go and talk about.

## Step 5: Compile marinas

From your facility discoveries, build a marinas list with useful details:

Each marina: `{ "name": "...", "type": "...", "notes": "..." }`

Types: full-service, dry-storage, fuel, ramp, yacht-club

Include what matters: slip count, fuel availability, location within your coverage area.

## Step 6: Push to Convex

```bash
swain desk update <your-desk> \
  --microlocations='[{"name":"...","type":"...","notes":"..."}, ...]' \
  --marinas='[{"name":"...","type":"...","notes":"..."}, ...]' \
  --status=active \
  --json
```

## Step 7: Write to memory

Save what you learned to `.claude/memory/` files:
- Regional overview (geography, weather patterns, seasons)
- Key marinas and facilities
- Fishing patterns and regulations
- Reliable information sources you found

This becomes your baseline knowledge for future card production.

## Step 8: Initial cards (up to 5)

Now produce your first batch of content. Use the `content-desk` skill workflow, but with an elevated limit of 5 cards. Prioritize:

1. Current weather/tides overview
2. Top marinas guide
3. Local regulations summary
4. Fishing report or seasonal activity
5. Navigation or anchorage guide
