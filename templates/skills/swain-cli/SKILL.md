---
name: swain-cli
description: Swain CLI command reference for cards, briefings, users, and agents.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["swain"] } } }
---

# Swain CLI Reference

The `swain` CLI connects to the Swain API server.

## Commands

### Cards
```bash
swain card pull --user=<userId> [--exclude-served] [--category=<cat>] [--limit=<n>] [--json]
swain card list [--agent=<id>] [--limit=<n>] [--json]
swain card get <cardId> [--json]
swain card library --user=<userId> [--json]
swain card check --agent-id=<id> [--date=<YYYY-MM-DD>] [--json]
swain card create --agent-id=<id> --title=<text> --subtext=<text> --content=<md> [options]
```

### Briefings
```bash
swain briefing previous --user=<userId> [--json]
swain briefing assemble --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--force] [--json]
swain briefing list [--user=<userId>] [--limit=<n>] [--json]
swain briefing get <briefingId> [--json]
swain briefing create --user=<userId> --date=<YYYY-MM-DD> --items='<json>' [--onboarding] [--json]
```

### Users
```bash
swain user get <userId> [--json]
```

### Agents
```bash
swain agent list [--type=<type>] [--json]
swain agent get <agentId> [--json]
```

### Sessions
```bash
swain session list <agentId>
```

## Environment

- `SWAIN_API_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
