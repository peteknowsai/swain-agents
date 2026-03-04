---
name: swain-library
description: "Card library strategy — how to browse, select, and prioritize content cards for briefings. Use this skill whenever you're choosing cards for a captain, deciding between timely and evergreen content, or figuring out what to include in a briefing."
metadata: { "openclaw": { "emoji": "📚", "requires": { "bins": ["swain"] } } }
---

# Card Library

The card library is the pool of all available content cards. Cards are created by beat reporter agents and curated for specific locations.

## Browsing Cards

Two commands, different purposes:

- **`swain card pull --user=<userId> --json`** — Personalized, ranked selection for a specific user. Respects `--exclude-served` to skip cards already delivered. User-tagged cards surface first. Use this for briefings.
- **`swain card list [--desk=<desk>] --json`** — Raw catalog query. Browse by desk or category. Use when exploring what's available or checking coverage, not for briefing assembly.

## Card Properties

Each card has:
- `id` - Unique card ID (e.g., `card_weather_1234`)
- `title` - Short headline (3-6 words)
- `subtext` - Preview text (2-3 sentences)
- `content_markdown` - Full article in markdown
- `image` - Image URL
- `backgroundColor` - Card background color (hex)
- `category` - Content category (e.g., `weather-tides`, `activities-events`)
- `freshness` - Either `timely` (expires) or `evergreen` (always relevant)
- `expires_at` - Unix timestamp when timely content expires (null for evergreen)
- `served_count` - How many times this card has been served globally
- `location` - Geographic location tag (e.g., `tierra-verde`)

## Freshness Model

- **timely** - Content that expires. Weather forecasts, tide charts, event announcements, fishing reports. Check `expires_at` before including.
- **evergreen** - Always relevant. Maintenance tips, how-to guides, safety info. Good filler content.

## User-Tagged Cards

Cards can be tagged for a specific captain using `--user=<userId>` during creation.
These are cards the advisor created based on conversations with that captain. When
you pull cards, user-tagged cards appear first with a `forUser: true` flag.

**Always prioritize user-tagged cards** — they were created specifically for this
captain and are the most personalized content available.

## Selection Strategy

1. **User-tagged cards first** - Cards you created for this captain (`forUser: true`)
2. **Lead with timely cards** - Check expiration dates, prioritize what's urgent
3. **Fill with fresh evergreen** - Cards they haven't seen yet
4. **Sparingly resurface** - Only if an old card is especially relevant to today
5. **Match interests** - Check the captain's profile for preferred topics
6. **Variety** - Don't stack 5 fishing cards; mix categories

## Categories

Common categories:
- `weather-tides` - Weather forecasts, tide charts
- `fishing-reports` - What's biting, conditions
- `activities-events` - Local events, dining, social
- `maintenance-care` - Boat maintenance tips
- `safety-regulations` - Safety info, regulations
- `port32-marinas` - Marina news, docking tips
- `routes-navigation` - Boating routes, navigation
- `wildlife-nature` - Wildlife sightings, nature
