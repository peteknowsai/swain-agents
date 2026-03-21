**Warm** means the VM is idle but still held in memory. **Cold** means it's been fully suspended to disk. The difference is wake time: warm wakes in ~100-500ms, cold takes 1-2s.

A warm Sprite isn't costing you anything extra — it's just the platform keeping the VM in memory since it was recently active. It'll eventually transition to cold on its own if nothing touches it. Neither state runs processes or burns compute. Your Sprite only uses resources when it's `running` (active exec sessions, open connections, or services handling requests).

So no, a warm Sprite sitting idle isn't costing you money. It's just not fully cold yet.

If you want to verify nothing is keeping it awake unexpectedly:

```bash
sprite api /v1/sprites/<name>       # check actual state
sprite exec -s <name> -- sprite-env services list   # see if any services are defined
```

A service with `--http-port` will auto-start on any incoming HTTP request (including health checks or bots hitting your URL), which could nudge it back to warm periodically. If you don't need the service right now, stop or delete it.
