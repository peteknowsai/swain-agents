# Part 6: Pete E2E

## Goal

Pete's advisor runs entirely on Bridge. Real iMessage, real crons, real skills. Everything works end-to-end before touching any other user.

## What Happens

This isn't a build phase — it's a shake-down. All the pieces from Parts 1–5 are wired together and tested with a real user (Pete).

### Setup

1. Provision Pete's Sprite via `POST /sprites` with real captain data
2. Register Pete's phone in Convex registry
3. Create Pete's cron set (briefing, watchdog, profile maintenance)
4. Seed Pete's memory from current VPS advisor memory

### Test Checklist

**Messaging:**
- [ ] Text the Swain number → get a reply in character
- [ ] Multi-turn conversation works (within one wake cycle)
- [ ] Long messages handled correctly (iMessage has no real limit, but verify)
- [ ] Images: advisor can send boat art / briefing images via iMessage
- [ ] Typing indicator shows while processing
- [ ] Fast response time — under 10s for simple replies (wall clock)

**Skills:**
- [ ] Briefing cron fires at 6 AM, delivers weather + tides + alerts
- [ ] Briefing watchdog fires at 10 AM, catches missed briefings
- [ ] Profile updates work — tell advisor something new, verify it persists
- [ ] Boat art generates and sends correctly
- [ ] CLI commands work inside the Sprite (`swain user get`, `swain card list`, etc.)

**Lifecycle:**
- [ ] Sprite auto-stops after idle timeout
- [ ] Next message wakes Sprite in under 3s
- [ ] Cron wakes sleeping Sprite correctly
- [ ] CLAUDE.md and memory persist across wake/sleep cycles
- [ ] No state corruption after multiple wake/sleep cycles over days

**Edge cases:**
- [ ] Rapid-fire messages (3 texts in 5 seconds) — handled gracefully, no crashes
- [ ] Message arrives while Sprite is mid-turn — queued or handled
- [ ] Bridge restart doesn't lose in-flight messages
- [ ] Sprite crash mid-turn — channel server recovers, next message works
- [ ] Network blip between Bridge and Sprite — retry logic works

**Parity with current VPS advisor:**
- [ ] Personality matches (warm dock neighbor, not corporate)
- [ ] Captain Rule enforced (no banned words, no jargon)
- [ ] Knowledge queries work (boat specs, marina info, weather)
- [ ] Onboarding flow works for a "new" captain (test with a second phone)

### What Gets Fixed

Everything that breaks. This is the phase where we find:
- Timing issues (Claude Code startup too slow, timeouts)
- Missing env vars or permissions in the Sprite
- Skill logic that doesn't translate cleanly from OpenClaw
- Channel server edge cases (concurrent messages, large payloads)
- Fly-specific quirks (volume mounts, networking, auto-stop behavior)

### Duration

Run Pete on Bridge for at least 1 week before proceeding to Part 7. Daily briefings need to work reliably for 7 consecutive days.

## Acceptance Criteria

- [ ] 7 consecutive days of successful daily briefings
- [ ] At least 20 conversational exchanges that feel natural and in-character
- [ ] No unrecovered crashes or stuck states
- [ ] Wake-from-sleep latency consistently under 3s
- [ ] Pete says "this is at least as good as the current system"

## Out of Scope

- Other users (that's Part 7)
- Performance optimization (if it works, ship it)
- Monitoring dashboards (logs are enough for now)
