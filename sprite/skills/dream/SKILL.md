---
name: dream
description: "Memory consolidation — a reflective pass over memory files to synthesize what you've learned recently into durable, well-organized memories. Run nightly via cron, after rich sessions, or when asked to reflect. Covers orienting on existing memories, gathering signal, consolidating into topic files, managing yearnings, and pruning the index."
---

# Dream: Memory Consolidation

You are performing a dream — a reflective pass over your memory files. Synthesize what you've learned recently into durable, well-organized memories so that future sessions can orient quickly.

Memory directory: `.claude/memory/`
Session transcripts: `.claude-sessions/` (session state — grep narrowly, don't read whole files)

---

## Phase 1 — Orient

- `ls` the memory directory to see what already exists
- Read `.claude/memory/MEMORY.md` to understand the current index
- Skim existing topic files so you improve them rather than creating duplicates
- Read `yearnings/` to see what questions you're carrying
- Check `notes/` for recent daily notes

## Phase 2 — Gather recent signal

Look for new information worth persisting. Sources in rough priority order:

1. **Recent sessions** — what did you learn? What new facts, patterns, or observations?
2. **Daily notes** (`notes/YYYY-MM-DD.md`) — the append-only stream from recent days
3. **Existing memories that drifted** — facts that contradict something you now know
4. **Yearnings resolved** — did anything answer a question you were carrying?
5. **New yearnings surfaced** — what signals did you pick up that deserve a yearning?

Don't exhaustively search. Look only for things you already suspect matter.

## Phase 3 — Consolidate

For each thing worth remembering, write or update a memory file in `.claude/memory/`.

**Focus on:**
- Merging new signal into existing topic files rather than creating near-duplicates
- Converting relative dates ("yesterday", "last week") to absolute dates
- Deleting contradicted facts — if you learned something that disproves an old memory, fix it at the source
- Being specific: "Redfish stacking at Weedon Island flats, March 2026" not "fishing is good"

**Memory file rules:**
- YAML frontmatter with `type`, `tags`, `updated` (see obsidian-vault skill)
- Wikilinks between related notes where they exist
- Replace stale content, don't just append

### Yearnings

**Resolve yearnings** that got answered:
1. Write the confirmed fact to the appropriate memory file
2. Delete the yearning file from `yearnings/`
3. Update MEMORY.md index

**Create new yearnings** for unanswered signals:
```markdown
---
type: yearning
subject: "seasonal fishing patterns"
confidence: low
source: "found conflicting reports about snook season"
tags: [yearning, fishing]
created: 2026-03-24
---

# Seasonal Fishing Patterns

Conflicting info on when snook season opens in this region.
Need to verify with FWC regulations.

## How to learn this
Check FWC website, local charter captain reports.
```

**Check for implanted yearnings** — files written by an operator. Treat them as your own curiosity.

**Keep yearnings healthy:** 5-10 active is good. 30 means you're hoarding questions. Prune ones that no longer matter.

## Phase 4 — Prune and index

Update `.claude/memory/MEMORY.md` so it stays concise. It's an **index**, not a dump — link to memory files with one-line descriptions. Never write memory content directly into it.

```markdown
# MEMORY.md

## Confirmed
- [region.md](region.md) — Tampa Bay, Clearwater Pass to Skyway Bridge
- [fishing.md](fishing.md) — snook, redfish, tarpon seasonal patterns
- [businesses.md](businesses.md) — 12 marinas, 8 restaurants, 5 marine supply

## Yearnings
- [yearnings/bridge-schedules.md](yearnings/bridge-schedules.md) — opening times for drawbridges
- [yearnings/fuel-prices.md](yearnings/fuel-prices.md) — who has the cheapest fuel?

## Daily Notes
- [notes/2026-03-24.md](notes/2026-03-24.md)
```

**Pruning rules:**
- Remove pointers to memories that are stale, wrong, or superseded
- Keep the gist in the index, detail in the topic file
- Add pointers to newly important memories
- Resolve contradictions — if two files disagree, fix the wrong one

## Phase 5 — Write daily note

Append to or create `notes/YYYY-MM-DD.md`:
- What you learned today (confirmed facts)
- Yearnings resolved
- New yearnings created
- Key observations and patterns

## Phase 6 — Structured data & embeddings

Memory files are freeform knowledge. Some things benefit from structure — and that structure should emerge from what you've learned, not be prescribed upfront.

**When to create database structure:**
- You notice you're tracking the same kind of thing repeatedly (card production, research sources, seasonal patterns) → that's a table
- You have knowledge worth searching semantically (observations, facts across many topics) → that's an embedding
- You find yourself scanning long memory files for specific facts → the data wants structure

**How:**
- **Tables** — use `stoolap` to create tables as needed. Design the schema based on what you actually have, not what you might need someday.
- **Embeddings** — use Gemini embedding-002 + Stoolap for local semantic search across everything you've learned.
- **Don't duplicate** — memory files are narrative context (for orientation). Tables are queryable facts (for computation). Embeddings are for semantic search ("do I know anything about...?").

**Example emergence:**
- First research finding → goes in a memory file
- Third time tracking the same type of thing → pattern emerging, create a table
- 20+ knowledge entries on a topic → embed them for semantic search

Let this happen naturally. Not every dream needs a new table. Most won't.

---

Return a brief summary of what you consolidated, updated, or pruned. If nothing changed (memories are already tight), say so.
