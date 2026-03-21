---
name: sprites
description: How to work with Sprites — persistent cloud dev environments on sprites.dev. Use this skill whenever managing Sprites (creating, destroying, configuring services, debugging lifecycle issues, checkpoints, networking, port forwarding), or when you need to run commands on a Sprite, set up auto-starting services, or troubleshoot cold/warm start behavior. Also use when someone mentions sprite-env, sprite exec, sprite services, or Sprite URLs.
---

# Working with Sprites

Sprites are persistent cloud microVMs on [sprites.dev](https://sprites.dev). They run Ubuntu 25.10 with 100GB storage. Everything on disk persists across sleep/wake — installed packages, databases, files. RAM doesn't persist — running processes stop when the Sprite sleeps.

## Quick Reference

```bash
# Manage sprites
sprite create <name>                    # create new sprite
sprite create <name> --skip-console     # create without opening console
sprite list                             # list all sprites
sprite destroy -s <name>                # destroy (irreversible!)

# Run commands
sprite exec -s <name> -- <command>      # one-off command
sprite console -s <name>               # interactive shell (TTY)
sprite exec -s <name> --tty <command>  # command with TTY

# Sessions (detachable)
sprite exec -tty npm run dev           # start a TTY session
# Ctrl+\ to detach
sprite sessions list                    # list running sessions
sprite sessions attach <id>             # reattach
sprite sessions kill <id>               # kill session

# Networking
sprite url -s <name>                    # show sprite URL
sprite url update --auth public -s <name>   # make URL public
sprite url update --auth sprite -s <name>   # require auth (default)
sprite proxy <port>                     # forward port to localhost
sprite proxy 3001:3000                  # map local:remote

# Checkpoints
sprite checkpoint create -s <name>                      # snapshot
sprite checkpoint create -s <name> --comment "note"     # with comment
sprite checkpoint list -s <name>                        # list snapshots
sprite restore <version-id> -s <name>                   # restore

# API calls
sprite api /v1/sprites                                  # list via API
sprite api -s <name> /checkpoints                       # sprite-specific
sprite api /v1/sprites/<name> -- -X DELETE              # delete via API (no TTY needed)
```

## Services — Auto-Starting Processes

Services are the key to making Sprites useful as servers. They auto-restart on wake, survive hibernation, and keep the Sprite alive while running.

```bash
# Create a service
sprite-env services create <name> --cmd <binary> [--args <arg1,arg2>] [--http-port <port>]

# Only ONE service can have --http-port
# The service with --http-port auto-starts when HTTP requests hit the Sprite URL

# Examples
sprite-env services create web --cmd node --args server.js --http-port 8080
sprite-env services create worker --cmd python3 --args worker.py
sprite-env services create myapp --cmd /home/sprite/start.sh --http-port 8080 --dir /home/sprite

# Manage services
sprite-env services list                    # list all services
sprite-env services get <name>              # service details + status
sprite-env services start <name>            # start
sprite-env services stop <name>             # stop (sends SIGTERM)
sprite-env services restart <name>          # stop + start
sprite-env services delete <name>           # remove service
sprite-env services signal <name> <signal>  # send signal (TERM, HUP, KILL)

# Environment variables
sprite-env services create myapp --cmd ./start.sh --env "KEY=val,FOO=bar"

# Dependencies
sprite-env services create app --cmd node --args server.js --needs redis
```

The `--http-port` flag is critical: it tells the Sprites proxy to route incoming HTTP requests to that port AND auto-start the service on wake. Without it, the service runs but isn't reachable via the Sprite URL.

## Lifecycle: Warm, Cold, Running

| State | Meaning | Wake Time |
|-------|---------|-----------|
| `running` | Active, processes running | Already awake |
| `warm` | Idle, VM in memory | ~100-500ms |
| `cold` | Suspended to disk | 1-2s |

**What keeps a Sprite awake:**
- Active exec/console commands
- Open TCP connections
- Running TTY sessions
- Active services with open connections

**What persists across sleep:**
- Filesystem (everything)
- Network config (ports, URL settings)
- Service definitions

**What doesn't persist:**
- Running processes (services auto-restart, others don't)
- In-memory data
- TTY sessions

## The Sprite URL

Every Sprite gets `https://<name>-<org>.sprites.app`. It routes to port 8080 by default (or the port specified by a service's `--http-port`).

Hitting the URL wakes the Sprite. If a service has `--http-port`, it auto-starts and handles the request. Without a service, the request gets a 502.

Auth modes:
- `sprite` (default) — requires org membership or API token
- `public` — open to the internet

For authenticated access from scripts:
```bash
curl -H "Authorization: Bearer $SPRITE_API_TOKEN" https://mysprite-myorg.sprites.app/
```

## Filesystem Layout

```
/home/sprite/           # home directory — put your stuff here
/home/sprite/.local/    # local binaries and user tools
/opt/                   # standalone applications
/var/                   # databases and application state
/.sprite/               # Sprite system directory
  bin/                  # sprite-env CLI
  docs/                 # documentation
  logs/                 # service logs at logs/services/<name>.log
  checkpoints/          # last 5 checkpoints mounted here
  policy/               # network egress policy
```

## Common Patterns

### Deploy a Bun/Node server as a service

```bash
# Write your server code
sprite exec -s mysprite -- bash -c 'cat > /home/sprite/server.ts << "EOF"
Bun.serve({
  port: 8080,
  fetch(req) {
    return new Response("hello");
  }
});
EOF'

# Create service
sprite exec -s mysprite -- sprite-env services create web \
  --cmd bun --args server.ts --http-port 8080 --dir /home/sprite

# Make URL public
sprite url update --auth public -s mysprite

# Test
curl https://mysprite-myorg.sprites.app/
```

### Run a service with environment variables

```bash
# Write a launcher script (easier than --args for complex commands)
echo '#!/bin/bash
export API_KEY="secret"
export PORT="8080"
cd /home/sprite/app
exec bun run server.ts' | sprite exec -s mysprite -- sh -c 'cat > /home/sprite/start.sh && chmod +x /home/sprite/start.sh'

# Create service pointing to the launcher
sprite exec -s mysprite -- sprite-env services create app \
  --cmd /home/sprite/start.sh --http-port 8080
```

### Check service logs

```bash
sprite exec -s mysprite -- tail -50 /.sprite/logs/services/myapp.log
```

### Debug a stuck Sprite

```bash
# Check status via API (doesn't require the Sprite to be awake)
sprite api /v1/sprites/mysprite

# Try to exec in
sprite exec -s mysprite -- echo hello

# If exec fails, the Sprite might be truly stuck
# Wait 30s and retry, or destroy and recreate
```

## Environment

Sprites come with pre-installed:
- **Languages:** Node.js, Python, Go, Ruby, Rust, Elixir, Java, Bun, Deno
- **AI/CLI Tools:** Claude CLI, Gemini CLI
- **Utilities:** Git, curl, wget, vim, common dev tools

Install anything else with `apt`, `pip`, `npm`, `cargo`, etc. — it persists.

## Gotchas

- **NEVER use `--skip-console` when creating Sprites.** The initial console session properly initializes the Sprite. Without it, the Sprite goes cold immediately and won't wake up. Always create with `sprite create <name>` (no `--skip-console`), let the console connect for a few seconds, then disconnect. For automation, background the create, sleep 10-15s, then kill the process.
- **`sprite destroy` is irreversible.** No undo. Checkpoint first if unsure.
- **Only one service can have `--http-port`.** The rest run without HTTP routing.
- **TTY sessions don't survive sleep.** Use services for persistent processes.
- **Destroying via CLI requires TTY confirmation.** Use `sprite api /v1/sprites/<name> -- -X DELETE` for non-interactive deletion.
- **Service status `failed` after stop is normal.** Stopping a service sends SIGTERM (exit code 143), which shows as "failed". Starting it again works fine.
- **Checkpoints count against storage quota.** Delete old ones to free space.
- **Cold start + service auto-start can take a few seconds.** Build retry logic into anything that depends on the Sprite URL being immediately available.

### Creating Sprites in automation

```bash
# Don't use --skip-console! The console session initializes the Sprite.
sprite create my-sprite 2>&1 &
CREATE_PID=$!
sleep 15          # let console initialize
kill $CREATE_PID  # disconnect console
# Now sprite exec works
sprite exec -s my-sprite -- echo "ready"
```
