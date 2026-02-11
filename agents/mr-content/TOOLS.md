# Tools Reference

## Skip CLI

The `swain` CLI connects to the Skip API server.

### Beat Reporters
```bash
# Dispatch a generic beat reporter
swain beat run --topic=<topic> --location=<location> [--instructions="..."] [--json]

# List all registered beat reporters
swain beat list [--json]

# Register a new permanent beat
swain beat register --topic=<topic> --location=<location> [--name="..."] [--schedule=daily] [--json]
```

### Library Analysis
```bash
# Analyze card library health and coverage
swain library analyze [--json]
```

### Advisor Communication
```bash
# Read advisor memories (all users or specific user)
swain advisor memories [--user=<userId>] [--json]

# Leave a note for an advisor
swain advisor note --user=<userId> --content="..." [--category=<cat>] [--json]
```

### Cards
```bash
swain card list [--agent=<id>] [--limit=<n>] [--json]
swain card get <cardId> [--json]
swain card library --user=<userId> [--json]
swain card check --agent-id=<id> [--date=<YYYY-MM-DD>] [--json]
```

### Agents
```bash
swain agent list [--type=<type>] [--json]
swain agent get <agentId> [--json]
```

### Users
```bash
swain user get <userId> [--json]
```

## Environment

- `WORKER_URL` - Override API URL
- Auto-detects local dev server at `http://localhost:8787`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when parsing output programmatically.
