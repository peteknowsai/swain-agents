# Obsidian Vault — Frontmatter Schemas & Examples

## captain
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

## family
```yaml
---
type: family
captain: "[[Captain]]"
tags: [captain, family]
updated: 2026-03-21
---
```

## boat
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

## marina
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

## daily
```yaml
---
type: daily
date: 2026-03-21
captain: "[[Captain]]"
tags: [daily]
---
```

## memory
General-purpose for preferences, work, health, goals, etc.
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

## conversation
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

## Full Examples

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
- Weather window looks good
```
