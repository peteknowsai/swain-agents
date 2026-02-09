---
name: skip-cli
description: Full Skip CLI command reference for fleet operations.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["skip"] } } }
---

# Skip CLI Reference

The `skip` CLI (v0.4.0) connects to the Skip API server. Always use `--json` for machine-readable output.

## Agents
```bash
skip agent list [--type=<type>] [--json]          # List all agents
skip agent get <agentId> [--json]                  # Get agent details
skip agent create --agent=<id> --type=<type> --name="..." [--json]
skip agent update --agent=<id> --name="..." [--json]
skip agent delete --agent=<id> [--force] [--json]
skip agent run <agentId> "<prompt>" [--json] [--session=<id>] [--model=<model>]
```

## Beat Reporters
```bash
skip beat list [--json]                            # List all beats
skip beat create --topic=<topic> --location=<loc> [--json]
skip beat dispatch --agent-id=<id> --prompt="..." [--json]
skip beat run --topic=<topic> --location=<loc> [--instructions="..."] [--json]
```

## Runs
```bash
skip run list [--status=<status>] [--agent-id=<id>] [--limit=<n>] [--json]
skip run status <runId> [--json]
```
Status values: `pending`, `running`, `completed`, `failed`

## Cards
```bash
skip card list [--agent=<id>] [--limit=<n>] [--json]
skip card list-today [--json]                       # Cards created today (ET)
skip card get <cardId> [--json]
skip card audit [--agent=<id>] [--location=<loc>] [--json]
skip card check --agent-id=<id> [--date=YYYY-MM-DD] [--json]
skip card create --agent-id=<id> --title="..." --subtext="..." --content="..." [--json]
skip card update <cardId> [--title=X] [--location=X] [--style-id=X] [--json]
skip card archive <cardId> [--json]
skip card unarchive <cardId> [--json]
skip card regen-image <cardId> [--prompt="..."] [--json]
```

## Briefings (READ ONLY)
```bash
skip briefing list [--user=<userId>] [--limit=<n>] [--json]
skip briefing get <briefingId> [--json]
```

## Sessions
```bash
skip session list <agentId>
```

## Sources
```bash
skip source list --agent-id=<id> [--json]
skip source add --agent-id=<id> --name="..." --url="..." [--json]
skip source remove <sourceId> [--json]
```

## Styles
```bash
skip style list [--json]
skip style get <styleId> [--json]
```

## Editions
```bash
skip edition list [--json]
skip edition get [--latest] [--json]
```

## Workflows
```bash
skip workflow list [--json]
skip workflow trigger [--name=<id>] [--json]
skip workflow status <runId> [--json]
```

## Images
```bash
skip image queue --prompt="..." [--json]
skip image status <jobId> [--json]
skip image wait <jobId> [--json]
```

## CLI Gaps (commands that DON'T exist)

These are commonly referenced but have no CLI implementation:

| Missing Command | Data Exists? | Notes |
|-----------------|-------------|-------|
| `skip user get/list` | Yes (API) | User profiles accessible via dashboard API |
| `skip advisor memories` | Yes (DB) | `advisor_memories` table, exposed via dashboard API |
| `skip advisor note` | No | Concept exists but no implementation |
| `skip briefing create` | Yes (API) | `POST /users/:userId/briefing` — needs CLI wrapper |
| `skip briefing delete` | Yes (API) | `DELETE /briefings/dashboard/:briefingId` |
| `skip card library --user=X` | Yes (API) | Card library for a specific user |
| `skip library analyze` | Unknown | May have been removed or never implemented |

## Environment

- `WORKER_URL` - Override API URL
- `AGENT_ID` - Default agent ID
- Auto-detects: localhost:8787 (dev), api.heyskip.com (prod)

## Tips

- Always use `--json` for programmatic parsing
- Use `--limit` on list commands to avoid huge output
- `skip card audit` is the best single command for coverage health
- `skip card list-today` is great for daily production checks
