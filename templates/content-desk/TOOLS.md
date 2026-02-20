# TOOLS.md — Environment Notes

## Identity
- **Desk Name:** {{deskName}}
- **Region:** {{region}}

## Swain CLI
- `/usr/local/bin/swain` — all data operations (cards, coverage)
- Read the **swain-cli** skill for full command reference
- Always use `--json` for programmatic output

## Key Commands

```bash
# Check coverage for your desk
swain card coverage --desk={{deskName}} --json

# List your cards
swain card list --desk={{deskName}} --json

# List timely cards (check for stale content)
swain card list --desk={{deskName}} --freshness=timely --json

# Get card details
swain card get <cardId> --json

# Create a new card
swain card create --desk={{deskName}} --category=<cat> --title="..." --subtext="..." --content="..." --freshness=<timely|evergreen> --json
```

## Content Categories

weather-tides, fishing-reports, activities-events, maintenance-care, safety-regulations, routes-navigation, wildlife-nature
