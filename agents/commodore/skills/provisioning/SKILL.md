---
name: provisioning
description: Create new beat agents, provision advisors, expand to new locations.
metadata: { "openclaw": { "emoji": "🏗️", "requires": { "bins": ["swain"] } } }
---

# Provisioning

Create new agents and expand fleet operations.

## Create a New Beat Agent

```bash
swain beat create --topic=<topic> --location=<location> --json
```

This provisions a full beat agent with:
- Database record
- CLAUDE.md prompt
- Shared skill symlinks
- Ready to dispatch immediately

### Naming convention
`beat-{topic}-{location}` — e.g., `beat-fishing-naples`, `beat-events-tampa-bay`

### Core topics per location
Every location should eventually have:
1. fishing
2. destinations
3. dining
4. port32
5. safety
6. maintenance
7. weather
8. events

## Expand to a New Location

### Checklist:
1. **Verify Port32 details** — Address, services, unique features
2. **Research the location** — Ask Mr. Content to research via sessions_send
3. **Create foundational beats:**
   ```bash
   swain beat create --topic=fishing --location=<loc> --json
   swain beat create --topic=destinations --location=<loc> --json
   swain beat create --topic=dining --location=<loc> --json
   swain beat create --topic=port32 --location=<loc> --json
   swain beat create --topic=safety --location=<loc> --json
   ```
4. **Dispatch foundational content** — Ask Mr. Content to dispatch:
   - First-Timer's Guide for the marina
   - Top 5 Destinations
   - Dock & Dine Guide
   - What's Biting (seasonal fishing)
   - Port32 amenities showcase
5. **Verify production** — Check cards are being created
6. **Update fleet inventory** — Record in memory

## Provision a New Advisor

Advisor provisioning is handled by the Skip server (advisor-runner). But you should:

1. **Verify the user exists:**
   ```bash
   swain user get <userId> --json
   ```
2. **Check their location has content:**
   ```bash
   swain card audit --location=<loc> --json
   ```
3. **Report readiness to Pete** — "User [name] at [location] has [N] cards available. Advisor provisioning can proceed."

## Fleet Growth Planning

Track and recommend:
- Which locations need more beat types
- Which topics should be fleet-wide (e.g., events for every location)
- When new advisors are provisioned and need content support
- Seasonal beat additions (e.g., hurricane season → safety beats)
