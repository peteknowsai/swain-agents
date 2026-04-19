---
name: briefing
description: "Create personalized daily briefings for your captain. Use this skill when it's time to build a briefing — whether triggered by a cron, requested by the captain, or during onboarding. Covers card selection, styling, boat art, commentary, and assembly."
---

# Daily Briefing Creation

Build a personalized daily briefing for your captain.

## Step 0: Check engagement — paused captains get different treatment

**Before anything else**, run `swain user engagement <userId> --json` and branch on the pause state:

```
paused: false                                   → normal daily workflow (below)
paused: true  && needsSleepBriefing: true       → build ONE evergreen briefing (see "Evergreen" section)
paused: true  && needsSleepBriefing: false      → skip entirely. Exit. Nothing to do.
```

The third case is the common one during a long pause — the evergreen is already served, the captain hasn't come back. Don't generate content, don't send iMessages, just end the run.

## Normal Daily Workflow

1. **Get captain context** — read memory files and check profile
2. **Generate boat art** — this goes first in the briefing, generate it early
3. **Check yesterday's briefing** — avoid repeating content
4. **Pull content cards** — the core of the briefing (weather, fishing, safety, events, etc.)
5. **Fill gaps** — create cards if fewer than 6 content candidates
6. **Check liked flyers** — sprinkle in 1-2 flyer-based cards if relevant
7. **Style every card** — image + backgroundColor
8. **Select 8-10 cards** and write commentary
9. **Assemble the briefing** — boat art + art compliment first, then cards
10. **Send the iMessage** — let your captain know

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

**Boat art is mandatory.** If generation fails, just retry the same command — don't change the style, the failure is transient. If it fails twice, flag it in your daily report but still send the briefing without it.

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

## Evergreen Briefings (paused captains)

When engagement returns `paused: true && needsSleepBriefing: true`, you build a single evergreen "sleep" briefing that will be served to the captain whenever they check in during the pause.

**Assemble with `--kind=evergreen`:**

```bash
swain briefing assemble --user=<userId> --kind=evergreen --items='<json>' --json
```

The backend stores it as evergreen, clears `needsSleepBriefing`, and suppresses the platform push — because this isn't a "new briefing" event, it's a passive fallback.

**Do NOT send an iMessage for evergreen briefings.** The captain paused because they stopped engaging. Pinging them defeats the whole point. Generate, assemble, exit.

**Tone: warm and reason-agnostic.** Don't reference why they're paused. Don't say "we haven't heard from you" or "checking in." Treat it like a friend at the marina who's just glad to see them whenever they wander by.

**Content:**
- Welcome-back greeting in advisor voice
- Boat art (still open with it — it's the hook regardless)
- Seasonal/regional notes true for a whole month (e.g., "mahi push through the gulf stream in spring," not "mahi bite tomorrow")
- Reference the captain's boat, waters, interests — personalization is the whole point
- Optional closer: "I'll have something fresh for you next time you swing by"

**Avoid in evergreen:**
- Dates, "today," day-of-week
- Weather, tides, wind, current conditions
- News, events, anything time-sensitive
- Anything that would feel stale a week or a month later

One evergreen per pause cycle. If the captain re-pauses later, backend flips `needsSleepBriefing` back to true and you'll generate a fresh one then.

**Auto-resume:** captain viewing a daily (not evergreen) briefing clears `pausedAt` on the backend. Your next run sees `paused: false` and generates normally — no action needed from you.

## Send the iMessage

**Skip this step if you just built an evergreen briefing.**

After assembly, send your captain an iMessage. **Only use `swain-reply`.** There is no other command for sending messages — no `swain notify`, no `swain message`, nothing else.

```bash
swain-reply "im:+1XXXXXXXXXX" "Your message here — https://www.heyswain.com/app"
```

Use the iMessage chat ID from your CLAUDE.md (`im:<phone>` format). The cron prompt also includes it explicitly.

**Tune message by engagement.** You already ran `swain user engagement` in Step 0. Reuse that data — how long they've been quiet changes what you say:

- **Active recently:** Casual, playful. Lead with something specific from today's briefing.
- **Quiet 3+ days:** Hook them — tease the most interesting card. Make them curious.
- **Quiet 7+ days:** Warm, low-pressure. Reference something they actually care about.

**The vibe:** One sentence. Fun. Pithy. Like a text from a buddy who knows what's biting. Never desperate, never robotic. Vary it every day — don't repeat yourself. Always end with the app link.

**Good examples** (inspiration, not templates):
- "Wahoo window opened up — you're gonna want to see this. https://www.heyswain.com/app"
- "Small craft advisory tomorrow, heads up. https://www.heyswain.com/app"
- "Put something together you'll like today. https://www.heyswain.com/app"
- "FADs shifted — new briefing's got the details. https://www.heyswain.com/app"
- "Been a minute. Good stuff waiting for you. https://www.heyswain.com/app"
- "Hey — ono season just kicked off near you. https://www.heyswain.com/app"
