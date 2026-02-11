---
name: advisor-oversight
description: Monitor advisor performance — briefings, runs, sessions, card availability.
metadata: { "openclaw": { "emoji": "🔭", "requires": { "bins": ["swain"] } } }
---

# Advisor Oversight

Monitor advisor agents to ensure captains are being well-served.

## What You CAN Do

### List briefings (all users or specific user)
```bash
swain briefing list --json                          # All recent briefings
swain briefing list --user=<userId> --json          # Briefings for one user
swain briefing list --user=<userId> --limit=5 --json
```

### Read a specific briefing
```bash
swain briefing get <briefingId> --json
```
Returns: greeting, card selections, commentary, closing note, date, items.

### Check advisor agent details
```bash
swain agent list --type=advisor --json              # All advisor agents
swain agent get <advisorId> --json                  # Specific advisor
```

### Check advisor run history
```bash
swain run list --agent-id=<advisorId> --json        # Advisor's runs
swain run list --agent-id=<advisorId> --status=failed --json  # Failed runs
```

### Check advisor sessions
```bash
swain session list <advisorId>                      # List sessions
```

### Check card availability for a location
```bash
swain card audit --location=<loc> --json            # What's available for advisors
swain card list --limit=20 --json                   # Recent cards across fleet
```

## What You CANNOT Do (CLI gaps)

These capabilities don't exist in the CLI yet:

| Action | Status | Workaround |
|--------|--------|------------|
| **Read advisor memories** | No CLI command | Ask Pete — data is in DB (`advisor_memories` table) |
| **Trigger briefing creation** | No CLI command | API exists (`POST /users/:userId/briefing`) but no CLI wrapper |
| **Edit a briefing** | No API at all | Not possible — briefings are immutable once created |
| **Delete a briefing** | API only | `DELETE /briefings/dashboard/:briefingId` — no CLI |
| **Leave notes for advisors** | No CLI or API | Doesn't exist yet |
| **Get user details** | No CLI command | API exists (`GET /dashboard/users/:userId`) |

**When you hit a gap:** Tell Pete what you need and suggest adding the CLI command.

## Advisor Health Indicators

| Indicator | Healthy | Warning | Critical |
|-----------|---------|---------|----------|
| Briefing frequency | Regular delivery | Gaps >3 days | No briefings in 7+ days |
| Run success | Recent successful runs | Some failures | All recent runs failed |
| Card availability | Location has 10+ cards | 5-10 cards | <5 cards for location |
| Session activity | Recent sessions | Quiet >3 days | No sessions ever |

## What to Look For

1. **Silent advisors** — Advisors with no recent briefings or runs
2. **Failed runs** — Advisor sessions that errored out
3. **Content-starved advisors** — If a captain's location has few cards, the advisor can't build good briefings
4. **Stale briefings** — Briefings that reuse the same cards repeatedly (check via briefing get)

## Monitoring Workflow

1. `swain agent list --type=advisor --json` → inventory
2. For each advisor, `swain run list --agent-id=X --json` → run health
3. `swain briefing list --json` → briefing production
4. `swain card audit --json` → card availability per location
5. Compile status and report

## Escalation

- **Content gap affecting advisor** → Message Mr. Content: "Advisor for [user] at [location] needs more cards"
- **Advisor infrastructure issue** → Report to Pete
- **Need to trigger briefing** → Ask Pete (or request `swain briefing create` CLI command)
