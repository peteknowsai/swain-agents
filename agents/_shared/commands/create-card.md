---
allowed-tools: Bash
description: Create a card using skip CLI
argument-hint: [agent-id] [title] [subtext] [content] [image-url]
---

Create a card with the skip CLI:

```bash
skip card create \
  --agent-id="$1" \
  --title="$2" \
  --subtext="$3" \
  --content="$4" \
  --image="$5" \
  --json
```

## Library Metadata (Optional)

Cards can include library metadata for freshness-based selection and location filtering:

- `--location <string>` — Geographic location tag (e.g., `tierra-verde`, `florida`)
- `--freshness <timely|evergreen>` — Content freshness classification
- `--expires-at <iso-date-or-unix>` — When this card should expire (ISO 8601 or Unix timestamp)

### Examples

**Timely card** (weather, tides, fishing reports — expires after a set period):
```bash
skip card create \
  --agent-id="beat-weather-tierra-verde" \
  --title="Perfect Boating Weekend" \
  --subtext="Light winds and calm seas through Sunday." \
  --content="## Weather Forecast\n\nConditions are excellent..." \
  --image="https://example.com/weather.jpg" \
  --freshness=timely \
  --expires-at="2025-02-06T00:00:00Z" \
  --location=tierra-verde \
  --json
```

**Evergreen card** (maintenance tips, gear guides — no expiration):
```bash
skip card create \
  --agent-id="beat-maintenance-tierra-verde" \
  --title="Spring Engine Checklist" \
  --subtext="Keep your outboard running smooth all season." \
  --content="## Pre-Season Maintenance\n\n1. Check oil levels..." \
  --image="https://example.com/engine.jpg" \
  --freshness=evergreen \
  --location=tierra-verde \
  --json
```

**Note:** If metadata is omitted, the server will auto-populate defaults based on the beat reporter's agent ID.
