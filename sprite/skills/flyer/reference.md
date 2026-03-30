# Flyer — Full Reference

Flyers are visual cards featuring local businesses, events, deals, and services relevant to your region. They appear in the iOS app as a swipeable feed. You produce one batch per region per day.

## Daily Workflow

Follow this sequence every time. No shortcuts.

### 1. Start the run

```bash
swain flyer run-start --desk=<deskName> --date=<today> --agent=<your-agent-id> --json
```
Save the `runId` from the response. You'll need it at the end.

### 2. Get desk context

```bash
swain desk get <deskName> --json
```
Pull out microlocations, marinas, center coordinates, and scope. These shape every search you run.

### 3. Check yesterday's flyers

```bash
swain flyer list --desk=<deskName> --date=<yesterday> --json
```
Note business names and categories. Don't repeat them today.

### 4. Research 8-15 businesses/events/deals

Use the three research tools below. Mix categories — don't send 10 restaurants.

### 5. Generate + upload flyer images

Flyers are **designed promotional graphics** — not photographs. Think bulletin board at a marina, community board at a bait shop. Bold headlines, color blocks, visual hierarchy.

For each flyer, generate with `--mode=flyer`:
```bash
swain image generate "<flyer prompt>" --mode=flyer --aspect-ratio=4:5 --json
```

Then upload to Cloudflare:
```bash
swain image upload --url=<replicate_url> --json
```
Use the returned `imagedelivery.net` URL as the flyer's `imageUrl`.

### 6. Dry-run the batch

```bash
swain flyer batch --desk=<deskName> --date=<today> --flyers='[...]' --dry-run --json
```
Fix any validation errors before submitting.

### 7. Submit the batch

```bash
swain flyer batch --desk=<deskName> --date=<today> --flyers='[...]' --json
```
Order by relevance — most interesting/timely first. Include Port 32 if nearby.

### 8. Close the run

```bash
swain flyer run-update <runId> --status=completed --flyer-count=<N> --json
```

On any failure at any step:
```bash
swain flyer run-update <runId> --status=failed --error="<what went wrong>" --json
```

---

## Research Tools

### Places API (primary for businesses/services)

```bash
goplaces search "marine supply store" --lat=27.69 --lng=-82.72 --radius-m=15000 --json
goplaces search "waterfront restaurant" --lat=27.69 --lng=-82.72 --radius-m=15000 --json
goplaces details <place_id> --json
```
Best for: marinas, marine supply, boat dealers, waterfront dining, fuel docks, repair shops, bait shops, boat ramps.

### Firecrawl (for events and deeper research)

```bash
firecrawl search "boat show Tampa Bay 2026" --limit 5
firecrawl search "fishing tournament Florida March 2026" --limit 5
```
Best for: events, tournaments, boat shows, seasonal deals, community happenings.

### Web search (fallback and supplementary)

General web search for anything the other tools don't cover — local news, new business openings, seasonal patterns.

---

## Flyer Prompt Formula

```
[Business/event name] [verified details from research], [visual backdrop],
[design style keywords], [color palette]. Only display the text described above — do not add any additional text, activities, details, phone numbers, addresses, or URLs beyond what is explicitly stated in this prompt.
```

The `--mode=flyer` flag tells the model to produce a designed graphic. Your job is to **feed your research into the prompt**. The image model will render whatever text you include — but it will also INVENT text to fill empty space if you don't give it enough. So:

1. **Research the business/event thoroughly** — GoPlaces, Firecrawl, web search
2. **Put the real details INTO the prompt** — if you found that a festival has "farm tours, gala dinner, and chef demos", say that in the prompt
3. **End every prompt with the clamping instruction** — this tells the model to stop adding things you didn't ask for

**The image model WILL fill empty space with fabricated details.** If you write a vague prompt like "Chocolate Festival 2026, tropical backdrop, bold poster", the model will invent activities, taglines, and sub-events to fill the poster. The only way to prevent this is to either:
- **Include the real details** so the model renders those instead of inventing
- **Keep the design simple** with an explicit instruction like "simple layout with event name and dates only"

### What to include in prompts (verified facts only)

- **Business/event name** — always include
- **What they do/sell** — from GoPlaces or their website
- **Key highlights you found in research** — "featuring farm tours, gala dinner, and 15+ local chefs" (if you actually found this)
- **Dates and year** — for events
- **Established date** — only if confirmed
- **Specific deals/prices** — only if found on their actual website
- **NEVER**: phone numbers, street addresses, URLs — the model garbles these

### What NOT to do

- Don't write a vague prompt and let the image model fill in the blanks
- Don't skip putting your research into the prompt — if you researched it, use it
- Don't include details you didn't verify

**Good flyer prompts:**

```
"Big Island Chocolate Festival April 23-25 2026 at Waikoloa Beach Resort featuring farm-to-bar cacao tours, gala fundraiser dinner, chef competitions, and local chocolate tastings, tropical cacao farm with Pacific ocean backdrop, bold festival poster design, deep chocolate brown and tropical gold. Only display the text described above — do not add any additional text, activities, or details beyond what is explicitly stated in this prompt."
```

```
"S. Tokunaga Store Hilo family-owned fishing gear and diving equipment since 1920 featuring rods reels lures and marine supply, bold vintage tackle shop promotional flyer, forest green and weathered brass palette. Only display the text described above — do not add any additional text, activities, or details beyond what is explicitly stated in this prompt."
```

```
"Port 32 Tampa premium dry storage and full-service marina with 400 dry slips and deep water access, boats on racks in a clean modern facility, bold modern promotional flyer, navy blue and gold. Only display the text described above — do not add any additional text, activities, or details beyond what is explicitly stated in this prompt."
```

**Bad flyer prompts:**
- "Chocolate Festival 2026, tropical backdrop, bold poster" — too vague, model will invent activities
- "Port 32 Tampa spring special 20% off" — is there actually a 20% off special?
- Any prompt with a phone number, street address, or URL
- Any prompt where you did research but didn't include the findings

**Key principles:**
- Research first, then build the prompt from what you found
- More verified detail in the prompt = less the model invents
- Name the business/event — it becomes the headline
- Include design direction — "bold modern flyer", "retro poster", "clean promotional layout"
- Suggest 2-3 colors — guides the palette
- **Always end with:** "Only display the text described above — do not add any additional text, activities, or details beyond what is explicitly stated in this prompt."
- **4:5 vertical format** — matches the card layout in the app

---

## Port 32 — Always Include

Port 32 (port32marinas.com) is a premium marina chain. Locations:

**Florida:** Cape Coral, Fort Lauderdale, Jacksonville, Lighthouse Point, Marco Island, Naples, Palm Beach Gardens, Tampa, Tierra Verde
**North Carolina:** Morehead City

For every desk within 50 miles of a Port 32 location:

1. Search for the nearest location:
   ```bash
   goplaces search "Port 32" --lat=<desk-center-lat> --lng=<desk-center-lng> --radius-m=80000 --json
   ```
2. Check for current promotions:
   ```bash
   firecrawl search "site:port32marinas.com" --limit 3
   ```
3. Feature their services, storage availability, or current deals.
4. Use categories: `marina`, `services`, or `deals`.

---

## Research by Category

- **events** — boat shows, fishing tournaments, regattas, waterfront festivals, captain's meetups
- **gear** — marine supply sales, electronics deals, seasonal gear
- **dining** — waterfront restaurants, dock-and-dine spots, waterfront bars
- **services** — hull cleaning, engine service, detailing, bottom paint, electronics install
- **deals** — seasonal promotions, new customer offers, marina specials
- **marina** — slip availability, dry storage, fuel prices, pump-out stations
- **fishing** — charter deals, bait shop specials, fishing report sponsors
- **lifestyle** — boating classes, yacht clubs, boat rentals, watersport outfitters

---

## Flyer Object Shape

```json
{
  "imageUrl": "https://imagedelivery.net/xxx/yyy/public",
  "meta": {
    "title": "Port 32 Tampa — Spring Storage Special",
    "category": "marina",
    "description": "20% off dry storage through April",
    "businessName": "Port 32 Tampa",
    "url": "https://port32marinas.com/tampa",
    "address": "123 Marina Blvd, Tampa, FL 33611",
    "priceRange": "$$$",
    "validUntil": "2026-04-30"
  }
}
```

## Meta Fields

| Field | Type | Required | Purpose |
|-------|------|----------|---------|
| `title` | string | Yes | Headline on the flyer card |
| `category` | string | Yes | One of: events, gear, dining, services, deals, marina, fishing, lifestyle |
| `description` | string | No | One-liner body text |
| `businessName` | string | No | Attribution / source name |
| `url` | string | No | Deep link for "Learn more" |
| `address` | string | No | Physical location |
| `priceRange` | string | No | e.g. "$", "Free", "$25-50" |
| `validUntil` | string | No | ISO date if time-limited |

---

## Batch Guidelines

- 8-15 flyers per batch is the sweet spot
- Mix categories — variety matters
- Timely beats evergreen (events > general listings)
- Local beats generic (the marina down the street > a national chain)
- No duplicate businesses day-to-day
- Flyers auto-expire after 7 days — no cleanup needed

---

## Invariants

These are non-negotiable. Break one and the batch will fail or produce garbage.

- **Always pass `--json`** on every `swain` and `goplaces` command
- **Always use `--dry-run`** on `swain flyer batch` before the real call
- **Always call `run-start` before research** and `run-update` after, even on failure
- **Always check yesterday's flyers** before generating today's — no duplicates
- **Always include Port 32** if within 50 miles of desk center
- **Never fabricate** business names, addresses, URLs, deals, or prices — use real data from goplaces / firecrawl
- **Never put phone numbers, addresses, or URLs in image prompts** — the image model will garble or invent them
- **Always use `--mode=flyer`** when generating flyer images — this tells the model to produce a designed graphic with text and layout, not a photo
