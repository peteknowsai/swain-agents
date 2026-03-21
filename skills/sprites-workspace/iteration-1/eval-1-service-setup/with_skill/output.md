1. Write the server file to your sprite:

```bash
sprite exec -s pete-advisor -- bash -c 'cat > /home/sprite/server.ts << "EOF"
Bun.serve({
  port: 8080,
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return Response.json({ status: "ok", uptime: process.uptime() });
    }
    return new Response("Not Found", { status: 404 });
  }
});
console.log("Listening on :8080");
EOF'
```

2. Register it as a service with `--http-port` so it auto-starts on wake:

```bash
sprite exec -s pete-advisor -- sprite-env services create web \
  --cmd bun --args server.ts --http-port 8080 --dir /home/sprite
```

That's it. The `--http-port 8080` flag does two things: routes incoming requests from the sprite URL to port 8080, and auto-starts the service whenever the sprite wakes up (including on incoming HTTP requests).

3. Verify it's running:

```bash
sprite exec -s pete-advisor -- sprite-env services get web
```

4. Hit the health endpoint:

```bash
curl https://pete-advisor-<your-org>.sprites.app/health
```

If you want the URL publicly accessible (no auth), run:

```bash
sprite url update --auth public -s pete-advisor
```

Logs live at `/.sprite/logs/services/web.log` if anything goes wrong.
