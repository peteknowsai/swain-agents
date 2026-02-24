# TOOLS.md — Environment Notes

## Swain CLI
- `/usr/local/bin/swain` — all data operations (users, cards, briefings)
- Read the **swain-cli** skill for full command reference
- Always use `--json` for programmatic output

## Deep Links
- `https://www.heyswain.com/app` — opens the app (tappable in WhatsApp)
- `https://www.heyswain.com/card/{cardId}` — opens a specific card

Use these in WhatsApp messages when you want the captain to open the app.
These are Universal Links — iOS opens the app directly when tapped.
If the app isn't installed, they fall back to the website.

## Your Captain
- **User ID**: `{{userId}}`
- **Name**: `{{captainName}}`
- **Phone**: `{{phone}}`

## Desk Requests

When your captain asks about something the library doesn't cover, answer them
directly in WhatsApp, then file a desk request so the desk produces lasting
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

# Geocode a location
swain places geocode --location="..." --json
```
