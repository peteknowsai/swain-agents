---
name: fleet-status
description: Full fleet health scan — agents, runs, cards, briefings. Produces GREEN/YELLOW/RED status report.
metadata: { "openclaw": { "emoji": "⚓", "requires": { "bins": ["skip"] } } }
---

# Fleet Status

Comprehensive fleet health scan across all agent types. Produces a single status report with GREEN/YELLOW/RED indicators.

## Full Fleet Scan

Run these commands and compile results:

### 1. Agent inventory
```bash
skip agent list --json
```
Count agents by type (beat, advisor, editor). Verify expected count.

### 2. Run health (last 24h)
```bash
skip run list --json
```
Calculate success rate. Flag any failures with agent IDs.

### 3. Failed runs (needs attention)
```bash
skip run list --status=failed --json
```
List each failure with agent ID, timestamp, and error if available.

### 4. Card production
```bash
skip card list --limit=20 --json
```
Count recent cards. Check production is flowing.

### 5. Coverage audit
```bash
skip card audit --json
```
Identify locations with thin coverage (<5 active cards).

### 6. Beat agents
```bash
skip beat list --json
```
Verify all expected beats are registered and active.

### 7. Briefing delivery
```bash
skip briefing list --limit=20 --json
```
Check advisors are producing briefings.

## Status Categories

| Category | GREEN | YELLOW | RED |
|----------|-------|--------|-----|
| **Runs** | >90% success | 70-90% success | <70% success |
| **Production** | Cards flowing daily | Gaps >24h | No cards in 48h+ |
| **Coverage** | All locations >5 cards | Some locations <5 | Any location at 0 |
| **Beats** | All expected beats active | Some missing | Critical beats missing |
| **Briefings** | All advisors delivering | Some gaps | Multiple advisors silent |

## Report Format

```
FLEET STATUS: [GREEN/YELLOW/RED] (worst category determines overall)

📊 Runs: [GREEN/YELLOW/RED] — X/Y successful (Z%)
📦 Production: [GREEN/YELLOW/RED] — N cards in last 24h
🗺️ Coverage: [GREEN/YELLOW/RED] — M locations with adequate coverage
📡 Beats: [GREEN/YELLOW/RED] — P/Q beats active
📬 Briefings: [GREEN/YELLOW/RED] — K briefings in last 24h

Issues requiring attention:
1. [specific issue + recommended action]
2. [specific issue + recommended action]

Fleet inventory: X beat agents, Y advisors, Z editors
```
