# Tools Reference

## Skip CLI

The `skip` CLI connects to the Skip API server.

### Beat Reporters
```bash
# Dispatch a generic beat reporter
skip beat run --topic=<topic> --location=<location> [--instructions="..."] [--json]

# List all registered beat reporters
skip beat list [--json]

# Register a new permanent beat
skip beat register --topic=<topic> --location=<location> [--name="..."] [--schedule=daily] [--json]
```

### Library Analysis
```bash
# Analyze card library health and coverage
skip library analyze [--json]
```

### Advisor Communication
```bash
# Read advisor memories (all users or specific user)
skip advisor memories [--user=<userId>] [--json]

# Leave a note for an advisor
skip advisor note --user=<userId> --content="..." [--category=<cat>] [--json]
```

### Cards
```bash
skip card list [--agent=<id>] [--limit=<n>] [--json]
skip card get <cardId> [--json]
skip card library --user=<userId> [--json]
skip card check --agent-id=<id> [--date=<YYYY-MM-DD>] [--json]
```

### Agents
```bash
skip agent list [--type=<type>] [--json]
skip agent get <agentId> [--json]
```

### Users
```bash
skip user get <userId> [--json]
```

## Environment

- `WORKER_URL` - Override API URL
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
