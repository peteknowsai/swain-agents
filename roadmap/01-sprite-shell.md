# Part 1: Sprite Shell

## Goal

A Docker container that can receive an HTTP message, feed it to Claude Code, and return the reply over HTTP. No Fly, no iMessage, no Convex — just the core runtime loop working in isolation.

## What Gets Built

```
sprite/
  channel/
    index.ts          # Bun HTTP server (channel MCP server)
    tools.ts          # reply() MCP tool — POSTs back to caller
    health.ts         # GET /health
  init.sh             # Entrypoint: starts channel server, manages Claude Code lifecycle
  Dockerfile          # Based on node/bun image, installs Claude Code CLI + swain binary
```

## How It Works

1. Channel server starts on port 8080
2. `POST /message` arrives with `{ text: "hello" }`
3. Channel server starts Claude Code with `--channel` pointing to itself
4. Claude Code reads CLAUDE.md, receives the message as a channel notification
5. Claude Code calls the `reply()` MCP tool with its response
6. `reply()` POSTs to the callback URL provided in the original message
7. Claude Code exits (turn complete), channel server marks idle

## Key Questions to Resolve

- **Claude Code `--channel` flag**: Verify this is the right mechanism. Check Claude Code docs for channel/MCP server integration. The channel server needs to push messages into a running Claude Code session.
- **Claude Code install in Docker**: Verify `claude` CLI installs cleanly in a container. Check if it needs interactive auth or can use `ANTHROPIC_API_KEY` env var.
- **Process lifecycle**: Does Claude Code exit after processing one turn, or does it stay alive waiting? We need it to exit so Fly auto-stop works.
- **MCP server registration**: How does Claude Code discover the channel MCP server? Via `.claude/settings.json`? Via CLI flags?

## Acceptance Criteria

- [ ] `docker build` produces a working image
- [ ] `docker run` starts the channel server, healthcheck passes
- [ ] `curl POST /message` with a simple prompt → Claude Code starts, processes, calls `reply()` → callback receives the response
- [ ] Claude Code exits after completing the turn
- [ ] Second `POST /message` starts a fresh Claude Code session
- [ ] `/health` reports Claude Code state correctly (running/idle)

## Out of Scope

- Fly deployment (Part 2)
- Actual advisor persona (Part 4)
- Persistent disk layout (Part 4)
- iMessage (Part 3)
- Crons (Part 5)

## Estimated Effort

Small. Mostly figuring out Claude Code's channel/MCP integration model and getting the Dockerfile right. The channel server itself is ~100 lines of Bun.
