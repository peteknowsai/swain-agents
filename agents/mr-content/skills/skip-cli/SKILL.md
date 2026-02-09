---
name: skip-cli
description: Full Skip CLI command reference for the editor agent.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["skip"] } } }
---

# Skip CLI Reference

The `skip` CLI connects to the Skip API server.

## Beat Reporters (New Model)

Reporters are now fully agentic. I dispatch them individually with freeform prompts. They use shared tools (web search, firecrawl, nanobanana for images, skip card create) to research and write cards autonomously.

### Dispatch to an existing beat agent
```bash
skip beat dispatch --agent-id=<agent-id> --prompt="..." [--json]
```

### Dispatch a one-off generic reporter
Uses the generic `beat-reporter` agent — no permanent agent needed:
```bash
skip beat run --topic=<topic> --location=<location> [--instructions="..."] [--json]
```

### Create a new permanent beat agent
```bash
skip beat create --topic=<topic> --location=<location> [--json]
```
Provisions a full agent (DB record, CLAUDE.md, skill symlinks). Ready to dispatch immediately.

### List beat agents
```bash
skip beat list [--json]
```

### Source Management
```bash
skip source list --agent-id=<id> [--json]
skip source add --agent-id=<id> --name="..." --url="..." [--notes="..."] [--json]
skip source remove <sourceId> [--json]
```

## Cards
```bash
skip card list [--agent=<id>] [--limit=<n>] [--json]
skip card get <cardId> [--json]
skip card library --user=<userId> [--json]
skip card audit [--agent=<id>] [--location=<loc>] [--json]
skip card update <cardId> --location=<loc> --style-id=<style> [--json]
skip card archive <cardId> [--json]
skip card unarchive <cardId> [--json]
skip card regen-image <cardId> --prompt="..." [--json]
```

## Agents
```bash
skip agent list [--type=<type>] [--json]
skip agent get <agentId> [--json]
skip agent run <agentId> "<prompt>" [--json]
```

## Advisor Communication
```bash
skip advisor memories [--user=<userId>] [--json]
skip advisor note --user=<userId> --content="..." [--category=<cat>] [--json]
```

## Users
```bash
skip user get <userId> [--json]
```

## Briefings
```bash
skip briefing list [--user=<userId>] [--limit=<n>] [--json]
skip briefing get <briefingId> [--json]
```

## Sessions
```bash
skip session list <agentId>
```

## Workflows
```bash
skip workflow list [--json]
skip workflow trigger <workflowId> [--json]
skip workflow status <workflowId> [--json]
```

## Environment

- `WORKER_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
