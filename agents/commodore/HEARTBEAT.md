# Heartbeat

These routines run when Pete invokes them or on a scheduled heartbeat.

## On Every Heartbeat

Quick fleet health check (< 2 minutes):

1. **Run health** — Check for failures and stuck runs:
   ```bash
   skip run list --status=failed --json
   skip run list --status=running --json
   ```
   Flag any failures that need retry. Flag runs older than 30 minutes as potentially stuck.

2. **Recent production** — Glance at newest cards:
   ```bash
   skip card list --limit=10 --json
   ```
   Verify cards are being produced. Spot obvious issues.

3. **Beat coverage** — Quick beat list:
   ```bash
   skip beat list --json
   ```
   Verify expected beats are registered.

4. **Status roll-up:**
   - **GREEN** — No failures, production flowing, beats registered
   - **YELLOW** — Some failures but recoverable, or production slower than expected
   - **RED** — Multiple failures, no recent production, or critical beats missing

   If GREEN → `HEARTBEAT_OK`. If YELLOW/RED → report details to Pete.

## Daily Fleet Review

When asked for a daily review:

1. **Run success rate** (last 24h):
   ```bash
   skip run list --json
   ```
   Calculate: successful / total runs. Target: >90%.

2. **Card production by agent/location:**
   ```bash
   skip card list --limit=50 --json
   ```
   Count cards produced in last 24h, grouped by agent and location.

3. **Expiration check** — Identify timely cards expiring within 24h.

4. **Briefing delivery** — Check advisor output:
   ```bash
   skip briefing list --limit=20 --json
   ```
   Are advisors creating briefings? Any gaps?

5. **Coverage gaps** — Any location with fewer than 5 active cards:
   ```bash
   skip card audit --json
   ```

6. **Status report format:**
   ```
   FLEET STATUS: [GREEN/YELLOW/RED]

   Runs (24h): X/Y successful (Z%)
   Cards produced: N new cards across M locations
   Briefings: K briefings delivered to L users
   Expiring: P cards expire within 24h

   Issues:
   - [list any YELLOW/RED items]

   Recommended actions:
   - [specific next steps]
   ```

## Weekly Fleet Review

When asked for a weekly review:

1. **Full fleet inventory:**
   - Total beat agents by topic and location
   - Active advisors and their captains
   - Mr. Content status

2. **Production trends:**
   - Cards produced this week vs last week
   - Run success rate trend
   - New agents provisioned

3. **Coverage map** — All 10 locations:
   - Cards per location (total, evergreen, timely)
   - Beat agents per location
   - Gaps: locations missing core beats

4. **Advisor performance:**
   ```bash
   skip advisor memories --json
   skip briefing list --limit=50 --json
   ```
   - Briefings per advisor this week
   - Memory growth (are advisors learning about their captains?)

5. **Mr. Content check-in:**
   - Message Mr. Content via sessions_send: "Weekly check-in. What's your editorial status? Any blockers?"
   - Review his response and include in report

6. **Expansion recommendations:**
   - Locations that need more beats
   - Topics that should be covered fleet-wide but aren't
   - New location candidates

7. **Report to Pete** with full status, trends, and recommendations.

## Monthly Strategy Review

When asked for a monthly review:

1. Total cards produced this month by location and topic
2. Fleet growth: new agents, new locations, new advisors
3. Run reliability: success rate, common failure modes
4. Advisor engagement: briefing frequency, memory depth
5. Coverage completeness: what percentage of location x topic matrix is filled
6. Strategic recommendations for next month
