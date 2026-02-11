# Tools Reference

## Skip CLI

The `swain` CLI connects to the Skip API server. Always use `--json` for machine-readable output.

### Briefing Management
```bash
swain briefing list [--user=<userId>] [--limit=<n>] --json  # List briefings
swain briefing get <briefingId> --json                       # Get briefing details with items
swain briefing create --user=<userId> [--date=YYYY-MM-DD] --json  # Generate a briefing
```

### Card Library
```bash
swain card list [--agent=<id>] [--limit=<n>] --json    # Query cards (filter by type/agent)
swain card get <cardId> --json                          # Get card details
swain card create --json                                # Create card (title, subtext, content, image, location, freshness, style, category)
swain card check --agent-id=<id> [--date=YYYY-MM-DD] --json  # Check if card exists for date
swain card list-today --json                            # List cards created today (Eastern Time)
swain card update <cardId> --title="..." --json         # Update card fields
swain card audit [--agent=<id>] [--location=<loc>] --json  # Audit cards for issues
swain card archive <cardId> --json                      # Soft-archive a card
swain card unarchive <cardId> --json                    # Restore archived card
swain card regen-image <cardId> --json                  # Regenerate card image
```

### Memory Management
```bash
swain memory list --user=<userId> --json                # List user's memories
swain memory get <memoryId> --json                      # Get memory details
swain memory add --user=<userId> --category=<cat> --content="..." --json  # Add memory
swain memory update <memoryId> --json                   # Update memory
swain memory forget <memoryId> --json                   # Delete a memory
```

### User & Advisor
```bash
swain user list [--limit=<n>] --json                    # List all users (captains, boats, locations, advisors)
swain user get <userId> --json                          # Get user details with memories and stats
swain advisor list --json                               # List all advisor agents
swain advisor memories --user=<userId> --json           # Read advisor memories for a user
```

### Agent Management
```bash
swain agent list [--type=<type>] --json                 # List agents
swain agent get <agentId> --json                        # Get agent metadata
swain agent run <agentId> "<prompt>" --json             # Run agent with streaming output
```

### Image Generation
```bash
swain image queue "prompt" [--style=<styleId>] [--agent=<agentId>] --json  # Queue async image job
swain image status <jobId> --json                       # Check job status
swain image wait <jobId> [--timeout=seconds] --json     # Poll until image ready
```

### Styles
```bash
swain style list --json                                 # List all card styles
swain style get <styleId> --json                        # Get style details
```

### Beat Reporters
```bash
swain beat list --json                                  # List beat agents
swain beat dispatch --agent-id=<id> --prompt="..." --json  # Dispatch a beat agent task
swain beat run --topic=<topic> --location=<loc> --instructions="..." --json  # Trigger beat reporter
```

### Sources
```bash
swain source list --agent-id=<id> --json                # List agent's data sources
swain source add --agent-id=<id> --name="..." --url="..." --json  # Add data source
swain source remove --agent-id=<id> --source-id=... --json  # Remove source
```

### Workflows & Runs
```bash
swain workflow list --json                              # List workflows
swain workflow trigger [--name=<workflow>] --json        # Trigger workflow
swain workflow status <runId> --json                    # Get workflow run status
swain run status <runId> --json                         # Get agent run status
swain run list [--agent-id=<id>] [--status=<status>] --json  # List agent runs
```

### Sessions
```bash
swain session list <agentId>                            # List agent sessions
swain teleport [sessionId]                              # Beam into agent session locally
swain resume [sessionId]                                # Resume session in original directory
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
- Use `swain <command> --help` for detailed usage on any command
