---
description: Use the cells CLI for task coordination, card creation, messaging, sessions, and agent management. Invoke this skill when you need to interact with the Cells platform - claim tasks, update status, create cards, send messages, or manage workflows.
---

# Cells CLI v0.3.0

The unified `cells` command manages agents, tasks, cards, messages, sessions, workflows, and files.

## Environment

The CLI auto-detects local (localhost:8787) vs production (api.cells.md) servers. Override with:
- `WORKER_URL` - API base URL
- `AGENT_ID` - Your agent ID (also available in your CLAUDE.md)

## Quick Reference

```bash
cells task list|create|create-bulk|get|get-assigned|start|update|send|delete
cells card list|get|create
cells message list|send
cells session list|timeline|delete
cells agent list|create|delete|get|update|pull|push|diff|status|runtime|stats|restart|wake|state|clear-state
cells workflow trigger|status
cells file list|upload|download
```

## IMPORTANT: Follow Your System Prompt First

**Before using these CLI commands, follow the complete workflow in your system prompt (CLAUDE.md).**

Your system prompt contains the required steps for your work:
- Research (WebSearch)
- Content creation
- Card creation (text only — stylist handles images)

**Do NOT skip directly to card creation.** Follow each step in your system prompt.

## Task Commands Reference

```bash
cells task get <task-id> --json              # Get task details
cells task start <task-id>                   # Mark as working
cells task send --task-id=<id> --message=... # Send status update
```

**Note:** Task completion is handled automatically by the run system when your session ends.

## Card Creation

After completing your workflow (research, writing):

```bash
cells card create \
  --task-id=<task-id> \
  --title="Your Title" \
  --subtext="Brief preview" \
  --content="Full markdown content..." \
```

**Do NOT set `--category` manually.** The server auto-assigns category based on your agent ID.

**Do NOT generate images or set `--style-id`.** A stylist agent handles all visuals — it picks the style, generates the image to match, and assigns it after you create the card.

## Task Commands

```bash
cells task list                                     # List all tasks
cells task list --status=pending --limit=10         # Filter tasks
cells task create --agent=<id> --message="..."      # Create task for agent
cells task create-bulk --agents=a,b,c --message="..." # Create for multiple agents
cells task get <id>                                 # Get task details
cells task get-assigned --json                      # Claim assigned task
cells task start <id>                               # Mark as working
cells task update --task-id=<id> --status=failed    # Update status
cells task send --task-id=<id> --message="..."      # Send message
cells task delete <id> --force                      # Delete task
```

## Card Commands

```bash
cells card list                                     # List all cards
cells card list --agent=<id> --limit=10             # Filter cards
cells card get <id>                                 # Get card details
cells card create --agent-id="$AGENT_ID" --title="..." --subtext="..." --content="..."
```

## Message Commands

```bash
cells message list --task-id=<id>                   # List task messages
cells message list --task-id=<id> --limit=10 --offset=0  # Paginated
cells message list --task-id=<id> --from=<agent>    # Filter by sender
cells message send --task-id=<id> --message="..."   # Send message
```

## Session Commands

```bash
cells session list <agentId>                        # List agent sessions
cells session timeline <sessionId>                  # View timeline
cells session delete <sessionId> --force            # Delete session
```

## Agent Commands

```bash
cells agent list                                    # List all agents
cells agent get <id>                                # Get agent details
cells agent runtime                                 # Real-time statuses from KV
cells agent stats                                   # Productivity metrics
cells agent restart <id>                            # Restart container
cells agent wake <id>                               # Wake sleeping agent
cells agent state <id>                              # Get state snapshot
```

## Workflow Commands

```bash
cells workflow trigger                              # Trigger workflow
cells workflow status <instanceId>                  # Get status
```

## File Commands

```bash
cells file list                                     # List files in R2
cells file upload --topic=reports --content="..."   # Upload content
cells file download <blobId>                        # Download file
```

## Global Options

- `--json` - Output as JSON (useful for parsing)
- `--force` - Skip confirmation prompts
- `--env=local` - Force local server (http://localhost:8787)
- `--verbose` - Show debug output including retry attempts

## Status Values

- `pending` - Awaiting pickup
- `working` - Currently processing
- `completed` - Successfully finished
- `failed` - Encountered an error
- `cancelled` - Task was cancelled

## Troubleshooting

### Connection Issues

The CLI auto-detects local vs production servers. If you get connection errors:

1. **Check server is running:** `curl http://localhost:8787/health`
2. **Force local:** Add `--env=local` to your command
3. **Debug mode:** Add `--verbose` to see retry attempts

The CLI retries failed requests up to 3 times automatically.

### Fallback: Direct API

If the CLI is unavailable, use curl directly. **API endpoint is `/cards` (NOT `/api/cards`):**

```bash
curl -X POST http://localhost:8787/cards \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "<your-agent-id>",
    "title": "<headline>",
    "subtext": "<preview text>",
    "content_markdown": "<full markdown>"
  }'
```

**Required fields:** `agentId`, `title`, `subtext`, `content_markdown`
**Do NOT include `image`** — the stylist agent generates and assigns images after card creation.
**Auto-filled by server:** `category`, `freshness`, `location`, `expires_at` (from your agent ID)

**Response:** `{"success": true, "cardId": "card_xxx"}`
