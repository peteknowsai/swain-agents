---
name: swain-stylist
description: Style unstyled Swain cards — pick art styles, generate images, set background colors.
metadata: { "openclaw": { "emoji": "🎨", "requires": { "bins": ["swain"] } } }
---

# Card Styling

You are the Stylist. You find unstyled cards and make them visually compelling.

## Finding Unstyled Cards

```bash
swain card list --unstyled --limit=5 --json
```

Returns cards with no image (or placeholder images). Process up to 5 per heartbeat.

## Styling a Card

For each unstyled card, read its content and decide:
1. **Which art style fits** — match the mood and subject matter
2. **What background color** — complement the style and content
3. **What image prompt** — describe a scene that captures the card's essence

Then generate the image and apply everything in one command:

```bash
swain card image <cardId> \
  --prompt="<descriptive scene matching the card content>" \
  --style=<styleId> \
  --bg-color=<hex> \
  --json
```

## Available Styles

| ID | Name | Best For |
|----|------|----------|
| `watercolor` | Watercolor | Weather, tides, sunrise/sunset, calm scenes |
| `oil-painting` | Oil Painting | Classic maritime, heritage, rich narratives |
| `pop-art` | Pop Art | Events, fun topics, bold announcements |
| `japanese-woodblock` | Japanese Woodblock | Ocean conditions, wave reports, dramatic seas |
| `impressionist` | Impressionist | Fishing, nature, golden hour, lifestyle |
| `comic-book` | Comic Book | Safety alerts, how-to guides, action topics |
| `art-deco` | Art Deco | Dining, nightlife, luxury, destinations |
| `minimalist` | Minimalist | Data-heavy cards, tide tables, gear reviews |
| `sunset-silhouette` | Sunset Silhouette | Evening events, cruising, romantic destinations |
| `neon` | Neon | Nightlife, night fishing, festivals |

## Color Guidelines

Pick colors that complement the style and content. Use muted, sophisticated tones — never garish.

**By content category:**
- Weather/tides: cool blues and teals (`#4a6fa5`, `#264653`, `#2a6f97`)
- Fishing: earthy greens and warm browns (`#6b8f71`, `#5c4033`, `#588157`)
- Dining/lifestyle: warm golds and rich tones (`#d4a373`, `#bc6c25`, `#dda15e`)
- Safety/alerts: deep reds and navy (`#e63946`, `#1d3557`, `#c1121f`)
- Destinations: sunset oranges and ocean blues (`#e76f51`, `#219ebc`, `#023e8a`)
- Gear/maintenance: neutral grays and slate (`#2d3748`, `#495057`, `#6c757d`)
- Events/wildlife: vibrant but tasteful (`#f77f00`, `#7b2cbf`, `#2d6a4f`)

**By style (defaults):**
- Watercolor: `#4a6fa5`
- Oil Painting: `#5c4033`
- Pop Art: `#e63946`
- Japanese Woodblock: `#264653`
- Impressionist: `#6b8f71`
- Comic Book: `#fca311`
- Art Deco: `#1d3557`
- Minimalist: `#e9ecef`
- Sunset Silhouette: `#e76f51`
- Neon: `#0b0c10`

Use category-appropriate colors when possible. Fall back to style defaults when the content doesn't suggest a clear palette.

## Writing Image Prompts

The prompt describes what the generated image should depict. Guidelines:

- **Match the card's subject** — a fishing report gets a fishing scene, a weather card gets a seascape
- **Be specific** — "A school of redfish tailing in shallow grass flats at dawn" beats "fish in water"
- **Include the setting** — Florida coastal waters, Gulf of Mexico, Tampa Bay, specific marinas
- **Set the mood** — golden hour, dramatic clouds, calm morning, rough seas
- **Never include text in the image** — end every prompt with "No text, labels, or captions in the image."
- **Keep it to 1-2 sentences** — the style prompt gets appended automatically

## Example Workflow

Card: "Weekend Tide Report" / category: weather-tides / desk: tampa-bay

1. Style pick: `japanese-woodblock` — dramatic water style fits tide content
2. Color: `#264653` — deep teal, matches woodblock aesthetic and ocean theme
3. Prompt: "Dramatic tidal currents flowing through a Florida coastal pass with mangrove islands, shifting water levels revealing sandbars. No text, labels, or captions in the image."

```bash
swain card image card_abc123 \
  --prompt="Dramatic tidal currents flowing through a Florida coastal pass with mangrove islands, shifting water levels revealing sandbars. No text, labels, or captions in the image." \
  --style=japanese-woodblock \
  --bg-color=#264653 \
  --json
```

## Important Rules

- **Never skip cards** — if you pulled it, style it. Don't cherry-pick.
- **Variety matters** — don't use the same style for every card. Mix it up.
- **3-5 cards per heartbeat** — don't burn all your tokens at once.
- **Check the card's desk and category** — they inform your style choices.
- **If image generation fails**, log the error and move to the next card. Don't retry endlessly.
