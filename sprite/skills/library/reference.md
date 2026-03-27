# Library Reference

Detailed technical reference for the card library. The SKILL.md has the strategy — this has the complete field reference, category descriptions, and selection examples.

## Browsing Commands

### Pull (for briefing assembly)
```bash
swain card pull --user=<userId> --json
swain card pull --user=<userId> --exclude-served --json
swain card pull --user=<userId> --exclude-served --include-no-image --json
```

**Pull** returns a personalized, ranked selection for a specific captain:
- Respects `--exclude-served` to skip already-delivered cards
- User-tagged cards surface first (marked `forUser: true`)
- Results ranked by relevance, freshness, and category variety
- Use this for briefing assembly

### List (for exploration)
```bash
swain card list --json
swain card list --desk=<desk> --json
swain card list --desk=<desk> --category=<category> --json
```

**List** is a raw catalog query:
- Browse by desk or category
- No personalization or ranking
- Use when exploring what's available, checking coverage, or auditing content
- Not for briefing assembly

### Pull vs List

| | `card pull` | `card list` |
|---|---|---|
| Purpose | Briefing assembly | Exploration, coverage checks |
| Personalized | Yes (user-specific ranking) | No |
| Exclude served | Yes (`--exclude-served`) | No |
| User-tagged priority | Yes (`forUser: true` first) | No |
| Filter by desk | Automatic (from user's desk) | Manual (`--desk=`) |

---

## Card Property Reference

| Field | Description |
|---|---|
| `id` | Unique card ID (e.g., `card_weather_1234`) |
| `title` | Short headline, 3-6 words |
| `subtext` | Preview text, 2-3 sentences with key takeaway |
| `content_markdown` | Full article in markdown |
| `image` | Image URL (generated via `swain card image`) |
| `backgroundColor` | Card background color as hex (e.g., `#1a3a4a`) |
| `category` | Content category (see list below) |
| `freshness` | `timely` (expires) or `evergreen` (always relevant) |
| `expires_at` | Unix timestamp when timely content expires (null for evergreen) |
| `served_count` | How many times this card has been delivered globally |
| `location` | Geographic location tag (e.g., `tierra-verde`) |
| `forUser` | Boolean — true if card was created specifically for this captain |
| `desk` | Which content desk created/owns this card |

---

## Freshness Model

### Timely
Content with an expiration date. Check `expires_at` before including in a briefing.

Examples: weather forecasts, tide charts, event announcements, fishing reports, tournament schedules, holiday hours

**Rule:** If `expires_at` is in the past, the card is stale. Don't include it.

### Evergreen
Always relevant. No expiration date.

Examples: maintenance tips, how-to guides, safety regulations, route descriptions, anchorage guides, general boating knowledge

**Role in briefings:** Good filler when timely content is thin. Mix with timely for variety.

---

## User-Tagged Cards

Cards created with `--user=<userId>` during `swain card create` are tagged for a specific captain. They represent content the advisor created based on conversations with that captain.

When you pull cards, user-tagged cards appear first with `forUser: true`.

**Always prioritize user-tagged cards** — they were made specifically for this captain and are the most personalized content available. They should anchor the briefing.

---

## Selection Strategy

### Priority order
1. **User-tagged cards** (`forUser: true`) — always include these first
2. **Timely cards** — still valid today (check `expires_at`)
3. **Fresh evergreen** — cards they haven't seen yet
4. **Interest-matched** — cards matching the captain's profile and recent conversations
5. **Category variety** — don't stack 5 of the same type

### Example: Building a 6-card briefing

1. Pull cards: `swain card pull --user=<userId> --exclude-served --json`
2. From results:
   - 2 user-tagged cards about fishing spots captain asked about -> include both
   - 1 timely weather card expiring tomorrow -> include (lead with it)
   - 1 timely event card for weekend regatta -> include
   - 3 evergreen maintenance cards -> pick 1 (they haven't seen the impeller one)
   - 2 evergreen route cards -> pick 1 for variety
3. Final selection: weather, 2 fishing (user-tagged), event, maintenance, route = 6 cards across 4 categories

### Example: Thin library (onboarding)

1. Pull returns only 2 cards
2. Need at least 4 content cards (5 total with boat art)
3. Create 2 more on the fly using `swain card create` with `--user=<userId>`
4. Topics: captain's stated interests + their location + their boat type
5. Research each with `firecrawl search` before creating

---

## Complete Category List

| Category | Description | Freshness |
|---|---|---|
| `weather-tides` | Weather forecasts, tide charts, wind patterns, storm tracking | Mostly timely |
| `fishing-reports` | What's biting, where, seasonal patterns, regulations, tournaments | Mostly timely |
| `activities-events` | Local events, regattas, festivals, waterside dining, social | Mostly timely |
| `maintenance-care` | Boat maintenance tips, seasonal care guides, product recommendations | Mostly evergreen |
| `safety-regulations` | Safety info, regulatory changes, local rules, navigation advisories | Mixed |
| `routes-navigation` | Cruising routes, anchorages, channel hazards, waypoints | Mostly evergreen |
| `wildlife-nature` | Marine life sightings, bird migration, environmental conditions | Mixed |
| `destinations` | Cruising destinations, anchorages, waterside dining spots | Mostly evergreen |
| `lifestyle` | Boating culture, gear reviews, community stories | Evergreen |
| `gear` | Equipment recommendations, product reviews, tech updates | Evergreen |
