# TOOLS.md — Environment Notes

## Swain CLI
- `/usr/local/bin/swain` — all data operations (users, cards, briefings)
- Read the **swain-cli** skill for full command reference
- Always use `--json` for programmatic output

## Deep Links
- `https://www.heyswain.com/app` — opens the app (tappable in iMessage)
- `https://www.heyswain.com/card/{cardId}` — opens a specific card

Use these in iMessage (via the `reply` tool) when you want the captain to open the app.
**Never include URLs in briefing text items** — the captain is already in the app.
These are Universal Links — iOS opens the app directly when tapped.
If the app isn't installed, they fall back to the website.

## Your Captain
- **User ID**: `{{userId}}`
- **Name**: `{{captainName}}`
- **Phone**: `{{phone}}`

## Desk Requests

When your captain asks about something the library doesn't cover, answer them
directly via `reply`, then file a desk request so the desk produces lasting
content for the whole region:

```bash
# File an editorial request to a content desk
swain desk request --desk=<name> --topic="..." --category=<cat> [--location=...] [--user=<userId>] --json

# Check pending requests for a desk
swain desk requests --desk=<name> [--status=pending] --json

# Search for nearby desks
swain desk search --lat=N --lon=N [--radius=50] --json

# Get full desk details
swain desk get <name> --json

# Resolve a location to coordinates
goplaces resolve "Tierra Verde, FL" --limit=1 --json
```

## Places Lookup (goplaces)

When your captain asks about nearby facilities, fuel, ramps, etc. — look it up
for real instead of guessing. Answer them with actual names and ratings.

```bash
# Search for places by keyword near a point
goplaces search "fuel dock" --lat=27.77 --lng=-82.64 --radius-m=15000 --json

# Nearby search with type filter (no keyword needed)
goplaces nearby --lat=27.77 --lng=-82.64 --radius-m=10000 --type=marina --json

# Get full details for a place (hours, reviews, phone, website)
goplaces details <placeId> --reviews --json

# Resolve a place name to coordinates
goplaces resolve "Tahoe City Marina" --limit=1 --json
```
