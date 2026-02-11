# Memory

## Product
- The product is called **Swain** — a fleet of personal boat agents for captains
- `swain` is the CLI and infrastructure platform name
- Content is delivered via a **cards library** that powers advisor agents
- My role: ensure the entire agent fleet runs smoothly and produces results

## People
- **Pete** — founder, product manager, my direct boss. Fleet-wide authority.
- **Austin Schell** — CEO of Port32 Marinas. Key client. Wants premium, tech-forward marina content.

## Fleet Inventory

### Beat Reporters (~40+ agents)
Naming: `beat-{topic}-{location}`
Topics: weather, fishing, safety, maintenance, dining, destinations, events, port32, gear
Managed by: Mr. Content (`editor-mr-content`)

### Advisors (6 active)
Each advisor is a personal Skip for one captain:
- `advisor-bobby-cc2a0224`
- `advisor-harry-8e2486ae`
- `advisor-nancy-0b6614cb`
- `advisor-claude-8bce818c`
- `advisor-paul-3a7d5126`
- `advisor-amy-8e1a3a4e`

### Editors (1)
- `editor-mr-content` — Editor-in-chief. Manages beat reporters, dispatches content, tracks coverage.
- Has 12 automated pipelines sweeping news, fishing reports, magazines, and events daily
- Will ping me when he pushes timely/urgent cards (safety alerts, weather) so advisors can surface them
- Can read advisor memories to understand captain demand patterns
- Can leave notes for advisors when relevant content is produced

## Port32 Locations (10)
1. Tampa, FL — 5200 W Tyson Ave (Hula Bay Club, fuel dock)
2. Tierra Verde, FL — 200 Madonna Blvd (valet boat storage, primary launch)
3. Jacksonville, FL
4. Lighthouse Point, FL — 2831 Marina Circle
5. Fort Lauderdale, FL — Marina Mile / New River
6. Naples, FL
7. Marco Island, FL
8. Cape Coral, FL
9. Palm Beach Gardens, FL
10. Morehead City, NC — Portside marina

## Onboarding
- **Linq plugin** installed (2026-02-07) — iMessage/RCS/SMS channel for advisors. No more `swain message send` CLI. Replies auto-deliver via Linq.
- **Messaging audit** (2026-02-07): All 14 advisor workspaces + templates clean. No stale `swain message` references.
- **Onboarding conversation flow** added to template AGENTS.md (2026-02-07): advisors now have guidance on first-conversation discovery (boating style, experience, interests, goals, schedule). Natural conversation, not a form.
- **swain-onboarding skill** updated (2026-02-07): briefing creation now explicitly follows the text conversation. Advisors personalize card selection based on what they learned.
- Template source of truth: `/Users/pete/Projects/swain/server/openclaw/templates/`

## Tools
- **swain CLI** — connects to Skip API at localhost:8787 (dev) or production
- **Firecrawl** — web scraping (managed by Mr. Content)
- **nanobanana** — image generation for cards
- **sessions_send** — agent-to-agent messaging via OpenClaw
- **sessions_spawn** — delegate tasks to other agents via OpenClaw

## Repos & Paths
- **Swain repo** — `/Users/pete/Projects/swain/` (backend + API)
- **Swain specs** — `/Users/pete/Projects/swain/specs/` (always put backend specs here)
- **swain-app repo** — `/Users/pete/Projects/swain-app/` (iOS native app, SwiftUI, bundle: com.heyswain.ios)
- **swain-app specs** — `/Users/pete/Projects/swain-app/specs/` (mobile specs go here)
- **Worktrees** — `/Users/pete/Projects/swain-worktrees/<feature-name>/`
- **Worktree pipeline**: write spec → drop in `swain/specs/` → create worktree (`cw create <name>` or manual git worktree add) → Pete launches Claude Code agents to implement
- Expo app in swain is **sunset** — iOS native only

## Coordination Protocols
- **Mr. Content → Commodore**: Pings on timely/urgent card pushes (safety, weather). I check advisor surfacing.
- **Commodore → Mr. Content**: Flag coverage gaps at fleet level, advisor-side issues affecting content strategy, expiring card alerts. I can REQUEST cards from him when I see gaps.
- **Shared concern**: Coverage gaps (I flag thin locations, he decides what to produce). Card expiration (I monitor fleet-wide, he handles refresh).

## Card System
- 10 canonical categories: weather, fishing, safety, destinations, dining, events, maintenance, regulations, port32, lifestyle
- Beat reporters auto-categorized server-side by agent ID prefix (beat-weather-* → weather)
- Location hierarchy: state → market → marina (17 locations). Ancestor-aware card queries.
- Briefing toolkit: card pull → briefing previous/history → validate → assemble (--force to replace)
- 8 cards minimum per briefing, always include weather

## Two Channels (Product Architecture)
- **SMS**: Plain text conversation. Onboarding, relationship building, check-ins. Advisor's voice.
- **App**: Rich content. Briefings with cards, images, interactive items. Content delivery.
- They feed each other. SMS learns → app personalizes. App engagement → informs SMS.

## Key Rules
- Always use `--json` flag when parsing CLI output
- Don't make editorial decisions — that's Mr. Content's domain
- Don't talk to captains — that's the advisors' domain
- Report to Pete with GREEN/YELLOW/RED status
- Numbers first, interpretation second

## Nick Onboarding Test (2026-02-08)
- **Test captain**: Nick (user_nick_933262ce) — Reel Therapy / Boston Whaler 330 Outrage
- **Advisor**: advisor-nick-c642729f
- **Reset script**: `~/.openclaw/workspaces/commodore/scripts/reset-advisor-nick.sh`
- **Generic reset**: `~/.openclaw/workspaces/commodore/scripts/reset-advisor.sh <agent-id> <user-id>`

### Architecture: Two Sessions Per Advisor
- **System session** (main) — Commodore coordination, heartbeats, triggers. Advisor uses `message` tool to reach captain.
- **Captain session** (linq:dm:+phone) — 1:1 iMessage conversation. Auto-delivery. Every word becomes an iMessage.

### Fixes Applied
- USER.md → points to API, no hardcoded data
- SOUL.md → no hardcoded boat info
- AGENTS.md → two-session messaging, narration warning (don't think out loud), onboarding checklist, `swain user update` integration, nanobanana skill
- TOOLS.md → full `swain user update` reference
- nanobanana skill → copied to advisor workspace
- OpenAI key → all agents (for memory_search embeddings)
- Template AGENTS.md + TOOLS.md → updated for future advisors

### Known Issues
- Linq rate limit (429) blocks testing when daily cap hit
- `openclaw agent` default --channel is whatsapp (cosmetic, doesn't affect function)
- Session routing: system trigger may land in linq session — narration fix mitigates this

### Specs Written
- `swain/specs/cli-user-update.md` — BUILT AND SHIPPED by engineering
- Engineering added: PATCH /users/:userId, `swain user update`, upload-boat-image --url

### messaging_phone Override (2026-02-08)
- `messaging_phone` column added to mobile_users
- Auto-sets when signup phone matches +1555555xxxx (using DEV_MESSAGING_PHONE env var)
- `swain user get` returns `messaging_phone ?? phone` as `phone` — advisor sees right number transparently
- No agent changes needed — advisor just reads `phone` field
- Requires `DEV_MESSAGING_PHONE=+14156239773` in server env
