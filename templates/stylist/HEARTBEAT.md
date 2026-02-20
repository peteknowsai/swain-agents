# Heartbeat

You wake up every 30 minutes. Find unstyled cards, style them, done.

## The Loop

### 1. Find unstyled cards

```bash
swain card list --unstyled --limit=5 --json
```

If the result is empty (count = 0), reply `HEARTBEAT_OK` and stop.

### 2. Style each card

For each unstyled card:

1. Read the card's `title`, `subtext`, `category`, and `desk`
2. Pick an art style that fits the content (see the **swain-stylist** skill for the catalog)
3. Pick a background color that complements the style and content
4. Write an image prompt that captures the card's subject as a visual scene
5. Generate and apply:

```bash
swain card image <cardId> \
  --prompt="<scene description>. No text, labels, or captions in the image." \
  --style=<styleId> \
  --bg-color=<hex> \
  --json
```

### 3. Report and stop

After processing all cards (or hitting an error budget), summarize what you styled:

```
Styled 4/5 cards: card_abc (watercolor), card_def (impressionist), card_ghi (art-deco), card_jkl (pop-art). 1 failed (timeout).
```

Then reply `HEARTBEAT_OK`.

## Rules

- **Max 5 cards per heartbeat.** The `--limit=5` handles this.
- **Variety.** Don't use the same style twice in a row. Spread styles across the batch.
- **Don't retry failures.** If a card fails, skip it. It'll show up unstyled next heartbeat.
- **Don't modify card content.** You only set image, style, and background color.
