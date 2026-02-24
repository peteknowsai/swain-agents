---
name: swain-content-desk
description: Beat reporting workflow for content desk agents.
metadata: { "openclaw": { "emoji": "📰", "requires": { "bins": ["swain"] } } }
---

# Beat Reporting

You are a content desk. You research and create cards for your region.

## Workflow

### 1. Check editorial requests

```bash
swain desk requests --desk=<your-desk> --status=pending --json
```

These are editorial signals from advisors — topics captains in your region are
asking about. They're not card orders. Use them to inform what you write and
prioritize your gap analysis.

### 2. Identify coverage gaps

```bash
swain card coverage --desk=<your-desk> --json
```

Every desk should cover these categories:
- **weather-tides** — conditions, forecasts, tide tables, wind patterns
- **fishing-reports** — what's running, where, seasonal patterns, regulations
- **activities-events** — local events, regattas, festivals, seasonal activities
- **maintenance-care** — seasonal maintenance, tips, product recommendations
- **safety-regulations** — regulatory changes, safety advisories, local rules
- **routes-navigation** — cruising routes, anchorages, hazards, channel markers
- **wildlife-nature** — marine life, bird migration, environmental conditions

Factor in desk request themes alongside standard coverage gaps. Prioritize
categories with zero coverage, then low coverage, then stale timely content.

### 3. Research with firecrawl

For each topic:
1. Search for current, local information
2. Cross-reference multiple sources when possible
3. Extract specific data: dates, numbers, locations, names
4. Verify timeliness — is this still current?

### 4. Create cards

```bash
swain card create \
  --desk=<your-desk> \
  --category=<category> \
  --title="<headline — specific, not generic>" \
  --subtext="<2-3 sentence preview with the key takeaway>" \
  --content="<full markdown content, 200-500 words>" \
  --freshness=<timely|evergreen> \
  --json
```

### 5. Style and polish every card (inline quality gate)

For every content card you just created:

1. **Browse the style catalog:**
   ```bash
   swain style list --json
   ```

2. **Pick a style** from the catalog that matches the card's category and mood.
   Vary your picks — don't reuse the same style in one heartbeat.

3. **Write a scene prompt** that captures the card's content. Be specific
   ("Redfish tailing in shallow grass flats at dawn") not generic ("fish in
   water"). 1-2 sentences.

4. **Pick a background color** — muted, dark enough for white text contrast.
   Match the style and content mood.

5. **Generate:**
   ```bash
   swain card image <cardId> --fast --style=<styleId> --bg-color=<hex> --prompt="<scene description>" --json
   ```

### 6. Mark requests fulfilled

For any pending request that a new card addresses:

```bash
swain desk fulfill --desk=<your-desk> --request=<requestId> --card=<cardId> --json
```

### 7. Push discoveries

If your research reveals new microlocations, marinas, or facilities that aren't
in your desk data yet, update the desk record:

```bash
swain desk update <your-desk> --microlocations='[...]' --marinas='[...]' --json
```

Read the current desk data first (`swain desk get <your-desk> --json`), merge
your new discoveries with the existing arrays, and send the full arrays back.

## Card Quality Standards

- **Specific > generic** — "Redfish moving to grass flats near Weedon Island" not "Fishing is good"
- **Locally grounded** — name real places, real conditions, real species
- **Actionable** — captain should be able to act on the information
- **Research-backed** — cite real data, conditions, forecasts
- **Well-written** — clear, concise, useful. Like a good local newsletter.

## Freshness Guidelines

- **timely** — weather, fishing reports, events, anything with an expiration date
- **evergreen** — maintenance tips, route guides, safety regulations, general knowledge

## Limits

- **Max 3 cards per regular heartbeat** — quality over quantity
- **Max 5 cards on first heartbeat** — elevated limit for self-population
- **Don't duplicate** — check existing cards before creating. If a similar card exists and is still fresh, skip it.
- **Don't fabricate** — if you can't find real data, don't make it up. Skip the topic and move on.
