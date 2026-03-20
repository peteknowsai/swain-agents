# Bridge Roadmap

Replace OpenClaw/WhatsApp/VPS with Claude Code/iMessage/Fly.io.

## The Parts

| # | Part | What It Delivers | Depends On |
|---|------|-----------------|------------|
| 1 | [Sprite Shell](./01-sprite-shell.md) | Docker image with Claude Code + channel server. Can receive a message over HTTP, run Claude Code, reply over HTTP. No Fly, no iMessage — just a container you can `docker run` and `curl`. | Nothing |
| 2 | [Bridge Gateway](./02-bridge-gateway.md) | Bun server on Fly that routes messages to Sprites, manages registry in Convex, handles provisioning via Fly Machines API. Testable with curl — no iMessage yet. | Part 1 |
| 3 | [iMessage Relay](./03-imessage-relay.md) | Mac mini running BlueBubbles + Cloudflare tunnel. Webhooks flow into Bridge, replies flow back to iMessage. End-to-end messages work. | Part 2 |
| 4 | [CLAUDE.md + Skills](./04-claude-md-skills.md) | Migrate templates + skills from OpenClaw format to Claude Code format. Render captain-specific CLAUDE.md at provision time. Agent actually behaves like a Swain advisor. | Part 1 |
| 5 | [Crons + Lifecycle](./05-crons-lifecycle.md) | Bridge schedules crons, wakes Sprites on schedule, dispatches briefings/watchdogs/maintenance. Sprites auto-sleep correctly. Full advisor lifecycle works. | Parts 2, 4 |
| 6 | [Pete E2E](./06-pete-e2e.md) | Pete's advisor runs entirely on Bridge. Real iMessage, real crons, real skills. Shake out every bug before touching other users. | Parts 1–5 |
| 7 | [Migration + Cutover](./07-migration-cutover.md) | Per-user migration tooling. Move captains from VPS to Fly one at a time. Decommission VPS when done. | Part 6 |

## Principles

- Each part is a deployable, testable increment. No "build everything then pray."
- VPS keeps running the whole time. Both systems share Convex — no conflicts.
- Parts 1 and 4 can run in parallel (no dependency between them).
- Don't optimize Sprite disk size, cost, or performance until real users are on it.
