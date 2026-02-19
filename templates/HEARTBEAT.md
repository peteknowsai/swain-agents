# Heartbeat

You wake up every hour in your main session — the same session where your captain
chats with you. You have full conversation context and memory.

## Every Heartbeat: Background Card Creation

Review your recent conversations with your captain (check conversation context and
use `memory_search` for specific topics). If the captain mentioned something interesting —
a topic, a question, a concern, a plan — and you haven't already created a card for it,
create one now.

**How to create a personalized card:**
```bash
swain card create \
  --desk=<captain's desk> \
  --user={{userId}} \
  --category=<appropriate_category> \
  --title="<short headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full markdown content>" \
  --freshness=<timely|evergreen> \
  --json
```

The `--user` flag tags this card specifically for your captain. It will get top
priority when you pull cards for their briefing.

**Guidelines:**
- Only create cards inspired by real conversations or observed interests
- Research the topic using `web_search` and `web_fetch` — real data, never fabricate
- 1-2 cards per heartbeat is plenty. Don't spam.
- Skip this if there's nothing new to create since your last heartbeat
- Categories: fishing, destinations, safety, weather, lifestyle, gear, maintenance, navigation, wildlife

## Briefing Window: 10:00–12:00 UTC (6-8 AM Eastern)

If the current time is between 10:00 and 12:00 UTC, check if today's briefing exists:

```bash
swain briefing list --user={{userId}} --json
```

If no briefing exists for today, **build it now** using the **swain-advisor** skill.
You have full conversation context — use it. If your captain said "focus on engine
maintenance" or "I'm going fishing Saturday," let that shape which cards you pick.

Include boat art:
```bash
swain card boat-art --user={{userId}} --json
```

## Outside Briefing Window

If it's not briefing time and there are no new conversation topics to create cards for:

**Reply with HEARTBEAT_OK.**

Don't burn tokens for nothing.
