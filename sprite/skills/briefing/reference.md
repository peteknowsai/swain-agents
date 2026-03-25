# Briefing — Detailed Workflow Reference

## Step-by-Step

### 1. Get captain context
```bash
swain user get <userId> --json
swain boat profile --user=<userId> --json
```
Read `.claude/memory/` for personality, preferences, recent conversations.

### 2. Check yesterday's briefing
```bash
swain briefing previous --user=<userId> --json
```

### 3. Check liked flyers
```bash
swain flyer list --user=<userId> --status=liked --json
```
For each liked flyer, research deeper and create a personalized card.

### 4. Pull card candidates
```bash
swain card pull --user=<userId> --exclude-served --json
```

### 5. Fill gaps (if fewer than 9 candidates)
Research topics the captain cares about, create cards one at a time:
```bash
swain card create --desk=<desk> --user=<userId> \
  --category=<cat> --title="..." --subtext="..." \
  --content="..." --freshness=<type> --json
```

### 6. Generate boat art
```bash
swain card boat-art --user=<userId> --json
```

### 7. Style every card

Browse styles:
```bash
swain style list --json
```

For each card missing an image:
```bash
swain card image <cardId> --style=<styleId> --bg-color=<hex> \
  --prompt="<scene description>" --json
```

Verify all cards:
```bash
swain card verify <cardId1> <cardId2> ... --json
```

### 8. Assemble
```bash
swain briefing assemble --user=<userId> --items='<json_array>' --json
```

## Briefing Item Types

| Type | Fields | Purpose |
|------|--------|---------|
| `greeting` | `content` | Opening — always first |
| `text` | `content` | Commentary between cards |
| `card` | `id` | Card reference — server hydrates |
| `boat_art` | `image`, `styleName`, `boatName` | Daily boat art |
| `closing` | `content` | Sign-off — always last |
| `survey` | `id`, `field`, `options` | Single-select question |
| `multi_select` | `id`, `field`, `options` | Multi-select question |
| `text_input` | `id`, `field`, `placeholder?` | Free text input |
| `photo_upload` | — | Ask for a photo |

**Important:** `survey`, `multi_select`, and `text_input` have NO `prompt` or `question` field. Put contextual copy in a preceding `text` item.

## Ordering

greeting → text + card pairs → interactive items woven in → boat art → closing

## Example

```json
[
  { "type": "greeting", "content": "Morning, Bobby!" },
  { "type": "text", "content": "Conditions look perfect for your usual run." },
  { "type": "card", "id": "card_weather_123" },
  { "type": "text", "content": "Redfish have been stacking up near the mangroves." },
  { "type": "card", "id": "card_fishing_456" },
  { "type": "boat_art", "image": "https://...", "styleName": "Watercolor", "boatName": "Sea Dog" },
  { "type": "closing", "content": "Tight lines, Captain." }
]
```
