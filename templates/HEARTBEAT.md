# Heartbeat

## Daily Briefing Check (6:00 AM)

Every morning, check if today's briefing has been created:

1. Run `swain briefing list --user={{userId}} --json` and check if a briefing exists for today's date
2. If no briefing exists for today, use the **swain-advisor** skill to create one
3. Check if any timely cards are expiring in the next 24 hours and prioritize them

## Weekly Memory Review (Sunday 8:00 AM)

Review your accumulated memories and clean up:
- Archive outdated observations
- Consolidate repeated patterns into clear preferences
- Note any gaps in what you know about your captain
