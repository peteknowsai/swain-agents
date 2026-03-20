# Part 2: Bridge Gateway

## Goal

A Bun server running on Fly that routes messages to the right Sprite, manages the phone→Sprite registry in Convex, and provisions/destroys Sprites via Fly Machines API.

## What Gets Built

```
bridge/
  index.ts                    # Main server entry
  routes/
    webhooks.ts               # POST /webhooks/bluebubbles (stubbed for now)
    sprites.ts                # CRUD: POST/GET/DELETE /sprites
    admin.ts                  # GET /health, POST /admin/rollout
  lib/
    fly-machines.ts           # Fly Machines API client (create, start, stop, destroy, list)
    registry.ts               # Convex-backed phone→spriteId registry
    provisioning.ts           # Orchestrates: create machine → wait healthy → bootstrap → register
  fly.toml                    # Fly config for the Bridge machine
  Dockerfile
```

## How It Works

**Provisioning (`POST /sprites`):**
1. Receives captain data (name, phone, userId, boat info)
2. Calls Fly Machines API to create a Sprite with the pre-built image from Part 1
3. Attaches a persistent volume, sets env vars
4. Waits for Sprite health check to pass
5. Calls `POST /bootstrap` on Sprite with captain data (CLAUDE.md rendering happens in Part 4 — for now, a stub)
6. Registers phone→spriteId in Convex
7. Returns spriteId

**Message routing (for Part 3 — stubbed here):**
1. Inbound arrives with phone + text
2. Lookup phone → spriteId in registry
3. Check Sprite state, wake if stopped
4. POST to Sprite's channel server
5. Sprite replies via `POST /sprites/:spriteId/reply`
6. Bridge forwards to outbound (BlueBubbles in Part 3 — logged here)

**Admin:**
- `GET /sprites` — list all Sprites with status
- `DELETE /sprites/:spriteId` — destroy machine + volume, remove from registry
- `GET /health` — Bridge health
- `POST /admin/rollout` — update Sprite image refs (for future deploys)

## Key Questions to Resolve

- **Fly Machines API auth**: API token via `FLY_API_TOKEN` env var. Verify token scopes needed.
- **Fly internal networking**: Sprites reachable via `[spriteId].vm.[app].internal:8080` on Fly's private network? Or by machine ID?
- **Volume creation**: Can volumes be created and attached in a single Machines API call, or is it two steps?
- **Sprite auto-stop config**: Set via Machines API at create time? What's the API shape?

## Acceptance Criteria

- [ ] Bridge deploys to Fly, healthcheck passes
- [ ] `POST /sprites` provisions a real Sprite on Fly, returns spriteId
- [ ] Sprite's channel server is reachable from Bridge over Fly internal network
- [ ] `POST /sprites/:spriteId/reply` receives and logs the reply
- [ ] `GET /sprites` lists all Sprites with status (running/stopped)
- [ ] `DELETE /sprites/:spriteId` destroys the Sprite and removes from Convex
- [ ] Registry lookups work: phone → spriteId via Convex

## Out of Scope

- BlueBubbles integration (Part 3)
- CLAUDE.md rendering (Part 4)
- Cron scheduling (Part 5)

## Estimated Effort

Medium. Fly Machines API client is the bulk of the work. Registry is simple Convex queries. Provisioning orchestration ties it together.
