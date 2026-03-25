---
name: memory
description: "How to manage memory — what to remember, when to write, where things go. Use this skill whenever you learn something new, at the start of sessions to load context, or when deciding how to organize what you know."
user-invocable: false
---

# Memory

Your value is directly proportional to what you know. An empty memory is a useless agent. A rich memory is an indispensable one.

## Where Memory Lives

```
.claude/memory/
  MEMORY.md             # Index — what you know + what you want to know
  yearnings/            # Questions you're carrying
  notes/                # Daily notes
  ...                   # Memory files you create as you learn
```

No prescribed structure. You build it as you learn. The dream cycle organizes it over time.

## MEMORY.md — The Index

Always read this first. It's your map of what you know and what you're curious about.

```markdown
# MEMORY.md

## Confirmed
- [region.md](region.md) — Tampa Bay, Clearwater Pass to Skyway Bridge

## Yearnings
- [yearnings/fishing-patterns.md](yearnings/fishing-patterns.md) — what species run here?

## Daily Notes
- [notes/2026-03-24.md](notes/2026-03-24.md)
```

Update it whenever you add, change, or remove a memory file.

## Yearnings

A yearning is a question you're carrying — a memory that doesn't exist yet.

You start with implanted yearnings: things you want to learn. As you learn answers, yearnings become confirmed memories. New questions surface and become new yearnings.

```markdown
---
type: yearning
subject: "local fishing patterns"
confidence: none
source: "new to this region"
tags: [yearning]
created: 2026-03-24
---

# Local Fishing Patterns

What species run here? When? Where are the inshore spots?

## How to learn this
Research local fishing reports, charter websites, bait shop reports.
```

### Lifecycle

Signal → yearning → carry it → discover the answer → create memory file → delete yearning.

Don't rush. Some resolve quickly, some take time.

## When to Read

- **Session start.** Read MEMORY.md, scan relevant files.
- **Before producing output.** Personalize based on what you know.
- **Before answering questions.** Check if you already know.

## When to Write

- **When you learn something.** Create or update a memory file immediately.
- **After meaningful work.** Daily note at `notes/YYYY-MM-DD.md`.
- **During the dream cycle.** Full consolidation — the dream skill handles this.

## How to Organize

Let structure emerge from what you learn. Don't create empty files upfront.

- **First fact about a topic?** Add it to an existing file if one fits, or create a new one.
- **File getting long?** Split it during a dream cycle.
- **Two files overlapping?** Merge during a dream cycle.
- **Cluster of related facts?** That's a file.

The dream cycle is your cleanup pass. Real-time writes just need to capture the information.

## How to Learn

- **Do the work first**, learn as a byproduct
- **Let yearnings guide your curiosity**
- **Be specific.** "Redfish stacking at Weedon Island flats in March" beats "fishing is good"
- **Include context.** Note the source and date of every fact

## Writing Rules

- **Use Obsidian formatting.** Frontmatter, wikilinks, tags. See obsidian-vault skill.
- **Replace stale content.** Don't append forever.
- **Be specific.** Context and dates on everything.
- **Update MEMORY.md index** when you add or remove files.
