# Content Engine Plan

## Overview
Automated content discovery and production pipeline for Swain across all 10 Port32 locations.

## Research Tools
- **Brave Search** (`web_search`) — real-time web search, news, local results
- **Firecrawl** — search (web + news + images), scrape, crawl, map. 3K credits/cycle
  - `firecrawl search --sources news --tbs qdr:d` — daily news
  - `firecrawl search --scrape` — search + auto-scrape in one call
  - `firecrawl map` — discover all URLs on a site
  - `firecrawl crawl` — deep crawl with path filtering
- **web_fetch** — lightweight URL → markdown extraction

## Content Pipelines

### Pipeline 1: Daily News Sweep (every morning)
**Goal:** Find today's boating/fishing/weather news for each Port32 region

**Searches per location:**
- `"[location] fishing report"` — sources: news, tbs: qdr:d
- `"[location] boating"` — sources: news, tbs: qdr:d
- `"[location] marine weather"` — sources: news, tbs: qdr:d

**Locations grouped by media market:**
- Tampa Bay: Tampa, Tierra Verde (same market)
- Southeast FL: Fort Lauderdale, Lighthouse Point (same market)
- Southwest FL: Naples, Marco Island, Cape Coral (same market)
- Jacksonville: Jacksonville
- Palm Beach: Palm Beach Gardens
- North Carolina: Morehead City

**That's 6 market searches × 3 topics = 18 searches/day**

**Output:** Content ideas file with links. If something is card-worthy, flag for dispatch.

### Pipeline 2: Weekly Magazine Scan (every Monday)
**Goal:** Find new articles from boating magazines for copycat cards

**Sources to scan:**
- boatingmag.com/how-to/
- saltwatersportsman.com
- sportfishingmag.com
- discoverboating.com
- floridasportsman.com
- thefisherman.com

**Method:** `firecrawl map [site] --search "2026"` to find new articles, then scrape promising ones

**Output:** Copycat card queue — articles to adapt for specific locations

### Pipeline 3: Local Event Discovery (weekly)
**Goal:** Find boat shows, fishing tournaments, festivals, regattas

**Searches:**
- `"boat show [location] 2026"` per location
- `"fishing tournament [location] February 2026"` per location
- `"[location] waterfront festival 2026"` per location

**Output:** Event cards dispatched to beat-events agents

### Pipeline 4: Fishing Report Aggregation (twice weekly)
**Goal:** Get real fishing intel for each location

**Key sources:**
- Florida Fish & Wildlife reports (myfwc.com)
- Local charter captain reports
- Fishing forums (thehulltruth.com, florida-sportsman.com/forum)
- NOAA marine forecasts

**Method:** Scrape specific fishing report pages per region, extract species/conditions

**Output:** Feed data to beat-fishing agents as context for report cards

### Pipeline 5: NOAA Marine Data (daily)
**Goal:** Real weather/tide/water temp data for each location

**Free APIs (no key needed):**
- `api.weather.gov` — marine forecasts by zone
- `tidesandcurrents.noaa.gov` — tide predictions, water temp
- `ndbc.noaa.gov` — buoy data (wind, waves, temp)

**NOAA Marine Zones for Port32:**
- Tampa Bay: AMZ154 (Tampa Bay waters)
- Jacksonville: AMZ450 (coastal waters)
- Southeast FL: AMZ550 (coastal waters Boca Raton to Jupiter)
- Southwest FL: AMZ650 (coastal waters Cape Coral to Tarpon Springs)
- NC: AMZ158 (Pamlico Sound)

**Output:** Real data feeds into weather/tide beat agents

### Pipeline 6: Port32 Intelligence (monthly)
**Goal:** Keep Port32 amenity info fresh, find news about Port32

**Searches:**
- `"Port32 marinas"` — news
- Scrape port32marinas.com for updated amenity info
- Check for new location openings

## Beat Reporter Organization

### Current Beats (per location):
- fishing, destinations, dining, port32

### Proposed Expanded Beats:
- **fishing** — weekly fishing reports with real species data
- **destinations** — day trip guides, sandbar guides, island guides
- **dining** — dock & dine, waterfront restaurants
- **port32** — marina amenities, first-timer guides, member tips
- **weather** — marine forecasts, storm prep (NOAA-fed)
- **tides** — tide awareness, draft planning (NOAA-fed)
- **events** — boat shows, tournaments, festivals, regattas
- **safety** — regulations, equipment checks, float plans
- **maintenance** — engine care, hull cleaning, winterization
- **gear** — tackle, electronics, clothing
- **copycat** — magazine article adaptations

### Data Sources per Beat:
Each beat agent should have attached data sources (`swain source add`) so they write from REAL data, not hallucinations.

## Cron Schedule

| Time | Task | Frequency |
|------|------|-----------|
| 6:00 AM | NOAA marine data pull | Daily |
| 7:00 AM | News sweep (all locations) | Daily |
| 8:00 AM | Fishing report aggregation | Tue/Fri |
| 9:00 AM (Mon) | Magazine scan | Weekly |
| 9:00 AM (Wed) | Event discovery | Weekly |
| 10:00 AM (1st) | Port32 intelligence | Monthly |

## Metrics to Track
- Cards produced per location per week
- Content freshness (how many timely cards are live vs expired)
- Coverage gaps (locations with < 10 active cards)
- Source diversity (are we using real data or just generating?)
