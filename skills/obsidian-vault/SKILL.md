---
name: obsidian-vault
description: "How to write Obsidian-native markdown — YAML frontmatter, wikilinks, tags, and consistent file structure. Use this skill whenever writing or updating memory files, daily notes, or any .md file that syncs to the captain's Obsidian vault. Ensures graph view, backlinks, and properties work correctly."
---

# Obsidian-Native Markdown

All markdown files you write — memory, daily notes, CLAUDE.md — sync to an Obsidian vault. Write them so they render properly: YAML frontmatter, wikilinks between notes, tags for categorization.

## Rules

1. **Every .md file gets YAML frontmatter.** No exceptions.
2. **Use wikilinks** to connect related notes: `[[Boat]]`, `[[Captain]]`, `[[Marina]]`
3. **Use tags** for categorization: `#captain`, `#boat`, `#maintenance`
4. **Always include `updated` in frontmatter** with today's date (YYYY-MM-DD)
5. **Replace stale content** — don't just append. Keep files current.
6. **Wikilinks with aliases** for readable prose: `[[Marina|Sausalito Yacht Harbor]]`

## Frontmatter Schemas

Every note has a `type` field. Use the schema matching the note type.

### captain

```yaml
---
type: captain
name: "Pete"
experience: advanced
marina: "[[Marina]]"
boat: "[[Boat]]"
tags: [captain]
updated: 2026-03-21
---
```

### family

```yaml
---
type: family
captain: "[[Captain]]"
tags: [captain, family]
updated: 2026-03-21
---
```

### boat

```yaml
---
type: boat
name: "Sea Breeze"
makeModel: "Beneteau Oceanis 42"
year: 2018
captain: "[[Captain]]"
marina: "[[Marina]]"
tags: [boat]
updated: 2026-03-21
---
```

### marina

```yaml
---
type: marina
name: "Sausalito Yacht Harbor"
location: "Sausalito, CA"
captain: "[[Captain]]"
boat: "[[Boat]]"
tags: [marina]
updated: 2026-03-21
---
```

### daily

```yaml
---
type: daily
date: 2026-03-21
captain: "[[Captain]]"
tags: [daily]
---
```

### memory

General-purpose memory note for anything that doesn't fit the specific types above (preferences, work, health, goals, etc.).

```yaml
---
type: memory
category: preferences
captain: "[[Captain]]"
tags: [captain, preferences]
updated: 2026-03-21
---
```

Valid categories: `preferences`, `work`, `health`, `goals`, `safety`, `insurance`, `budget`, `schedule`, `regulations`, `social`, `services`, `fishing`, `racing`, `entertaining`, `cruising`, `weather`, `local-knowledge`, `inventory`, `fuel-water`, `issues`, `upgrades`, `maintenance`, `systems`

### conversation

Summary of a specific conversation or briefing delivery.

```yaml
---
type: conversation
date: 2026-03-21
channel: imessage
captain: "[[Captain]]"
topic: "Engine oil change schedule"
tags: [conversation, maintenance]
updated: 2026-03-21
---
```

## Tag Taxonomy

Use these consistently:

| Tag | When |
|-----|------|
| `#captain` | Anything about the captain personally |
| `#boat` | Boat specs, systems, equipment |
| `#maintenance` | Repairs, scheduled work, projects |
| `#marina` | Marina, slip, dock, facilities |
| `#weather` | Weather preferences, conditions, thresholds |
| `#cruising` | Trips, destinations, anchorages |
| `#fishing` | Spots, species, gear |
| `#racing` | Club, class, results |
| `#safety` | Certs, equipment, emergency info |
| `#daily` | Daily notes |
| `#conversation` | Conversation summaries |
| `#family` | Family members, crew |
| `#local` | Local knowledge, anchorages, fuel docks |

Combine tags freely: a maintenance note about the engine is `[maintenance, boat]`.

## Wikilinks

Link related notes so Obsidian's graph view shows connections.

**Always link to:**
- `[[Captain]]` from any note that references the captain
- `[[Boat]]` from maintenance, systems, upgrades, issues notes
- `[[Marina]]` from local knowledge, services notes
- `[[Daily/YYYY-MM-DD]]` from conversation summaries

**Alias syntax** for natural prose:
```markdown
Docked at [[Marina|Sausalito Yacht Harbor]] since 2024.
Took [[Boat|Sea Breeze]] out past the Gate yesterday.
```

**Don't over-link.** Link to notes that exist or will exist. Don't create links to notes you'll never write.

## File Structure

```
.claude/memory/
  captain.md          # type: captain
  family.md           # type: family
  boat.md             # type: boat
  marina.md           # type: marina
  preferences.md      # type: memory, category: preferences
  work.md             # type: memory, category: work
  goals.md            # type: memory, category: goals
  maintenance.md      # type: memory, category: maintenance
  systems.md          # type: memory, category: systems
  ...
  notes/
    2026-03-21.md     # type: daily
    2026-03-20.md
    ...
```

## Examples

### Captain memory file

```markdown
---
type: captain
name: "Pete"
experience: advanced
marina: "[[Marina]]"
boat: "[[Boat]]"
tags: [captain]
updated: 2026-03-21
---

# Pete

Experienced sailor, owns [[Boat|Sea Breeze]] — a 42' Beneteau based at [[Marina|Sausalito Yacht Harbor]].
Prefers early morning departures, comfortable in up to 25kt winds.

## Preferences
- Favorite anchorage: Angel Island
- Communication style: brief, no fluff
- Interests: offshore passages, boat maintenance

## See Also
- [[Boat]] — vessel details
- [[Marina]] — home port
```

### Daily note

```markdown
---
type: daily
date: 2026-03-21
captain: "[[Captain]]"
tags: [daily, maintenance]
---

# 2026-03-21

## Conversation
[[Captain|Pete]] asked about oil change intervals for the Yanmar in [[Boat|Sea Breeze]].
Recommended every 200 hours — he's at 180 now. Noted in [[Maintenance]].

## Observations
- Mentioned a trip to Drakes Bay next weekend
- Weather window looks good — updated [[Weather]] preferences
```

### Maintenance memory

```markdown
---
type: memory
category: maintenance
captain: "[[Captain]]"
boat: "[[Boat]]"
tags: [maintenance, boat]
updated: 2026-03-21
---

# Maintenance Log

## Engine — Yanmar 4JH4-TE
- Oil change due at 200 hours (currently 180 as of 2026-03-21)
- Last oil change: 2026-01-15 at 150 hours
- Uses 15W-40 diesel oil

## Bottom Paint
- Last haul-out: 2025-10-01
- Paint: Interlux Micron CSC (blue)
- Next haul due: Fall 2026

## See Also
- [[Boat]] — full specs
- [[Systems]] — electrical, plumbing details
```

### Conversation summary

```markdown
---
type: conversation
date: 2026-03-21
channel: imessage
captain: "[[Captain]]"
topic: "Weekend trip planning"
tags: [conversation, cruising]
updated: 2026-03-21
---

# Weekend Trip Planning — 2026-03-21

[[Captain|Pete]] wants to take [[Boat|Sea Breeze]] to Drakes Bay Saturday.

## Key Points
- Departure: early morning, ~0600
- Crew: just Pete, solo
- Weather check needed Friday evening
- Wants to anchor overnight, return Sunday

## Actions Taken
- Checked NOAA forecast — looks favorable
- Updated [[Cruising]] with Drakes Bay plans
```
