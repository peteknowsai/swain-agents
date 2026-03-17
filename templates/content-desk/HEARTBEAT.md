# Heartbeat — {{deskName}}

Runs every 4 hours.

## Check Your State

```
swain desk get {{deskName}} --json
```

Look at `microlocations`, `marinas`, `status`, and count your existing cards.

---

## Self-Population (if microlocations is empty)

If `microlocations` is empty, you need to discover your region. This runs on first
heartbeat and re-runs on any heartbeat where data is missing (recovery).

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

Push what you found:

```
swain desk update {{deskName}} --microlocations='[...]' --marinas='[...]' --topics='[...]' --json
```

### Activate

If `status` is `"provisioning"`, set it to `"active"` now:

```
swain desk update {{deskName}} --status=active --json
```

Do this immediately after pushing discoveries, before creating cards.

---

## Card Production

**If microlocations exist but you have fewer than 5 cards**, produce cards to
fill the gap (up to 5 total). This covers first heartbeat AND recovery if an
earlier run was interrupted.

**If this is a regular heartbeat** (microlocations exist, 5+ cards), follow the
normal beat reporting workflow below.

---

## Daily Flyers

Once per day (first heartbeat of the day), generate a batch of local flyers
for your region. Use the **swain-flyer** skill for the full workflow.

Check if you've already run today:
```bash
swain flyer list --desk={{deskName}} --date=<today> --json
```

If no flyers exist for today, run the flyer generation workflow. Skip if
you're still in self-population (no microlocations yet).

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

Use the `swain-content-desk` skill for each card.

```
HEARTBEAT_OK
```
