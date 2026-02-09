---
name: beat-assignment
description: Create and dispatch beat reporters for topics and locations.
metadata: { "openclaw": { "emoji": "📰", "requires": { "bins": ["skip"] } } }
---

# Beat Assignment

I'm the dispatcher. Beat reporters are fully agentic — I give them a detailed, localized prompt and they handle research, writing, image generation, and card creation.

## Dispatch Commands

### To an existing beat agent
```bash
skip beat dispatch --agent-id=<agent-id> --prompt="..." [--json]
```

### One-off generic reporter
```bash
skip beat run --topic=<topic> --location=<location> --instructions="..." --json
```

### Create a new permanent beat agent
```bash
skip beat create --topic=<topic> --location=<location> --json
```

### Monitor runs
```bash
skip run list --status=running --json     # what's active
skip run list --status=failed --json      # what broke
skip run status <runId> --json            # specific run
skip run list --agent-id=<id> --json      # runs for an agent
```

## Location Hierarchy

Content is served hierarchically. A captain at tierra-verde sees cards tagged:
- `tierra-verde` (marina-level, hyper-local)
- `tampa-bay` (market-level, regional)
- `florida` (state-level, statewide)

### Levels and what goes where

| Level | Slug examples | Content type |
|-------|--------------|-------------|
| **state** | `florida`, `north-carolina` | Regulations, boating license, hurricane season, statewide FWC rules |
| **market** | `tampa-bay`, `sw-florida`, `se-florida`, `ne-florida`, `crystal-coast` | Regional weather, shared fishing waters, boat shows, marine forecasts |
| **marina** | `tierra-verde`, `naples`, etc. | Specific restaurants, passes, launch spots, Port32 amenity guides |

### Full hierarchy
```
florida
├── tampa-bay → tierra-verde, tampa
├── sw-florida → naples, marco-island, cape-coral
├── se-florida → fort-lauderdale, lighthouse-point, palm-beach-gardens
└── ne-florida → jacksonville

north-carolina
└── crystal-coast → morehead-city
```

### When to use regional vs marina tags
- **FWC regulation change?** → `florida` (all FL captains need this)
- **Tampa Bay weather forecast?** → `tampa-bay` (both TV and Tampa captains)
- **SW FL red tide report?** → `sw-florida` (Naples, Marco, Cape Coral)
- **Specific restaurant guide?** → marina-level (e.g. `naples`)
- **NC fishing season change?** → `north-carolina`

### API: Check the hierarchy
```bash
curl http://localhost:8787/locations  # full tree
```

## The Beat Fleet

### Naming convention: `beat-{topic}-{location}`

**State-level agents** (Florida-wide content):
- beat-regulations-florida (existing)
- Need: beat-safety-florida, beat-events-florida

**Market-level agents** (regional):
- Tampa Bay: beat-dining-tampa-bay, beat-destinations-tampa-bay, beat-events-tampa-bay, beat-port32-tampa-bay, beat-fishing-tampa-bay, beat-weather-tampa-bay, beat-safety-tampa-bay, beat-maintenance-tampa-bay
- Need: sw-florida, se-florida, ne-florida, crystal-coast market agents

**Marina-level agents** (hyper-local):
- All 10 Port32 locations have fishing, destinations, dining, port32 agents
- Most have safety, events, weather, maintenance agents

**Tampa (micro)**:
- beat-dining-tampa, beat-destinations-tampa

## What Reporters Handle vs What the Server/Stylist Handle

**Reporters write content and generate an image. That's it.**

The server auto-assigns from the agent ID:
- **category** — weather, fishing, safety, destinations, dining, events, maintenance, regulations, port32, lifestyle
- **freshness** — timely or evergreen
- **expiration** — auto-calculated for timely beats
- **location** — extracted from agent ID

A **stylist agent** handles visual styles after card creation. Do NOT tell reporters to pick a style.

## Dispatch Philosophy

Reporters are agents, not formatters. Give them direction, not dictation. They should research, discover, and make editorial calls. Your job is to point them at the right story — they figure out how to tell it.

### Good dispatch: direction + context
```
Snook season opens March 1 in Naples. Cover it — where to find them, 
what the regs are, what's working for local anglers. The Naples Bay 
shoreline and Gordon Pass area should be rich territory.
```

### Bad dispatch: dictation
```
Write a card called "Snook Season Opens March 1: Where to Find Them 
in Naples Bay". Cover Gordon Pass, dock lights at night, mangrove 
shorelines on outgoing tide. Live pilchards or white bait on light 
tackle. Slot limit 28-33 inches, one per person. Mention Port32 
Naples as a convenient launch point.
```

The first gives the reporter a story to chase. The second writes the card for them.

### What to include in a dispatch:
- **The story** — what's the topic and why now?
- **Local seeds** — a few specific places/details to get them started (they'll find more)
- **Source article** — if it's a copycat, link the inspiration piece
- **Constraints** — only if truly needed (e.g., "this is time-sensitive, expires end of week")

### What NOT to include:
- Detailed outlines or section-by-section structure
- Style/category/freshness (server and stylist handle these)
- Word counts or format requirements
- Every fact you want mentioned — let them research

### When to be more prescriptive:
- **Port32 guides** — these need specific amenity details the reporter can't easily find
- **Regulation cards** — accuracy matters more than creativity, give them the key rules
- **Copycat cards** — link the source article so they can read and adapt it

## Source Management

```bash
skip source list --agent-id=<id> --json
skip source add --agent-id=<id> --name="..." --url="..." --json
skip source remove <sourceId> --json
```

## Decision Framework

1. **No content at location** → Dispatch foundational pack (see coverage-tracker skill)
2. **Expired timely** → Replace immediately
3. **Port32 gap** → Every marina needs its showcase content
4. **Seasonal miss** → What should exist for this time of year?
5. **Magazine copycat** → Adapt great articles, localize them
6. **Advisor signal** → Captains asking about something we don't cover
