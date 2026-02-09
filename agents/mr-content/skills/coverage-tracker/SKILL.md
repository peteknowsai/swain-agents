---
name: coverage-tracker
description: Track content coverage across all Port32 locations, identify gaps, and plan dispatches.
metadata: { "openclaw": { "emoji": "🗺️", "requires": { "bins": ["skip"] } } }
---

# Coverage Tracker

Track and audit content coverage across all 10 Port32 marina locations.

## Port32 Locations

| Location | Region | Key Waters | State |
|----------|--------|-----------|-------|
| Tierra Verde | Tampa Bay | Bunces Pass, Fort De Soto, Shell Key, Egmont Key, Gulf offshore | FL |
| Tampa | Tampa Bay | Old Tampa Bay, Hillsborough River, Courtney Campbell, Bayshore | FL |
| Jacksonville | NE Florida | St. Johns River, Atlantic offshore, Amelia Island | FL |
| Lighthouse Point | SE Florida | Hillsboro Inlet, ICW, Atlantic offshore | FL |
| Ft Lauderdale | SE Florida | New River, Port Everglades, Atlantic offshore | FL |
| Naples | SW Florida | Gordon Pass, Naples Bay, 10,000 Islands | FL |
| Marco Island | SW Florida | 10,000 Islands, Everglades, Caxambas Pass | FL |
| Cape Coral | SW Florida | Caloosahatchee River, Charlotte Harbor, Pine Island Sound | FL |
| Palm Beach Gardens | SE Florida | ICW, Jupiter Inlet, Atlantic offshore | FL |
| Morehead City | NC Coast | Bogue Sound, Cape Lookout, Outer Banks, Atlantic offshore | NC |

## Location Hierarchy

Content serves hierarchically: marina → market → state. A captain at tierra-verde sees cards from `tierra-verde` + `tampa-bay` + `florida`.

```
florida
├── tampa-bay → tierra-verde, tampa
├── sw-florida → naples, marco-island, cape-coral
├── se-florida → fort-lauderdale, lighthouse-point, palm-beach-gardens
└── ne-florida → jacksonville

north-carolina
└── crystal-coast → morehead-city
```

### Content by level
- **State** (`florida`, `north-carolina`): Regulations, licensing, statewide seasons, hurricane prep
- **Market** (`tampa-bay`, `sw-florida`, etc.): Regional weather, shared waters, regional events
- **Marina** (`tierra-verde`, `naples`, etc.): Specific restaurants, passes, Port32 guides

### Audit tip
When counting coverage, a captain's effective library = marina cards + market cards + state cards. A Tierra Verde captain with 12 marina cards also gets 11 tampa-bay cards + 4 florida cards = 27 total.

## Core Beats Per Location

Every **marina** should have these content types:
- **Fishing** — Local species, seasonal reports, spots
- **Destinations** — Day trips, anchor-outs, island guides, sandbars
- **Dining** — Dock-and-dine restaurants accessible by boat
- **Port32** — Marina-specific guides, amenities, first-timer content
- **Safety** — Location-specific hazards, inlet guides
- **Maintenance** — Climate-specific care
- **Events** — Local boat shows, tournaments, waterfront festivals

Every **market** should have:
- **Weather** — Regional marine forecast
- **Fishing** — Regional fishing report (what's biting across the market)
- **Events** — Regional boat shows, tournaments
- **Safety** — Regional advisories (red tide, cold snaps, storms)

Every **state** should have:
- **Regulations** — Fishing licenses, FWC rules, boating registration
- **Safety** — Hurricane prep, statewide advisories
- **Seasons** — Statewide species seasons (snook, grouper, lobster)

## Coverage Audit

### Quick count by location
```bash
# Get all cards and analyze by location
skip card list --limit=200 --json
```

Parse the JSON and count cards per location field.

### Beat agents per location
```bash
skip beat list --json
```

### Check for gaps
For each location, verify:
1. ✅ Has at least 1 fishing card
2. ✅ Has at least 1 destinations/routes card
3. ✅ Has at least 1 dining card
4. ✅ Has a Port32 first-timer's guide
5. ✅ Has at least 1 safety card
6. ✅ Has at least 1 evergreen card
7. ✅ No expired timely cards without replacement

## Foundational Content Checklist

When launching a new location, dispatch these first (in order):
1. **First-Timer's Guide** — "Your First Trip Out of Port32 [Location]"
2. **Top Destinations** — "5 Places to Take Your Boat from [Location]"
3. **Dock & Dine** — "Restaurants You Can Boat To Near [Location]"
4. **Fishing Primer** — "What's Biting Near [Location]" (seasonal)
5. **Port32 Amenities** — What makes this specific marina special

## Seasonal Content Calendar

### Florida (all locations except Morehead City)
- **Jan-Feb**: Winter fishing (sheepshead, black drum), manatee season, cold front prep
- **Mar-Apr**: Spring fishing (tarpon starting), boat show season, spring break crowds
- **May-Jun**: Summer prep, thunderstorm season begins, tarpon peak, snook open
- **Jul-Aug**: Peak summer, afternoon storms daily, offshore runs, lobster mini-season (SE FL)
- **Sep-Oct**: Hurricane season peak, early fall fishing, fewer crowds
- **Nov-Dec**: Winter prep, snook closes, holiday events, snowbird arrivals

### Morehead City NC
- **Jan-Feb**: Winter fishing (speckled trout, red drum), cold weather boating
- **Mar-Apr**: Spring runs begin, boat shows
- **May-Jun**: King mackerel, cobia arriving, Cape Lookout trips
- **Jul-Aug**: Peak offshore (mahi, tuna), Cape Lookout camping
- **Sep-Oct**: Fall fishing (false albacore, red drum), hurricane season
- **Nov-Dec**: Late fall fishing, winterization, oyster season

## Priority Matrix

When deciding what to dispatch:
1. **No content** → Location with zero cards gets priority (foundational pack)
2. **Expired timely** → Replace stale weather/fishing/events immediately
3. **Port32 gap** → Every location needs its marina-specific content
4. **Seasonal miss** → Content that should exist for this time of year but doesn't
5. **Copycat opportunity** → Great magazine article that localizes well
6. **Depth** → Adding more content to locations that already have basics covered
