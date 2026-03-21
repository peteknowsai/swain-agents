# Bridge Architecture

## Overview

Swain advisors run as Claude Code instances inside Sprites (persistent microVMs on sprites.dev). A central Bridge on the VPS routes messages between captains and their advisors via Discord and iMessage.

```
[Captain's Phone]
      │ iMessage
      ▼
[Mac mini: BlueBubbles]
      │ webhook (Cloudflare tunnel)
      ▼
[VPS: Bridge]  ◄──── Discord bot gateway
      │ lookup sender → sprite
      │ wake sprite if sleeping
      │ POST /message
      ▼
[Sprite: Channel Server → claude -p --resume]
      │ processes message
      │ POST /sprites/:id/reply
      ▼
[VPS: Bridge]
      │ route reply to correct channel
      ▼
[iMessage or Discord]
```

## Components

### Bridge (VPS)

Always-on Bun server on the VPS. The nerve center.

- **Discord bot** — holds gateway connection, receives/sends Discord messages
- **BlueBubbles webhook handler** — receives inbound iMessages
- **BlueBubbles API client** — sends outbound iMessages
- **Sprite router** — looks up sender → sprite, wakes sprite, forwards messages
- **Reply relay** — receives replies from Sprites, routes to correct channel

**URL:** `https://bridge.heyswain.com` (Cloudflare tunnel → VPS port 3848)

### Channel Server (per Sprite)

Lightweight Bun HTTP server running as a Sprite service. Auto-starts on incoming HTTP requests (Sprite wake).

- Receives `POST /message` from Bridge
- Runs `claude -p --resume <session-id>` with the message
- Captures JSON output, extracts response + session ID
- POSTs reply back to Bridge
- Persists session ID to disk for conversation continuity

**URL:** `https://<sprite-name>-bas32.sprites.app` (port 8080)

### Mac mini (iMessage)

Dedicated Mac mini running BlueBubbles with Private API enabled.

- Receives iMessages via Messages.app
- Fires webhooks to Bridge on new messages
- Sends outbound iMessages via BlueBubbles REST API
- Runs as a headless server with SIP disabled

**URL:** `https://messages.heyswain.com` (Cloudflare tunnel → port 1234)

## Data Architecture

### Three layers

| Layer | What | Where | Purpose |
|-------|------|-------|---------|
| **Convex** | Platform data | Cloud | User accounts, auth, billing, agent registry, provisioning, admin |
| **Stoolap** | Per-agent structured data | Sprite disk | Boats, cards, briefings, weather, waypoints, tasks |
| **Files** | Per-agent memory + media | Sprite disk | Captain knowledge, conversation notes, photos, documents |

### Design principles

- **Local-first.** Advisors read and write locally. Fast, no network dependencies.
- **No sync jobs.** Operational knowledge flows agent-to-agent through the Bridge in real-time.
- **Convex is platform-only.** User accounts, registry, billing. Not captain data.
- **Agent-to-agent messaging.** When an advisor needs to tell a desk agent something, it sends a message through the Bridge. No shared database.

## Sprite Filesystem Layout

Every advisor Sprite gets this structure at provisioning. Most files start empty — Claude fills them in over time as it learns about the captain.

```
/home/sprite/
  CLAUDE.md                          # Persona, rules, captain profile, skill refs

  .claude/
    memory/                          # Claude Code native memory system
      MEMORY.md                      # Index

      # Captain
      captain.md                     # Name, background, experience level, personality
      family.md                      # Partner, kids, pets, who comes aboard
      work.md                        # Job, schedule, availability patterns
      preferences.md                 # Comms style, briefing time, topics they love/hate
      goals.md                       # Sailing goals, bucket list, this season's plans
      health.md                      # Seasickness, mobility, allergies, medical

      # Boat
      boat.md                        # Name, make, model, year, LOA, beam, draft, hull
      systems.md                     # Engine, electrical, plumbing, electronics, rigging
      maintenance.md                 # Repair history, scheduled work, refit projects
      upgrades.md                    # Wishlist, in-progress, completed
      issues.md                      # Known problems, quirks, things to watch
      inventory.md                   # Safety gear, spare parts, tools aboard
      fuel-water.md                  # Tank capacities, consumption rates, range

      # Location
      marina.md                      # Home marina, slip, dock neighbors, facilities
      local-knowledge.md             # Anchorages, fuel docks, chandleries, restaurants
      cruising-grounds.md            # Familiar waters, favorite spots, routes taken
      tides-currents.md              # Local patterns, tricky spots, timing notes

      # Activities
      cruising.md                    # Trip plans, destinations, itineraries, logbook
      fishing.md                     # Spots, species, gear, licenses, seasons
      racing.md                      # Club, class, schedule, crew, results
      entertaining.md                # How they use the boat socially, guest preferences
      diving.md                      # Spots, certifications, gear
      watersports.md                 # Skiing, wakeboarding, paddleboarding, kayaking

      # Operations
      safety.md                      # Certifications, equipment, emergency contacts
      weather.md                     # Sensitivity, comfort thresholds, go/no-go criteria
      insurance.md                   # Policy, survey dates, requirements, agent
      budget.md                      # Spending patterns, priorities, cost sensitivity
      schedule.md                    # Seasonal schedule, haul-out, storage, commissioning
      regulations.md                 # Local rules, permits, registration, zones

      # Community
      social.md                      # Dock neighbors, yacht club, boating friends, crew
      services.md                    # Trusted mechanics, canvas, electronics, detailers
      vendors.md                     # Parts suppliers, online stores, preferred brands

      # Daily
      notes/
        YYYY-MM-DD.md                # Conversation notes, observations

  stoolap/
    knowledge.db                     # Vector embeddings, semantic search
    boats.db                         # Structured boat data, specs, dimensions
    cards.db                         # Briefing cards — weather, tides, alerts, notices
    briefings.db                     # Briefing history, delivery status, content
    scans.db                         # Boat scan data, condition reports
    tasks.db                         # Captain's to-do list, reminders, follow-ups
    contacts.db                      # Captain's boating contacts, service providers
    waypoints.db                     # Saved locations, routes, anchorages with coords
    weather-history.db               # Historical weather for their area, patterns

  media/
    boat-photos/                     # Boat pics, damage photos, project progress
    documents/                       # Registration, insurance, manuals, surveys, PDFs
    charts/                          # Saved routes, annotated charts, anchorage notes
    receipts/                        # Maintenance receipts, purchase records
    exports/                         # Anything generated for the captain

  logs/
    briefings/                       # Every briefing delivered, full content
      YYYY-MM-DD.md
    conversations/                   # Conversation summaries, key exchanges
      YYYY-MM-DD.md
    weather/                         # Daily weather snapshots
      YYYY-MM-DD.json
    maintenance/                     # Maintenance log entries
      YYYY-MM-DD.md

  skills/                            # Skill files (read on demand)
    briefing.md
    onboarding.md
    profile.md
    boat-art.md
    boat-scan.md
    card-create.md
    cli.md
```

## Session Management

Each captain has one persistent Claude Code session. Messages resume the same session via `claude -p --resume <session-id>`. Session IDs are persisted to `/home/sprite/.claude-sessions/sessions.json` and survive Sprite sleep.

With a 1M token context window, a single session can hold months of casual conversation. Claude Code's compact handles cleanup when context gets large.

Cron tasks (briefings, maintenance) run in separate sessions but read the same memory files.

## Sprite Lifecycle

1. Captain sends a message (iMessage or Discord)
2. Bridge receives it, looks up the captain's Sprite
3. Bridge hits Sprite URL → Sprite wakes (100-500ms warm, 1-2s cold)
4. Sprite service auto-starts the channel server
5. Channel server runs `claude -p --resume` with the message
6. Claude processes, writes to memory if needed, responds
7. Channel server POSTs reply to Bridge
8. Bridge sends reply via iMessage or Discord
9. Sprite goes idle → eventually sleeps

## Agent-to-Agent Communication

Agents communicate through the Bridge. An advisor that learns something relevant to a desk agent sends a message:

```
POST https://bridge.heyswain.com/sprites/baja-desk/message
{
  "text": "Incoming vessel: Sea Spirit, arriving mid-April, captain Pete",
  "chatId": "agent:swain-advisor",
  "user": "swain-advisor"
}
```

The desk agent receives it like any other message, processes it, writes to its own memory. No shared database, no sync jobs. Real-time, event-driven.

## Infrastructure

| Component | Runs On | URL | Survives Reboot |
|-----------|---------|-----|-----------------|
| Bridge | VPS (Hostinger) | bridge.heyswain.com | systemd service (TODO) |
| BlueBubbles | Mac mini | messages.heyswain.com | LaunchAgent |
| Cloudflared (VPS) | VPS | — | systemd service |
| Cloudflared (Mac) | Mac mini | — | LaunchDaemon |
| Advisor Sprites | sprites.dev | *.sprites.app | Auto-wake on HTTP |
| Convex | Cloud | wandering-sparrow-224.convex.site | Managed |

## Cost

| Component | Cost |
|-----------|------|
| Sprites (per advisor, mostly sleeping) | ~$1-2/mo |
| VPS (existing Hostinger) | Already paid |
| Mac mini (owned) | $0/mo |
| Cloudflare tunnels | Free |
| Convex | Free tier |
| Claude API (Sonnet for chat) | Usage-based |
