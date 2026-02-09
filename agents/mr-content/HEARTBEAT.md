# Heartbeat

These routines run when Pete invokes them or on a scheduled heartbeat.

## On Every Heartbeat

Quick health check (< 2 minutes):
1. `skip run list --status=running --json` — check for stuck or long-running reporters
2. `skip run list --status=failed --json` — check for failures that need retry
3. `skip card list --limit=10 --json` — glance at newest cards, spot any obvious issues
4. Check if any timely cards are expiring today/tomorrow
5. If something needs attention, report it. Otherwise, HEARTBEAT_OK.

## Daily Library Review

When asked for a daily review:

1. **Coverage audit by location** — For each Port32 marina, count active cards:
   ```bash
   skip card list --limit=100 --json
   ```
   Flag any location with fewer than 5 active cards.

2. **Expiration check** — Identify timely cards expiring within 24 hours that need refresh (weather, tides, events, fishing reports).

3. **Run status** — Check all recent runs:
   ```bash
   skip run list --json
   ```
   Identify failures, retry if needed.

4. **Quality spot-check** — Read 2-3 recent cards in detail. Are they good enough? Local enough? Would Austin be proud?

5. **Dispatch recommendations** — Based on gaps, propose which reporters to send where.

6. **Advisor pulse** — Check advisor memories for emerging captain interests:
   ```bash
   skip advisor memories --json
   ```

## Weekly Deep Research

When asked for a weekly review:

1. **Magazine scan** — Scrape Boating Mag, Salt Water Sportsman, Discover Boating for new article ideas:
   ```bash
   FIRECRAWL_API_KEY=... firecrawl scrape https://www.boatingmag.com/how-to/ --only-main-content
   ```

2. **Coverage map** — Full audit of all 10 locations:
   - Cards per location (total, evergreen, timely)
   - Beat agents per location
   - Gaps: locations missing core beats (fishing, destinations, dining, port32)

3. **Seasonal planning** — What's coming in the next 2-4 weeks?
   - Fishing seasons opening/closing
   - Weather pattern shifts
   - Local events (boat shows, tournaments, festivals)
   - Holidays affecting boating

4. **Port32 content audit** — Are we showcasing each marina's unique amenities?
   - Does every location have a "First-Timer's Guide"?
   - Does every location reference its Port32 services naturally?

5. **Advisor insights review** — What are captains across all locations asking about?

6. **New beat proposals** — Should we create new agents for emerging topics?

7. **Copycat pipeline** — Queue up 5-10 magazine articles to adapt into localized cards.

## Monthly Strategy Review

When asked for a monthly review:

1. Total cards produced this month by location
2. Card engagement data (served counts, thumbs up/down)
3. Which beats are producing the best content
4. Which locations need more investment
5. Port32 expansion — any new marinas coming online?
6. Content strategy adjustments for Pete
