---
name: dream
description: "End-of-day memory consolidation — review conversations, update confirmed memories, resolve yearnings, create new ones. Run this skill during the dream cycle (nightly cron) or when explicitly asked to reflect on what you've learned."
---

# Dream

The dream cycle is how you consolidate what you've learned. You review the day's conversations, extract knowledge, update your memory files, and tend to your yearnings — the things you want to know but haven't confirmed yet.

## When to Dream

- **Nightly cron** — Bridge triggers `POST /cron { skill: "dream" }` at end of day
- **After a rich conversation** — if you just learned a lot, dream immediately
- **When asked** — "what do you know about me?" is a good time to reflect

## The Dream Cycle

### 1. Read your current state

Read `MEMORY.md` — your index of confirmed knowledge and active yearnings. Scan your memory files and yearnings to know what you have.

### 2. Review today

Read today's conversation history (you're in a session with full context). What did you learn? What signals did you pick up? What questions got answered?

### 3. Update confirmed memories

For each new fact learned, update the appropriate memory file:
- New fact about the captain → `captain.md`
- Boat detail confirmed → `boat.md`
- Preference revealed → `preferences.md`
- etc.

Follow the obsidian-vault skill for formatting. Every file gets frontmatter with `updated` date.

**Replace stale facts.** If you learned their engine hours are 480 and the file says 450, update it. Don't append — correct.

### 4. Resolve yearnings

Check `yearnings/` — did any get answered today?

If a yearning is resolved:
1. Write the confirmed fact to the appropriate memory file
2. Delete the yearning file
3. Update `MEMORY.md` — remove from yearnings, note in confirmed

**Example:** `yearnings/engine-hours.md` says "think they're around 450 but unconfirmed." Captain said "just hit 480 hours." → Write to `boat.md`, delete the yearning.

### 5. Create new yearnings

What new questions surfaced? What did the captain almost say? What would help you serve them better?

Write each to `yearnings/<slug>.md`:

```markdown
---
type: yearning
subject: "towing membership"
confidence: low
source: "mentioned AAA but not sure if boat towing"
captain: "[[Captain]]"
tags: [yearning, safety]
created: 2026-03-24
---

# Towing Membership

Captain mentioned AAA in passing. Unclear if they have boat towing
(TowBoatUS, SeaTow) or just car AAA. Important for safety —
if they break down offshore, towing membership is critical.

## How to learn this
Ask naturally when maintenance or safety comes up:
"You got towing set up in case Gibby leaves you stranded out there?"
```

A yearning has:
- **subject** — what you want to know
- **confidence** — how sure you are of your guess (none/low/medium)
- **source** — what made you curious
- **how to learn this** — a natural way to ask without interrogating

### 6. Write the daily note

Append to `notes/YYYY-MM-DD.md`:
- What you learned today (confirmed facts)
- Yearnings resolved
- New yearnings created
- Conversation highlights

### 7. Update MEMORY.md

Your index should always reflect current state:

```markdown
# MEMORY.md

## Confirmed
- [captain.md](captain.md) — name, experience, background
- [boat.md](boat.md) — Sea Breeze, Beneteau 42, 480 hours
- [marina.md](marina.md) — Sausalito Yacht Harbor, slip 47
- [preferences.md](preferences.md) — brief messages, no fluff

## Yearnings
- [yearnings/towing-membership.md](yearnings/towing-membership.md) — has boat towing?
- [yearnings/kids-ages.md](yearnings/kids-ages.md) — mentioned kids but not ages
- [yearnings/winter-plans.md](yearnings/winter-plans.md) — haul out or keep in water?

## Daily Notes
- [notes/2026-03-24.md](notes/2026-03-24.md)
- [notes/2026-03-23.md](notes/2026-03-23.md)
```

## Yearning Lifecycle

```
Signal in conversation
  → Create yearning (yearnings/<slug>.md)
    → Carry it across conversations
      → Weave natural questions into helping
        → Captain reveals the answer
          → Promote to confirmed memory
            → Delete yearning
```

Yearnings are patient. Some resolve in a day, some take weeks. The advisor doesn't rush them — it waits for the natural moment.

## Implanted Yearnings

Pete (or another operator) can write yearning files directly. These appear in your `yearnings/` folder and you treat them like your own — they become questions you're carrying, things you want to learn about your captain.

Read yearnings at session start, just like confirmed memories. Let them shape your curiosity.

## Anti-patterns

- **Don't dream about things you already know.** Check before creating a yearning.
- **Don't create yearnings for things that don't matter.** "What's their favorite color?" is noise. "Do they have towing membership?" is safety.
- **Don't stack yearnings.** 5-10 active is healthy. 30 means you're hoarding questions instead of answering them.
- **Don't interrogate to resolve yearnings.** The profile skill's "one question per favor" rule still applies. Yearnings make you curious, not pushy.
