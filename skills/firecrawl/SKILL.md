---
name: firecrawl
description: Search the web, scrape pages, crawl sites, and run AI agents using the Firecrawl CLI. Use for research, content gathering, and web data extraction.
metadata: { "openclaw": { "emoji": "🔥", "requires": { "bins": ["firecrawl"], "env": ["FIRECRAWL_API_KEY"] } } }
---

# Firecrawl CLI Reference

Web search, scraping, crawling, and AI-powered data extraction. Authenticated via `FIRECRAWL_API_KEY` env var.

## Quick Reference

### Search the Web
```bash
firecrawl search "query" --limit 10
firecrawl search "query" --tbs qdr:d          # Last day
firecrawl search "query" --tbs qdr:w          # Last week
firecrawl search "query" --location "Naples,FL" --country US
firecrawl search "query" --scrape --scrape-formats markdown  # Search + scrape results
firecrawl search "query" --categories github,research,pdf
```

### Scrape a Single Page
```bash
firecrawl scrape https://example.com                    # Markdown output
firecrawl scrape https://example.com --only-main-content # Clean content, no nav/footer
firecrawl scrape https://example.com --format markdown,links --pretty
firecrawl scrape https://example.com -o output.md       # Save to file
firecrawl scrape https://example.com --wait-for 3000    # Wait for JS rendering
```

### Discover URLs on a Site
```bash
firecrawl map https://example.com                       # All URLs
firecrawl map https://example.com --search "blog"       # Filter by keyword
firecrawl map https://example.com --limit 500
```

### Crawl an Entire Site
```bash
firecrawl crawl https://example.com --wait --progress
firecrawl crawl https://example.com --limit 50 --max-depth 2 --wait
firecrawl crawl https://example.com --include-paths /blog,/docs --wait
firecrawl crawl <job-id>                                # Check status
```

### AI Agent (Natural Language Research)
```bash
firecrawl agent "Find the top 5 marina companies in Florida" --wait
firecrawl agent "Compare pricing" --urls https://a.com,https://b.com --wait
firecrawl agent "Get company info" --schema '{"name":"string","founded":"number"}' --wait
firecrawl agent "query" --model spark-1-pro --wait      # Higher accuracy
```

### Browser (Remote Sandbox)
No local browser needed. Each session runs in an isolated sandbox with `agent-browser` pre-installed.

```bash
# Shorthand: auto-launches a session if none active
firecrawl browser "open https://example.com"
firecrawl browser "snapshot"                     # Returns @ref IDs for elements
firecrawl browser "click @e5"                    # Click element by ref
firecrawl browser "fill @e3 'search query'"      # Fill input by ref
firecrawl browser "scrape"                       # Extract page content
firecrawl browser close                          # Clean up session

# Or manage sessions explicitly
firecrawl browser launch-session
firecrawl browser execute "open https://example.com"
firecrawl browser execute "snapshot"
firecrawl browser close
```

Use browser for pages that need JS rendering, login flows, or interactive data extraction.

## Output Tips

- Single format → raw content (markdown text, HTML, etc.)
- Multiple formats → JSON with all data
- Use `--pretty` for readable JSON
- Use `-o file.md` to save to disk
- Pipe to other tools: `firecrawl search "query" | head -20`

## Common Patterns for Advisor Work

### Research a Company
```bash
# 1. Search for recent news
firecrawl search "Port32 marina news" --tbs qdr:m --limit 10

# 2. Scrape their website
firecrawl scrape https://www.port32marinas.com --only-main-content -o port32.md

# 3. Map their full site structure
firecrawl map https://www.port32marinas.com --limit 100

# 4. Deep research with AI agent
firecrawl agent "What marinas does Port32 operate and what services do they offer?" --wait
```

### Get Weather/Marine Data
```bash
firecrawl scrape "https://marine.weather.gov/MapClick.php?lat=25.94&lon=-81.73" --only-main-content
firecrawl search "Marco Island FL marine forecast today" --limit 5
```

### Build a Card from Web Research
1. Search for the topic: `firecrawl search "topic" --limit 5`
2. Scrape the best results: `firecrawl scrape <url> --only-main-content`
3. Synthesize into a card using `swain card create`

## Credit Usage
```bash
firecrawl credit-usage --json --pretty
firecrawl --status   # Check auth, concurrency, credits
```
