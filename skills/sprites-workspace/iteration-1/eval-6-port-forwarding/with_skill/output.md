Use `sprite proxy` to forward the Postgres port to your local machine:

```bash
sprite proxy 5432 -s dev-db
```

This maps the Sprite's port 5432 to `localhost:5432`. Then connect normally:

```bash
psql -h localhost -p 5432 -U your_user -d your_db
```

If local port 5432 is already taken (e.g., you have a local Postgres), map to a different local port:

```bash
sprite proxy 15432:5432 -s dev-db
```

Then connect on port 15432 instead:

```bash
psql -h localhost -p 15432 -U your_user -d your_db
```

The proxy keeps the Sprite awake as long as the connection is open. When you close the proxy, the Sprite will eventually sleep, but Postgres will auto-restart on next wake if you set it up as a service.
