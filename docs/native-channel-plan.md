# Native Channel Architecture for Swain Advisors

## The Problem

`claude -p` is a one-shot batch process. The agent can't send messages while working or receive messages while thinking. This breaks onboarding (needs to say "give me a few minutes" then build a briefing) and will break any future multi-step task that requires mid-task communication.

## The Solution

Use Claude Code's native channel system. Each sprite runs Claude Code as a persistent interactive process with a channel MCP server that bridges to the VPS.

## Architecture

```
Captain's iPhone
    ↕ iMessage
Mac mini (BlueBubbles)
    ↕ webhook / API
VPS Bridge (port 3848)
    ↕ sprite exec
Sprite
    └─ Claude Code (persistent, interactive)
         └─ swain-channel (MCP server, channel plugin)
              ├─ receives messages via file drop from sprite exec
              ├─ pushes them into Claude as <channel> notifications
              ├─ exposes reply tool → POSTs back to Bridge
              └─ exposes permission relay (future: approve from iMessage)
```

## How Messages Flow

### Inbound (captain → advisor)

1. Captain sends iMessage
2. BlueBubbles webhook → Bridge
3. Bridge looks up sprite name from registry
4. Bridge runs `sprite exec -s <name> -- swain-channel-send "<message>" "<chatId>"`
5. `swain-channel-send` writes message to a drop file: `/home/sprite/.channel/inbox/<timestamp>.json`
6. The channel MCP server watches the inbox, picks up the file
7. Channel server pushes `notifications/claude/channel` to Claude Code
8. Claude sees `<channel source="swain" chat_id="im:+1234">message text</channel>`
9. Claude responds by calling the `reply` tool
10. Reply tool POSTs to Bridge: `http://<vps>:3848/sprites/<name>/reply`
11. Bridge sends iMessage via BlueBubbles

### Outbound mid-task (advisor sends message while working)

Same as step 9-11 above. Claude calls the `reply` tool at any point during execution. The message goes out immediately while Claude keeps working.

### Cron triggers

1. Scheduler runs `sprite exec -s <name> -- swain-channel-send "<skill prompt>" "cron:<skill>"`
2. Same flow — drops into inbox, channel picks it up, Claude runs the skill
3. Any output goes through the reply tool

## Components to Build

### 1. `sprite/channel/swain-channel.ts` — The MCP Channel Server

Runs as a subprocess of Claude Code. Communicates over stdio (MCP protocol).

```typescript
// Capabilities
capabilities: {
  experimental: {
    'claude/channel': {},           // register as channel
    'claude/channel/permission': {} // future: permission relay
  },
  tools: {}  // reply tool
}

// Instructions (goes into Claude's system prompt)
instructions: `Messages from your captain arrive as <channel source="swain" chat_id="...">.
Reply using the reply tool, passing the chat_id. You can send multiple messages
during a single task — call reply as many times as needed.`
```

**Inbox watcher:** Polls `/home/sprite/.channel/inbox/` every 500ms for new `.json` files. Each file contains `{ text, chatId, user, ts }`. After reading, deletes the file and pushes a channel notification to Claude.

**Reply tool:** `reply(chat_id, text)` — POSTs to Bridge at `$BRIDGE_URL/sprites/$SPRITE_ID/reply`.

**Permission relay (future):** Forwards tool approval prompts through the channel, so captains can approve/deny from iMessage.

### 2. `sprite/channel/swain-channel-send` — Message Drop Script

Tiny bash script installed at `/usr/local/bin/swain-channel-send`. Called by `sprite exec` from the VPS.

```bash
#!/bin/bash
# Usage: swain-channel-send "message text" "chat_id"
mkdir -p /home/sprite/.channel/inbox
echo "{\"text\":\"$1\",\"chatId\":\"$2\",\"ts\":$(date +%s%3N)}" > /home/sprite/.channel/inbox/$(date +%s%3N).json
```

### 3. `sprite/channel/.mcp.json` — Claude Code MCP Config

Written to `/home/sprite/.mcp.json` during provisioning:

```json
{
  "mcpServers": {
    "swain-channel": {
      "command": "bun",
      "args": ["/home/sprite/channel/swain-channel.ts"]
    }
  }
}
```

### 4. `sprite/channel/start-claude.sh` — Claude Code Launcher

Replaces the old `start.sh` channel server launch. Starts Claude Code in interactive channel mode.

```bash
#!/bin/bash
# Source env vars
eval $(grep "^export" /home/sprite/start.sh)

# Start Claude Code with the channel
exec claude \
  --dangerously-load-development-channels server:swain-channel \
  --dangerously-skip-permissions \
  --append-system-prompt "Read your CLAUDE.md for identity and context. Read .claude/memory/MEMORY.md to know your captain."
```

### 5. Updates to Bridge (`bridge/index.ts`, `bridge/lib/sprites.ts`)

`sendMessageToSprite` changes from running `claude -p` to dropping a message file:

```typescript
async function sendMessageToSprite(spriteName, text, chatId) {
  // Ensure Claude Code is running (sprite exec triggers wake)
  // Drop message into inbox
  await spriteExec(spriteName, `swain-channel-send '${text}' '${chatId}'`);
  // Reply comes back async via POST /sprites/:name/reply
}
```

Bridge keeps the `/sprites/:name/reply` endpoint — it's now the primary reply path again (not just backward compat).

### 6. Updates to provisioning

- Write `.mcp.json` during `setupSprite`
- Install `swain-channel-send` script
- Write `swain-channel.ts` to sprite
- Update service to run `start-claude.sh` instead of `bun run server.ts`
- Create `/home/sprite/.channel/inbox/` directory

## Session Management

Claude Code manages its own session natively. No session IDs to track on the VPS. The `--resume` flag isn't needed — Claude Code stays running and maintains context.

When the sprite sleeps (no activity), Claude Code exits. On next wake, Claude Code starts fresh. But Claude Code's session is persisted to disk automatically — the next startup loads the previous conversation context.

## Idle Behavior

- Sprite has no HTTP traffic → sprite platform puts it to sleep naturally
- Claude Code exits when the sprite sleeps
- Next message → `sprite exec` wakes the sprite → service starts Claude Code → channel server starts → inbox message is processed
- ~3-5 second wake time, then instant responses within the same wake cycle

## What This Replaces

| Before | After |
|--------|-------|
| Channel server (HTTP on sprite) | Claude Code + MCP channel |
| `sprite exec -- claude -p` from VPS | `sprite exec -- swain-channel-send` (message drop) |
| Bridge waits for response | Bridge fires and forgets, reply comes via callback |
| One message per `claude -p` call | Multiple messages per session, mid-task messaging |
| Session management on VPS | Claude Code manages sessions natively |
| `--resume` on every call | Persistent process, auto-resume on wake |

## What Stays the Same

- Bridge receives BlueBubbles webhooks, routes to sprites
- Bridge `/sprites/:name/reply` sends iMessages via BlueBubbles
- Sprite has CLAUDE.md, skills, memory on disk
- `start.sh` has all env vars
- Bridge registry maps phone → sprite name
- Scheduler triggers crons via `sprite exec`

## Open Questions

1. **How does Claude Code start on sprite wake?** Need a service that runs `start-claude.sh`. The old channel service (`sprite-env services create`) pointed to `start.sh` which ran the HTTP server. We'd point it to `start-claude.sh` instead.

2. **What if the inbox has multiple messages when Claude wakes?** Process them in order by timestamp. The channel server reads all `.json` files sorted by name (which is timestamp-based).

3. **Does `--dangerously-load-development-channels` work with `--dangerously-skip-permissions`?** Need to test.

4. **R2 vault sync.** Currently triggered by the channel server after each message. With native channels, we'd trigger it from the reply tool handler or on a timer.

## Implementation Order

1. Build `swain-channel.ts` (MCP channel server)
2. Build `swain-channel-send` (message drop script)
3. Test locally: Claude Code + channel + inbox drop
4. Update provisioning to deploy channel to sprites
5. Update Bridge to use message drop instead of `sprite exec -- claude -p`
6. Update scheduler for cron triggers
7. End-to-end test: signup → intro → conversation → briefing
