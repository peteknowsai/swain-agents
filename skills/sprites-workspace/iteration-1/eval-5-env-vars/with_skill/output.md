Two options, depending on how you run the script.

## Option 1: Service with `--env` (simplest)

If your script runs as a service, pass env vars inline:

```bash
sprite exec -s <your-sprite> -- sprite-env services create myscript \
  --cmd python3 --args /home/sprite/myscript.py \
  --env "API_KEY=your-key,DATABASE_URL=postgres://..."
```

Service definitions persist across sleep/wake, so the env vars come back automatically when the sprite restarts the service.

## Option 2: Launcher script (better for many vars or secrets)

Write a shell script that sets env vars and execs your python script:

```bash
echo '#!/bin/bash
export API_KEY="your-key"
export DATABASE_URL="postgres://user:pass@host:5432/db"
cd /home/sprite/app
exec python3 myscript.py' | sprite exec -s <your-sprite> -- sh -c 'cat > /home/sprite/start.sh && chmod +x /home/sprite/start.sh'
```

Then create a service pointing to the launcher:

```bash
sprite exec -s <your-sprite> -- sprite-env services create myscript \
  --cmd /home/sprite/start.sh
```

Add `--http-port 8080` if the script serves HTTP.

## Why services matter here

The filesystem persists across sleep, but running processes don't. If you just `sprite exec` your python script, it dies when the sprite sleeps. Services auto-restart on wake, bringing your env vars back with them.

If the script doesn't need to run continuously (it's a one-off job, not a server), you can also just put your env vars in `/home/sprite/.bashrc` or a `.env` file — those persist on disk. But for anything that should stay running, use a service.
