---
name: beat-monitoring
description: Monitor specific beat output — runs, cards produced, freshness, reliability.
metadata: { "openclaw": { "emoji": "📡", "requires": { "bins": ["swain"] } } }
---

# Beat Monitoring

Drill into a specific beat reporter's performance, or scan all beats for issues.

## Check a specific beat

### Recent runs
```bash
swain run list --agent-id=<beat-agent-id> --json
```
Look at: success/failure rate, last run time, run duration.

### Cards produced
```bash
swain card list --agent=<beat-agent-id> --json
```
Look at: total cards, most recent card date, card quality (titles, content length).

### Coverage audit for that agent
```bash
swain card audit --agent=<beat-agent-id> --json
```
Check: are cards fresh? Any expired timely content?

## Scan all beats

### List all beat agents
```bash
swain beat list --json
```

### For each beat, check:
1. **Last successful run** — When did it last produce something?
2. **Failure rate** — Is this beat reliable?
3. **Card count** — Is it producing enough?
4. **Freshness** — Are timely cards being refreshed?

## Beat Health Indicators

| Indicator | Healthy | Warning | Critical |
|-----------|---------|---------|----------|
| Last run | <24h ago | 1-3 days | >3 days |
| Success rate | >90% | 70-90% | <70% |
| Cards produced | Growing | Flat | Declining |
| Timely freshness | All current | Some expiring | Expired with no replacement |

## Common Issues

1. **Beat keeps failing** — Check run error messages. May need prompt adjustment or source fix.
2. **Beat produces low-quality cards** — Flag to Mr. Content for prompt improvement.
3. **Beat not registered** — Location/topic gap. Recommend provisioning to Mr. Content.
4. **Timely content expired** — Dispatch immediate refresh via Mr. Content.

## Escalation

If a beat issue requires editorial decision (what to write, how to improve quality):
→ Message Mr. Content via sessions_send with specific details.

If a beat issue is infrastructure (CLI errors, API failures):
→ Report to Pete directly.
