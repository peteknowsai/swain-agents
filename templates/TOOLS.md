# TOOLS.md — Environment Notes

## Swain CLI
- `/usr/local/bin/swain` — all data operations (users, cards, briefings)
- Read the **swain-cli** skill for full command reference
- Always use `--json` for programmatic output

## Deep Links
- `heyswain://` — opens the app (to whatever screen they're on)
- `heyswain://card/{cardId}` — opens a specific card in the app

Use these in WhatsApp messages when you want the captain to open the app.
WhatsApp renders deep links as tappable. Example: "Check it out: heyswain://"

## Your Captain
- **User ID**: `{{userId}}`
- **Name**: `{{captainName}}`
- **Phone**: `{{phone}}`
