---
name: skip-cli
description: Skip CLI command reference for cards, briefings, users, and agents.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["skip"] } } }
---

# Skip CLI Reference

The `skip` CLI connects to the Swain API server.

## Commands

### Cards
```bash
skip card pull --user=<userId> [--exclude-served] [--category=<cat>] [--limit=<n>] [--json]
skip card list [--agent=<id>] [--limit=<n>] [--json]
skip card get <cardId> [--json]
skip card library --user=<userId> [--json]
skip card check --agent-id=<id> [--date=<YYYY-MM-DD>] [--json]
skip card create --agent-id=<id> --title=<text> --subtext=<text> --content=<md> [options]
```

### Briefings
```bash
skip briefing previous --user=<userId> [--json]
skip briefing assemble --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--force] [--json]
skip briefing list [--user=<userId>] [--limit=<n>] [--json]
skip briefing get <briefingId> [--json]
skip briefing create --user=<userId> --date=<YYYY-MM-DD> --items='<json>' [--onboarding] [--json]
```

### Users
```bash
skip user get <userId> [--json]
```

### Agents
```bash
skip agent list [--type=<type>] [--json]
skip agent get <agentId> [--json]
```

### Sessions
```bash
skip session list <agentId>
```

## Environment

- `SKIP_API_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
