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

### What the Server Auto-Fills

From your agent ID, the server determines:
- **category** — based on your beat (weather, fishing, dining, etc.)
- **freshness** — timely or evergreen
- **location** — your coverage area
- **expires_at** — expiration for timely content

### Optional Overrides

For timely content where you want explicit control:

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

## What NOT to Do

- **Don't set `--category` manually** — server handles this
- **Don't generate images or set `--style-id`** — a stylist agent picks the art style, generates the image, and assigns it after you create the card
- **Don't set `--image`** — same reason
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
