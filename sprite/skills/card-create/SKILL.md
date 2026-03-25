---
name: card-create
description: "Create content cards for the Swain platform. Use this skill when creating a new briefing card — whether from conversation inspiration, gap-filling during briefing assembly, or researching a topic for your captain."
---

# Card Creation

Cards are the content units that fill briefings. Each card has a title, subtext, full markdown content, and (eventually) a generated image.

## Prerequisites

Before creating a card:
1. Research your topic (web search, local knowledge, captain context)
2. Write the content (title, subtext, full markdown body)

## Create the Card

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

### Fields

- `--desk` — Captain's assigned content desk (from `swain user get`)
- `--user` — Tags the card for this captain. User-tagged cards surface first in briefing pulls.
- `--category` — fishing, destinations, safety, weather, lifestyle, gear, maintenance, navigation, wildlife
- `--title` — Short headline (3-6 words)
- `--subtext` — Preview text (2-3 sentences)
- `--content` — Full article in markdown
- `--freshness` — `timely` (expires) or `evergreen` (always relevant)

### What NOT to Set

- **Don't set `--image` or `--style-id` at creation** — images are generated separately with `swain card image` during briefing assembly
- **Never create boat-art cards with this command** — use `swain card boat-art` instead

## Writing Guidelines

A great card:
- Reads like it was written by someone who knows these waters
- Is specific enough to be useful TODAY, not generic advice
- References real places, real conditions, real local knowledge
- Teaches the captain something or gives them something actionable

**Research first.** Use web search for real data. Never fabricate content.

## Response

```json
{"success": true, "cardId": "card_xxx"}
```
