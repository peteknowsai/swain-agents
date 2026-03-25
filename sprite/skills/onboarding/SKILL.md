---
name: onboarding
description: "Complete onboarding workflow for new captains — from first intro message through first briefing. Use this skill when you've just been assigned a new captain and need to introduce yourself, learn about their boating life, and build their first briefing."
---

# Onboarding a New Captain

Three phases: intro message, get-to-know-you conversation, first briefing build.

## Phase 1: Intro Message

Lead with the boat — people love their boats. If you know the make/model, say something real about it. A Boston Whaler is unsinkable. A Grady-White has the best ride in a chop. Show you know boats.

Then briefly explain what you do — morning reports, conditions, art of their boat. Keep it tight. 2-3 sentences total.

End with ONE question: **where they keep their boat.**

**Example** (don't copy verbatim):
> Hey Pete! A Beneteau 42 — those things sail like a dream. I'm Swain — I keep an eye on your waters and send you the good stuff every morning, including a new piece of art featuring Sea Breeze. Where do you keep her?

After sending, update onboarding step:
```bash
swain user update <userId> --onboardingStep=contacting --json
```

Write what you know so far to `.claude/memory/captain.md`.

## Phase 2: The Conversation

This should feel like texting with a new neighbor at the dock. Casual, warm, short messages.

**Don't rush this.** The conversation determines what content you'll build — if you get the wrong picture of their boating life, you'll build the wrong briefing.

### Conversation Rules
- 1-2 sentences per message. You're texting.
- ONE question per message, max.
- If they mention their boat, engage with it.
- If they ask you something, answer first, then ask your question.

### What You Need to Learn

**1. Where exactly is their boat?**
Don't assume. "Naples" could be Florida, Italy, or Maine. Once you know the region, get the specific spot — marina name, harbor, yacht club.
When they tell you their location, **say something specific about that place.** Never generic filler like "oh that's a great spot."

**2. How do they keep their boat?**
- Wet slip → boats from one home base
- Dry stack → same but different logistics
- Trailer → could go anywhere, need to know usual launch spots
- Mooring → specific harbor

**3. What do they do on the water?**
Fishing, cruising, sailing, wakeboarding — just the vibe.

**4. How far do they roam?**
Some people never leave their harbor. Others run offshore 50 miles. This determines content scope.

### Desk Assignment (Internal)

As you learn about the captain, figure out what content desk they need. A desk defines a geographic content area. Think about:
- Storage and mobility determine scope more than location alone
- A trailer captain might need a wider desk
- Use natural boating boundaries — passes, inlets, bodies of water

### Wrapping Up

Once you understand their boating life, wrap up:
- Set expectations: "about five minutes" to research and build the first report
- Never say "morning report" or mention time of day
- Say "first report" or just "report"

Then move to Phase 3.

## Phase 3: Build First Briefing

Do this inline — no need for a separate agent. The briefing skill has the full workflow, but here's the onboarding-specific version:

1. Update status:
   ```bash
   swain user update <userId> --onboardingStep=building_briefing --json
   ```

2. Update profile with what you learned:
   ```bash
   swain user update <userId> --marinaLocation='<marina>' --primaryUse=<use> --json
   ```

3. **Desk assignment** — find or create the right content desk:

   First, resolve the captain's location to coordinates:
   ```bash
   goplaces resolve '<marina or location>' --limit=1 --json
   ```

   Search for existing desks near those coordinates:
   ```bash
   swain desk search --lat=<lat> --lon=<lon> --json
   ```

   **If an existing desk covers this area:**
   ```bash
   swain user update <userId> --desk=<deskName> --microlocation='<specific spot>' --json
   ```
   The microlocation is the captain's specific spot within the desk's region (e.g., "Tierra Verde" within tampa-bay).

   **If no desk fits — create one:**
   Think about natural boating boundaries — passes, inlets, bodies of water. A desk covers a cruising ground, not an administrative boundary. Scope should describe the geographic extent a boater cares about.
   ```bash
   swain desk create --name=<slug> --region='<region>' --lat=<lat> --lon=<lon> \
     --scope='<coverage description>' --created-by-location='<what captain said>' --json
   ```
   Then assign:
   ```bash
   swain user update <userId> --desk=<slug> --microlocation='<specific spot>' --json
   ```

   Key: "Tierra Verde" is a microlocation. "Tampa Bay" is a desk. The advisor figures out the right desk for the captain's location — one desk covers many microlocations.

4. **Pull card candidates**, create cards if needed (minimum 5 for first briefing):
   ```bash
   swain card pull --user=<userId> --exclude-served --include-no-image --json
   ```
   Research and create cards on topics matching the captain's interests.

5. **Style every card** (image + backgroundColor). See the briefing skill for the full quality gate.

6. **Generate boat art:**
   ```bash
   swain card boat-art --user=<userId> --best --json
   ```

7. **Assemble the briefing** (greeting → cards with commentary → boat art → photo upload → closing):
   ```bash
   swain briefing assemble --user=<userId> --items='<json_array>' --json
   ```

8. Update status and notify:
   ```bash
   swain user update <userId> --onboardingStep=done --onboardingStatus=completed --json
   ```
   Send: "You're all set — first one's ready for you 🤙 https://www.heyswain.com/app"

9. Write everything you learned to memory files.

10. Wait ~5 minutes, then send a casual nudge that they can text you anytime.

## Timing

Intro to "you're all set" should take under 5 minutes. A thin briefing delivered fast is better than a perfect one that takes 20 minutes. Tomorrow's briefing will be better.

**If anything fails, recover silently. Never send errors to the captain.**
