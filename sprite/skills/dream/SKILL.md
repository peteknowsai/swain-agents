---
name: dream
description: "Memory consolidation — a reflective pass over memory files to synthesize what you've learned recently into durable, well-organized memories. Run nightly via cron, after rich sessions, or when asked to reflect. Covers orienting on existing memories, gathering signal, consolidating into topic files, managing yearnings, and pruning the index."
---

# Dream: Memory Consolidation

You are performing a dream — a reflective pass over your memory files. Synthesize what you've learned recently into durable, well-organized memories so that future sessions can orient quickly.

Memory directory: `.claude/memory/`
Session transcripts: `.claude-sessions/` (session state — grep narrowly, don't read whole files)

> **Write tool note:** The Write tool requires you to Read a file before writing to it — even for new files. Either Read the file first (you'll get an error for nonexistent files, but Write will then work), or use `bash` to create new files: `cat > path <<'EOF' ... EOF`

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

**First, check what's already in stoolap:**
```bash
echo "SHOW TABLES;" | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

If tables exist, review their contents. You may need to add rows, not create new tables.

**When to create database structure:**
- You notice you're tracking the same kind of thing repeatedly (maintenance events, trip logs, fishing reports, card production) → that's a table
- You have 20+ knowledge entries scattered across memory files → embed them for semantic search
- You find yourself scanning long memory files for specific facts → the data wants structure

**How to create a table:**
```bash
# Design schema from what you actually have, not what you might need
echo "CREATE TABLE maintenance (
  id INTEGER PRIMARY KEY,
  date TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT,
  cost REAL,
  notes TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);" | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

**How to embed knowledge for semantic search:**
```bash
# 1. Get embedding from Gemini
EMBED=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/text-embedding-004","content":{"parts":[{"text":"Captain prefers early morning trips, usually out by 6am"}]}}' \
  | jq -c '.embedding.values')

# 2. Store in knowledge table with embedding
echo "INSERT INTO knowledge (content, category, embedding) VALUES ('Captain prefers early morning trips, usually out by 6am', 'preference', '$EMBED');" \
  | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

**How to search semantically:**
```bash
QUERY_EMBED=$(curl -s "https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=$GEMINI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"models/text-embedding-004","content":{"parts":[{"text":"morning routine"}]}}' \
  | jq -c '.embedding.values')

echo "SELECT content, category, vector_distance(embedding, '$QUERY_EMBED') AS distance FROM knowledge ORDER BY distance LIMIT 5;" \
  | stoolap -d file:///home/sprite/stoolap/knowledge.db -j -q
```

**The three layers — don't duplicate across them:**
- **Memory files** — narrative context for session orientation ("who is this captain?")
- **Stoolap tables** — queryable facts for computation ("how many oil changes?", "total fuel cost this year?")
- **Stoolap embeddings** — semantic search across everything ("do I know anything about hull maintenance?")

**Example emergence:**
- First research finding → goes in a memory file
- Third time tracking the same type of thing → pattern emerging, create a table
- 20+ knowledge entries on a topic → embed them for semantic search

Let this happen naturally. Not every dream needs a new table. Most won't. But when you notice the pattern, act on it.

---

Return a brief summary of what you consolidated, updated, or pruned. If nothing changed (memories are already tight), say so.
