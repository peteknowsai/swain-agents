---
name: card-hygiene
description: "Find and fix cards that are missing images or have other quality issues. Run daily to clean up after failed image generations."
---

# Card Hygiene

Find cards on your desk that are missing images and fix them.

## Workflow

1. **List cards missing images**
```bash
swain card list --desk=<your-desk> --json
```
Filter for cards where `imageUrl` is null/empty.

2. **Style each card** — generate an image and set backgroundColor
```bash
swain style list --json
swain card image <cardId> --style=<styleId> --bg-color=<hex> \
  --prompt="<scene description based on card title and content>" --json
```

3. **Verify**
```bash
swain card verify <cardId> --json
```

## Rules

- Only fix cards on YOUR desk
- Max 5 cards per run (don't burn through the image budget)
- Pick a style that matches the card's category and tone
- Write a specific image prompt — reference the actual content, not generic scenes
- If image generation fails, skip the card and move on — next run will catch it
