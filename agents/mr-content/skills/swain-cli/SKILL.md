---
name: swain-cli
description: Full Skip CLI command reference for the editor agent.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["swain"] } } }
---

# Skip CLI Reference

The `swain` CLI connects to the Skip API server.

## Beat Reporters (New Model)

Reporters are now fully agentic. I dispatch them individually with freeform prompts. They use shared tools (web search, firecrawl, nanobanana for images, swain card create) to research and write cards autonomously.

### Dispatch to an existing beat agent
```bash
swain beat dispatch --agent-id=<agent-id> --prompt="..." [--json]
```

### Dispatch a one-off generic reporter
Uses the generic `beat-reporter` agent — no permanent agent needed:
```bash
swain beat run --topic=<topic> --location=<location> [--instructions="..."] [--json]
```

### Create a new permanent beat agent
```bash
swain beat create --topic=<topic> --location=<location> [--json]
```
Provisions a full agent (DB record, CLAUDE.md, skill symlinks). Ready to dispatch immediately.

### List beat agents
```bash
swain beat list [--json]
```

### Source Management
```bash
swain source list --agent-id=<id> [--json]
swain source add --agent-id=<id> --name="..." --url="..." [--notes="..."] [--json]
swain source remove <sourceId> [--json]
```

## Cards
```bash
swain card list [--agent=<id>] [--limit=<n>] [--json]
swain card get <cardId> [--json]
swain card library --user=<userId> [--json]
swain card audit [--agent=<id>] [--location=<loc>] [--json]
swain card update <cardId> --location=<loc> --style-id=<style> [--json]
swain card archive <cardId> [--json]
swain card unarchive <cardId> [--json]
swain card regen-image <cardId> --prompt="..." [--json]
```

## Agents
```bash
swain agent list [--type=<type>] [--json]
swain agent get <agentId> [--json]
swain agent run <agentId> "<prompt>" [--json]
```

## Advisor Communication
```bash
swain advisor memories [--user=<userId>] [--json]
swain advisor note --user=<userId> --content="..." [--category=<cat>] [--json]
```

## Users
```bash
swain user get <userId> [--json]
```

## Briefings
```bash
swain briefing list [--user=<userId>] [--limit=<n>] [--json]
swain briefing get <briefingId> [--json]
```

## Sessions
```bash
swain session list <agentId>
```

## Workflows
```bash
swain workflow list [--json]
swain workflow trigger <workflowId> [--json]
swain workflow status <workflowId> [--json]
```

## Environment

- `WORKER_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
