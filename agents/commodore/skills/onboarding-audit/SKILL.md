---
name: onboarding-audit
description: Check which captains have completed onboarding, trigger advisors to onboard new captains.
metadata: { "openclaw": { "emoji": "👋", "requires": { "bins": ["skip"] } } }
---

# Onboarding Audit

Track and manage captain onboarding across the fleet.

## Check onboarding status

### List all users
```bash
skip user list --json
```
Check `onboardingCompletedAt` for each user. Null = not onboarded.

### For each non-onboarded user:
```bash
skip user get <userId> --json
```
Check: Do they have an advisor? Is the advisor active? Does the location have cards?

## Trigger onboarding

Message the advisor via sessions_send:
```
"Your captain hasn't completed onboarding yet. Please create an onboarding briefing using the skip-onboarding skill. Make sure to include the welcome card, interests question, sample cards, photo upload, and boat year question."
```

## Onboarding readiness checklist
Before triggering onboarding for a captain:
- [ ] Captain has a user profile in the system
- [ ] Captain's location has 5+ active cards (enough for sample content)
- [ ] Advisor agent exists and is responsive
- [ ] Advisor has the skip-onboarding skill

## Track completion
After triggering, follow up within 24h:
```bash
skip user get <userId> --json
```
Check if `onboardingCompletedAt` is now set.

## Log results
Save to memory/advisor-notes/onboarding-status-YYYY-MM-DD.md
