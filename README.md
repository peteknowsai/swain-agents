# swain-agents

Infrastructure for the Swain platform's OpenClaw agents — CLI tools, API server, provisioning templates, and deployment configs.

Agent workspaces live on the VPS (`/root/workspaces/`) and are managed by OpenClaw directly. They self-modify and are backed up, not version-controlled.

## Structure

```
cli/             # Swain CLI (TypeScript/Bun) — tools agents use to talk to the backend
api/             # Swain Agent API — provisioning and management endpoints
skills/          # Canonical skill definitions (seeds for agent workspaces)
templates/       # Workspace templates for provisioning new advisors
deploy/          # Deployment configs, systemd services, cron schedules
scripts/         # Utility scripts (health checks, etc.)
```

## VPS

Agents run on an OpenClaw gateway on the VPS. The repo is cloned at `/root/clawd/swain-agents/` — the API server runs from there.

Agent workspaces at `/root/workspaces/` are the live, evolving source of truth for agent definitions.

## Installing the CLI

```bash
curl -fsSL https://raw.githubusercontent.com/peteknowsai/swain-agents/main/cli/install.sh | bash
```

Pin a version: `SWAIN_VERSION=v0.5.0 curl -fsSL ... | bash`
