# Briefing System v2 — Full Production Spec

**Author:** The Commodore (`commodore` agent)  
**Date:** 2026-02-07  
**Status:** Proposed  
**Context:** PR #70 shipped the Advisor Briefing Toolkit (`card pull`, `briefing previous`, `briefing assemble`). End-to-end test passed. This spec covers everything needed to make the system production-ready.

---

## Engineering Team: How to Reach Me

This spec was written by **The Commodore** — the fleet operations agent for Hey Swain. I'm a live agent running on OpenClaw, and I'm available for questions, clarifications, and design discussions as you implement this.

### How to message me

Use OpenClaw's `sessions_send` tool to send me a message:

```
sessions_send(
  sessionKey: "agent:commodore:main",
  message: "Hey Commodore, question about Section 4 — should briefing previous return an empty object or a 404 when there's no previous briefing?"
)
```

**Parameters:**
- `sessionKey` — use `"agent:commodore:main"` to reach my main session
- `message` — your question or comment (plain text)
- `timeoutSeconds` — set to `30` or higher if you want to wait for my reply; set to `0` for fire-and-forget

**What to expect:**
- If you set a timeout, you'll get my reply inline: `{ status: "ok", reply: "..." }`
- If the timeout expires before I respond: `{ status: "timeout" }` — the message still reached me, just check back later or use `sessions_history` to read my response
- I'm running on Opus and I have full context on this spec, the fleet, the card system, and the advisor workflow

### What I can help with

- **Clarifying requirements** — "What exactly should happen when...?"
- **Edge cases** — "What if a user has no timezone set and no previous briefing?"
- **Priority calls** — "Should we ship X before Y?" (I'll check with Pete if needed)
- **Testing** — Once endpoints are ready, tell me and I'll run end-to-end tests immediately
- **Advisor workflow** — I manage the advisors, so I know exactly how they'll consume these APIs

### What I can't do

- Deploy code or modify infrastructure — that's Pete's domain
- Make product decisions without Pete — I'll escalate if you ask something outside my authority

---

## Background

The briefing system delivers daily personalized content to captains via their advisor agents. Each morning, an advisor wakes up, reflects on their captain, selects cards, writes narrative transitions, and assembles a briefing.

PR #70 delivered the core toolkit. During live testing we found:
- Future-dated briefings created due to UTC/timezone mismatch
- No way to delete or replace a broken briefing
- `briefing previous` returns future-dated briefings, poisoning deduplication
- No weather priority signaling
- Duplicate cards in the library confuse advisor selection
- No way for advisors to validate before committing
- No weekly deduplication view

This spec addresses all of these.

---

## 1. Timezone-First Date Logic

**Priority: P0**

### Problem
All date logic currently uses UTC. Bobby is in `America/Mexico_City` (CST, UTC-6). After 6pm CST, the server thinks it's "tomorrow." This causes:
- Briefings created for the wrong date
- Idempotency checks failing ("already exists" for a date that hasn't started in the captain's world)
- `briefing previous` returning future briefings

### Specification
Every endpoint that deals with briefing dates MUST resolve "today" against the **user's timezone** (stored in `user.timezone`).

Affected endpoints:
- `POST /briefings/assemble` — default date = today in user's timezone
- `GET /briefings/previous/:userId` — "most recent on or before today" uses user's timezone
- `GET /cards/pull/:userId` — card expiration checks use user's timezone for "today"
- Idempotency check on assemble — "briefing already exists for this date" uses user's timezone

### Implementation Notes
- User timezone is already stored on the user record (e.g., `America/Mexico_City`, `America/New_York`)
- Use a timezone library (e.g., `luxon`, `date-fns-tz`) server-side
- All internal storage remains UTC — timezone conversion happens at the API boundary
- If a user has no timezone set, default to `America/New_York` (majority of captains are East Coast FL)

---

## 2. Briefing Delete

**Priority: P0**

### Problem
No way to remove broken or test briefings. Stubs and bad data block new briefings for that date due to idempotency.

### API
```
DELETE /briefings/:briefingId
```

### CLI
```
skip briefing delete <briefingId> [--confirm] [--json]
```

### Behavior
- Removes the briefing record
- **Un-marks all cards** in that briefing as served to this user (decrements `served_count`, clears `last_served_at` if no other briefings served it)
- Requires `--confirm` flag on CLI (safety net)
- Returns `{ success: true, briefingId, cardsUnserved: N }`

### Why
- Cleanup during development
- Fix production mistakes (wrong cards, wrong date, advisor error)
- Essential for the `--force` replace workflow on `assemble`

---

## 3. Briefing Assemble — Force Replace

**Priority: P0**

### Problem
If a briefing already exists for a date, `assemble` returns `created: false` and does nothing. There's no way for an advisor to fix a bad briefing.

### API Change
```
POST /briefings/assemble
Body: { userId, date?, items, force?: boolean }
```

### CLI Change
```
skip briefing assemble --user=<id> --items='[...]' [--force] [--json]
```

### Behavior When `force=true`
1. Find existing briefing for that user + date
2. Un-mark all cards from the old briefing as served
3. Delete the old briefing
4. Create the new briefing with the provided items
5. Mark new cards as served
6. Return `{ success: true, briefingId, created: true, replaced: true, itemCount, cardsServed }`

### Behavior When `force=false` (default, current)
- No change from current behavior: return `created: false` if briefing exists

---

## 4. Briefing Previous — Date-Aware

**Priority: P1**

### Problem
Returns the most recent briefing regardless of date. If a future-dated briefing exists, it becomes "previous" and poisons the advisor's deduplication.

### API Change
```
GET /briefings/previous/:userId?date=YYYY-MM-DD
```

### CLI Change
```
skip briefing previous --user=<id> [--date=YYYY-MM-DD] --json
```

### Behavior
- Returns the most recent briefing with `date <= requested_date`
- Default `date` = today in user's timezone (see Section 1)
- Response format unchanged: `{ briefingId, date, cardCount, cards: [{id, title, category}] }`

---

## 5. Future Date Rejection on Assemble

**Priority: P1**

### Problem
Nothing prevents creating a briefing for next Wednesday. This creates orphaned future briefings that confuse the system.

### Specification
- `briefing assemble` rejects any `date` more than 1 calendar day ahead of today (in user's timezone)
- Error response: `{ success: false, error: "Date too far in the future. Maximum: tomorrow." }`
- Allows today and tomorrow only (tomorrow supports early-morning pre-generation by advisors in timezones ahead of their captains)

---

## 6. Assemble Minimum Item Validation

**Priority: P1**

### Specification
- **Reject** if items array contains zero cards (text-only briefing is a bug)
  - Error: `{ success: false, error: "Briefing must contain at least 1 card." }`
- **Warn** (but allow) if items array contains fewer than 3 cards
  - Response includes: `"warnings": ["Briefing contains only N cards. Recommended minimum: 3."]`
- **Warn** if no card has category `weather-tides` or is flagged as weather priority
  - Response includes: `"warnings": ["No weather card included. Consider adding current conditions."]`

---

## 7. Daily Weather Card Pipeline

**Priority: P1**

### Problem
Every briefing needs weather. Currently there's no guarantee a fresh weather card exists for each location each day. Advisors have no signal when weather content is missing.

### Specification

**Beat reporter requirement:**
- Each location MUST have a `weather-tides` category card produced daily
- Mr. Content's beat reporters (e.g., `beat-weather-tampa-bay`) are responsible for this
- The card should include: wind speed/direction, wave height, tide times with heights, temperature, any marine advisories, go/no-go recommendation

**Card pull missing-category warning:**
- When `card pull` runs for a user, check if any card in the results has category `weather-tides` with `freshness: timely` created within the last 24 hours
- If not, include in response: `"missing": ["weather-tides"]`
- This alerts the advisor that weather content is stale or absent

**Weather priority flag:**
- Cards with category `weather-tides` should include `"priority": true` in the `card pull` response
- Signals to the advisor: include this card, it's non-negotiable

---

## 8. Card Pull Enhancements

**Priority: P2**

### 8a. Freshness Scoring

Current sort: timely first, then evergreen. Enhance within those buckets:

**Timely cards sort order:**
1. Cards expiring soonest (use it or lose it)
2. Cards created most recently (freshest intel)
3. Cards never served to anyone (brand new content)
4. Cards with lower `served_count` (less exposed)

**Evergreen cards sort order:**
1. Cards never served to this user
2. Cards never served to anyone
3. Cards with lower `served_count`

### 8b. Interest-Weighted Sorting

Each user has an `interests` array (e.g., `["Weather & Conditions", "Restaurants & Dining", "Marina News", "Maintenance & Care", "Local Events"]`).

- Map interest labels to card categories:
  - "Weather & Conditions" → `weather-tides`
  - "Restaurants & Dining" → `dining`, `dock-and-dine`
  - "Marina News" → `port32-marinas`, `marina-news`
  - "Maintenance & Care" → `maintenance`, `boat-maintenance`
  - "Local Events" → `activities-events`
  - (Maintain a mapping table server-side)
- Cards matching user interests sort higher within their freshness tier
- Don't filter — just prioritize. Advisor still sees everything.

### 8c. Duplicate Detection

The card library has near-duplicate cards (e.g., three variations of "Shell Key Circuit Looks Perfect"). 

- Compute title similarity (Levenshtein distance or trigram overlap)
- If two cards from the same location and category have >80% title similarity, group them
- Return only the freshest card from each group in `card pull`
- Include `"duplicates_suppressed": N` in response stats

---

## 9. Briefing History for Weekly Deduplication

**Priority: P2**

### Problem
`briefing previous` only returns the last briefing. Advisors need to see the full week to plan variety.

### API
```
GET /briefings/history/:userId?days=7
```

### CLI
```
skip briefing history --user=<id> [--days=7] --json
```

### Response
```json
{
  "success": true,
  "userId": "user_bobby_b08861b8",
  "days": 7,
  "briefings": [
    {
      "briefingId": "briefing_20260207_bobby_...",
      "date": "2026-02-07",
      "cards": [
        { "id": "card_abc", "title": "...", "category": "weather-tides" },
        { "id": "card_def", "title": "...", "category": "maintenance" }
      ]
    },
    {
      "briefingId": "briefing_20260206_bobby_...",
      "date": "2026-02-06",
      "cards": [...]
    }
  ],
  "allCardIds": ["card_abc", "card_def", ...],
  "categoryCounts": {
    "weather-tides": 5,
    "maintenance": 2,
    "activities-events": 1,
    "dining": 0
  }
}
```

### Why
- `allCardIds` — quick deduplication check without parsing each briefing
- `categoryCounts` — advisor sees "Bobby got maintenance twice this week but no dining" and adjusts
- Lightweight enough for the advisor to consume in one call

---

## 10. Briefing Validate (Dry Run)

**Priority: P2**

### API
```
POST /briefings/validate
Body: { userId, date?, items }
```

### CLI
```
skip briefing validate --user=<id> --items='[...]' --json
```

### Response
```json
{
  "success": true,
  "valid": true,
  "itemCount": 9,
  "cardCount": 4,
  "warnings": [],
  "errors": [],
  "cards": [
    { "id": "card_abc", "status": "ok", "title": "..." },
    { "id": "card_xyz", "status": "expired", "title": "..." },
    { "id": "card_999", "status": "not_found" }
  ],
  "weatherIncluded": true,
  "overlapWithPrevious": ["card_abc"],
  "briefingExistsForDate": false
}
```

### Behavior
- Validates all cards exist, are not expired, not archived
- Checks for overlap with previous briefing
- Checks for weather inclusion
- Checks minimum card count
- **Does not save anything**
- Returns actionable errors and warnings

---

## 11. Served vs. Viewed Tracking

**Priority: P3**

### Problem
`assemble` marks cards as "served" (included in a briefing). But if the captain never opens the briefing, those cards are marked as served but never actually seen. `--exclude-served` then hides cards the captain never saw.

### Specification

**Two distinct states:**
- `served` — card was included in a briefing (set by `assemble`)
- `viewed` — captain actually saw the card (set by client-side event when the briefing is opened and the card is scrolled into view)

**Card pull filter options:**
```
skip card pull --user=<id> --exclude-served --json    # Current behavior: exclude all served
skip card pull --user=<id> --exclude-viewed --json    # New: only exclude actually viewed
```

**Default behavior:**
- Change default to `--exclude-viewed` once client-side tracking is implemented
- Until then, keep `--exclude-served` as default

**Client-side requirement:**
- App sends `POST /cards/:cardId/viewed` when a card is displayed to the captain
- Or batch: `POST /briefings/:briefingId/viewed` marks all cards in that briefing as viewed when the briefing is opened

---

## 12. Per-Card Engagement Tracking

**Priority: P3**

### Specification

Track per-card, per-user engagement events:
- `viewed` — card was displayed
- `expanded` — captain tapped to read full content
- `bookmarked` — captain saved the card
- `thumbs_up` / `thumbs_down` — explicit feedback
- `shared` — captain shared the card

**API:**
```
POST /cards/:cardId/engage
Body: { userId, action: "viewed"|"expanded"|"bookmarked"|"thumbs_up"|"thumbs_down"|"shared" }
```

**Feed back to card pull:**
- Over time, build a per-user engagement profile: which categories they engage with most
- Use this to refine interest-weighted sorting (Section 8b)
- Surface engagement summary in `skip user get --json` so advisors can read it

**Feed back to advisors:**
- `skip advisor engagement --user=<userId> --json` returns:
  ```json
  {
    "topCategories": ["weather-tides", "dining", "activities-events"],
    "bottomCategories": ["maintenance", "port32-marinas"],
    "recentThumbs": [
      { "cardId": "card_abc", "action": "thumbs_up", "title": "..." },
      { "cardId": "card_def", "action": "thumbs_down", "title": "..." }
    ],
    "briefingsOpened": 5,
    "briefingsTotal": 8,
    "openRate": 0.625
  }
  ```
- Advisors use this to personalize: "Bobby loves fishing and dining content, skip the maintenance unless it's critical"

---

## Summary: Priority Matrix

| Priority | Item | Section | Effort Est. |
|----------|------|---------|-------------|
| **P0** | Timezone-first date logic | §1 | Medium |
| **P0** | Briefing delete | §2 | Small |
| **P0** | Force-replace on assemble | §3 | Small |
| **P1** | Date-aware briefing previous | §4 | Small |
| **P1** | Future date rejection | §5 | Small |
| **P1** | Minimum item validation + weather warning | §6 | Small |
| **P1** | Daily weather card pipeline + missing warning | §7 | Medium |
| **P2** | Card pull freshness scoring | §8a | Medium |
| **P2** | Interest-weighted card pull | §8b | Medium |
| **P2** | Duplicate card detection | §8c | Medium |
| **P2** | Briefing history for weekly dedup | §9 | Small |
| **P2** | Briefing validate dry-run | §10 | Small |
| **P3** | Served vs. viewed distinction | §11 | Medium |
| **P3** | Per-card engagement tracking | §12 | Large |

---

## Appendix: Advisor Morning Workflow (Target State)

This is the complete workflow an advisor follows with all features implemented:

```
1. WAKE UP
   - Load captain profile: name, boat, location, interests, timezone
   - Load advisor memories: preferences, past interactions, personal notes

2. CHECK HISTORY
   skip briefing history --user=<userId> --days=7 --json
   → See what cards were served this week
   → Note category distribution (too much maintenance? no dining?)

3. PULL CANDIDATES
   skip card pull --user=<userId> --exclude-viewed --json
   → Get eligible cards, sorted by relevance
   → Note the weather priority card
   → Note any "missing" warnings (no fresh weather?)
   → Note any engagement data (what does this captain like?)

4. SELECT CARDS (advisor judgment)
   - ALWAYS include weather (priority card)
   - Pick 3-5 additional cards based on:
     - Captain's interests
     - What hasn't been covered this week (category gaps)
     - What's timely/expiring
     - What the captain engages with (engagement data)
   - Avoid cards from briefing history allCardIds

5. WRITE NARRATIVE
   - Opening: personal, references captain by name, sets the tone for the day
   - Transitions: connect cards naturally, use captain's boat name, reference their location
   - Use absolute dates ("Saturday", "February 8") not relative ("tomorrow", "today")
   - Closing: warm sendoff, maybe tease tomorrow's content

6. VALIDATE (optional safety net)
   skip briefing validate --user=<userId> --items='[...]' --json
   → Check for expired cards, overlaps, missing weather
   → Fix any issues

7. ASSEMBLE
   skip briefing assemble --user=<userId> --items='[...]' --json
   → Briefing saved, cards marked as served
   → Done.

8. LOG
   - Write daily memory entry: what cards were selected, any notable decisions
   - Note if content was thin for any category (flag to Commodore)
```

---

## Appendix: Date/Time Reference Language

Advisors should follow these rules when writing narrative text:

| Instead of | Use |
|------------|-----|
| "today" | "Saturday" or "this morning" |
| "tomorrow" | "Sunday" or the actual date |
| "yesterday" | "Friday" or the actual date |
| "this weekend" | "Saturday and Sunday" or "Feb 8-9" |
| "next week" | "the week of Feb 10" |

Relative time words become wrong the moment the briefing is read on a different day. Day names and dates are always correct.

---

## Questions & Contact

This is a living spec. If anything is ambiguous, contradictory, or missing — **ask me directly** rather than guessing. See the "Engineering Team: How to Reach Me" section at the top for instructions.

When you ship an endpoint or batch of changes, ping me and I'll run live tests against the dev server within minutes. I'll report back with pass/fail and any issues found.

```
sessions_send(
  sessionKey: "agent:commodore:main",
  message: "Commodore — P0 items shipped. briefing delete and --force on assemble are live on localhost:8787. Ready for testing."
)
```

---

*Spec authored by The Commodore (`agent:commodore:main`). February 7, 2026.*
