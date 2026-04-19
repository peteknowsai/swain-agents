---
name: content-desk
description: "Beat reporting workflow — research your region, identify coverage gaps, create and style content cards. Use this skill when it's time to produce content, check editorial requests, or run gap analysis."
---

# Beat Reporting

You research and create cards for your coverage area. You're a local expert — you know the waters, the businesses, the weather patterns, the fishing spots.

## Workflow

### 0. Status + bootstrap check

```bash
swain desk get <your-desk> --json
```

**Check `status` first.** The backend cascades desk pause from captain pauses — a desk is paused whenever every captain on it is paused or deleted.

- `status: "active"` → continue
- `status: "paused"` → **exit immediately.** Don't pull sources, don't check editorial requests, don't hit coverage. No captains on this desk want fresh content right now. The desk auto-resumes the moment any captain on it comes back, so your next scheduled run will pick up naturally.

Then check bootstrap: if `microlocations` is empty, run the `desk-bootstrap` skill first, then come back here.

### 1. Check editorial requests

```bash
swain desk requests --desk=<your-desk> --status=pending --json
```

Requests are signals from advisors about what captains are asking for. Not card orders — use them to prioritize.

### 2. Identify coverage gaps

```bash
swain card coverage --desk=<your-desk> --json
```

Cover these categories:
- **weather-tides** — forecasts, tide tables, wind patterns
- **fishing-reports** — what's running, where, regulations
- **activities-events** — local events, regattas, festivals
- **maintenance-care** — seasonal tips, product recommendations
- **safety-regulations** — regulatory changes, advisories
- **routes-navigation** — cruising routes, anchorages, hazards
- **wildlife-nature** — marine life, environmental conditions

Prioritize: zero coverage → low coverage → stale timely content → request themes.

### 3. Create, style, and verify cards — ONE AT A TIME

Do not parallelize card creation. Do not spawn subagents. Work through each card sequentially:

**For each card (complete all steps before starting the next):**

1. **Research** — one or two quick web searches on the topic. Don't over-research. Use WebSearch for facts, firecrawl for deeper scraping only if needed.

2. **Write and create** the card:
   ```bash
   swain card create --desk=<desk> --category=<cat> --title="..." --subtext="..." --content="..." --freshness=<type> --json
   ```

3. **Style immediately** — pick a style, write a scene prompt, pick a dark background color:
   ```bash
   swain card image <cardId> --style=<styleId> --bg-color=<hex> --prompt="<specific scene description>" --json
   ```
   This generates an image via Gemini and uploads to Cloudflare. Takes ~30 seconds.

4. **Verify** the card has both image and backgroundColor:
   ```bash
   swain card verify <cardId> --json
   ```
   If it fails, retry the image once. If still fails, move on.

5. **Move to the next card.** Do not start the next card until this one is fully styled and verified.

**Speed matters.** Each card should take 2-3 minutes total. Three cards in under 10 minutes. Don't do exhaustive multi-source research — a quick search and your own knowledge is enough.

### 5. Mark requests fulfilled

```bash
swain desk fulfill --desk=<desk> --request=<requestId> --card=<cardId> --json
```

### 6. Update region knowledge

If research reveals new microlocations, marinas, or facilities:
```bash
swain desk update <desk> --microlocations='[...]' --marinas='[...]' --json
```

## Card Quality

- **Specific > generic** — "Redfish near Weedon Island" not "Fishing is good"
- **Locally grounded** — real places, real conditions
- **Actionable** — captain can act on it
- **Research-backed** — real data, not guesses
- **Max 3 cards per run** — quality over quantity

## Memory

Write what you learn about your region to memory files. Coverage patterns, seasonal knowledge, reliable sources, local contacts. The dream cycle organizes it. Your regional expertise grows over time.
