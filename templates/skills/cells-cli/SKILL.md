---
name: cells-cli
description: Cells CLI command reference for cards, briefings, users, and agents.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["cells"] } } }
---

# Cells CLI Reference

The `cells` CLI connects to the Cells API server.

## Commands

### Cards
```bash
cells card pull --user=<userId> [--exclude-served] [--category=<cat>] [--limit=<n>] [--json]
cells card list [--agent=<id>] [--limit=<n>] [--json]
cells card get <cardId> [--json]
cells card library --user=<userId> [--json]
cells card check --agent-id=<id> [--date=<YYYY-MM-DD>] [--json]
cells card create --agent-id=<id> --title=<text> --subtext=<text> --content=<md> [options]
```

### Briefings
```bash
cells briefing previous --user=<userId> [--json]
cells briefing assemble --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--force] [--json]
cells briefing list [--user=<userId>] [--limit=<n>] [--json]
cells briefing get <briefingId> [--json]
cells briefing create --user=<userId> --date=<YYYY-MM-DD> --items='<json>' [--onboarding] [--json]
```

### Users
```bash
cells user get <userId> [--json]
```

### Agents
```bash
cells agent list [--type=<type>] [--json]
cells agent get <agentId> [--json]
```

### Sessions
```bash
cells session list <agentId>
```

## Environment

- `WORKER_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
