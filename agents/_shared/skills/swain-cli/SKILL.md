---
description: Use the swain CLI for task coordination, card creation, messaging, sessions, and agent management. Invoke this skill when you need to interact with the Swain platform - claim tasks, update status, create cards, send messages, or manage workflows.
---

# Skip CLI v0.3.0

The unified `swain` command manages agents, tasks, cards, messages, sessions, workflows, and files.

## Environment

The CLI auto-detects local (localhost:8787) vs production servers. Override with:
- `SWAIN_API_URL` - API base URL
- `AGENT_ID` - Your agent ID (also available in your CLAUDE.md)

## Quick Reference

```bash
swain task list|create|create-bulk|get|get-assigned|start|update|send|delete
swain card list|get|create
swain message list|send
swain session list|timeline|delete
swain agent list|create|delete|get|update|pull|push|diff|status|runtime|stats|restart|wake|state|clear-state
swain workflow trigger|status
swain file list|upload|download
```

## IMPORTANT: Follow Your System Prompt First

**Before using these CLI commands, follow the complete workflow in your system prompt (CLAUDE.md).**

Your system prompt contains the required steps for your work:
- Research (WebSearch)
- Content creation
- Card creation (text only — stylist handles images)

**Do NOT swain directly to card creation.** Follow each step in your system prompt.

## Task Commands Reference

```bash
swain task get <task-id> --json              # Get task details
swain task start <task-id>                   # Mark as working
swain task send --task-id=<id> --message=... # Send status update
```

**Note:** Task completion is handled automatically by the run system when your session ends.

## Card Creation

After completing your workflow (research, writing):

```bash
swain card create \
  --task-id=<task-id> \
  --title="Your Title" \
  --subtext="Brief preview" \
  --content="Full markdown content..." \
```

**Do NOT set `--category` manually.** The server auto-assigns category based on your agent ID.

**Do NOT generate images or set `--style-id`.** A stylist agent handles all visuals — it picks the style, generates the image to match, and assigns it after you create the card.

## Task Commands

```bash
swain task list                                     # List all tasks
swain task list --status=pending --limit=10         # Filter tasks
swain task create --agent=<id> --message="..."      # Create task for agent
swain task create-bulk --agents=a,b,c --message="..." # Create for multiple agents
swain task get <id>                                 # Get task details
swain task get-assigned --json                      # Claim assigned task
swain task start <id>                               # Mark as working
swain task update --task-id=<id> --status=failed    # Update status
swain task send --task-id=<id> --message="..."      # Send message
swain task delete <id> --force                      # Delete task
```

## Card Commands

```bash
swain card list                                     # List all cards
swain card list --agent=<id> --limit=10             # Filter cards
swain card get <id>                                 # Get card details
swain card create --agent-id="$AGENT_ID" --title="..." --subtext="..." --content="..."
```

## Message Commands

```bash
swain message list --task-id=<id>                   # List task messages
swain message list --task-id=<id> --limit=10 --offset=0  # Paginated
swain message list --task-id=<id> --from=<agent>    # Filter by sender
swain message send --task-id=<id> --message="..."   # Send message
```

## Session Commands

```bash
swain session list <agentId>                        # List agent sessions
swain session timeline <sessionId>                  # View timeline
swain session delete <sessionId> --force            # Delete session
```

## Agent Commands

```bash
swain agent list                                    # List all agents
swain agent get <id>                                # Get agent details
swain agent runtime                                 # Real-time statuses from KV
swain agent stats                                   # Productivity metrics
swain agent restart <id>                            # Restart container
swain agent wake <id>                               # Wake sleeping agent
swain agent state <id>                              # Get state snapshot
```

## Workflow Commands

```bash
swain workflow trigger                              # Trigger workflow
swain workflow status <instanceId>                  # Get status
```

## File Commands

```bash
swain file list                                     # List files in R2
swain file upload --topic=reports --content="..."   # Upload content
swain file download <blobId>                        # Download file
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
