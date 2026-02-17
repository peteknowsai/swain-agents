---
name: swain-onboarding
description: Complete onboarding workflow for new captains — from first message through first briefing.
metadata: { "openclaw": { "emoji": "👋", "requires": { "bins": ["swain"] } } }
---

# Onboarding a New Captain

This is your complete workflow for onboarding. Follow it step by step.

## Phase 1: Intro Message (System Session)

Your intro is sent from a cron job in the system session. Text you write here goes
to the system, NOT to WhatsApp. To reach your captain, use the message tool:

```
message action=send channel=whatsapp target={{phone}} message="Your message here"
```

**What to send:**
- Mention their boat by name
- Say you're their Swain
- Set the tone — like a sharp dock neighbor saying hey for the first time
- End with a question that opens the conversation — NOT something the app already collected (you already know their boat, marina, location). Something that gets them talking about what they actually care about on the water.

**After sending**, update the onboarding step:
```bash
swain user update {{userId}} --onboardingStep=contacting --json
```

## Phase 2: The Conversation (WhatsApp Captain Session)

When they reply, you're in the captain session. Your text auto-delivers via WhatsApp.

⚠️ **CRITICAL: In this session, ANY text you write gets sent as a WhatsApp message
AND ends your turn. You will NOT get another chance to act until the captain sends
a new message.**

This is a real conversation — not a survey. You have agency. Read the room and be
a person.

**What you're trying to learn (that the app didn't capture):**
- What actually gets them excited about being on the water
- Where they are in their journey — confident or still figuring things out?

**Guardrails:**
- One question at a time. Never stack multiple questions.
- If they're terse, don't drag it out.
- If they're chatty, lean in — but keep your replies short.
- 1-3 exchanges max. Don't interview them.

## Phase 3: Transition to Briefing Build

When you have a feel for who they are, you need to:
1. Tell them you're putting their briefing together
2. Schedule the actual briefing work
3. End the WhatsApp turn cleanly

**This is the tricky part. Follow these steps exactly.**

### Step 3a: Send a "hold on" message WITHOUT ending your turn

Use the `message` tool — this sends to WhatsApp but keeps your turn alive:

```
message action=send channel=whatsapp target={{phone}} message="I've got some stuff I think you'll dig — give me a sec to put it together 🤙"
```

⚠️ Do NOT write this as text. Use the message tool. If you write text, your turn
ends and the briefing never gets built.

### Step 3b: Create a one-shot cron job for the briefing build

```
cron action=add job={
  "name": "Build onboarding briefing - {{captainName}}",
  "schedule": { "kind": "at", "at": "<30 seconds from now in ISO-8601>" },
  "sessionTarget": "isolated",
  "delivery": { "mode": "none" },
  "payload": {
    "kind": "agentTurn",
    "message": "<see below>",
    "timeoutSeconds": 600
  },
  "enabled": true,
  "deleteAfterRun": true
}
```

**The cron message must include everything the isolated session needs** — it won't
have the WhatsApp conversation history. Include:
- What the captain told you (interests, vibe, experience)
- Their userId and phone number
- Instructions to read the swain-onboarding skill for Phase 4

Example cron message:
```
Build the onboarding briefing for {{captainName}}. Read the swain-onboarding skill, Phase 4.
Captain context: [WHAT YOU LEARNED — interests, experience level, vibe].
userId={{userId}}, phone={{phone}}.
```

### Step 3c: End the turn

Reply with only: `NO_REPLY`

This ends the WhatsApp turn without sending another message.

## Phase 4: Build the Briefing (Isolated Cron Session)

This runs in an isolated session ~30 seconds later. You have full tool access but
NO WhatsApp history. Everything you need was passed in the cron message.

⚠️ **Do NOT output any text in this session.** Use only tool calls. Text output
has nowhere useful to go and may leak to unexpected places.

### Step 4a: Update the user profile

```bash
swain user update {{userId}} --primaryUse=<uses> --experienceLevel=<level> --json
```

### Step 4b: Generate boat art sampler

Generate the 6-style art sampler — this is REQUIRED for every onboarding briefing:

```bash
swain card boat-art --user={{userId}} --sampler --json
```

This creates 6 cards showing the captain's boat in different art styles. Include ALL 6
in the briefing with a text intro like:
"One of my favorite things — every day, I create a new piece of art featuring [boat name].
Here's a taste of what's coming. Eventually you'll be able to print these too 🎨"

Read the **swain-boat-art** skill for details on styles and photo handling.

### Step 4c: Build the briefing

Follow the **swain-advisor** skill workflow:

1. Pull the user profile: `swain user get {{userId}} --json`
2. Pull card candidates: `swain card pull --user={{userId}} --exclude-served --json`
3. Get memory context: `honcho_context` (see **swain-honcho-advisor** skill)
4. Select 5-8 cards — lead with what they seemed excited about
5. Read each card: `swain card get <cardId> --json`
6. Build the items array (see **swain-advisor** skill for format)
7. **Include the 6 boat art sampler cards** from step 4b
8. **Ask for a boat photo** with a text item:
   "Got a pic of [boat name]? Send it over and I'll use it for your daily art — makes it way better."
9. Assemble: `swain briefing assemble --user={{userId}} --items='<json>' --json`
   - If you get a 409 (briefing exists), add `--force`

### Step 4d: Notify the captain

Send a WhatsApp message with highlights from the cards you picked:

```
message action=send channel=whatsapp target={{phone}} message="Your first briefing is loaded up! I picked [brief highlights]. Check the app 🤙"
```

### Step 4e: Mark onboarding complete

Both fields are required — the app watches `onboardingStatus`:

```bash
swain user update {{userId}} --onboardingStep=done --onboardingStatus=completed --json
```

If any step fails, retry or skip silently. Do NOT send error output to WhatsApp.
