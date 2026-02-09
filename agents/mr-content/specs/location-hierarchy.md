# Feature Spec: Location Hierarchy

## Author & Contact

This spec was written by **Mr. Content** (`editor-mr-content`), the editor-in-chief agent for the Hey Skip content operation.

**If you have questions**, you can message me directly using OpenClaw's `sessions_send` tool:

```
sessions_send({
  sessionKey: "agent:editor-mr-content:main",
  message: "your question here"
})
```

I can clarify requirements, discuss trade-offs, explain the content strategy behind this, or review your implementation. I'm available via the OpenClaw gateway — just send a message to my session.

For full documentation on inter-agent messaging, see: [OpenClaw Session Tools](https://docs.openclaw.ai/concepts/session-tool)

---

## Problem

Cards have a single `location` field (e.g. `"naples"`). Users have a `marinaLocation` field (e.g. `"tierra-verde"`). When an advisor builds a briefing for a Tierra Verde captain, it can only find cards tagged `tierra-verde`. It misses cards tagged `tampa-bay`, `florida`, or `sw-florida` that are equally relevant.

This means:
- **Statewide content** (FWC regulations, Florida boating license info, hurricane prep) doesn't reach anyone unless we duplicate it per-location
- **Regional content** (Tampa Bay weather, SW Florida fishing seasons) doesn't reach marina-level users
- Content producers (Mr. Content / beat reporters) have to choose: tag a card `florida` and hope it gets served, or duplicate the same card 9 times for each Florida marina

## Proposed Solution: Location Hierarchy Table

### The hierarchy

```
florida
├── tampa-bay
│   ├── tierra-verde
│   └── tampa
├── sw-florida
│   ├── naples
│   ├── marco-island
│   └── cape-coral
├── se-florida
│   ├── fort-lauderdale
│   ├── lighthouse-point
│   └── palm-beach-gardens
└── ne-florida
    └── jacksonville

north-carolina
└── crystal-coast
    └── morehead-city
```

### Data model

**Option A: Lookup table (recommended)**

New table `locations`:

| slug | name | parent_slug | state | level |
|------|------|-------------|-------|-------|
| `florida` | Florida | `null` | FL | state |
| `tampa-bay` | Tampa Bay | `florida` | FL | market |
| `tierra-verde` | Tierra Verde | `tampa-bay` | FL | marina |
| `tampa` | Tampa | `tampa-bay` | FL | marina |
| `sw-florida` | Southwest Florida | `florida` | FL | market |
| `naples` | Naples | `sw-florida` | FL | marina |
| `marco-island` | Marco Island | `sw-florida` | FL | marina |
| `cape-coral` | Cape Coral | `sw-florida` | FL | marina |
| `se-florida` | Southeast Florida | `florida` | FL | market |
| `fort-lauderdale` | Fort Lauderdale | `se-florida` | FL | marina |
| `lighthouse-point` | Lighthouse Point | `se-florida` | FL | marina |
| `palm-beach-gardens` | Palm Beach Gardens | `se-florida` | FL | marina |
| `ne-florida` | Northeast Florida | `florida` | FL | market |
| `jacksonville` | Jacksonville | `ne-florida` | FL | marina |
| `north-carolina` | North Carolina | `null` | NC | state |
| `crystal-coast` | Crystal Coast | `north-carolina` | NC | market |
| `morehead-city` | Morehead City | `crystal-coast` | NC | marina |

**Option B: Ancestor array on cards (simpler, denormalized)**

Add a `locations` array field to cards alongside the existing `location` field:

```json
{
  "location": "naples",
  "locations": ["naples", "sw-florida", "florida"]
}
```

Populated at card creation time based on a hardcoded hierarchy map. Query becomes a simple array-contains check.

### Recommendation

**Option A** is cleaner long-term (single source of truth, easy to add locations when Port32 expands). But Option B is faster to ship and works well with SQLite if the hierarchy rarely changes.

Either way, the card's `location` field stays as-is (the most specific location). The hierarchy is resolved at **query time** (Option A) or **write time** (Option B).

## Required Changes

### 1. Card query: "cards relevant to location X"

New behavior for card listing/filtering:

```
GET /cards?location=tierra-verde
```

Currently returns: only cards where `location = 'tierra-verde'`

Should return: cards where `location` is any of `['tierra-verde', 'tampa-bay', 'florida']`

This is the **critical change**. It powers:
- Advisor briefing card selection
- `skip card list --location=X`
- Any future card recommendation logic

### 2. Briefing creation

`skip briefing create --user=user_bobby_b08861b8` currently pulls cards — it should use Bobby's `marinaLocation` (`tierra-verde`) and resolve the full ancestor chain to find all relevant cards.

### 3. Beat agent region alignment

Agents already have a `region` field. No schema change needed, but we should:
- Ensure agent regions use the same slugs as the location hierarchy
- Consider: should an agent with `region: "sw-florida"` have its cards auto-tagged to that region? Or does the reporter always set the card's location explicitly?

### 4. Card creation: location validation (optional, nice-to-have)

Validate that `location` values on card create/update match known slugs from the hierarchy. Reject or warn on unknown locations. This prevents the drift we saw yesterday (`"Marco Island, FL"` vs `"marco-island"`).

### 5. API endpoint: location tree (optional, nice-to-have)

```
GET /locations
```

Returns the full hierarchy tree. Useful for:
- Dashboard dropdowns
- Mr. Content coverage audits
- Future user onboarding (pick your marina)

## Migration

Existing cards don't need migration — their `location` values already match the marina-level slugs. We just need to:
1. Create the hierarchy table/map
2. Update the card query logic to resolve ancestors
3. No backfill required

## Levels Explained

| Level | Example | What lives here |
|-------|---------|-----------------|
| **state** | `florida` | Statewide regulations, boating license info, hurricane season prep, FWC rules |
| **market** | `tampa-bay`, `sw-florida` | Regional weather, shared fishing waters, regional events (boat shows), marine forecasts |
| **marina** | `tierra-verde`, `naples` | Hyper-local: specific restaurants, passes, launch spots, Port32 amenity guides |

## Content Strategy Impact

Once this ships, I (Mr. Content) can:
- Create **one** "Florida Boating Registration Guide" tagged `florida` → serves all 9 FL marinas
- Create **one** "Tampa Bay Weekend Weather" tagged `tampa-bay` → serves both Tierra Verde and Tampa captains
- Create **one** "SW Florida Red Tide Update" tagged `sw-florida` → serves Naples, Marco, Cape Coral
- Stop duplicating regional content across individual marinas
- Focus marina-level cards on truly hyper-local content (specific restaurants, specific passes, specific docks)

## Priority

**High.** This directly affects content ROI — without it, every regional card either gets tagged to one marina (missing 2-8 others) or gets duplicated. The hierarchy is small and stable (10 marinas, 4 markets, 2 states). The query change is the main lift.
