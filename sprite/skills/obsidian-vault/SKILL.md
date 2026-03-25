---
name: obsidian-vault
description: "How to write Obsidian-native markdown — YAML frontmatter, wikilinks, tags, and consistent file structure. Use this skill whenever writing or updating memory files, daily notes, or any .md file in .claude/memory/. These files sync to an Obsidian vault where frontmatter, wikilinks, and tags power graph view and backlinks."
user-invocable: false
---

# Obsidian-Native Markdown

All markdown files you write sync to an Obsidian vault. Write them so they render properly: YAML frontmatter, wikilinks between notes, tags for categorization.

## Rules

1. **Every .md file gets YAML frontmatter.** No exceptions.
2. **Use wikilinks** to connect related notes: `[[Boat]]`, `[[Captain]]`, `[[Marina]]`
3. **Use tags** for categorization: `#captain`, `#boat`, `#maintenance`
4. **Always include `updated` in frontmatter** with today's date (YYYY-MM-DD)
5. **Replace stale content** — don't just append. Keep files current.
6. **Wikilinks with aliases** for readable prose: `[[Marina|Sausalito Yacht Harbor]]`

## Frontmatter Schemas

Every note has a `type` field. Use the schema matching the note type.

For the full schema reference and examples, see [reference.md](reference.md).

### Quick Reference

| Type | Key Fields | When |
|------|-----------|------|
| `captain` | name, experience, marina, boat | Captain profile |
| `family` | captain | Family, crew, pets |
| `boat` | name, makeModel, year, captain, marina | Boat specs |
| `marina` | name, location, captain, boat | Home marina |
| `daily` | date, captain | Daily conversation notes |
| `memory` | category, captain | Everything else (preferences, maintenance, etc.) |
| `conversation` | date, channel, captain, topic | Conversation summaries |

## Tag Taxonomy

| Tag | When |
|-----|------|
| `#captain` | Anything about the captain personally |
| `#boat` | Boat specs, systems, equipment |
| `#maintenance` | Repairs, scheduled work, projects |
| `#marina` | Marina, slip, dock, facilities |
| `#weather` | Weather preferences, conditions |
| `#cruising` | Trips, destinations, anchorages |
| `#fishing` | Spots, species, gear |
| `#safety` | Certs, equipment, emergency info |
| `#daily` | Daily notes |
| `#conversation` | Conversation summaries |
| `#family` | Family members, crew |
| `#local` | Local knowledge, fuel docks |

## Wikilinks

**Always link to:**
- `[[Captain]]` from any note referencing the captain
- `[[Boat]]` from maintenance, systems, upgrades notes
- `[[Marina]]` from local knowledge, services notes

**Don't over-link.** Link to notes that exist or will exist.

## File Structure

```
.claude/memory/
  captain.md
  family.md
  boat.md
  marina.md
  preferences.md
  maintenance.md
  ...
  notes/
    2026-03-21.md
    2026-03-20.md
```
