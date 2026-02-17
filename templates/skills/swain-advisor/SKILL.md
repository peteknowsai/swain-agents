---
name: swain-advisor
description: Create personalized daily briefings using the advisor toolkit.
metadata: { "openclaw": { "emoji": "📋", "requires": { "bins": ["swain"] } } }
---

# Daily Briefing Creation

Create a personalized daily briefing for your captain.

## Workflow

1. **Get user profile**
   ```bash
   swain user get {{userId}} --json
   ```

2. **Check yesterday's briefing** (avoid repeating topics)
   ```bash
   swain briefing previous --user={{userId}} --json
   ```
   Returns card IDs and titles from the last briefing. Use this to pick different topics today.

3. **Pull fresh card candidates**
   ```bash
   swain card pull --user={{userId}} --exclude-served --json
   ```
   Returns lightweight card summaries (no full content) sorted by relevance: timely first, then evergreen. Only cards the captain hasn't seen before.

4. **Get captain context from memory**
   ```
   honcho_context
   ```
   This returns Honcho's representation of your captain — their interests, boat, preferences, everything you've learned. Use this to guide card selection.

5. **Generate today's boat art**
   ```bash
   swain card boat-art --user={{userId}} --json
   ```
   This creates a card with stylized art of the captain's boat. Include it in every briefing. Read the **swain-boat-art** skill for style options.

6. **Select 5-8 cards** based on:
   - **Prioritize timely cards** that are still valid today (check `expires_at`)
   - **Mix in evergreen cards** the captain hasn't seen yet
   - **Match the captain's interests** from Honcho context
   - **Avoid repeating** cards from yesterday's briefing

7. **Flag content gaps** — If your captain cares about something and the library
   doesn't have it, tell Mr. Content. Just message him directly:
   ```
   sessions_send(sessionKey="agent:mr-content:main", message="My captain [name] is into [topic] around [location] but I can't find anything in the library on it. Would be great to get some content on this.")
   ```
   Mr. Content coordinates the content desks — he'll route it to the right one.
   Don't overthink it. If something's missing, just say so.

8. **Read full card content** for each selected card:
   ```bash
   swain card get <cardId> --json
   ```
   Read each card to understand the content before writing your commentary.

9. **Build briefing items** as a JSON array:
   - Start with a greeting text item (personalized, 1-2 sentences)
   - For each selected card: add a commentary text item, then a card reference
   - End with a closing note text item

10. **Assemble the briefing**
   ```bash
   swain briefing assemble --user={{userId}} --items='<json_array>' --json
   ```
   The server validates cards, fills in full card data, and marks them as served.

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
