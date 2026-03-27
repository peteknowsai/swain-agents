# Card Create Reference

Detailed technical reference for card creation. The SKILL.md has the basics — this covers the full field reference, category list, and the differences between advisor and desk agent card creation.

## Advisor Card Creation

Advisors create cards in two situations:
1. **During heartbeats** — conversation-inspired content (captain mentioned a topic worth exploring)
2. **During briefing assembly** — gap-filling when the pull doesn't return enough candidates

Advisors set all fields explicitly (no auto-fill):

```bash
swain card create \
  --desk=<captain's regional desk> \
  --user=<userId> \
  --category=<category> \
  --title="<short headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full markdown>" \
  --freshness=<timely|evergreen> \
  --json
```

- `--desk` — The captain's assigned content desk (from `swain user get`)
- `--user` — Tags the card for a specific captain. User-tagged cards surface first in pull results.
- `--category` — Set manually (see category list below)
- `--freshness` — Set manually: `timely` or `evergreen`

## Desk Agent Card Creation

Desk agents create cards as part of beat reporting. The server auto-fills some fields from the agent ID:

```bash
swain card create \
  --agent-id="$AGENT_ID" \
  --title="Your Title" \
  --subtext="Brief preview text" \
  --content="Full markdown content..." \
  --json
```

**Server auto-fills from agent ID:**
- `category` — based on the agent's beat
- `freshness` — timely or evergreen
- `location` — the agent's coverage area
- `expires_at` — expiration for timely content

**Optional overrides** (desk agents only use these when needed):
```bash
swain card create \
  --agent-id="$AGENT_ID" \
  --title="Weekend Fishing Report" \
  --subtext="Snook stacked on channel edges through Sunday" \
  --content="## Inshore Report\n\n..." \
  --freshness=timely \
  --expires-at="2025-02-07T06:00:00Z" \
  --location=tierra-verde \
  --json
```

---

## Complete Field Reference

| Field | Flag | Required | Description |
|---|---|---|---|
| Title | `--title` | Yes | Short headline, 3-6 words |
| Subtext | `--subtext` | Yes | Preview text, 2-3 sentences with key takeaway |
| Content | `--content` | Yes | Full article in markdown |
| Desk | `--desk` | Advisor: yes | Captain's assigned content desk |
| User | `--user` | No | Tags card for a specific captain |
| Category | `--category` | Advisor: yes | Content category (see list below) |
| Freshness | `--freshness` | Advisor: yes | `timely` or `evergreen` |
| Agent ID | `--agent-id` | Desk agent: yes | Desk agent's ID (enables auto-fill) |
| Location | `--location` | No | Geographic tag override |
| Expires At | `--expires-at` | No | ISO 8601 timestamp for timely content expiration |
| JSON output | `--json` | Recommended | Returns structured JSON response |

---

## Category List

| Category | Description |
|---|---|
| `weather-tides` | Weather forecasts, tide charts, wind patterns |
| `fishing-reports` | What's biting, conditions, regulations |
| `activities-events` | Local events, regattas, festivals, dining |
| `maintenance-care` | Boat maintenance tips, seasonal care |
| `safety-regulations` | Safety info, regulatory changes |
| `routes-navigation` | Boating routes, anchorages, navigation hazards |
| `wildlife-nature` | Wildlife sightings, marine life, environmental conditions |
| `destinations` | Cruising destinations, anchorages, waterside dining |
| `lifestyle` | Boating lifestyle, gear reviews, culture |
| `gear` | Equipment recommendations, product reviews |

---

## Image Generation

Images are **not** set at card creation time. They are generated separately:
```bash
swain card image <cardId> --style=<styleId> --bg-color=<hex> --prompt="<scene description>" --json
```

This is a separate step, typically done during briefing assembly or the content desk styling workflow.

**Do not set `--image` or `--style-id` at creation time.**

---

## Boat Art Warning

**NEVER create boat-art cards with `swain card create`.** Use the dedicated command:
```bash
swain card boat-art --user=<userId> --best --json
```

`boat-art` auto-sets `styleId`, `backgroundColor`, and proper metadata that iOS needs for art display mode. Manual boat-art cards created via `card create` will render broken in the app.

---

## Response Format

```json
{"success": true, "cardId": "card_xxx"}
```

---

## Writing Guidelines

A great card:
- Reads like it was written by someone who knows these waters
- Is specific enough to be useful TODAY, not generic advice
- References real places, real conditions, real local knowledge
- Teaches the captain something or gives them something actionable
- **Research first** — use web search for real data, never fabricate content
