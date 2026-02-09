# Tools Reference

## Skip CLI

The `skip` CLI connects to the Skip API server. Always use `--json` for machine-readable output.

### Briefing Management
```bash
skip briefing list [--user=<userId>] [--limit=<n>] --json  # List briefings
skip briefing get <briefingId> --json                       # Get briefing details with items
skip briefing create --user=<userId> [--date=YYYY-MM-DD] --json  # Generate a briefing
```

### Card Library
```bash
skip card list [--agent=<id>] [--limit=<n>] --json    # Query cards (filter by type/agent)
skip card get <cardId> --json                          # Get card details
skip card create --json                                # Create card (title, subtext, content, image, location, freshness, style, category)
skip card check --agent-id=<id> [--date=YYYY-MM-DD] --json  # Check if card exists for date
skip card list-today --json                            # List cards created today (Eastern Time)
skip card update <cardId> --title="..." --json         # Update card fields
skip card audit [--agent=<id>] [--location=<loc>] --json  # Audit cards for issues
skip card archive <cardId> --json                      # Soft-archive a card
skip card unarchive <cardId> --json                    # Restore archived card
skip card regen-image <cardId> --json                  # Regenerate card image
```

### Memory Management
```bash
skip memory list --user=<userId> --json                # List user's memories
skip memory get <memoryId> --json                      # Get memory details
skip memory add --user=<userId> --category=<cat> --content="..." --json  # Add memory
skip memory update <memoryId> --json                   # Update memory
skip memory forget <memoryId> --json                   # Delete a memory
```

### User & Advisor
```bash
skip user list [--limit=<n>] --json                    # List all users (captains, boats, locations, advisors)
skip user get <userId> --json                          # Get user details with memories and stats
skip advisor list --json                               # List all advisor agents
skip advisor memories --user=<userId> --json           # Read advisor memories for a user
```

### Agent Management
```bash
skip agent list [--type=<type>] --json                 # List agents
skip agent get <agentId> --json                        # Get agent metadata
skip agent run <agentId> "<prompt>" --json             # Run agent with streaming output
```

### Image Generation
```bash
skip image queue "prompt" [--style=<styleId>] [--agent=<agentId>] --json  # Queue async image job
skip image status <jobId> --json                       # Check job status
skip image wait <jobId> [--timeout=seconds] --json     # Poll until image ready
```

### Styles
```bash
skip style list --json                                 # List all card styles
skip style get <styleId> --json                        # Get style details
```

### Beat Reporters
```bash
skip beat list --json                                  # List beat agents
skip beat dispatch --agent-id=<id> --prompt="..." --json  # Dispatch a beat agent task
skip beat run --topic=<topic> --location=<loc> --instructions="..." --json  # Trigger beat reporter
```

### Sources
```bash
skip source list --agent-id=<id> --json                # List agent's data sources
skip source add --agent-id=<id> --name="..." --url="..." --json  # Add data source
skip source remove --agent-id=<id> --source-id=... --json  # Remove source
```

### Workflows & Runs
```bash
skip workflow list --json                              # List workflows
skip workflow trigger [--name=<workflow>] --json        # Trigger workflow
skip workflow status <runId> --json                    # Get workflow run status
skip run status <runId> --json                         # Get agent run status
skip run list [--agent-id=<id>] [--status=<status>] --json  # List agent runs
```

### Sessions
```bash
skip session list <agentId>                            # List agent sessions
skip teleport [sessionId]                              # Beam into agent session locally
skip resume [sessionId]                                # Resume session in original directory
```

## Key Concepts

### Card Types
- **Timely** — Current conditions (weather, tides, fishing). Expire within 168h.
- **Evergreen** — Always relevant (maintenance tips, gear guides). No expiration.

### Serving Model
- **Fresh cards** — Never seen by the captain before
- **Resurfaced cards** — Previously viewed, can re-show if contextually relevant

### Memory Categories
preferences, boat-details, weather-patterns, locations, and custom categories as needed.

## Agent-to-Agent Communication

### Send a message to another agent
```bash
# Via OpenClaw sessions_send tool
sessions_send --sessionKey=agent:<agentId>:main --message="..."
```

### Spawn a task under another agent
```bash
# Via OpenClaw sessions_spawn tool
sessions_spawn --agentId=<agentId> --task="..."
```

Use sessions_send for coordination messages. Use sessions_spawn for delegated work that needs its own session.

## Environment

- Always use `--json` when parsing output programmatically
- Use `skip <command> --help` for detailed usage on any command
