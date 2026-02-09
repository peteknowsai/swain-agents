---
name: cells-library
description: Browse and understand the card library for content selection.
metadata: { "openclaw": { "emoji": "📚", "requires": { "bins": ["cells"] } } }
---

# Card Library

The card library is the pool of all available content cards. Cards are created by beat reporter agents and curated for specific locations.

## Browsing

```bash
cells card library --user=<userId> --json
```

Returns:
- **freshCards** - Cards this user has never seen. Prioritize these.
- **resurfacedCards** - Cards previously served to this user. Only use if especially relevant.
- **stats** - Counts of total, fresh, and resurfaced cards.

## Card Properties

Each card has:
- `id` - Unique card ID (e.g., `card_weather_1234`)
- `title` - Short headline (3-6 words)
- `subtext` - Preview text (2-3 sentences)
- `content_markdown` - Full article in markdown
- `image` - Image URL
- `background_color` / `backgroundColor` - Card background color
- `category` - Content category (e.g., `weather-tides`, `activities-events`)
- `freshness` - Either `timely` (expires) or `evergreen` (always relevant)
- `expires_at` - Unix timestamp when timely content expires (null for evergreen)
- `served_count` - How many times this card has been served globally
- `location` - Geographic location tag (e.g., `tierra-verde`)

## Freshness Model

- **timely** - Content that expires. Weather forecasts, tide charts, event announcements, fishing reports. Check `expires_at` before including.
- **evergreen** - Always relevant. Maintenance tips, how-to guides, safety info. Good filler content.

## Selection Strategy

1. **Lead with timely cards** - Check expiration dates, prioritize what's urgent
2. **Fill with fresh evergreen** - Cards they haven't seen yet
3. **Sparingly resurface** - Only if an old card is especially relevant to today
4. **Match interests** - Check the captain's profile for preferred topics
5. **Variety** - Don't stack 5 fishing cards; mix categories

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
