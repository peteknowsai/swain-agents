Use the API endpoint instead of the CLI. `sprite destroy` requires TTY confirmation with no `--force` or `-y` flag, so it won't work in scripts.

```bash
sprite api /v1/sprites/<name> -- -X DELETE
```

To bulk-delete, loop over names:

```bash
for name in old-sprite-1 old-sprite-2 old-sprite-3; do
  sprite api /v1/sprites/"$name" -- -X DELETE
  echo "Deleted $name"
done
```

Or grab the list dynamically and filter:

```bash
sprite list  # identify which ones to nuke, then:

for name in $(sprite api /v1/sprites | jq -r '.[].name' | grep '^old-'); do
  sprite api /v1/sprites/"$name" -- -X DELETE
done
```

No TTY, no prompts, works in scripts and CI.
