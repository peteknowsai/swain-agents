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
goplaces search "marina" --lat={{lat}} --lng={{lon}} --radius-m=25000 --json
goplaces search "boat ramp" --lat={{lat}} --lng={{lon}} --radius-m=25000 --json
goplaces search "yacht club" --lat={{lat}} --lng={{lon}} --radius-m=15000 --json
goplaces search "fuel dock" --lat={{lat}} --lng={{lon}} --radius-m=25000 --json
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
