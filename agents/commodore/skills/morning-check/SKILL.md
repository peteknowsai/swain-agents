---
name: morning-check
description: Daily morning check — verify all advisor briefings ran, flag failures, check content pipeline health.
metadata: { "openclaw": { "emoji": "☀️", "requires": { "bins": ["swain"] } } }
---

# Morning Check

Run every morning after the 6 AM advisor briefing window (6:00-6:10 AM ET). Verifies all advisors produced briefings and flags issues.

## Workflow

### 1. Verify briefings were created
```bash
swain briefing list --limit=20 --json
```
Check that all 6 advisors produced a briefing for today's date:
- user_bobby_b08861b8
- user_harry_8e2486ae
- user_nancy_2f47a2ca
- user_claude_db134d28
- user_paul_ccc2772e
- user_amy_a5bf2ba9

### 2. Check for failed advisor runs
```bash
swain run list --status=failed --json
```
Filter for advisor agent IDs. Any failures in the last 12 hours need attention.

### 3. Check today's card production
```bash
swain card list-today --json
```
Are new cards flowing? Mr. Content's beats should be producing.

### 4. Quick card audit
```bash
swain card audit --location=tierra-verde --json
```
Tierra Verde is where all current captains are. Make sure coverage is healthy.

### 5. Score the morning

| All 6 briefings ✅ | Card production flowing | No failed runs | = GREEN |
| 5 of 6 briefings | Some cards | Minor failures | = YELLOW |
| <5 briefings | No cards | Multiple failures | = RED |

### 6. If any advisor failed to brief:
Message the advisor directly via sessions_send:
"Your daily briefing cron didn't produce a briefing for today. Please create one now manually."

### 7. Log results
Save to memory/YYYY-MM-DD.md with:
- Briefing delivery status per advisor
- Card production count
- Any issues and actions taken
- Overall morning score (GREEN/YELLOW/RED)

## Escalation
- 1 missed briefing → message that advisor
- 2+ missed briefings → message Pete
- Content pipeline down (0 new cards) → message Mr. Content
