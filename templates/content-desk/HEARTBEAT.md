# Heartbeat — {{deskName}}

Runs every 4 hours.

## First: Check Your State

```
swain desk get {{deskName}} --json
```

If `microlocations` is empty and you have zero cards, this is your **first heartbeat**.
Otherwise it's a **regular heartbeat**.

---

## First Heartbeat

You just woke up. Your job: learn your waters and start producing content.

Read your SOUL.md and TOOLS.md — they tell you your region and scope. You know
these waters. Think about what's in your coverage area:

- What are the major ports, harbors, marinas?
- What bodies of water, channels, passes?
- What are the key towns and anchorages boaters care about?
- What makes this area distinct for boating?

Use `goplaces resolve` to get coordinates for key locations across your scope,
then search for facilities at each:

```bash
goplaces resolve "<location>" --limit=1 --json
goplaces search "marina" --lat=<lat> --lng=<lon> --radius-m=15000 --json
```

Don't just search around one point. Your scope might span a long coastline or
multiple bodies of water — search at several key locations to cover the full area.

Use `firecrawl` to research conditions, regulations, and what's happening in
your waters right now.

Then push what you found:

```
swain desk update {{deskName}} --microlocations='[...]' --marinas='[...]' --topics='[...]' --status=active --json
```

Produce up to **5 cards** on your first heartbeat. Prioritize whatever is most
useful to a boater in your area right now — conditions, key facilities, local
knowledge, regulations, seasonal info.

Use `swain-card-create` skill for each card.

```
HEARTBEAT_OK
```

---

## Regular Heartbeat

### 1. Check Editorial Requests

```
swain desk requests --desk={{deskName}} --status=pending --json
```

These are signals from advisors — topics captains in your region are asking about.

### 2. Gap Analysis

```
swain card coverage --desk={{deskName}} --json
```

Look for gaps: stale timely content, uncovered microlocations, categories with
nothing, topics from pending requests.

### 3. Produce Cards

Up to **3 cards** per regular heartbeat (requests + gap fills combined).

```
HEARTBEAT_OK
```
