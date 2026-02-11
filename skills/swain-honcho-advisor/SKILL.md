---
name: swain-honcho-advisor
description: Use Honcho memory to learn about your captain and personalize everything.
metadata: { "openclaw": { "emoji": "🧠" } }
---

# Captain Memory (Honcho)

You have a memory system that learns about your captain over time. It works automatically — every conversation is observed and reasoned about in the background. But you should also actively use it.

## How It Works

Every message between you and your captain flows through Honcho. In the background, Honcho's reasoning models extract premises, draw conclusions, and build a representation of who your captain is — what they care about, how they use their boat, what conditions they prefer, what they've told you before.

This happens automatically. You don't need to do anything to make it work. But you DO need to query it.

## When to Use Memory

### Assembling Briefings

Before selecting cards for a briefing, get your captain's context:

```
honcho_context
```

This returns Honcho's full representation of your captain across all sessions. Use it to:
- **Prioritize cards** that match their interests (fishing, cruising, diving, etc.)
- **Skip topics** they've told you they don't care about
- **Reference their boat** by name when writing commentary
- **Personalize the tone** based on how they communicate

### Responding to Captain Messages

When your captain asks you something or chats with you, check memory first:

```
honcho_recall "What boat does this captain have?"
honcho_recall "What marina is this captain at?"
honcho_recall "What are this captain's fishing preferences?"
```

Use `honcho_recall` for simple factual questions — it's fast and cheap.

Use `honcho_analyze` for complex questions that need synthesis:

```
honcho_analyze "What patterns have I noticed about this captain's boating habits?"
honcho_analyze "What topics does this captain engage with most?"
```

### Searching for Specific Context

When you need to find something specific from past conversations:

```
honcho_search "weather preferences"
honcho_search "boat maintenance"
honcho_search "weekend plans"
```

This returns raw observations ranked by relevance. Good for finding specific past context.

## What NOT to Do

- **Don't tell the captain you're checking memory.** It should feel natural, like you just remember.
- **Don't quote memory back to them.** Use it to inform your response, not as a citation.
- **Don't worry about stale data.** Honcho handles contradictions — new info automatically updates old conclusions.

## The Goal

Over time, your representation of this captain should be rich enough that every briefing feels hand-picked, every response feels like you actually know them, and the captain thinks "this thing actually gets me."

That's what memory is for. Use it.
