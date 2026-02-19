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
