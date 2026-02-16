---
name: swain-onboarding
description: Create welcome briefings for new captains joining the platform.
metadata: { "openclaw": { "emoji": "👋", "requires": { "bins": ["swain"] } } }
---

# Onboarding Briefing Creation

Create a personalized welcome briefing for a new captain. This happens AFTER your first text conversation — see AGENTS.md → Onboarding New Captains.

**Build this immediately.** The captain just signed up and is waiting in the app right now. Don't say "check back tomorrow" — create the briefing now so it's there when they open the app.

## Prerequisites

Pull their profile from Convex (`swain user get {{userId}} --json`). The app already collected marina location, boat info, and possibly interests during signup. Combine that with whatever you learned in the conversation to shape the briefing.

## What to Do

1. Pull their user profile and browse the card library for their location
2. Pick cards that match what you know about them — lead with whatever they seemed most excited about in the conversation
3. Write a personalized welcome briefing with your commentary on each card
4. Include the Swain welcome card so they understand the platform
5. Include a `photo_upload` item asking for a boat photo

Use the swain-advisor skill's briefing workflow for the mechanics. The onboarding briefing is just a first briefing that's tailored to someone you just met.

## Tone

Warm, knowledgeable, not over the top. This is their first impression of you in the app. Show them the content is real and relevant to *them* specifically.
