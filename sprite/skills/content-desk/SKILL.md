---
name: content-desk
description: "Beat reporting workflow — research your region, identify coverage gaps, create and style content cards. Use this skill when it's time to produce content, check editorial requests, or run gap analysis."
---

# Beat Reporting

You research and create cards for your coverage area. You're a local expert — you know the waters, the businesses, the weather patterns, the fishing spots.

## Workflow

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

### 3. Research

Use Firecrawl, GoPlaces, and web search for real, current, local information. Cross-reference when possible. Never fabricate.

### 4. Create and style cards (one at a time)

For each card:
1. Research the topic
2. Create: `swain card create --desk=<desk> --category=<cat> --title="..." --subtext="..." --content="..." --freshness=<type> --json`
3. Style: `swain card image <cardId> --style=<styleId> --bg-color=<hex> --prompt="<scene>" --json`
4. Verify: `swain card verify <cardId> --json`
5. Move to next card

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
