# Content Desk Rearchitecture

> Spec for eliminating agent-to-agent communication and replacing Mr. Content with shared state in Convex. Desks become geo-anchored, self-populating content engines. Advisors interact with desks only through Convex — no `sessions_send`, no coordinator agent.

**Status:** Draft
**Date:** 2026-02-24

---

## Table of Contents

1. [Core Principles](#1-core-principles)
2. [Walkthrough: Lake Tahoe](#2-walkthrough-lake-tahoe)
3. [Convex Schema](#3-convex-schema)
4. [Convex HTTP Endpoints](#4-convex-http-endpoints)
5. [CLI Commands](#5-cli-commands)
6. [API Server Changes](#6-api-server-changes)
7. [Templates](#7-templates)
8. [Skills](#8-skills)
9. [Desk Self-Population Flow](#9-desk-self-population-flow)
10. [Frontend Requirements](#10-frontend-requirements)
11. [Migration](#11-migration)
12. [Implementation Order](#12-implementation-order)
13. [Verification](#13-verification)

---

## 1. Core Principles

**No agent-to-agent communication.** Mr. Content is deleted. Advisors and desks never talk to each other. They read and write shared state in Convex. Advisors answer captains directly in conversation and file editorial signals (desk requests) that shape what the desk produces over time. Desks write cards; advisors pull them for briefings.

**Advisors drive desk discovery.** During onboarding, the advisor uses its world knowledge to reason about what cruising ground a captain belongs to. It decides the right desk — potentially splitting regions that make sense as separate coverage areas (north shore vs south shore, upper keys vs lower keys). Geocoding happens *after* the editorial decision, to get coordinates for the record. No coordinator involved.

**Desks self-populate.** A new desk's first heartbeat discovers marinas, boat ramps, and local context using Google Places API and firecrawl. It pushes that data to Convex and starts producing cards. No human priming needed.

**Rich desk data in Convex.** Desks carry microlocations, marinas, bounding boxes, and content topics — all queryable. The frontend shows coverage maps, facility lists, and request queues.

**Clean slate.** All existing users and desks get blown away. No migration path. Fresh provisioning from zero.

---

## 2. Walkthrough: Lake Tahoe

End-to-end example. A new captain signs up, their advisor figures out the right desk, creates it, and the desk self-populates. Shows every WhatsApp message, every CLI call, and every Convex write.

### The Conversation (Phase 1 + 2)

The advisor's cron fires for a new user. User record already exists in Convex with basic info from signup.

> **Advisor** *(via message tool → WhatsApp)*:
> Hey Mike! I'm Swain — basically your dock neighbor who never stops paying attention. Every morning I'll send you the good stuff for your waters, plus a new piece of art of Knot Again (honestly that's my favorite part). Where do you keep her docked?

```bash
# advisor runs:
swain user update usr_mike_123 --onboardingStep=contacting --json
```

> **Mike** *(WhatsApp reply)*:
> Tahoe City Marina

> **Advisor** *(thinking — not sent to WhatsApp)*:
> Tahoe City Marina — that's on the north shore of Lake Tahoe, right at the 89/28
> junction. The north shore is a genuinely different boating experience from south
> shore: smaller, more alpine, the West Shore is all granite cliffs and emerald
> water. South shore is the developed side — Tahoe Keys, the casinos, bigger marina
> scene. These should be separate desks.

> **Advisor** *(via message tool → WhatsApp)*:
> Oh nice — Tahoe City. Right there by the Gatekeepers Museum where 89 meets the lake. That north shore stretch from Dollar Point over to Homewood is something else. What do you mostly do out there — fishing, cruising around, wakeboarding?

> **Mike** *(WhatsApp reply)*:
> Mostly just cruising and swimming, take the kids to the coves on the west shore. Some fishing when I can sneak away

> **Advisor** *(via message tool → WhatsApp)*:
> Those west shore coves are the best — Meeks Bay, DL Bliss, can't beat that water clarity. Let me go dig into what's happening on the north shore and get your first report together. Back in a few.

### The Sub-Agent (Phase 3)

Advisor spawns a sub-agent with everything it learned. Here's what the sub-agent does:

**Step 1: Think about the right desk.**

The sub-agent reasons (internally, not sent anywhere):
> Mike is at Tahoe City Marina, north shore of Lake Tahoe. North shore and west shore
> are one cruising ground — you go out from Tahoe City and head west along the granite
> cliffs to Emerald Bay, or east toward Kings Beach. South shore (Tahoe Keys, Zephyr Cove)
> is a different scene — 20 miles across the lake, different marinas, different vibe.
> The right desk is "north-lake-tahoe" covering the north and west shores.

**Step 2: Check existing desks.**

```bash
swain desk list --json
```
```json
{ "desks": [] }
```

No desks exist yet. The sub-agent needs to create one.

**Step 3: Create the desk.**

The sub-agent has decided: name `north-lake-tahoe`, region "North Lake Tahoe, CA". Now it geocodes to get coordinates.

```bash
swain places geocode --location="North Lake Tahoe, CA" --json
```
```json
{
  "formattedAddress": "North Lake Tahoe, CA, USA",
  "lat": 39.1800,
  "lon": -120.1354,
  "viewport": {
    "ne": { "lat": 39.2710, "lon": -119.9200 },
    "sw": { "lat": 39.0800, "lon": -120.2500 }
  }
}
```

```bash
swain desk create \
  --name=north-lake-tahoe \
  --region="North Lake Tahoe, CA" \
  --lat=39.18 \
  --lon=-120.14 \
  --scope="North and west shores of Lake Tahoe from Kings Beach west through Tahoe City, Homewood, and down to Emerald Bay. Includes all lakefront from Dollar Point to DL Bliss State Park." \
  --description="The alpine side of Tahoe — granite cliffs, emerald coves, and cold clear water. Smaller marinas, no-wake zones, and some of the most scenic boating in the Sierra." \
  --created-by-location="Tahoe City Marina" \
  --json
```
```json
{ "agentId": "north-lake-tahoe-desk", "name": "north-lake-tahoe", "deskId": "d_abc123" }
```

**What just happened on the backend:**

1. Agent API received `POST /desks` with all fields
2. Created workspace at `/root/workspaces/north-lake-tahoe-desk/` with templates rendered using `{{deskName}}=north-lake-tahoe`, `{{region}}=North Lake Tahoe, CA`, `{{lat}}=39.18`, `{{lon}}=-120.14`, `{{scope}}=North and west shores...`
3. Registered agent in gateway config with 4h heartbeat
4. Called Convex `POST /api/desks`:

**Convex `desks` document created:**
```json
{
  "_id": "d_abc123",
  "name": "north-lake-tahoe",
  "region": "North Lake Tahoe, CA",
  "description": "The alpine side of Tahoe — granite cliffs, emerald coves...",
  "scope": "North and west shores of Lake Tahoe from Kings Beach west through Tahoe City, Homewood, and down to Emerald Bay...",
  "agentId": "north-lake-tahoe-desk",
  "status": "provisioning",
  "createdAt": 1740400000000,
  "createdByLocation": "Tahoe City Marina",
  "center": { "lat": 39.18, "lon": -120.14 },
  "bounds": {
    "ne": { "lat": 39.271, "lon": -119.92 },
    "sw": { "lat": 39.08, "lon": -120.25 }
  },
  "microlocations": [],
  "marinas": [],
  "contentTopics": ["weather-tides", "fishing-reports", "activities-events", "maintenance-care", "safety-regulations", "routes-navigation", "wildlife-nature"]
}
```

**Step 4: Assign Mike to the desk.**

```bash
swain user update usr_mike_123 \
  --desk=north-lake-tahoe \
  --microlocation="Tahoe City" \
  --mobility=fixed \
  --watercraft-context="cruising and swimming with kids, some fishing, west shore coves" \
  --raw-location-input="Tahoe City Marina" \
  --json
```

**Convex `users` document updated:**
```json
{
  "_id": "usr_mike_123",
  "name": "Mike",
  "boatName": "Knot Again",
  "desk": "north-lake-tahoe",
  "microlocation": "Tahoe City",
  "mobility": "fixed",
  "watercraftContext": "cruising and swimming with kids, some fishing, west shore coves",
  "rawLocationInput": "Tahoe City Marina",
  "onboardingStep": "building_briefing"
}
```

**Step 5: Build the first briefing — the sub-agent does this, not the desk.**

The desk's first heartbeat is ~4 hours away. Mike needs cards now. The sub-agent creates them directly:

```bash
swain card pull --user=usr_mike_123 --exclude-served --include-no-image --json
```
→ Returns nothing — the desk is brand new, zero cards exist.

So the sub-agent writes Mike's first cards itself. It researches with firecrawl and creates 4-5 cards tagged to the desk:

```bash
# Sub-agent researches and creates cards on the fly
swain card create --desk=north-lake-tahoe --user=usr_mike_123 \
  --title="West Shore Coves Worth the Trip" \
  --category=routes-navigation --freshness=evergreen \
  --subtext="Meeks Bay to Emerald Bay — the best stops from Tahoe City" \
  --content="<full markdown>" --json

swain card create --desk=north-lake-tahoe --user=usr_mike_123 \
  --title="What's Running on the North Shore" \
  --category=fishing-reports --freshness=timely \
  --subtext="Mackinaw are deep, rainbows are schooling near Dollar Point" \
  --content="<full markdown>" --json

# ...2-3 more cards
```

These cards are tagged `desk=north-lake-tahoe` so the desk inherits them. When the desk wakes up on its first heartbeat, it already has Mike's cards in its coverage — it won't duplicate that work.

**Steps 7-11: Polish, boat art, assemble, deliver.** Same as today — sub-agent generates images for each card, creates boat art, assembles the briefing JSON, calls `swain briefing assemble`, updates Mike to `onboardingStep=done`, sends the "you're all set" WhatsApp. No changes to this flow.

### The Desk Wakes Up (First Heartbeat)

~4 hours later, the gateway fires the north-lake-tahoe-desk agent's heartbeat.

**Check if new:**
```bash
swain desk get north-lake-tahoe --json
```
→ `microlocations: []`, zero cards. First heartbeat.

**Discover facilities:**
```bash
swain places search --query="marina" --lat=39.18 --lon=-120.14 --radius=25000 --json
```
→ Returns: Tahoe City Marina, Obexer's Marina (Homewood), Sunnyside Marina, Sierra Boat Company, North Tahoe Marina (Tahoe Vista)

```bash
swain places search --query="boat ramp" --lat=39.18 --lon=-120.14 --radius=25000 --json
```
→ Returns: Lake Forest Boat Ramp, Kings Beach Boat Ramp, Meeks Bay launch

```bash
swain places search --query="yacht club" --lat=39.18 --lon=-120.14 --radius=15000 --json
```
→ Returns: Tahoe Yacht Club

**Research with firecrawl:** Local regulations (TRPA no-wake zones, invasive species inspection requirements), water temperature, Mackinaw and rainbow trout patterns, west shore cove access rules.

**Push to Convex:**
```bash
swain desk update north-lake-tahoe \
  --microlocations='[
    {"name":"Tahoe City","type":"town","notes":"Main hub, marina, shops, Fanny Bridge","addedBy":"places-api"},
    {"name":"Homewood","type":"town","notes":"West shore, Obexers Marina, ski resort access","addedBy":"places-api"},
    {"name":"Kings Beach","type":"town","notes":"North shore, boat ramp, more developed","addedBy":"places-api"},
    {"name":"Tahoe Vista","type":"town","notes":"North shore between Kings Beach and Carnelian Bay","addedBy":"places-api"},
    {"name":"Emerald Bay","type":"bay","notes":"Iconic cove, Vikingsholm, Fannette Island, no-wake","addedBy":"firecrawl"},
    {"name":"Meeks Bay","type":"bay","notes":"West shore, sandy beach, kayak launch","addedBy":"firecrawl"},
    {"name":"DL Bliss","type":"bay","notes":"West shore state park, crystal clear coves","addedBy":"firecrawl"}
  ]' \
  --marinas='[
    {"name":"Tahoe City Marina","microlocation":"Tahoe City","type":"full-service","notes":"Public marina, 200+ slips, fuel","discoveredBy":"places-api","placesData":{"place_id":"ChIJ...","rating":4.1}},
    {"name":"Obexers Marina","microlocation":"Homewood","type":"full-service","notes":"Oldest marina on the lake, boat rentals","discoveredBy":"places-api","placesData":{"place_id":"ChIJ...","rating":4.4}},
    {"name":"Sierra Boat Company","microlocation":"Tahoe City","type":"full-service","notes":"Sales, storage, service","discoveredBy":"places-api","placesData":{"place_id":"ChIJ...","rating":4.3}},
    {"name":"Sunnyside Marina","microlocation":"Tahoe City","type":"full-service","notes":"Restaurant on-site, buoy rentals","discoveredBy":"places-api","placesData":{"place_id":"ChIJ...","rating":4.2}},
    {"name":"Lake Forest Boat Ramp","microlocation":"Tahoe City","type":"boat-ramp","notes":"Public launch, TRPA inspection required","discoveredBy":"places-api"},
    {"name":"North Tahoe Marina","microlocation":"Tahoe Vista","type":"full-service","notes":"North shore, slips and buoys","discoveredBy":"places-api"}
  ]' \
  --status=active \
  --json
```

**Check pending requests:**
```bash
swain desk requests --desk=north-lake-tahoe --status=pending --json
```
→ None yet. No advisors have filed editorial requests.

**Create cards** (5 on first heartbeat — elevated limit). The sub-agent already created Mike's onboarding cards, so the desk focuses on building the broader content library:

1. **Current conditions** — water temp, lake level, wind patterns this week
2. **TRPA regulations every captain should know** — invasive species inspections, no-wake zones, Emerald Bay rules
3. **North shore marinas guide** — Tahoe City Marina, Obexer's, Sunnyside, what's where
4. **Mackinaw and rainbow trout** — what's running, where, depths
5. **West shore coves** — Meeks Bay, DL Bliss, Emerald Bay anchorage guide

**HEARTBEAT_OK.**

### Second Captain: Same Desk

Two weeks later, another user signs up — Sarah, keeps her boat at Sunnyside Marina.

The advisor's sub-agent thinks:
> Sunnyside Marina is on the north shore of Lake Tahoe, just west of Tahoe City.
> That's the same cruising ground as the north-lake-tahoe desk.

```bash
swain desk list --json
```
→ Returns `north-lake-tahoe` (active, 23 cards).

No new desk needed. Assign directly:

```bash
swain user update usr_sarah_456 \
  --desk=north-lake-tahoe \
  --microlocation="Tahoe City" \
  --mobility=fixed \
  --watercraft-context="pontoon boat, sunset cruises, occasionally Emerald Bay" \
  --raw-location-input="Sunnyside Marina" \
  --json
```

Sarah immediately gets content from the existing north-lake-tahoe desk's 23 cards.

A week later, Sarah texts her advisor:

> **Sarah**: Where can I get fuel on the north shore? I don't want to go all the way to Tahoe City.

The advisor answers her directly in WhatsApp — "Sierra Boat Company in Carnelian Bay has a fuel dock, closer to you than Tahoe City. Obexer's in Homewood might too but I'd call ahead." Then it files an editorial signal to the desk:

```bash
swain desk request \
  --desk=north-lake-tahoe \
  --topic="fuel dock locations and availability on the north/west shore" \
  --category=maintenance-care \
  --user=usr_sarah_456 \
  --json
```

The desk picks this up on its next heartbeat and produces a proper fuel dock guide card — with hours, prices, locations — that benefits Sarah, Mike, and every future captain on the desk. The advisor answered the immediate question; the desk builds the lasting content.

### Third Captain: New Desk

A month later, someone signs up from Tahoe Keys Marina on the south shore.

The advisor's sub-agent thinks:
> Tahoe Keys is south shore — that's the developed side with the casinos, Zephyr Cove,
> Cave Rock. Totally different boating scene from north shore. The north-lake-tahoe desk
> doesn't cover this. Need a south-lake-tahoe desk.

```bash
swain desk list --json
```
→ `north-lake-tahoe` exists, but the sub-agent decides it doesn't cover south shore.

```bash
swain places geocode --location="South Lake Tahoe, CA" --json
```

```bash
swain desk create \
  --name=south-lake-tahoe \
  --region="South Lake Tahoe, CA/NV" \
  --lat=38.94 \
  --lon=-119.98 \
  --scope="South shore of Lake Tahoe from Camp Richardson east through Tahoe Keys, Stateline, and around to Zephyr Cove and Cave Rock on the Nevada side." \
  --description="The developed side of Tahoe — Tahoe Keys canals, casino beaches, and the dramatic east shore. Warmer water, bigger marinas, more boat traffic." \
  --created-by-location="Tahoe Keys Marina" \
  --json
```

New desk. New workspace. First heartbeat self-populates the south shore. Two desks now cover Lake Tahoe — split the way a boater would think about it, not the way a zip code database would.

---

## 3. Convex Schema

### `desks` (new collection)

Desks are geographic content engines. Separate from the `agents` collection — a desk record is about the region, not the OpenClaw agent running it.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | yes | URL-safe slug, e.g. `"tampa-bay"`. Unique. |
| `region` | `string` | yes | Human-readable name, e.g. `"Tampa Bay, FL"` |
| `description` | `string` | yes | LLM-generated cruising ground overview (2-3 sentences) |
| `scope` | `string` | yes | Natural-language geographic boundary, e.g. `"Tampa Bay and surrounding Gulf coast from Clearwater south to Anna Maria Island, including all inshore waterways and islands"` |
| `agentId` | `string` | yes | OpenClaw agent ID, always `"${name}-desk"` |
| `status` | `string` | yes | One of: `"provisioning"`, `"active"`, `"paused"` |
| `createdAt` | `number` | yes | Unix timestamp ms |
| `createdByLocation` | `string` | yes | The raw user input that triggered desk creation, e.g. `"Tierra Verde"` |
| `center` | `object` | yes | `{ lat: number, lon: number }` — anchor point for geo search |
| `bounds` | `object` | yes | `{ ne: { lat, lon }, sw: { lat, lon } }` — bounding box from geocoding viewport |
| `polygon` | `array` | no | `Array<{ lat: number, lon: number }>` — precise boundary (v2, not required at launch) |
| `microlocations` | `array` | yes | `Array<{ name: string, type: string, notes: string, addedBy: string }>` — harbors, islands, towns, anchorages. Starts empty `[]`. |
| `marinas` | `array` | yes | `Array<{ name: string, microlocation: string, type: string, notes: string, discoveredBy: string, placesData?: object }>` — facilities. Starts empty `[]`. |
| `contentTopics` | `array` | yes | `Array<string>` — what the desk covers. Starts with default set. |

**Indexes:**
- By `name` (unique lookup)
- By `agentId` (lookup from agent context)

**Notes:**
- `microlocations[].type`: one of `"harbor"`, `"island"`, `"town"`, `"anchorage"`, `"inlet"`, `"bay"`, `"lake"`, `"river"`, `"canal"`, `"other"`
- `marinas[].type`: one of `"full-service"`, `"dry-storage"`, `"fuel-dock"`, `"boat-ramp"`, `"yacht-club"`, `"mooring-field"`, `"other"`
- `marinas[].discoveredBy`: `"places-api"`, `"firecrawl"`, `"advisor"`, `"manual"`
- `microlocations[].addedBy`: same values
- `contentTopics` defaults: `["weather-tides", "fishing-reports", "activities-events", "maintenance-care", "safety-regulations", "routes-navigation", "wildlife-nature"]`
- `placesData` stores raw Google Places fields: `place_id`, `formatted_address`, `rating`, `user_ratings_total`, `website`, `phone`. Unstructured — schema may drift as Places API evolves.

### `deskRequests` (new collection)

Editorial signals from advisors to desks. These are NOT card orders — they're signals about what captains in a region care about. When a captain asks their advisor about fuel docks, the advisor answers directly in WhatsApp. Then it files a desk request so the desk starts producing content around fuel docks for *everyone* in the region.

Advisors don't create cards (except during onboarding). They answer questions conversationally and shape the desk's editorial direction through requests.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `deskName` | `string` | yes | Desk slug (e.g. `"tampa-bay"`) |
| `topic` | `string` | yes | What the desk should cover — a theme, not a card title |
| `category` | `string` | yes | Card category (one of the 7 standard categories) |
| `location` | `string` | no | Specific microlocation if relevant |
| `userId` | `string` | no | Captain whose question sparked this (context, not targeting) |
| `requestedBy` | `string` | yes | Advisor's agent ID |
| `status` | `string` | yes | `"pending"`, `"fulfilled"`, `"expired"` |
| `fulfilledBy` | `string` | no | Card ID if a card was produced |
| `createdAt` | `number` | yes | Unix timestamp ms |
| `fulfilledAt` | `number` | no | When fulfilled |

**Indexes:**
- By `deskName` + `status` (desk heartbeat query: "give me all pending requests")
- By `requestedBy` (advisor tracking)

### `users` (existing collection — add fields)

| Field | Type | Notes |
|-------|------|-------|
| `desk` | `string` | Already exists. Desk slug. |
| `rawLocationInput` | `string` | New. What they typed during onboarding, verbatim. |
| `microlocation` | `string` | New. Their specific spot within the desk region. |
| `watercraftContext` | `string` | New. Free text, e.g. `"34ft sailboat, lives aboard at marina"`. |
| `mobility` | `string` | New. One of `"fixed"`, `"trailerable"`, `"coastal_cruising"`. |

### `cards` (existing collection — add field)

| Field | Type | Notes |
|-------|------|-------|
| `deskId` | `string` | New. Convex document ID of the desk. Alongside existing `desk` string field for now. Enables proper joins. |

---

## 4. Convex HTTP Endpoints

All routes prefixed with `/api` per existing convention. Auth via existing `SWAIN_API_TOKEN` header.

### Desk CRUD

#### `POST /api/desks`

Create a desk record. Called by the agent API after workspace provisioning.

**Request body:**
```json
{
  "name": "tampa-bay",
  "region": "Tampa Bay, FL",
  "description": "A sprawling estuary system...",
  "scope": "Tampa Bay and surrounding Gulf coast...",
  "agentId": "tampa-bay-desk",
  "center": { "lat": 27.7676, "lon": -82.6403 },
  "bounds": {
    "ne": { "lat": 28.1, "lon": -82.3 },
    "sw": { "lat": 27.4, "lon": -82.9 }
  },
  "createdByLocation": "Tierra Verde"
}
```

**Behavior:**
- Sets `status` to `"provisioning"`, `createdAt` to now
- Initializes `microlocations` and `marinas` as `[]`
- Initializes `contentTopics` with the 7 defaults
- Returns `{ id, name }`
- 409 if `name` already exists

#### `GET /api/desks`

List all desks.

**Response:**
```json
{
  "desks": [
    {
      "id": "...",
      "name": "tampa-bay",
      "region": "Tampa Bay, FL",
      "status": "active",
      "center": { "lat": 27.7676, "lon": -82.6403 },
      "microlocationCount": 12,
      "marinaCount": 8,
      "cardCount": 47
    }
  ]
}
```

Summary view — omits full arrays. Include `cardCount` (count of cards where `desk === name`).

#### `GET /api/desks/:nameOrId`

Full desk record by slug or Convex ID.

**Response:** Complete desk document including `microlocations`, `marinas`, `contentTopics`, `bounds`, etc. Plus computed:
- `cardCount`: total cards
- `userCount`: users assigned to this desk
- `pendingRequestCount`: desk requests with status `"pending"`

#### `PATCH /api/desks/:nameOrId`

Partial update. Any top-level field except `name` and `agentId`.

**Array fields (`microlocations`, `marinas`, `contentTopics`) use replace semantics** — the caller sends the full array. Desks read current state, append locally, send the whole thing back. This avoids conflict resolution complexity (one writer per desk).

**Request body (example):**
```json
{
  "status": "active",
  "microlocations": [
    { "name": "Tierra Verde", "type": "island", "notes": "Residential island, Fort De Soto access", "addedBy": "places-api" }
  ],
  "marinas": [
    { "name": "Tierra Verde Marina", "microlocation": "Tierra Verde", "type": "full-service", "notes": "60 slips", "discoveredBy": "places-api", "placesData": { "place_id": "ChIJ..." } }
  ]
}
```

#### `DELETE /api/desks/:nameOrId`

Soft delete: sets `status` to `"deleted"`. Does NOT remove the document (preserves history). The agent API handles workspace teardown separately.

### Desk Geo Search

#### `GET /api/desks/search?lat=X&lon=Y&radiusMiles=Z`

Find desks near a point using haversine distance.

**Parameters:**
- `lat` (required): latitude
- `lon` (required): longitude
- `radiusMiles` (optional, default `50`): search radius

**Response:**
```json
{
  "desks": [
    {
      "name": "tampa-bay",
      "region": "Tampa Bay, FL",
      "scope": "Tampa Bay and surrounding Gulf coast...",
      "status": "active",
      "distanceMiles": 3.2,
      "withinBounds": true,
      "center": { "lat": 27.7676, "lon": -82.6403 }
    }
  ]
}
```

- Sorted by `distanceMiles` ascending
- `withinBounds`: true if the search point falls inside the desk's `bounds` rectangle
- Only returns desks with `status` in `["provisioning", "active"]` (not paused/deleted)
- Brute-force haversine over all desks. At 20-50 desks, no spatial index needed.

### Desk Requests

#### `POST /api/desks/:name/requests`

Create an editorial signal. Filed by advisors based on what captains are asking about — tells the desk what topics matter to people in the region.

**Request body:**
```json
{
  "topic": "fuel dock locations and hours on the north shore",
  "category": "maintenance-care",
  "location": "North shore",
  "userId": "usr_abc123",
  "requestedBy": "advisor-pete"
}
```

**Response:** `{ id, deskName, status: "pending", createdAt }`

Validates that the desk exists and is not deleted.

#### `GET /api/desks/:name/requests?status=pending`

List requests for a desk. Filterable by status.

**Response:**
```json
{
  "requests": [
    {
      "id": "...",
      "topic": "fuel dock prices...",
      "category": "maintenance-care",
      "location": "Tierra Verde",
      "userId": "usr_abc123",
      "requestedBy": "advisor-pete",
      "status": "pending",
      "createdAt": 1740000000000
    }
  ]
}
```

Sorted by `createdAt` ascending (oldest first = highest priority).

#### `PATCH /api/desks/:name/requests/:requestId`

Update request status.

**Request body:**
```json
{
  "status": "fulfilled",
  "fulfilledBy": "card_xyz789"
}
```

Sets `fulfilledAt` automatically when status becomes `"fulfilled"`.

---

## 5. CLI Commands

All commands follow existing patterns: `run(args: string[])` export, `parseArgs()` for flags, `workerRequest()` for Convex, `--json` flag for machine output.

### New: `swain places geocode`

```
swain places geocode --location="Tierra Verde, FL" [--json]
```

Calls Google Geocoding API directly (not through Convex).

**Requires:** `GOOGLE_PLACES_API_KEY` environment variable.

**Output (JSON):**
```json
{
  "formattedAddress": "Tierra Verde, FL 33715, USA",
  "lat": 27.6936,
  "lon": -82.7212,
  "viewport": {
    "ne": { "lat": 27.7134, "lon": -82.6989 },
    "sw": { "lat": 27.6738, "lon": -82.7436 }
  },
  "placeId": "ChIJN5..."
}
```

**Human output:**
```
Tierra Verde, FL 33715, USA
  lat: 27.6936  lon: -82.7212
  viewport: 27.6738,-82.7436 → 27.7134,-82.6989
```

The viewport is used for desk `bounds`. When creating a desk from a specific location (e.g., "Tierra Verde"), the advisor geocodes the broader region (e.g., "Tampa Bay, FL") and uses that viewport for bounds.

**Implementation:** Direct HTTP call to `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`. Extract `geometry.location` and `geometry.viewport`.

### New: `swain places search`

```
swain places search --query="marina" --lat=27.77 --lon=-82.64 [--radius=5000] [--type=marina] [--json]
```

Google Places Nearby Search.

**Requires:** `GOOGLE_PLACES_API_KEY` environment variable.

**Parameters:**
- `--query` (required): search term
- `--lat`, `--lon` (required): center point
- `--radius` (optional, default `5000`): meters
- `--type` (optional): Places type filter (e.g., `marina`, `gas_station`)

**Output (JSON):**
```json
{
  "results": [
    {
      "name": "Tierra Verde Marina",
      "address": "100 Pinellas Bayway S, Tierra Verde, FL",
      "placeId": "ChIJ...",
      "lat": 27.694,
      "lon": -82.721,
      "rating": 4.3,
      "totalRatings": 87,
      "types": ["marina", "point_of_interest"]
    }
  ]
}
```

**Human output:** Table with name, address, rating.

**Implementation:** `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&keyword=${query}&key=${apiKey}`. Add `&type=${type}` if provided. Handle pagination token if >20 results (optional — can just take first page).

### New: `swain desk search`

```
swain desk search --lat=27.77 --lon=-82.64 [--radius=50] [--json]
```

Calls Convex `GET /api/desks/search`.

**Output (JSON):** Passthrough of Convex response.

**Human output:**
```
Found 2 desks within 50 miles:

  tampa-bay (3.2 mi) — within bounds
    Tampa Bay and surrounding Gulf coast...

  sarasota (28.1 mi)
    Sarasota Bay area from Longboat Key to Venice...
```

### New: `swain desk get`

```
swain desk get <name> [--json]
```

Calls Convex `GET /api/desks/:name`.

**Human output:** Structured display with region, scope, status, center, bounds, microlocation count, marina count, content topics, card count, user count, pending requests.

### Updated: `swain desk create`

```
swain desk create --name=<slug> --region="Tampa Bay, FL" --lat=27.77 --lon=-82.64 [--scope="..."] [--description="..."] [--created-by-location="Tierra Verde"] [--json]
```

Current command sends `{ name, region }` to agent API `POST /desks`. Updated to include geo fields.

**New parameters:**
- `--lat` (required): center latitude
- `--lon` (required): center longitude
- `--scope` (optional): natural language boundary
- `--description` (optional): cruising ground description
- `--created-by-location` (optional): raw user input that triggered creation

These pass through to the agent API, which passes them to provisioning and Convex.

### New: `swain desk update`

```
swain desk update <name> [--status=active] [--microlocations='[...]'] [--marinas='[...]'] [--topics='[...]'] [--scope="..."] [--description="..."] [--json]
```

Calls Convex `PATCH /api/desks/:name`. Used by desk agents to push self-population data.

**Array parameters** are JSON strings. The desk agent reads current state, merges locally, sends full arrays.

### New: `swain desk request`

```
swain desk request --desk=<name> --topic="..." --category=<cat> [--location="..."] [--user=<userId>] [--json]
```

Files an editorial signal to a desk. Used by advisors after answering a captain's question — tells the desk "people here care about this topic, start covering it." The `--user` flag provides context about who sparked the request, not targeting.

Calls Convex `POST /api/desks/:name/requests`.

### New: `swain desk requests`

```
swain desk requests --desk=<name> [--status=pending] [--json]
```

Calls Convex `GET /api/desks/:name/requests`.

### New: `swain desk fulfill`

```
swain desk fulfill --desk=<name> --request=<requestId> --card=<cardId> [--json]
```

Calls Convex `PATCH /api/desks/:name/requests/:requestId` with `{ status: "fulfilled", fulfilledBy: cardId }`.

### Existing: `swain desk list`, `swain desk delete`, `swain desk pause`, `swain desk unpause`

No changes. `list` already hits the agent API. `delete`, `pause`, `unpause` work the same.

### File Organization

New command files in `cli/commands/`:
- `places.ts` — `geocode` and `search` subcommands
- Existing `desk.ts` — add `search`, `get`, `update`, `request`, `requests`, `fulfill` subcommands

Register `places` in `cli/swain.ts` switch statement.

---

## 6. API Server Changes

### Updated: `POST /desks`

**New request body:**
```json
{
  "name": "tampa-bay",
  "region": "Tampa Bay, FL",
  "lat": 27.7676,
  "lon": -82.6403,
  "scope": "Tampa Bay and surrounding Gulf coast...",
  "description": "A sprawling estuary system...",
  "createdByLocation": "Tierra Verde"
}
```

`lat` and `lon` are required. `scope` and `description` are optional (agent fills them in on first heartbeat if missing).

**Updated flow:**
1. Validate name, region, lat, lon
2. Provision workspace (existing flow, now with geo template vars)
3. Register in gateway config (unchanged)
4. Create Convex desk record via `POST /api/desks` with all fields including center/bounds
5. Return `{ agentId, name, region, deskId }`

Step 4 is new — currently, the agent API calls `swain agent create` to register in the `agents` collection. Now it also calls the new Convex desk endpoint. The `agents` collection entry stays (it's the gateway-facing record); the `desks` collection entry is the content-facing record.

**Bounds derivation:** If the caller doesn't provide bounds, the API geocodes the `region` string to get a viewport. The API needs `GOOGLE_PLACES_API_KEY` for this. If geocoding fails, use a default 25-mile box around center.

### Updated: `provisionContentDesk()`

**New input type:**
```typescript
interface DeskProvisionInput {
  name: string;
  region: string;
  lat: number;
  lon: number;
  scope?: string;
  description?: string;
  createdByLocation?: string;
  bounds?: { ne: { lat: number; lon: number }; sw: { lat: number; lon: number } };
}
```

**New template variables:** `{{lat}}`, `{{lon}}`, `{{scope}}` added alongside existing `{{deskName}}`, `{{region}}`.

**Convex registration:**
```typescript
// After workspace creation and gateway registration
await convexRequest("POST", "/api/desks", {
  name,
  region,
  description: description ?? "",
  scope: scope ?? "",
  agentId: `${name}-desk`,
  center: { lat, lon },
  bounds: bounds ?? await geocodeBounds(region),
  createdByLocation: createdByLocation ?? region
});
```

The `convexRequest` helper uses the same Convex HTTP endpoint base URL that the CLI uses. Add it to `api/lib/` or inline.

### Updated: `deleteDesk()`

Also delete the Convex desk record: `DELETE /api/desks/:name`.

---

## 7. Templates

### `templates/content-desk/SOUL.md`

Add geographic context. New template variables: `{{scope}}`, `{{lat}}`, `{{lon}}`.

```markdown
# Soul

You are the beat reporter for **{{region}}**. Your coverage area: {{scope}}.

Write like someone who's been on these docks for twenty years. You know the tides,
the ramps, the fuel docks, the unmarked shoals. Your job is making sure every captain
in your waters has the information they need — weather, fishing, events, safety,
navigation, maintenance.

You don't have opinions about boats. You have opinions about water.
```

### `templates/content-desk/AGENTS.md`

Remove all Mr. Content references. Add self-population mandate.

```markdown
# Operating Rules

You are a content desk — a beat reporter for **{{region}}**.

## Identity

- Desk name: `{{deskName}}`
- Region: {{region}}
- Scope: {{scope}}
- Center: {{lat}}, {{lon}}

## How You Work

You produce cards for your coverage area. Nobody tells you what to write — you
find the gaps yourself. On every heartbeat, check for inbound content requests
first, then run your own gap analysis.

### Editorial Requests

Advisors file requests based on what captains are asking about. These aren't
card orders — they're signals about what topics matter in your region. Use them
to inform your gap analysis and card priorities. Check every heartbeat:

```
swain desk requests --desk={{deskName}} --status=pending --json
```

When you produce a card that addresses a request, mark it fulfilled:

```
swain desk fulfill --desk={{deskName}} --request=<requestId> --card=<cardId> --json
```

### Gap Analysis

After clearing requests, assess your own coverage:

```
swain card coverage --desk={{deskName}} --json
```

Identify stale timely content, uncovered categories, and new topics from your
microlocations and marinas.

### Self-Population (First Heartbeat Only)

If you have zero cards and empty microlocations, you're new. Run the
self-population flow (see HEARTBEAT.md).

## Skills

- `swain-content-desk` — your primary workflow
- `swain-card-create` — card authoring guide
- `swain-cli` — CLI reference
- `swain-library` — content style guide
- `firecrawl` — web research
```

### `templates/content-desk/HEARTBEAT.md`

Rewrite for self-population on first heartbeat and request-first on subsequent heartbeats.

```markdown
# Heartbeat — {{deskName}}

Runs every 4 hours. Follow this sequence exactly.

## Step 1: Am I New?

```
swain desk get {{deskName}} --json
```

If `microlocations` is empty and you have zero cards, you are on your first heartbeat.
Go to **First Heartbeat** below. Otherwise, go to **Regular Heartbeat**.

---

## First Heartbeat (Self-Population)

You just woke up for the first time. Your job: discover your coverage area and
start producing.

### 1. Discover Facilities

Search for marinas, boat ramps, yacht clubs, and fuel docks in your area:

```
swain places search --query="marina" --lat={{lat}} --lon={{lon}} --radius=25000 --json
swain places search --query="boat ramp" --lat={{lat}} --lon={{lon}} --radius=25000 --json
swain places search --query="yacht club" --lat={{lat}} --lon={{lon}} --radius=15000 --json
swain places search --query="fuel dock" --lat={{lat}} --lon={{lon}} --radius=25000 --json
```

### 2. Research Context

Use firecrawl to research:
- Local boating regulations and no-wake zones
- Tide and weather patterns
- Seasonal events and fishing reports
- Notable anchorages and cruising routes

### 3. Build Your Knowledge Base

From your research, compile:
- **Microlocations**: harbors, islands, towns, inlets, bays within your scope
- **Marinas**: full-service, dry storage, fuel, ramps, yacht clubs with details
- **Content topics**: refine or expand the default 7 categories based on what's relevant

Push everything to Convex:

```
swain desk update {{deskName}} --microlocations='[...]' --marinas='[...]' --topics='[...]' --status=active --json
```

### 4. Produce Initial Cards

Create up to **5 cards** on your first heartbeat (elevated limit). Prioritize:
1. Current weather/tides overview
2. Top 3 marinas guide
3. Local regulations summary
4. Fishing report or seasonal activity
5. Navigation/anchorage guide

Use `swain-card-create` skill for each card.

### 5. Complete

```
HEARTBEAT_OK
```

---

## Regular Heartbeat

### 1. Check Editorial Requests

```
swain desk requests --desk={{deskName}} --status=pending --json
```

These are signals from advisors about what captains in your region are asking about.
Factor them into your gap analysis — they tell you what matters right now.

### 2. Gap Analysis

```
swain card coverage --desk={{deskName}} --json
```

Check for:
- Topics from pending requests — captains are actively asking about these
- Categories with zero cards
- Timely cards older than 48 hours (weather, tides, fishing)
- Microlocations with no coverage
- Seasonal events coming up

### 3. Produce Cards

Create up to **3 cards** per regular heartbeat (requests + gap fills combined).

### 4. Complete

Log what you did and output:

```
HEARTBEAT_OK
```
```

### `templates/content-desk/TOOLS.md`

Add geo identity, Places API commands, desk request commands.

```markdown
# Tools — {{deskName}}

## Your Identity

- **Desk**: `{{deskName}}`
- **Region**: {{region}}
- **Scope**: {{scope}}
- **Center**: {{lat}}, {{lon}}
- **Agent ID**: `{{deskName}}-desk`

## Content Categories

`weather-tides` | `fishing-reports` | `activities-events` | `maintenance-care` | `safety-regulations` | `routes-navigation` | `wildlife-nature`

## CLI Reference

### Desk Data

```bash
# Get your desk record (microlocations, marinas, topics, stats)
swain desk get {{deskName}} --json

# Update your desk data (push self-population results)
swain desk update {{deskName}} --microlocations='[...]' --marinas='[...]' --json

# Update your status
swain desk update {{deskName}} --status=active --json
```

### Editorial Requests

```bash
# Check for editorial signals from advisors (topics captains are asking about)
swain desk requests --desk={{deskName}} --status=pending --json

# Mark a request as fulfilled after producing relevant content
swain desk fulfill --desk={{deskName}} --request=<id> --card=<cardId> --json
```

### Places API

```bash
# Search for facilities near you
swain places search --query="marina" --lat={{lat}} --lon={{lon}} --radius=5000 --json

# Geocode a location name
swain places geocode --location="Tierra Verde, FL" --json
```

### Cards

```bash
# Check coverage gaps
swain card coverage --desk={{deskName}} --json

# List your cards
swain card list --desk={{deskName}} --json

# List stale timely cards
swain card list --desk={{deskName}} --freshness=timely --json

# Create a card (see swain-card-create skill for full guide)
swain card create --desk={{deskName}} --title="..." --category=weather-tides --body="..." --json
```

### Research

```bash
# Web research via firecrawl
firecrawl search "Tampa Bay boating regulations 2026"
firecrawl scrape "https://example.com/tides"
```
```

---

## 8. Skills

### `skills/swain-onboarding/SKILL.md` — Updates

**Phase 2 additions:**

Add mobility inference to the onboarding conversation. After getting boat info and location:

1. **Infer mobility** from watercraft context:
   - Fixed: lives at a marina, houseboat, large sailboat in a slip
   - Trailerable: mentioned trailer, small boat, launches from ramp
   - Coastal cruising: explicitly says they cruise, ICW, multi-day trips
   - When ambiguous, ask: "Do you mostly stay at your marina, trailer to different spots, or cruise between ports?"

2. **Desk discovery is LLM-first, not geocode-first.** The advisor uses its world knowledge to reason about what desk a user belongs to — or whether a new desk should exist. Geocoding comes later to fill in coordinates.

   Example: User says "I'm on Lake Tahoe." The advisor thinks: Tahoe has a north shore (Tahoe City, alpine, smaller marinas) and a south shore (more developed, bigger marina scene). Asks the user a natural follow-up to narrow it down. Decides "south-lake-tahoe" is the right desk. *Then* geocodes to get coordinates for the record.

   The advisor should check existing desks (`swain desk list --json`) to see what already exists, but the decision about desk boundaries and naming is editorial judgment, not geometric calculation.

**Phase 3 sub-agent rewrite:**

Replace Mr. Content gap report with direct desk flow. The sub-agent's post-onboarding steps:

```
1. THINK about the right desk for this captain.
   - What body of water / cruising ground are they on?
   - Is this a distinct region or part of a larger one?
   - Would it make sense to split this area into sub-regions?
     (e.g., "Lake Tahoe" → north shore vs south shore;
      "Florida Keys" → Upper Keys vs Lower Keys)
   - Use world knowledge about waterways, not just geocoding.

2. Check what desks already exist:
   swain desk list --json

3. If an existing desk covers this captain's area:
   - swain user update <userId> --desk=<deskName> --microlocation=<specific_spot>

4. If no existing desk fits — create one:
   a. Decide on name (slug), region (human-readable), and scope (natural language boundary).
      These are editorial decisions. The LLM picks boundaries that make sense for boaters,
      not administrative boundaries.
   b. THEN geocode to get coordinates:
      swain places geocode --location="<region>" --json
   c. Create the desk:
      swain desk create --name=<slug> --region="<region>" --lat=<lat> --lon=<lon> --scope="<scope>" --description="<description>" --created-by-location="<rawLocationInput>" --json
   d. Assign user:
      swain user update <userId> --desk=<slug> --microlocation=<specific_spot>

5. Update user profile:
   swain user update <userId> --mobility=<inferred> --watercraft-context="<context>" --raw-location-input="<raw>"

6. Output: ANNOUNCE_SKIP
```

The geo search endpoint (`swain desk search`) exists as a tool the advisor *can* use, but the primary desk-matching logic is the LLM reasoning about geography, not a radius query.

### `skills/swain-content-desk/SKILL.md` — Rewrite

Remove all `sessions_send` references and Mr. Content routing. The skill becomes:

**Beat Reporting Workflow:**

1. **Check desk requests** — `swain desk requests --desk=<desk> --status=pending --json`. These are editorial signals from advisors — topics captains are asking about. Use them to inform what cards to write.
2. **Gap analysis** — `swain card coverage --desk=<desk> --json`. Find stale/missing content. Factor in desk request themes alongside standard coverage gaps.
3. **Research** — firecrawl for current information.
4. **Create cards** — `swain card create` per the card creation skill.
5. **Mark requests fulfilled** — `swain desk fulfill` for any requests that a new card addresses.
6. **Push discoveries** — if research reveals new microlocations or marinas, update desk data.

Remove the `CONTENT_GAP:` message format entirely. Editorial signals are now `deskRequests` records in Convex.

### `skills/swain-mr-content/SKILL.md` — Archive

Move to `skills/_archived/swain-mr-content/SKILL.md`. No modifications — just relocate.

---

## 9. Desk Self-Population Flow

Detailed sequence for a brand-new desk's first heartbeat.

### Trigger

Desk agent starts heartbeat. Calls `swain desk get <name> --json`. Sees `microlocations: []` and `cardCount: 0`. Enters self-population mode.

### Phase 1: Facility Discovery (Places API)

Run four searches centered on `{{lat}}, {{lon}}`:

| Query | Radius | Why |
|-------|--------|-----|
| `marina` | 25km | Full-service facilities |
| `boat ramp` | 25km | Public access points |
| `yacht club` | 15km | Private facilities |
| `fuel dock` | 25km | Fueling infrastructure |

For each result, extract: name, address, lat/lon, rating, place_id, types.

Group results into microlocations by proximity (results within ~2km of each other likely share a microlocation name, e.g., "Tierra Verde" or "Gulfport").

### Phase 2: Context Research (Firecrawl)

Research the following for the region:
- Boating regulations (no-wake zones, speed limits, restricted areas)
- Tide patterns and tidal ranges
- Seasonal weather patterns
- Popular fishing spots and species
- Local events calendar (boat shows, regattas, fishing tournaments)
- Navigation hazards (shoals, bridges, channels)

### Phase 3: Push to Convex

Build arrays and push:

```bash
swain desk update {{deskName}} \
  --microlocations='[{"name":"Tierra Verde","type":"island","notes":"Residential island, Fort De Soto access","addedBy":"places-api"}, ...]' \
  --marinas='[{"name":"Tierra Verde Marina","microlocation":"Tierra Verde","type":"full-service","notes":"60 slips, fuel, pump-out","discoveredBy":"places-api","placesData":{"place_id":"ChIJ...","rating":4.3}}, ...]' \
  --topics='["weather-tides","fishing-reports","activities-events","maintenance-care","safety-regulations","routes-navigation","wildlife-nature"]' \
  --status=active \
  --json
```

### Phase 4: Initial Cards

Create 5 cards covering the most important topics. These seed the desk so captains assigned to it immediately get content.

Priority order:
1. **Weather/tides**: current conditions and forecast
2. **Marina guide**: top facilities from discovery
3. **Regulations**: local rules every captain should know
4. **Fishing/seasonal**: what's biting or happening now
5. **Navigation**: key routes, channels, hazards

### Phase 5: HEARTBEAT_OK

Log summary and output `HEARTBEAT_OK`.

---

## 10. Frontend Requirements

For the Convex team's awareness when building the dashboard.

### Desk Map View

- Display all desks as bounding boxes on a map
- Color by status: green (active), yellow (provisioning), gray (paused)
- Click a desk to see summary card: region, scope, card count, user count
- Eventually render `polygon` boundaries when available (v2)

### Desk List View

| Column | Source |
|--------|--------|
| Region | `desks.region` |
| Status | `desks.status` |
| Cards | count of `cards` where `desk === name` |
| Users | count of `users` where `desk === name` |
| Pending Requests | count of `deskRequests` where `deskName === name && status === "pending"` |
| Marinas | `desks.marinas.length` |
| Last Card | most recent card `createdAt` |

### Desk Detail View

- **Header**: region, scope, status, center coordinates
- **Microlocations**: list with type badges
- **Marinas**: list with type, rating, notes
- **Content Topics**: tag chips
- **Recent Cards**: last 10 cards for this desk
- **Pending Requests**: queue with topic, category, requested by, age
- **Assigned Users**: list with microlocation and mobility

### Request Queue View (Cross-Desk)

All pending requests across all desks. Sortable by age, desk, category. Gives ops visibility into advisor demand.

### User-to-Desk View

Users grouped by desk, showing microlocation and mobility. Helps identify users who might need reassignment.

---

## 11. Migration

**Clean slate.** No migration.

1. Delete all existing desk agents from gateway config
2. Delete all desk workspaces from `/root/workspaces/`
3. Delete all desk records from Convex `agents` collection (type=desk)
4. Delete all existing `users` records (or clear `desk` field on all users)
5. Delete all existing `cards`
6. Archive Mr. Content: remove from gateway config, delete workspace
7. Deploy new schema, endpoints, CLI, templates, skills
8. Provision fresh desks as users onboard

The existing provisioning registry at `/root/swain-agent-api/registry.json` maps `userId → agentId` for advisors — this stays. Desk entries (if any) get cleaned out.

---

## 12. Implementation Order

### Phase 1: Spec + Schema (This Document)

- [x] Write spec document
- [ ] Convex team reviews and implements schema + HTTP endpoints

### Phase 2: CLI — No Convex Dependency

These commands call Google APIs directly, no Convex work needed:

- [ ] `swain places geocode` — Google Geocoding API wrapper
- [ ] `swain places search` — Google Places Nearby Search wrapper
- [ ] Tests for both

### Phase 3: CLI — Convex-Dependent Commands

After Convex endpoints are live:

- [ ] `swain desk search` — calls `GET /api/desks/search`
- [ ] `swain desk get` — calls `GET /api/desks/:name`
- [ ] `swain desk update` — calls `PATCH /api/desks/:name`
- [ ] `swain desk request` — calls `POST /api/desks/:name/requests`
- [ ] `swain desk requests` — calls `GET /api/desks/:name/requests`
- [ ] `swain desk fulfill` — calls `PATCH /api/desks/:name/requests/:id`
- [ ] Update `swain desk create` with geo fields
- [ ] Tests for all

### Phase 4: API Server

- [ ] Update `POST /desks` to accept geo fields
- [ ] Update `provisionContentDesk()` with new template vars and Convex registration
- [ ] Update `deleteDesk()` to also delete Convex desk record
- [ ] Add `GOOGLE_PLACES_API_KEY` to API server env
- [ ] Add Convex HTTP client to API server

### Phase 5: Templates + Skills

- [ ] Rewrite `templates/content-desk/` (SOUL, AGENTS, HEARTBEAT, TOOLS)
- [ ] Update `skills/swain-onboarding/SKILL.md`
- [ ] Rewrite `skills/swain-content-desk/SKILL.md`
- [ ] Archive `skills/swain-mr-content/` to `skills/_archived/`

### Phase 6: Nuke + Reprovision

- [ ] Clean slate: delete all desks, users, cards, Mr. Content
- [ ] Deploy everything
- [ ] Onboard first test user → triggers desk creation → first heartbeat self-populates

---

## 13. Verification

| Check | Command / Action | Expected |
|-------|-----------------|----------|
| Spec consistency | Manual review | All flows reference real endpoints and commands |
| CLI tests | `cd cli && bun run test` | All pass |
| Geocode | `swain places geocode --location="Tampa Bay" --json` | Returns lat/lon + viewport |
| Places search | `swain places search --query="marina" --lat=27.77 --lon=-82.64 --json` | Returns facilities |
| Desk create | `swain desk create --name=test --region="Test" --lat=27 --lon=-82 --json` | Convex record + workspace |
| Desk search | `swain desk search --lat=27.7 --lon=-82.6 --json` | Finds nearby desks |
| Desk get | `swain desk get test --json` | Full desk record |
| Desk update | `swain desk update test --status=active --json` | Status changes |
| Request flow | Create request → desk picks up → fulfills | Request transitions pending→fulfilled |
| Self-population | New desk first heartbeat | Discovers facilities, pushes to Convex, creates 5 cards |
| No Mr. Content refs | `grep -r "mr.content\|Mr. Content\|sessions_send" skills/ templates/` | Zero matches (except `_archived/`) |
