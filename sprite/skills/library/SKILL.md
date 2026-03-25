---
name: library
description: "Card library strategy — how to browse, select, and prioritize content cards for briefings. Use when choosing cards for a captain, deciding between timely and evergreen content, or building a briefing's content lineup."
user-invocable: false
---

# Card Library

The card library is the pool of all available content cards. Cards are created by desk agents and advisors.

## Browsing

- **`swain card pull --user=<userId> --json`** — Personalized, ranked for this captain. Use `--exclude-served` to skip delivered cards. Use for briefings.
- **`swain card list [--desk=<desk>] --json`** — Raw catalog query. Use when exploring or checking coverage.

## Freshness

- **timely** — expires. Weather, tide charts, events, fishing reports. Check `expires_at`.
- **evergreen** — always relevant. Maintenance tips, how-tos, safety info.

## Selection Priority

1. **User-tagged cards** — created specifically for this captain (`forUser: true`)
2. **Timely cards** — still valid today
3. **Fresh evergreen** — cards they haven't seen
4. **Match interests** — captain's profile and recent conversations
5. **Variety** — mix categories, don't stack 5 of the same type

## Categories

`weather-tides`, `fishing-reports`, `activities-events`, `maintenance-care`, `safety-regulations`, `routes-navigation`, `wildlife-nature`
