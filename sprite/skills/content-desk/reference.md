# Content Desk Reference

Detailed technical reference for beat reporting. The SKILL.md has the workflow — this has all the commands, field values, and quality standards.

## Editorial Requests

```bash
swain desk requests --desk=<your-desk> --status=pending --json
```

Requests are signals from advisors about what captains are asking for. They inform your gap analysis and topic prioritization, but they're not card orders.

### Fulfilling a request
```bash
swain desk fulfill --desk=<your-desk> --request=<requestId> --card=<cardId> --json
```

---

## Coverage Analysis

```bash
swain card coverage --desk=<your-desk> --json
```

### Coverage categories

| Category | What it covers |
|---|---|
| `weather-tides` | Conditions, forecasts, tide tables, wind patterns |
| `fishing-reports` | What's running, where, seasonal patterns, regulations |
| `activities-events` | Local events, regattas, festivals, seasonal activities |
| `maintenance-care` | Seasonal maintenance, tips, product recommendations |
| `safety-regulations` | Regulatory changes, safety advisories, local rules |
| `routes-navigation` | Cruising routes, anchorages, hazards, channel markers |
| `wildlife-nature` | Marine life, bird migration, environmental conditions |

### Prioritization order
1. Zero coverage categories
2. Low coverage categories
3. Stale timely content (expired or near-expiring)
4. Request themes from advisors

---

## One-at-a-Time Card Workflow

Do not parallelize card creation. Complete all steps for one card before starting the next.

### Step 1: Browse styles (once per session)
```bash
swain style list --json
```

### Step 2: Research the topic
One or two quick web searches. Don't over-research.
```bash
firecrawl search "<topic>" --limit 5
firecrawl scrape <url> --only-main-content
```

### Step 3: Create the card
```bash
swain card create \
  --desk=<your-desk> \
  --category=<category> \
  --title="<headline — specific, not generic>" \
  --subtext="<2-3 sentence preview with key takeaway>" \
  --content="<full markdown, 200-500 words>" \
  --freshness=<timely|evergreen> \
  --json
```

### Step 4: Style immediately
Pick a style from the catalog. Write a scene prompt specific to the content. Pick a muted background color dark enough for white text.
```bash
swain card image <cardId> --style=<styleId> --bg-color=<hex> --prompt="<scene description>" --json
```

**Scene prompt rules:**
- Describe the scene, not the style — the style gets applied from `--style`
- Be specific: "Redfish tailing in shallow grass flats at dawn"
- Not generic: "fish in water"
- Vary style picks across cards in one session

**Background color rules:**
- Muted tones
- Dark enough for white text contrast
- Match the mood of the card content

### Step 5: Verify
```bash
swain card verify <cardId> --json
```

Checks that the card has both `image` and `backgroundColor`.

**If verify fails:**
1. Check the output to see what's missing
2. Fix it (`swain card image` with `--bg-color`, or `swain card update --bg-color=<hex>`)
3. Run verify again
4. **Max 3 attempts per card.** After 3 failures, move on — the card exists but unstyled.

### Step 6: Move to next card
Only after verify passes (or you've hit max attempts).

---

## Final Verification Gate

After all cards are created, batch verify:
```bash
swain card verify <cardId1> <cardId2> <cardId3> --json
```

If `allPass` is false, fix failing cards (up to 2 more total attempts). If cards still fail after retries, log it in your memory files for follow-up.

---

## Updating Desk Data

If your research reveals new microlocations, marinas, or facilities:

```bash
# Read current desk data first
swain desk get <your-desk> --json

# Update with merged arrays
swain desk update <your-desk> --microlocations='[...]' --marinas='[...]' --json
```

Read the current data first, merge your discoveries with existing arrays, then send the full arrays back.

---

## Freshness Guidelines

| Type | Use for | Examples |
|---|---|---|
| `timely` | Content with an expiration date | Weather forecasts, fishing reports, events, tide tables |
| `evergreen` | Always-relevant content | Maintenance tips, route guides, safety regulations, how-tos |

---

## Card Quality Standards

- **Specific > generic** — "Redfish moving to grass flats near Weedon Island" not "Fishing is good"
- **Locally grounded** — name real places, real conditions, real species
- **Actionable** — captain should be able to act on the information
- **Research-backed** — cite real data, conditions, forecasts. If you can't find real data, skip the topic.
- **Well-written** — clear, concise, useful. Like a good local newsletter.
- **Never fabricate** — if you can't find real data, don't make it up

---

## Limits

- **Max 3 cards per regular run** — quality over quantity
- **Max 5 cards on first run** — elevated limit for initial self-population
- **Don't duplicate** — check existing cards before creating. If a similar card exists and is still fresh, skip it.

---

## Speed Target

Each card should take 2-3 minutes total. Three cards in under 10 minutes. A quick search plus your own knowledge is enough — don't do exhaustive multi-source research.
