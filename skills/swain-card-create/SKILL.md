---
name: swain-card-create
description: Create content cards for the Swain platform. Used by beat reporters after researching and writing.
metadata: { "openclaw": { "emoji": "🃏", "requires": { "bins": ["swain"] } } }
---

# Card Creation

Create a content card after completing your research and writing workflow.

## Prerequisites

Before creating a card, you must have:
1. Researched your topic (web search, data APIs, local sources)
2. Written the content (title, subtext, full markdown body)

**Do NOT skip to card creation.** Follow your CLAUDE.md workflow first.

## Create the Card

```bash
swain card create \
  --agent-id="$AGENT_ID" \
  --title="Your Title" \
  --subtext="Brief preview text" \
  --content="Full markdown content..." \
  --json
```

### What You Set

- `--title` — Short headline (3-6 words)
- `--subtext` — Preview text (2-3 sentences)
- `--content` — Full article in markdown

### Desk Agents — Server Auto-Fill

When a desk agent creates a card with `--agent-id`, the server determines:
- **category** — based on your beat (weather, fishing, dining, etc.)
- **freshness** — timely or evergreen
- **location** — your coverage area
- **expires_at** — expiration for timely content

Optional overrides for timely content:

```bash
swain card create \
  --agent-id="$AGENT_ID" \
  --title="Weekend Fishing Report" \
  --subtext="Snook stacked on channel edges through Sunday" \
  --content="## Inshore Report\n\n..." \
  --freshness=timely \
  --expires-at="2025-02-07T06:00:00Z" \
  --location=tierra-verde \
  --json
```

### Advisor Cards

Advisors create cards in two situations:
1. **During heartbeats** — conversation-inspired content (captain mentioned a topic worth exploring)
2. **During briefing assembly** — gap-filling when the pull doesn't return enough candidates

Advisors set fields explicitly (no auto-fill from agent ID):

```bash
swain card create \
  --desk=<captain's regional desk> \
  --user=<userId> \
  --category=<category> \
  --title="<short headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full markdown>" \
  --freshness=<timely|evergreen> \
  --json
```

- `--desk` — The captain's assigned content desk (from `swain user get`)
- `--user` — Tags the card for a specific captain. User-tagged cards surface first in pull results.
- `--category` — Set manually: fishing, destinations, safety, weather, lifestyle, gear, maintenance, navigation, wildlife
- `--freshness` — Set manually: `timely` or `evergreen`

**Research first.** Use `firecrawl search` / `firecrawl scrape` for real data. Create cards one at a time. Never fabricate content.

## What NOT to Do

- **Desk agents: don't set `--category` manually** — server determines it from your agent ID. (Advisors set it explicitly — see above.)
- **Don't set `--image` or `--style-id` at creation time** — images are generated separately with `swain card image` during briefing assembly
- **NEVER create boat-art cards with this command** — use `swain card boat-art` instead. It auto-sets `styleId`, `backgroundColor`, and proper metadata that iOS needs for art display mode. Manual boat-art cards will render broken.

## Response

```json
{"success": true, "cardId": "card_xxx"}
```

## Writing Guidelines

A great card:
- Reads like it was written by someone who knows these waters
- Is specific enough to be useful TODAY, not generic advice
- References real places, real conditions, real local knowledge
- Naturally mentions Port32 if relevant — never forced
- Teaches the captain something or gives them something actionable
