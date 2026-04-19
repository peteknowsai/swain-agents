---
name: flyer
description: "Daily flyer batch generation — research local businesses, events, and deals, create promotional graphics, publish for your region. Use when it's time to generate today's flyer batch."
---

# Flyer Generation

Flyers are visual cards featuring local businesses, events, deals, and services. They appear in the app as a swipeable feed. One batch per region per day.

## Workflow

### 0. Check desk status

```bash
swain desk get <desk> --json
```

If `status: "paused"`, **exit immediately** — don't start a run, don't research, don't generate images. Every captain on the desk is paused; flyers would be wasted compute and Cloudflare storage. Auto-resumes when any captain returns.

If `status: "active"`, continue.

### 0.5 Check the backlog

```bash
swain flyer backlog --desk=<desk> --json
```

Returns `{ unseen: N }` — the count of **unswiped** flyers on the desk (active captains' queues + desk-wide scope combined; paused captains' queues excluded).

- `unseen <= 30` → continue
- `unseen > 30` → **exit immediately.** Log it if you're keeping a run log, but don't start a run. Captains have plenty of flyers they haven't worked through yet. Generating more just buries the backlog deeper and burns compute.

This is a live check every run — no paused flag. The moment captains swipe enough to drop unseen back to ≤ 30, the next scheduled run picks up naturally.

**Note on "unswiped":** the backend can't distinguish "never reached the captain's screen" from "shown but scrolled past without swiping." Either way, it's content sitting in the queue that hasn't been acted on — which is the signal we care about.

### 1. Start the run
```bash
swain flyer run-start --desk=<desk> --date=<today> --agent=<agentId> --json
```

### 2. (Desk context already pulled in Step 0 — use that response.)

### 3. Check yesterday's flyers (avoid repeats)
```bash
swain flyer list --desk=<desk> --date=<yesterday> --json
```

### 4. Research 8-15 businesses/events/deals
Mix categories. Use GoPlaces for businesses, Firecrawl for events and deals.

### 5. Generate flyer images
Flyers are **designed promotional graphics** — not photos. Bold headlines, color blocks, visual hierarchy.

```bash
swain image generate "<flyer prompt>" --mode=flyer --aspect-ratio=4:5 --json
swain image upload --url=<generated_url> --json
```

**Prompt formula:** `[Business/event name] [verified details from your research], [visual backdrop], [design style], [color palette]. Only display the text described above — do not add any additional text, activities, or details beyond what is explicitly stated in this prompt.`

**Feed your research into the prompt.** The image model will invent details to fill empty space. If you researched that a festival has "farm tours, gala dinner, and chef demos" — put that in the prompt so the model renders real facts instead of fabricating. No phone numbers, addresses, or URLs — the model garbles these.

### 6. Dry-run, then submit
```bash
swain flyer batch --desk=<desk> --date=<today> --flyers='[...]' --dry-run --json
swain flyer batch --desk=<desk> --date=<today> --flyers='[...]' --json
```

### 7. Close the run
```bash
swain flyer run-update <runId> --status=completed --flyer-count=<N> --json
```

For the full flyer object shape and research patterns, see [reference.md](reference.md).
