---
name: swain-cli
description: Full Skip CLI command reference for fleet operations.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["swain"] } } }
---

# Skip CLI Reference

The `swain` CLI (v0.4.0) connects to the Skip API server. Always use `--json` for machine-readable output.

## Agents
```bash
swain agent list [--type=<type>] [--json]          # List all agents
swain agent get <agentId> [--json]                  # Get agent details
swain agent create --agent=<id> --type=<type> --name="..." [--json]
swain agent update --agent=<id> --name="..." [--json]
swain agent delete --agent=<id> [--force] [--json]
swain agent run <agentId> "<prompt>" [--json] [--session=<id>] [--model=<model>]
```

## Beat Reporters
```bash
swain beat list [--json]                            # List all beats
swain beat create --topic=<topic> --location=<loc> [--json]
swain beat dispatch --agent-id=<id> --prompt="..." [--json]
swain beat run --topic=<topic> --location=<loc> [--instructions="..."] [--json]
```

## Runs
```bash
swain run list [--status=<status>] [--agent-id=<id>] [--limit=<n>] [--json]
swain run status <runId> [--json]
```
Status values: `pending`, `running`, `completed`, `failed`

## Cards
```bash
swain card list [--agent=<id>] [--limit=<n>] [--json]
swain card list-today [--json]                       # Cards created today (ET)
swain card get <cardId> [--json]
swain card audit [--agent=<id>] [--location=<loc>] [--json]
swain card check --agent-id=<id> [--date=YYYY-MM-DD] [--json]
swain card create --agent-id=<id> --title="..." --subtext="..." --content="..." [--json]
swain card update <cardId> [--title=X] [--location=X] [--style-id=X] [--json]
swain card archive <cardId> [--json]
swain card unarchive <cardId> [--json]
swain card regen-image <cardId> [--prompt="..."] [--json]
```

## Briefings (READ ONLY)
```bash
swain briefing list [--user=<userId>] [--limit=<n>] [--json]
swain briefing get <briefingId> [--json]
```

## Sessions
```bash
swain session list <agentId>
```

## Sources
```bash
swain source list --agent-id=<id> [--json]
swain source add --agent-id=<id> --name="..." --url="..." [--json]
swain source remove <sourceId> [--json]
```

## Styles
```bash
swain style list [--json]
swain style get <styleId> [--json]
```

## Editions
```bash
swain edition list [--json]
swain edition get [--latest] [--json]
```

## Workflows
```bash
swain workflow list [--json]
swain workflow trigger [--name=<id>] [--json]
swain workflow status <runId> [--json]
```

## Images
```bash
swain image queue --prompt="..." [--json]
swain image status <jobId> [--json]
swain image wait <jobId> [--json]
```

## CLI Gaps (commands that DON'T exist)

These are commonly referenced but have no CLI implementation:

| Missing Command | Data Exists? | Notes |
|-----------------|-------------|-------|
| `swain user get/list` | Yes (API) | User profiles accessible via dashboard API |
| `swain advisor memories` | Yes (DB) | `advisor_memories` table, exposed via dashboard API |
| `swain advisor note` | No | Concept exists but no implementation |
| `swain briefing create` | Yes (API) | `POST /users/:userId/briefing` — needs CLI wrapper |
| `swain briefing delete` | Yes (API) | `DELETE /briefings/dashboard/:briefingId` |
| `swain card library --user=X` | Yes (API) | Card library for a specific user |
| `swain library analyze` | Unknown | May have been removed or never implemented |

## Environment

- `WORKER_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects: localhost:8787 (dev), api.swain.com (prod)

## Tips

- Always use `--json` for programmatic parsing
- Use `--limit` on list commands to avoid huge output
- `swain card audit` is the best single command for coverage health
- `swain card list-today` is great for daily production checks
