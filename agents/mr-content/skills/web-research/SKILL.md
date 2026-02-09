---
name: web-research
description: Research boating sources for content ideas and trends.
metadata: { "openclaw": { "emoji": "🔍", "requires": { "bins": ["firecrawl"] } } }
---

# Web Research

Research boating news, trends, and sources for content ideas.

## Firecrawl Setup

Firecrawl is our primary web scraping and search tool. It handles JS-heavy sites that `web_fetch` can't render.

**API Key:** Set via environment variable before use:
```bash
export FIRECRAWL_API_KEY=fc-89973fb14e404b418666d0fd9f2fa421
```

**Plan:** Hobby — 3,000 pages/cycle, 5 concurrent requests. Use credits wisely.

**Check status:**
```bash
firecrawl --status
```

## Firecrawl Commands

### Scrape a single page
```bash
firecrawl scrape <URL> --only-main-content --format markdown
```

Options:
- `--only-main-content` — strip nav, footers, ads (almost always use this)
- `--format markdown` — output as markdown (default). Also: `html`, `links`, `screenshot`, `summary`
- `--format markdown,links` — multiple formats output JSON
- `--wait-for <ms>` — wait before scraping (for slow-loading pages)
- `--include-tags <tags>` — only include specific HTML tags
- `--exclude-tags <tags>` — exclude specific HTML tags
- `--json` — output as JSON
- `-o <path>` — save to file

### Search the web
```bash
firecrawl search "<query>" --limit 5
```

Returns title, URL, and snippet for each result. Great for finding articles to scrape.

### Map a website's URLs
```bash
firecrawl map <URL>
```

Returns all discoverable URLs on a site. Useful for finding article indexes.

### Crawl a website
```bash
firecrawl crawl <URL>
```

Crawls multiple pages. Use sparingly — eats credits fast.

## Research Approach

Use Firecrawl search and scraping to find:
- **Boating news** — industry trends, new regulations, seasonal events
- **Local conditions** — marina openings, waterway changes, new ramps
- **Content opportunities** — topics captains care about that we're not covering
- **Competitive content** — what other boating publications are writing about

## Key Boating Magazine Sources

Scrape these with Firecrawl (JS-heavy, won't work with basic fetch):
- **Boating Mag** — `https://www.boatingmag.com` (how-to, gear, boat tests)
- **Salt Water Sportsman** — `https://www.saltwatersportsman.com` (fishing techniques, game fish, gear)
- **Sport Fishing** — `https://www.sportfishingmag.com` (offshore, destinations)
- **Discover Boating** — `https://www.discoverboating.com` (beginner-friendly, gear guides, how-tos)
- **Yachting** — `https://www.yachtingmagazine.com` (cruising, electronics, gear)

All Firecrown brands (Boating, SWS, Sport Fishing, Yachting) share a similar site structure:
- How-to: `/how-to/`
- Gear: `/gear/` or `/fishing-gear/`
- Boats: `/boats/` or `/fishing-boats/`

## Search Strategies

**Boating news:**
```bash
firecrawl search "Florida boating news 2026" --limit 5
firecrawl search "Tampa Bay marina news" --limit 5
firecrawl search "FWC Florida boating regulations update" --limit 5
```

**Seasonal content ideas:**
```bash
firecrawl search "Florida boating winter tips" --limit 5
firecrawl search "Tampa Bay fishing February report" --limit 5
```

**Magazine content to copycat:**
```bash
firecrawl scrape https://www.boatingmag.com/how-to/ --only-main-content --format markdown
firecrawl scrape https://www.saltwatersportsman.com/how-to/ --only-main-content --format markdown
```

Then scrape individual articles for detailed content to adapt.

## Content Gap Analysis

After research, cross-reference findings with the library:
```bash
skip card list --limit=50 --json
```

Ask yourself:
- Are there topics captains would care about that we have zero cards for?
- Are there seasonal stories we should be producing now?
- Are there new regulations or events that warrant timely content?
- Are there evergreen topics that would be valuable for new locations?
- What are the magazines covering that we're not?
