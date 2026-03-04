# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Repo Is

Infrastructure for the Swain platform's OpenClaw agents. This is **not** where agents live — agent workspaces are on the VPS at `/root/workspaces/` and self-modify at runtime. This repo contains only the tools and infrastructure those agents depend on.

## Build & Test

```bash
# CLI (from cli/)
cd cli && bun install
bun run build          # compiles to cli/bin/swain
bun run test           # vitest
bun run test:watch     # vitest watch mode

# API (from api/) — no build step, runs directly with Bun
bun run start          # bun run index.ts (port 3847)
bun run dev            # bun --watch run index.ts
```

## Architecture

**Two services, one shared backend:**

- **`cli/`** — The `swain` CLI that agents use to interact with the Convex backend. Compiles to a standalone binary via `bun build --compile`. Calls Convex HTTP actions at `https://wandering-sparrow-224.convex.site` (prod). Dev override via `SWAIN_API_URL` env var. All commands go through `lib/worker-client.ts` which handles auth, retries, and environment detection.

- **`api/`** — Advisor provisioning API (Bun server, port 3847). Runs on the VPS. Three endpoints: `POST /advisors` (provision), `GET /advisors` (list/lookup), `DELETE /advisors/:agentId`. Provisioning creates an OpenClaw workspace at `/root/workspaces/`, registers the agent with `openclaw agents add`, copies auth profiles, and seeds Honcho memory.

**Supporting directories:**

- **`skills/`** — Canonical OpenClaw skill definitions (SKILL.md files). Single source of truth. On the VPS, `~/.openclaw/skills/swain-cli` is a global symlink to the repo, and each agent workspace symlinks its `skills/` directory here too. A `git pull` updates all agents immediately.

- **`templates/`** — Workspace templates for new advisors (AGENTS.md, TOOLS.md, HEARTBEAT.md). Used by `api/provision.ts` — rendered with `{{userId}}` placeholders.

## VPS Deployment

The VPS (hostname in `$VPS_HOST`) runs two things:
1. **OpenClaw gateway** — agent runtime (systemd: `openclaw.service`)
2. **Swain Agent API** — this repo's `api/` (systemd: `swain-agent-api.service`, working dir: `/root/clawd/swain-agents/api`)

The repo is cloned on the VPS at `/root/clawd/swain-agents/`. Deploying is:
```bash
ssh root@$VPS_HOST "cd /root/clawd/swain-agents && git pull"
```

For `api/` changes, GitHub Actions auto-deploys on push to main (pulls and restarts the service).

For `skills/` changes, `git pull` updates all skills immediately — both the global `swain-cli` symlink and all workspace skill symlinks resolve to `skills/` in this repo.

## Key Conventions

- The CLI outputs JSON with `--json` flag. Agents always use `--json`. Human-readable output is the default.
- `workerRequest()` in `lib/worker-client.ts` auto-prefixes paths with `/api` for Convex HTTP routes.
- Agent provisioning generates workspace files from templates + `generateSoul()`, `generateIdentity()`, `generateUser()` in `api/templates.ts`. Captain data is NOT baked into workspace files — advisors pull fresh data from Convex at runtime.
- The provisioning registry at `/root/swain-agent-api/registry.json` maps `userId → agentId`.
