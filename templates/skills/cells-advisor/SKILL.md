---
name: cells-advisor
description: Create personalized daily briefings using the advisor toolkit.
metadata: { "openclaw": { "emoji": "📋", "requires": { "bins": ["cells"] } } }
---

# Daily Briefing Creation

Create a personalized daily briefing for your captain.

## Workflow

1. **Get user profile**
   ```bash
   cells user get {{userId}} --json
   ```

2. **Check yesterday's briefing** (avoid repeating topics)
   ```bash
   cells briefing previous --user={{userId}} --json
   ```
   Returns card IDs and titles from the last briefing. Use this to pick different topics today.

3. **Pull fresh card candidates**
   ```bash
   cells card pull --user={{userId}} --exclude-served --json
   ```
   Returns lightweight card summaries (no full content) sorted by relevance: timely first, then evergreen. Only cards the captain hasn't seen before.

4. **Select 5-8 cards** based on:
   - **Prioritize timely cards** that are still valid today (check `expires_at`)
   - **Mix in evergreen cards** the captain hasn't seen yet
   - **Match the captain's interests** and known preferences
   - **Read your memory** for context on what they've liked before
   - **Avoid repeating** cards from yesterday's briefing

5. **Read full card content** for each selected card:
   ```bash
   cells card get <cardId> --json
   ```
   Read each card to understand the content before writing your commentary.

6. **Build briefing items** as a JSON array:
   - Start with a greeting text item (personalized, 1-2 sentences)
   - For each selected card: add a commentary text item, then a card reference
   - End with a closing note text item

7. **Assemble the briefing**
   ```bash
   cells briefing assemble --user={{userId}} --items='<json_array>' --json
   ```
   The server validates cards, fills in full card data, and marks them as served. Add `--force` to replace an existing briefing for the same date.

## Briefing Item Types

```json
// Text item (greeting, commentary, closing)
{ "type": "text", "content": "Your personalized message here" }

// Card reference (server hydrates full card data)
{ "type": "card", "id": "card_abc123" }
```

You do NOT need to include card titles, images, or content in the items — just the card ID. The server fills in everything.

## Commentary Guidelines

Your commentary for each card should:
- Be 1-2 sentences, warm and personal
- Reference the captain's boat, marina, or interests when relevant
- Explain why this card matters to THEM specifically
- Feel like a knowledgeable friend at the marina

## Example Briefing Structure

```json
[
  { "type": "text", "content": "Morning, Bobby! Looks like a great day to get out on the water." },
  { "type": "text", "content": "Conditions are looking perfect for your usual run out of Tierra Verde." },
  { "type": "card", "id": "card_weather_123" },
  { "type": "text", "content": "The redfish have been active near the mangroves this week." },
  { "type": "card", "id": "card_fishing_456" },
  { "type": "text", "content": "Have a great day on the water! Check back tomorrow for updated conditions." }
]
```
