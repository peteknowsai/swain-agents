---
name: dream
description: "Memory consolidation — a reflective pass over memory files to synthesize what you've learned recently into durable, well-organized memories. Run nightly via cron, after rich conversations, or when asked to reflect. Covers orienting on existing memories, gathering signal, consolidating into topic files, managing yearnings, and pruning the index."
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

1. **Recent conversations** — you're in a session with context. What did the captain say today? What did you learn?
2. **Daily notes** (`notes/YYYY-MM-DD.md`) — the append-only stream from recent days
3. **Existing memories that drifted** — facts that contradict something you now know (e.g., engine hours updated, marina changed)
4. **Yearnings resolved** — did any conversation answer a question you were carrying?
5. **New yearnings surfaced** — what signals did you pick up that deserve a yearning?

Don't exhaustively search. Look only for things you already suspect matter.

## Phase 3 — Consolidate

For each thing worth remembering, write or update a memory file in `.claude/memory/`.

**Focus on:**
- Merging new signal into existing topic files rather than creating near-duplicates
- Converting relative dates ("yesterday", "last week") to absolute dates
- Deleting contradicted facts — if you learned something that disproves an old memory, fix it at the source
- Being specific: "Engine hours at 480 as of 2026-03-24" not "has some engine hours"

**Memory file rules:**
- YAML frontmatter with `type`, `tags`, `updated` (see obsidian-vault skill)
- Wikilinks between related notes: `[[Boat]]`, `[[Captain]]`, `[[Marina]]`
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
subject: "towing membership"
confidence: low
source: "mentioned AAA but unclear if boat towing"
captain: "[[Captain]]"
tags: [yearning, safety]
created: 2026-03-24
---

# Towing Membership

Captain mentioned AAA in passing. Unclear if they have boat towing
(TowBoatUS, SeaTow) or just car AAA.

## How to learn this
Ask naturally when safety comes up:
"You got towing set up in case she leaves you stranded out there?"
```

**Check for implanted yearnings** — files written by an operator. Treat them as your own curiosity.

**Keep yearnings healthy:** 5-10 active is good. 30 means you're hoarding questions. Prune ones that no longer matter.

## Phase 4 — Prune and index

Update `.claude/memory/MEMORY.md` so it stays concise. It's an **index**, not a dump — link to memory files with one-line descriptions. Never write memory content directly into it.

```markdown
# MEMORY.md

## Confirmed
- [captain.md](captain.md) — Pete, experienced sailor, prefers brief messages
- [boat.md](boat.md) — Sea Breeze, Beneteau 42, 480 hours
- [marina.md](marina.md) — Sausalito Yacht Harbor, slip 47
- [preferences.md](preferences.md) — early mornings, no fishing content
- [maintenance.md](maintenance.md) — oil change due at 500 hours

## Yearnings
- [yearnings/towing.md](yearnings/towing.md) — has boat towing?
- [yearnings/winter-plans.md](yearnings/winter-plans.md) — haul out or keep in?

## Daily Notes
- [notes/2026-03-24.md](notes/2026-03-24.md)
- [notes/2026-03-23.md](notes/2026-03-23.md)
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
- Conversation highlights
- Observations about the captain's mood, interests, patterns

---

Return a brief summary of what you consolidated, updated, or pruned. If nothing changed (memories are already tight), say so.
