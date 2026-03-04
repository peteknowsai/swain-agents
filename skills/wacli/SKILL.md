---
name: wacli
description: "DEPRECATED — Use the `message` tool instead. wacli is the old WhatsApp CLI that has been replaced by the unified message tool."
metadata: { "openclaw": { "emoji": "📱" } }
---

# wacli — DEPRECATED

**Do not use wacli.** It has been replaced by the `message` tool, which is available in all agent workspaces.

## Use This Instead

```
message action=send channel=whatsapp target={{phone}} message="Your message here"
```

The `message` tool:
- Takes phone numbers in E.164 format directly (e.g., `+12025550123`) — no `@s.whatsapp.net` suffix needed
- Is documented in your workspace's TOOLS.md
- Does not require a separate binary
