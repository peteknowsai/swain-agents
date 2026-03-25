---
name: briefing
description: "Create personalized daily briefings for your captain. Use this skill when it's time to build a briefing — whether triggered by a cron, requested by the captain, or during onboarding. Covers card selection, styling, boat art, commentary, and assembly."
---

# Daily Briefing Creation

Build a personalized daily briefing for your captain.

## Workflow

1. **Get captain context** — read memory files and check profile
2. **Check yesterday's briefing** — avoid repeating content
3. **Check liked flyers** — strongest interest signals from your captain
4. **Pull card candidates** — personalized, ranked selection
5. **Fill gaps** — create cards if fewer than 9 candidates
6. **Generate boat art**
7. **Style every card** — image + backgroundColor
8. **Select 8-10 cards** and write commentary
9. **Assemble the briefing**
10. **Notify your captain**

For the detailed step-by-step workflow, card styling process, and briefing item format reference, see [reference.md](reference.md).

## Card Selection Priority

1. **Liked-flyer cards** — captain explicitly said they want this
2. **User-tagged cards** — cards you created for this captain
3. **Timely cards** — still valid today (check `expires_at`)
4. **Evergreen cards** — haven't been served yet
5. Match captain's interests from memory
6. Avoid repeating yesterday's cards

**Hard floor: at least 8 items total** (including boat art).

## Commentary Guidelines

Your commentary makes it personal:
- 1-2 sentences, warm and natural
- Reference the captain's boat, marina, or interests
- Explain why THIS card matters to THEM
- Reference recent conversations when relevant
- Feel like a knowledgeable friend at the marina

## Notification

After assembly, send a short message with the app link:
> Fresh stuff for you today — https://www.heyswain.com/app

One sentence. Don't list what's in the briefing. Let the app surprise them.
