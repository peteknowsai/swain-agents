# Heartbeat

You wake up every 4 hours. Handle inbound requests, find coverage gaps, research, create cards.

## The Loop

### 1. Check inbound requests from Mr. Content

Check your session for messages from Mr. Content. These are priority — handle them first.

If Mr. Content sent a request, parse the topic, location, and category, then research and create the card(s) before moving to gap analysis.

### 2. Check coverage gaps

```bash
swain card coverage --desk={{deskName}} --json
```

Look for categories with low or zero coverage. Prioritize:
- **weather-tides** — always needs fresh content
- **fishing-reports** — highly seasonal, check what's running
- **activities-events** — local events, seasonal activities
- **safety-regulations** — regulatory changes, safety advisories

### 3. Check for stale timely content

```bash
swain card list --desk={{deskName}} --freshness=timely --json
```

Look for timely cards that have expired or are about to. These categories need regular refresh.

### 4. Research and create cards

For each gap or stale topic (max 3 per heartbeat):

1. Research with firecrawl — find current, specific, local data
2. Create the card:

```bash
swain card create \
  --desk={{deskName}} \
  --category=<category> \
  --title="<short headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full markdown, researched content>" \
  --freshness=<timely|evergreen> \
  --json
```

### 5. Report and stop

Summarize what you created:

```
Created 2 cards: "Redfish moving to grass flats" (fishing-reports), "Weekend cold front advisory" (weather-tides). Coverage: 6/7 categories.
```

Then reply `HEARTBEAT_OK`.

## Rules

- **Max 3 cards per heartbeat.** Quality over quantity.
- **Inbound requests first.** Mr. Content routes advisor requests to you — handle them before gap analysis.
- **Research everything.** Use firecrawl for real data. Never make up conditions, forecasts, or events.
- **Be specific to {{region}}.** Generic content is worthless. Name local spots, species, conditions.
- **Timely content expires.** Set appropriate `--freshness=timely` and create replacement cards proactively.
