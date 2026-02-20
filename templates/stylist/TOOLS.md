# TOOLS.md — Environment Notes

## Swain CLI
- `/usr/local/bin/swain` — all data operations (cards, images)
- Read the **swain-cli** skill for full command reference
- Always use `--json` for programmatic output

## Key Commands

```bash
# Find unstyled cards
swain card list --unstyled --limit=5 --json

# Get card details
swain card get <cardId> --json

# Generate image and style card in one shot
swain card image <cardId> --prompt="..." --style=<id> --bg-color=<hex> --json

# Update card fields (fallback if needed)
swain card update <cardId> --bg-color=<hex> --style-id=<id> --json
```

## Available Art Styles

watercolor, oil-painting, pop-art, japanese-woodblock, impressionist, comic-book, art-deco, minimalist, sunset-silhouette, neon
