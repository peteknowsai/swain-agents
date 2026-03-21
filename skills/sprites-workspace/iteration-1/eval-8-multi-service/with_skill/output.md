Create two services — one with `--http-port` for the web server, one without for the worker.

```bash
# Create the web server service (gets HTTP routing via the Sprite URL)
sprite exec -s <your-sprite> -- sprite-env services create web \
  --cmd node --args server.js --http-port 3000 --dir /home/sprite

# Create the background worker service
sprite exec -s <your-sprite> -- sprite-env services create worker \
  --cmd node --args worker.js --dir /home/sprite
```

Both auto-start on wake. The `web` service also auto-starts when HTTP requests hit your Sprite URL because it has `--http-port`.

If the worker depends on the web server being up first, add `--needs`:

```bash
sprite exec -s <your-sprite> -- sprite-env services create worker \
  --cmd node --args worker.js --dir /home/sprite --needs web
```

Two constraints to know:

1. **Only one service can have `--http-port`.** Your worker can't claim a second HTTP port — only the web server gets routed through the Sprite URL.
2. **The Sprite URL routes to whatever port `--http-port` specifies.** So your server needs to actually listen on 3000, and you pass `--http-port 3000`.

To verify both are running:

```bash
sprite exec -s <your-sprite> -- sprite-env services list
```

Logs land at `/.sprite/logs/services/web.log` and `/.sprite/logs/services/worker.log`.
