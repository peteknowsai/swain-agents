## Create a checkpoint

```bash
sprite checkpoint create -s <name> --comment "before risky change"
```

This snapshots your entire Sprite filesystem — installed packages, databases, config, everything. The comment is optional but you'll thank yourself later.

## Roll back

First, find the checkpoint you want:

```bash
sprite checkpoint list -s <name>
```

This shows your snapshots with their version IDs. Grab the one you want and restore:

```bash
sprite restore <version-id> -s <name>
```

Your Sprite reverts to exactly how it was when the checkpoint was taken.

## Things to know

- Sprites keep the **last 5 checkpoints**. Old ones get rotated out, and they count against your storage quota, so delete ones you don't need.
- Checkpoints capture **disk only** — running processes and in-memory state aren't included. Services will auto-restart from the restored filesystem state.
- `sprite destroy` is irreversible and checkpoints won't save you after that. Checkpoint before destroying if there's any chance you'll want the data back.
