# Memory

## Product
- The product is called **Swain** (not Skip — `swain` is just the CLI tool name)
- Swain is a fleet of personal boat agents for captains
- Content is delivered via a **cards library** that powers the agents
- My role: supply the agents with great boating content through the cards library

## People
- **Pete** — founder, product manager, my direct partner and boss. Ask him when I need guidance.

## Tools
- **Firecrawl** — web scraping/search tool for JS-heavy sites. API key stored in web-research skill. Hobby plan: 3,000 pages/cycle, 5 concurrent. Use `FIRECRAWL_API_KEY` env var.
- **swain CLI** — connects to Skip API. `swain agent run` had socket timeout issues on 2026-02-06 — may need server-side fix.

## Repo & Specs
- **Skip repo**: `~/Projects/skip/`
- **Specs go in**: `~/Projects/skip/specs/` — ALWAYS put specs there, not in my workspace. That's where the engineering team looks.
- **Worktrees**: `~/Projects/skip-worktrees/<name>` — feature branches off dev, launched with `cw create <name>`
- **`cw` script**: `~/.local/bin/cw` (symlink to `~/Projects/swain/tools/cw`) — creates worktree + tmux + Claude Code with agent teams

## Client: Port32 / Austin Schell
- **Port32 Marinas** — premier marina chain, dry/wet storage, valet boat service across Florida
- **Austin Schell** — CEO. Ex-XOJET (private jets) president, PE background (Parthenon Capital), UBS investment banking. Loves offshore fishing, sandbars, hole-in-the-wall beach bars. Reads Huberman, Dostoevsky, Garcia Marquez. Competitive, data-driven, customer experience obsessed. Believes in tech leadership in marina space.
- **Port32 Tampa** — 5200 W Tyson Ave, dry storage (up to 42'), wet slips (up to 110'), fuel dock with ethanol-free Rec 90, ship store, Hula Bay Club restaurant on-site, Gulfstream Boat Club, valet service (wash, flush, return to storage)
- **Port32 Tierra Verde** — 200 Madonna Blvd, valet boat storage, our primary launch location
- **Port32 locations**: Tampa, Tierra Verde, Jacksonville, Lighthouse Point, Ft Lauderdale, Naples, Marco Island, Cape Coral, Palm Beach Gardens, Portside (Morehead City NC)
- **What makes Austin happy**: Content that makes Port32 look like the premium, tech-forward marina experience. Content that helps HIS members have better days on the water. Content that showcases Port32 amenities and services naturally (not ads, but helpful references).

## Location Hierarchy (LIVE as of 2026-02-07)
- Cards serve hierarchically: marina → market → state
- A captain at tierra-verde sees: `tierra-verde` + `tampa-bay` + `florida` cards
- Full tree:
  - florida → tampa-bay (tierra-verde, tampa), sw-florida (naples, marco-island, cape-coral), se-florida (fort-lauderdale, lighthouse-point, palm-beach-gardens), ne-florida (jacksonville)
  - north-carolina → crystal-coast (morehead-city)
- **State-level** (`florida`): regulations, licensing, hurricane prep, statewide seasons
- **Market-level** (`tampa-bay`, `sw-florida`, etc.): regional weather, shared fishing waters, regional events
- **Marina-level** (`tierra-verde`, etc.): specific restaurants, passes, Port32 guides
- API: `GET /locations` returns the full tree
- Card query with `?location=X` auto-expands to ancestors
- **Use this to avoid duplicating content.** One florida-level regulation card serves all 9 FL marinas.

## Categories — Canonical 10
`weather`, `fishing`, `safety`, `destinations`, `dining`, `events`, `maintenance`, `regulations`, `port32`, `lifestyle`
- Auto-populated server-side from beat agent ID prefix in `beat-config.ts`
- Reporters can't override — `autoPopulateCardMetadata` handles it
- Briefing system checks `weather` category for priority/missing warnings

## Dispatch Rules
- **Location-specific content** → use the location-specific agent (`beat-fishing-naples`, `beat-port32-tampa-bay`, etc.)
- **Universal/one-off content** → use `beat-reporter` (generic, no location baked in, just follows instructions)
- Location-specific agents have location in their system prompt AND auto-populate location from agent ID — they'll tag everything with their location even if the content is universal
- `beat-reporter` has no location bias — it does exactly what the dispatch says

## Editorial Strategy
- Use boating magazines (Boating Mag, Salt Water Sportsman, Sport Fishing, Discover Boating) as content inspiration
- Two card types: **evergreen originals** and **copycat cards** (adapted from magazine articles, localized to our locations)
- Firecrawl for scraping magazine content → extract topics → dispatch beat reporters with direction (not dictation)
- **Think hierarchy first**: regulations/licensing → state, weather/fishing reports → market, restaurants/passes → marina
- **Reporters are agentic**: give them a story to chase, not a script to format. They research, discover, make editorial calls.

## Research Tools
- **Brave Search** — `web_search` tool, key configured in OpenClaw config + .env
- **Firecrawl** — `firecrawl search --sources news --tbs qdr:d` for daily news, `firecrawl map` for URL discovery, `--scrape` for auto-scrape. API key: `fc-89973fb14e404b418666d0fd9f2fa421`. 3K credits/cycle.
- **web_fetch** — lightweight URL → markdown extraction

## Content Engine (Cron Jobs — enabled but not firing in dev)
- 19 cron jobs enabled, zero have fired (gateway not running at scheduled times in dev)
- 6 daily news sweeps (one per market: Tampa Bay, SE FL, SW FL, Jax, Palm Beach, Crystal Coast NC)
- Weekly magazine scan (Monday), fishing report sweeps (Tue/Fri), event discovery (Wednesday)
- 6 daily advisor briefings (Bobby, Harry, Nancy, Claude, Paul, Amy) at 6am ET
- Daily image regen job at 8am ET
- Monthly Port32 intel & strategy (1st of month)
- Full plan in `memory/content-engine-plan.md`
- Data sources being compiled in `memory/data-sources.md`

## Style Library & Stylist
- **133 styles** total, 120/135 have Cloudflare example images (15 need NanoBanana regen)
- Image pipeline: nanobanana -c --json → Cloudflare Images. ALWAYS use `-c` flag.
- **Stylist is an OpenClaw sub-agent** (NOT Agent SDK) — dispatched via sessions_spawn
- Stylist workflow: nanobanana -c --json "prompt" → image tool (Haiku vision) picks bg color → swain card update --image --background-color
- ~70 seconds per card. Can batch 9 cards per sub-agent, run 5 parallel = 45 cards in ~10-12 min
- I write custom image prompts per card — editorial control over visual direction
- Background colors: Haiku analyzes the actual card image and picks a complementary vibrant hex
- Server's `regen-image` endpoint is broken (was hitting Replicate) — we bypass it entirely with CLI
- Server bug still exists: `regenerate-example` endpoint missing `-c` flag → saves to localhost. Fix: router.ts ~line 2177 and 2206

## Key Rules (from Pete)
- Don't regen images for old cards — only today's cards onward
- Content must be hyper-local per marina, not generic
- **NanoBanana limit: 100 images/day** — budget carefully. Style example batches + card images share the same pool.
- Run image-heavy jobs (style examples, bulk regen) on days when NOT mass-producing cards
- **Fallbacks mask problems** — don't use defaults that hide gaps. Make issues visible.
- **Don't automate what you haven't manually operated** — Pete wants to run agent teams himself first before we automate launches
- **Think hierarchy first**: regulations/licensing → state, weather/fishing reports → market, restaurants/passes → marina
- **Beat reporters stay on Agent SDK** (Sonnet, lean, purpose-built) — stylist is OpenClaw sub-agent
- **Keep it simple** — Pete flagged "too many layers". Use nanobanana CLI directly, not server endpoints
- **Check freshness** — many cards were incorrectly set to "timely" that should be "evergreen". Fixed 58 on 2026-02-08. Watch for this on future dispatches.
