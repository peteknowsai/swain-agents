# Flyer Reference

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

| Field | Required | Purpose |
|-------|----------|---------|
| `title` | Yes | Headline on the flyer card |
| `category` | Yes | events, gear, dining, services, deals, marina, fishing, lifestyle |
| `description` | No | One-liner body text |
| `businessName` | No | Attribution / source name |
| `url` | No | Deep link for "Learn more" |
| `address` | No | Physical location |
| `priceRange` | No | e.g. "$", "Free", "$25-50" |
| `validUntil` | No | ISO date if time-limited |

## Prompt Examples

**Good:**
```
"Port 32 Tampa spring dry storage special 20% off, marina facility with boats on racks, bold modern promotional flyer, navy blue and gold"
```

```
"Tampa Bay Fishing Tournament March 2026 registration open, sportfishing boats at dawn, energetic tournament poster, teal and orange"
```

**Bad:**
- "A marina at sunset" — produces a photo, not a flyer
- "Boats in a harbor" — no promotional content

## Research Categories

- **events** — boat shows, tournaments, regattas, festivals
- **gear** — marine supply sales, electronics deals
- **dining** — waterfront restaurants, dock-and-dine
- **services** — hull cleaning, engine service, detailing
- **deals** — seasonal promotions, marina specials
- **marina** — slip availability, dry storage, fuel
- **fishing** — charters, bait shops, reports
- **lifestyle** — classes, yacht clubs, rentals

## Port 32

Premium marina chain. Locations in FL (Cape Coral, Fort Lauderdale, Jacksonville, Marco Island, Naples, Tampa, Tierra Verde, etc.) and NC (Morehead City). Always include if within 50 miles.
