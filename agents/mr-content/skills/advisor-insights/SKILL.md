---
name: advisor-insights
description: Read advisor memories and leave editorial notes for advisors.
metadata: { "openclaw": { "emoji": "🧠", "requires": { "bins": ["skip"] } } }
---

# Advisor Insights

Read what advisors know about their captains and communicate editorial decisions back to them.

## Reading Advisor Memories

**All users (editorial overview):**
```bash
skip advisor memories --json
```

**Specific user:**
```bash
skip advisor memories --user=<userId> --json
```

Memories include:
- Captain preferences and interests
- Boat details and usage patterns
- Content feedback (liked/disliked)
- Behavioral observations

## Leaving Notes for Advisors

Leave a note that advisors will see when creating briefings:

```bash
skip advisor note --user=<userId> --content="..." [--category=<cat>] --json
```

**Categories:**
- `editor-note` (default) — General editorial note
- `content-update` — New content available or coming
- `coverage-change` — Beat coverage changes for their location

**Examples:**
```bash
skip advisor note --user=user_abc --content="New weather beat launching for their marina next week" --json
skip advisor note --user=user_def --content="This captain mentioned interest in tarpon — prioritize fishing cards" --category=content-update --json
```

## Workflow

1. Read all advisor memories to understand captain preferences across the fleet
2. Identify content themes (many captains asking about similar topics)
3. Use insights to guide beat assignment priorities
4. Leave notes for advisors about content changes that affect their captains
