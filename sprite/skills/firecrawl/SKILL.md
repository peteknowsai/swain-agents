---
name: firecrawl
description: "Firecrawl CLI — search the web, scrape pages, crawl sites, and extract data. Use whenever you need real-time information like weather, tides, marine conditions, local events, business info, news, or pricing. If your captain asks about something and you don't know the answer, search for it."
user-invocable: false
---

# Firecrawl CLI

Web search, scraping, crawling, and AI-powered data extraction. Authenticated via `FIRECRAWL_API_KEY` env var.

## Quick Reference

### Search
```bash
firecrawl search "query" --limit 10
firecrawl search "query" --tbs qdr:d          # Last day
firecrawl search "query" --tbs qdr:w          # Last week
firecrawl search "query" --location "Naples,FL" --country US
```

### Scrape a Page
```bash
firecrawl scrape https://example.com --only-main-content
firecrawl scrape https://example.com -o output.md
```

### AI Agent (Complex Research)
```bash
firecrawl agent "Find the top 5 marina companies in Florida" --wait
firecrawl agent "Compare pricing" --urls https://a.com,https://b.com --wait
```

### Browser (JS-Heavy Pages)
```bash
firecrawl browser "open https://example.com"
firecrawl browser "snapshot"
firecrawl browser "scrape"
firecrawl browser close
```

## Common Advisor Patterns

### Weather & Marine Conditions
```bash
firecrawl scrape "https://marine.weather.gov/MapClick.php?lat=25.94&lon=-81.73" --only-main-content
firecrawl search "Marco Island FL marine forecast today" --limit 5
```

### Local Business Research
```bash
firecrawl search "Port32 marina news" --tbs qdr:m --limit 10
firecrawl scrape https://www.port32marinas.com --only-main-content
```

### Build a Card from Research
1. Search: `firecrawl search "topic" --limit 5`
2. Scrape best results: `firecrawl scrape <url> --only-main-content`
3. Create card: `swain card create ...`
