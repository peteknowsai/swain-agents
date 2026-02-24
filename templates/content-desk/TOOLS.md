# Tools — {{deskName}}

## Your Identity

- **Desk**: `{{deskName}}`
- **Region**: {{region}}
- **Scope**: {{scope}}
- **Center**: {{lat}}, {{lon}}
- **Agent ID**: `{{deskName}}-desk`

## Content Categories

`weather-tides` | `fishing-reports` | `activities-events` | `maintenance-care` | `safety-regulations` | `routes-navigation` | `wildlife-nature`

## CLI Reference

### Desk Data

```bash
# Get your desk record (microlocations, marinas, topics, stats)
swain desk get {{deskName}} --json

# Update your desk data (push self-population results)
swain desk update {{deskName}} --microlocations='[...]' --marinas='[...]' --json

# Update your status
swain desk update {{deskName}} --status=active --json
```

### Editorial Requests

```bash
# Check for editorial signals from advisors (topics captains are asking about)
swain desk requests --desk={{deskName}} --status=pending --json

# Mark a request as fulfilled after producing relevant content
swain desk fulfill --desk={{deskName}} --request=<id> --card=<cardId> --json
```

### Places API (goplaces)

```bash
# Search for facilities near you
goplaces search "marina" --lat={{lat}} --lng={{lon}} --radius-m=5000 --json

# Nearby search (alternative — no keyword, uses type filter)
goplaces nearby --lat={{lat}} --lng={{lon}} --radius-m=15000 --type=marina --json

# Resolve a location name to coordinates
goplaces resolve "Tierra Verde, FL" --limit=1 --json

# Get full details for a place
goplaces details <placeId> --json
```

### Cards

```bash
# Check coverage gaps
swain card coverage --desk={{deskName}} --json

# List your cards
swain card list --desk={{deskName}} --json

# List stale timely cards
swain card list --desk={{deskName}} --freshness=timely --json

# Create a card (see swain-card-create skill for full guide)
swain card create --desk={{deskName}} --title="..." --category=weather-tides --body="..." --json
```

### Research

```bash
# Web research via firecrawl
firecrawl search "Tampa Bay boating regulations 2026"
firecrawl scrape "https://example.com/tides"
```
