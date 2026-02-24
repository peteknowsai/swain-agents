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

### Places API

```bash
# Search for facilities near you
swain places search --query="marina" --lat={{lat}} --lon={{lon}} --radius=5000 --json

# Geocode a location name
swain places geocode --location="Tierra Verde, FL" --json
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
