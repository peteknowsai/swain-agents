# Part 5: Crons + Lifecycle

## Goal

Bridge manages scheduled tasks (briefings, watchdogs, maintenance) and Sprite lifecycle (wake, sleep, health). Advisors run their daily routines without human intervention.

## What Gets Built

```
bridge/
  lib/
    cron-scheduler.ts          # In-memory cron scheduler (croner)
    sprite-lifecycle.ts        # Wake/sleep/health management
  routes/
    crons.ts                   # CRUD: POST/GET/DELETE /crons
```

```
sprite/
  channel/
    index.ts                   # Add POST /cron endpoint
```

## Cron System

**Bridge owns all scheduling.** Sprites can't schedule their own crons because they auto-stop when idle.

**Cron definitions stored in Convex:**
```
{ spriteId, name, schedule, payload, enabled, timezone }
```

Examples:
- `{ name: "briefing", schedule: "0 6 * * *", timezone: "America/New_York", payload: { skill: "briefing" } }`
- `{ name: "briefing-watchdog", schedule: "0 10 * * *", payload: { skill: "briefing-watchdog" } }`
- `{ name: "profile-maintenance", schedule: "0 2 * * 1", payload: { skill: "profile" } }`

**When a cron fires:**
1. Scheduler triggers in Bridge
2. Bridge wakes Sprite if stopped (Fly Machines API → start, poll health)
3. Bridge POSTs to Sprite: `POST /cron` with `{ skill: "briefing", ... }`
4. Channel server pushes cron notification into Claude Code
5. Claude Code reads the skill file, does the work, calls `reply()` if there's output
6. Claude Code exits, channel server marks idle
7. Fly auto-stops Sprite after idle timeout

**On Bridge startup:**
- Load all cron definitions from Convex
- Register them with the in-memory scheduler
- If Bridge restarts mid-day, missed crons don't re-fire (idempotency via Convex — check if today's briefing already sent)

## Sprite Lifecycle

**States:** `running` | `stopped` | `starting` | `destroying`

**Wake flow:**
1. Bridge needs to send a message or cron to a Sprite
2. Check state cache (or Fly API if cache is stale)
3. If stopped: `POST /machines/{id}/start`
4. Poll `GET /health` on Sprite until it returns 200 (1-2s typical)
5. Send the message/cron
6. Update state cache

**Sleep flow (automatic):**
1. Claude Code exits after completing a turn
2. Channel server marks idle, updates `/health` response
3. No new messages arrive for N minutes (configurable, default 5)
4. Fly auto-stop kicks in, suspends the Sprite
5. Persistent volume preserved, next wake is fast

**Health monitoring:**
- Bridge periodically pings running Sprites (every 60s)
- If a Sprite is "running" but health fails → log warning, update state
- If a Sprite has been running for >30 min with no activity → investigate (possible stuck process)

## Cron CRUD

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/crons` | Create cron for a Sprite |
| GET | `/crons` | List all crons (optionally filter by spriteId) |
| GET | `/crons/:cronId` | Get single cron |
| DELETE | `/crons/:cronId` | Delete cron |
| PATCH | `/crons/:cronId` | Enable/disable, update schedule |

Provisioning (Part 2) auto-creates the default cron set for each new Sprite.

## Acceptance Criteria

- [ ] Crons fire on schedule and wake sleeping Sprites
- [ ] Sprite receives cron payload, reads correct skill, does work, replies if needed
- [ ] Sprite goes idle → Fly auto-stops it within the timeout window
- [ ] Bridge restart reloads crons from Convex and resumes scheduling
- [ ] Cron CRUD endpoints work — create, list, delete, enable/disable
- [ ] Duplicate cron execution prevented (briefing doesn't send twice if Bridge restarts)
- [ ] Stuck Sprite detection: alert if running too long with no activity

## Out of Scope

- Advanced scheduling (retry on failure, backoff) — keep it simple
- Cron UI — API-only for now
- Per-captain timezone detection (set manually at provision time)

## Estimated Effort

Medium. `croner` handles the scheduling mechanics. Sprite lifecycle is mostly Fly API calls. The subtle part is idempotency and missed-cron handling on Bridge restart.
