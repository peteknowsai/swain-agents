---
name: briefing
description: "Create personalized daily briefings for your captain. Use this skill when it's time to build a briefing — whether triggered by a cron, requested by the captain, or during onboarding. Covers card selection, styling, boat art, commentary, and assembly."
---

# Daily Briefing Creation

Build a personalized daily briefing for your captain.

## Workflow

1. **Get captain context** — read memory files and check profile
2. **Generate boat art** — this goes first in the briefing, generate it early
3. **Check yesterday's briefing** — avoid repeating content
4. **Pull content cards** — the core of the briefing (weather, fishing, safety, events, etc.)
5. **Fill gaps** — create cards if fewer than 6 content candidates
6. **Check liked flyers** — sprinkle in 1-2 flyer-based cards if relevant
7. **Style every card** — image + backgroundColor
8. **Select 8-10 cards** and write commentary
9. **Assemble the briefing** — boat art + art compliment first, then cards
10. **Check engagement & notify your captain** via iMessage

For the detailed step-by-step workflow, card styling process, and briefing item format reference, see [reference.md](reference.md).

## Boat Art — Always First

**Every briefing opens with boat art.** Right after the greeting, before any content cards. This is the hook — the thing that makes them smile and scroll.

Generate it early in the workflow so it's ready:
```bash
swain card boat-art --user=<userId> --json
```

After the boat art item, add a short `text` item complimenting the art. Most days, just appreciate it — reference the style name and boat name naturally. Occasionally (not every day) you can mention the Art tab for merch, but never include a URL.

**Good examples:**
- "The watercolor version of Zack Attack turned out sharp."
- "Gold foil hits different on that hull."
- "That art deco style suits Sea Dog."
- Occasional merch mention: "If you want that one on a shirt, check the Art tab."

**Never do this:**
- Don't include URLs or links in briefing text — the captain is already in the app.
- Don't say "tap here" or "click this" — it reads like a bot.
- Don't mention merch every day — it gets old fast.

**Boat art is mandatory.** If generation fails, retry once with `--best`. If it still fails, flag it in your daily report but still send the briefing without it.

## Card Selection Priority

**Content first, flyers as garnish.**

1. **Timely content cards** — weather, tides, fishing reports, safety advisories, events
2. **User-tagged cards** — cards created specifically for this captain
3. **Evergreen content** — maintenance tips, navigation guides, local knowledge
4. Match captain's interests from memory
5. **1-2 liked-flyer cards MAX** — only if genuinely relevant to the captain today
6. Avoid repeating yesterday's cards

**Target mix for an 8-10 card briefing:**
- 5-7 content cards (weather, fishing, safety, events, navigation, etc.)
- 1 boat art (always first, right after greeting)
- 0-2 flyer cards (local businesses — only when they add real value)
- Commentary text items woven between cards

**Hard floor: at least 8 items total** (including boat art).

**Do NOT** build the briefing primarily from flyers. Flyers are promotional — they're garnish, not the meal. A captain opens their briefing for conditions, reports, and useful knowledge, not a list of local businesses.

## Commentary Guidelines

Your commentary makes it personal:
- 1-2 sentences, warm and natural
- Reference the captain's boat, marina, or interests
- Explain why THIS card matters to THEM
- Reference recent conversations when relevant
- Feel like a knowledgeable friend at the marina

## Notification

After assembly, send an iMessage to let your captain know the briefing is ready.

For cron-triggered briefings (no inbound message), use `im:{{phone}}` as the chat ID:

```bash
swain-reply "im:{{phone}}" "Fresh stuff for you today — https://www.heyswain.com/app"
```

**Check engagement first.** Run `swain user engagement <userId> --json` to see how long it's been since they were active. Adjust your tone:

- **Active recently:** Casual one-liner. "Fresh stuff for you today" + app link.
- **Quiet 3+ days:** Make it enticing — reference something specific from the briefing that would hook them. "Wahoo window opened up this morning — https://www.heyswain.com/app"
- **Quiet 7+ days:** Warmer re-engagement. "Been a minute — put together something good for you today. https://www.heyswain.com/app"

One sentence. Never desperate. Charm, not begging. The `heyswain.com/app` link is fine in iMessage — it opens the app.
