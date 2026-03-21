A 502 from a Sprite URL means the proxy is reaching the Sprite, but nothing is listening on the expected port. Here's how to work through it:

## 1. Check if the service is actually running

```bash
sprite exec -s pete-advisor -- sprite-env services get web
```

(Replace `web` with whatever you named the service.) Look at the status — if it says `failed` or `stopped`, the process crashed or exited.

## 2. Check the logs

```bash
sprite exec -s pete-advisor -- tail -100 /.sprite/logs/services/web.log
```

This is where you'll find the actual error — a missing dependency, a port conflict, a bad config, a syntax error. Nine times out of ten, the answer is in the logs.

## 3. Confirm a service has `--http-port` set

```bash
sprite exec -s pete-advisor -- sprite-env services list
```

If no service has `--http-port`, the Sprite URL has nothing to route to — that's your 502. You need exactly one service with `--http-port` set (default expectation is port 8080).

## 4. Restart the service

```bash
sprite exec -s pete-advisor -- sprite-env services restart web
```

Then hit the URL again. If it was a transient crash, this fixes it.

## 5. If you can't even exec in

```bash
# Check Sprite status without waking it
sprite api /v1/sprites/pete-advisor

# Try a basic exec
sprite exec -s pete-advisor -- echo hello
```

If exec hangs or fails, the Sprite itself may be stuck. Wait 30 seconds and retry. If it's still stuck, your options are restoring a checkpoint or destroying and recreating.

## Common causes of "it was working, now it's 502"

- **Sprite went to sleep, service failed on wake.** The service auto-starts when the URL is hit, but if the process crashes immediately (e.g., a dependency moved, a port is stale), you get 502. Check the logs.
- **Service status shows `failed` from a previous stop.** This is normal after a `services stop` (SIGTERM = exit code 143). Just `services start` it again.
- **Cold start timing.** If the Sprite was cold, the first request can 502 while the service boots. Build in a retry — hit it again after 2-3 seconds.
- **The binary or script moved/broke.** If you changed files on disk, the service's `--cmd` might point at something that no longer exists. Check with `services get` and verify the command path.
