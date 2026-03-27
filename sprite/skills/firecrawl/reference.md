# Firecrawl Reference

Complete CLI reference for web search, scraping, crawling, and AI-powered data extraction.

Authenticated via `FIRECRAWL_API_KEY` env var.

## Search

Search the web for information.

```bash
firecrawl search "query" --limit 10
```

### Flags

| Flag | Description | Example |
|---|---|---|
| `--limit` | Max results to return | `--limit 10` |
| `--tbs` | Time-based search filter | `--tbs qdr:d` (last day) |
| `--location` | Geographic location bias | `--location "Naples,FL"` |
| `--country` | Country code | `--country US` |
| `--scrape` | Also scrape each result page | `--scrape` |
| `--scrape-formats` | Format for scraped content | `--scrape-formats markdown` |
| `--categories` | Filter result categories | `--categories github,research,pdf` |

### Time filters (`--tbs`)
- `qdr:h` — last hour
- `qdr:d` — last day
- `qdr:w` — last week
- `qdr:m` — last month
- `qdr:y` — last year

### Examples
```bash
firecrawl search "Tampa Bay fishing report" --limit 5
firecrawl search "Marco Island marine forecast" --tbs qdr:d --limit 5
firecrawl search "boat maintenance tips outboard" --location "Naples,FL" --country US --limit 10
firecrawl search "regatta schedule 2026" --scrape --scrape-formats markdown --limit 5
```

---

## Scrape

Scrape a single page and extract its content.

```bash
firecrawl scrape https://example.com
```

### Flags

| Flag | Description | Example |
|---|---|---|
| `--only-main-content` | Strip nav, footer, sidebar — clean content only | `--only-main-content` |
| `--format` | Output format(s) | `--format markdown,links` |
| `--pretty` | Pretty-print JSON output | `--pretty` |
| `-o` | Save output to file | `-o output.md` |
| `--wait-for` | Wait for JS rendering (ms) | `--wait-for 3000` |

### Examples
```bash
firecrawl scrape https://marine.weather.gov/MapClick.php?lat=25.94&lon=-81.73 --only-main-content
firecrawl scrape https://www.port32marinas.com --only-main-content -o port32.md
firecrawl scrape https://example.com --format markdown,links --pretty
```

### Output behavior
- Single format -> raw content (markdown text, HTML, etc.)
- Multiple formats -> JSON with all data
- Use `--pretty` for readable JSON output

---

## Map

Discover all URLs on a site.

```bash
firecrawl map https://example.com
```

### Flags

| Flag | Description | Example |
|---|---|---|
| `--search` | Filter URLs by keyword | `--search "blog"` |
| `--limit` | Max URLs to return | `--limit 500` |

### Examples
```bash
firecrawl map https://www.port32marinas.com --limit 100
firecrawl map https://example.com --search "events"
```

---

## Crawl

Crawl an entire site, scraping multiple pages.

```bash
firecrawl crawl https://example.com --wait --progress
```

### Flags

| Flag | Description | Example |
|---|---|---|
| `--wait` | Wait for crawl to complete | `--wait` |
| `--progress` | Show progress during crawl | `--progress` |
| `--limit` | Max pages to crawl | `--limit 50` |
| `--max-depth` | Max link depth from start URL | `--max-depth 2` |
| `--include-paths` | Only crawl these path prefixes | `--include-paths /blog,/docs` |

### Check crawl status
```bash
firecrawl crawl <job-id>
```

### Examples
```bash
firecrawl crawl https://example.com --limit 50 --max-depth 2 --wait
firecrawl crawl https://example.com --include-paths /blog,/docs --wait --progress
```

---

## Agent

AI-powered research agent. Sends a natural language query, gets structured answers.

```bash
firecrawl agent "Find the top 5 marina companies in Florida" --wait
```

### Flags

| Flag | Description | Example |
|---|---|---|
| `--wait` | Wait for completion | `--wait` |
| `--urls` | Specific URLs to analyze | `--urls https://a.com,https://b.com` |
| `--schema` | JSON schema for structured output | `--schema '{"name":"string"}'` |
| `--model` | Model to use | `--model spark-1-pro` |

### Examples
```bash
firecrawl agent "What marinas does Port32 operate and what services do they offer?" --wait
firecrawl agent "Compare pricing" --urls https://a.com,https://b.com --wait
firecrawl agent "Get company info" --schema '{"name":"string","founded":"number"}' --wait
firecrawl agent "query" --model spark-1-pro --wait   # Higher accuracy
```

---

## Browser

Remote browser sandbox. Each session runs in isolation with `agent-browser` pre-installed. No local browser needed. Use for JS-heavy pages, login flows, or interactive data extraction.

### Quick commands (auto-launches session)
```bash
firecrawl browser "open https://example.com"
firecrawl browser "snapshot"                    # Returns @ref IDs for elements
firecrawl browser "click @e5"                   # Click element by ref
firecrawl browser "fill @e3 'search query'"     # Fill input by ref
firecrawl browser "scrape"                      # Extract page content
firecrawl browser close                         # Clean up session
```

### Explicit session management
```bash
firecrawl browser launch-session
firecrawl browser execute "open https://example.com"
firecrawl browser execute "snapshot"
firecrawl browser close
```

### Workflow
1. Open a URL
2. Take a snapshot to see element refs (`@e1`, `@e2`, etc.)
3. Interact with elements (click, fill, etc.)
4. Scrape when you have the data you need
5. Always close the session when done

---

## Output Tips

- Single format -> raw content (markdown text, HTML, etc.)
- Multiple formats -> JSON with all data
- Use `--pretty` for readable JSON
- Use `-o file.md` to save to disk
- Pipe to other tools: `firecrawl search "query" | head -20`

---

## Common Advisor Work Patterns

### Research for a card
```bash
# 1. Search for the topic
firecrawl search "Tampa Bay redfish report" --limit 5

# 2. Scrape the best result
firecrawl scrape <url> --only-main-content

# 3. Create the card
swain card create --desk=<desk> --user=<userId> --category=fishing-reports ...
```

### Get weather and marine data
```bash
firecrawl scrape "https://marine.weather.gov/MapClick.php?lat=25.94&lon=-81.73" --only-main-content
firecrawl search "Marco Island FL marine forecast today" --limit 5
```

### Research a business or location
```bash
# Search for recent news
firecrawl search "Port32 marina news" --tbs qdr:m --limit 10

# Scrape their website
firecrawl scrape https://www.port32marinas.com --only-main-content

# Map their site structure
firecrawl map https://www.port32marinas.com --limit 100

# Deep research with AI agent
firecrawl agent "What marinas does Port32 operate?" --wait
```

### Quick fact-check
```bash
firecrawl search "Florida snook season 2026" --limit 3
```

---

## Credit Management

```bash
# Check credit usage
firecrawl credit-usage --json --pretty

# Check auth, concurrency, and credits
firecrawl --status
```

Monitor credits during heavy research sessions. Each search, scrape, and agent call consumes credits.
