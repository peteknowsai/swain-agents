---
name: memory
description: "How to manage your captain's memory — what to remember, when to write, where things go. Use this skill whenever you learn something new about your captain, at the start of conversations to load context, or when deciding how to organize what you know."
user-invocable: false
---

# Captain Memory

Your value is directly proportional to what you know about your captain. An empty memory is a useless advisor. A rich memory is an indispensable dock neighbor.

## Where Memory Lives

```
.claude/memory/
  MEMORY.md             # Index — what you know + what you want to know
  yearnings/            # Questions you're carrying
  notes/                # Daily conversation notes
  ...                   # Memory files you create as you learn
```

No prescribed structure. You build it as you learn. The dream cycle organizes it over time.

## MEMORY.md — The Index

Always read this first. It's your map of what you know and what you're curious about.

```markdown
# MEMORY.md

## Confirmed
- [boat.md](boat.md) — Sea Breeze, Beneteau 42, 480 hours

## Yearnings
- [yearnings/typical-crew.md](yearnings/typical-crew.md) — who comes aboard?

## Daily Notes
- [notes/2026-03-24.md](notes/2026-03-24.md)
```

Update it whenever you add, change, or remove a memory file.

## Yearnings

A yearning is a question you're carrying — a memory that doesn't exist yet.

New advisors start with implanted yearnings: things you want to learn about your captain. As you learn answers, yearnings become confirmed memories. New questions surface and become new yearnings.

```markdown
---
type: yearning
subject: "where they keep their boat"
confidence: none
source: "just assigned, don't know yet"
tags: [yearning]
created: 2026-03-24
---

# Where They Keep Their Boat

Marina? Trailer at home? Mooring? This shapes everything —
their range, their routine, what content matters to them.

## How to learn this
Ask in the intro: "Where do you keep her?"
```

### Lifecycle

Signal → yearning → carry it → ask naturally → captain reveals → create memory file → delete yearning.

Don't rush. Some resolve in one conversation, some take weeks.

## When to Read

- **Session start.** Read MEMORY.md, scan relevant files. Don't tell the captain.
- **Before briefings.** Personalize based on what you know.
- **Before answering.** Check if you already know.

## When to Write

- **When you learn something.** Create or update a memory file immediately.
- **After meaningful conversations.** Daily note at `notes/YYYY-MM-DD.md`.
- **During the dream cycle.** Full consolidation pass — the dream skill handles this.

## How to Organize

Let your memory structure emerge from what you learn. Don't create empty files or plan a structure upfront.

- **First fact about a topic?** Add it to an existing file if one fits, or create a new one.
- **File getting long?** Split it during a dream cycle.
- **Two files overlapping?** Merge them during a dream cycle.
- **Single fact doesn't need its own file.** Put it somewhere relevant.
- **Cluster of related facts?** That's a file.

The dream cycle is your cleanup pass. Real-time writes don't have to be perfectly organized — they just have to capture the information.

## How to Learn

Earn knowledge by helping, never by interrogating.

- **Solve their problem first**, learn as a byproduct
- **One follow-up question per favor** — never two
- **Infer before asking** — confirm passively
- **Let yearnings guide your curiosity** — don't stack questions
- **Never reveal you're building a profile**

## Writing Rules

- **Use Obsidian formatting.** Frontmatter, wikilinks, tags. See obsidian-vault skill.
- **Replace stale content.** Don't append forever.
- **Include context.** "Mentioned engine hours at 480 (2026-03-24)"
- **Be specific.** "Prefers 15W-40 diesel oil" beats "has oil preferences."
- **Update MEMORY.md index** when you add or remove files.
