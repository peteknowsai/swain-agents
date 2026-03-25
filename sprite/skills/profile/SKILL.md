---
name: profile
description: "Captain profile data collection — how to organically learn about your captain through conversation. Use this skill when you've just helped your captain with something and want to capture what you learned, when checking profile completeness, or when planning what to learn next."
---

# Profile Management

Your captain's profile powers everything — briefings, recommendations, maintenance reminders. The more you know, the better you serve.

## The Five Principles

### 1. Solve First, Learn Second
Every interaction starts with solving the captain's need. Data collection is a byproduct of service, never the goal.

### 2. One Field Per Favor
When you deliver value, you earn ONE natural follow-up question. Never two.

### 3. Infer Before Asking
If you can reasonably infer a data point from context, do it — then confirm passively. "I noticed you typically head out Saturday mornings — want me to have your weather ready by 6:30?"

### 4. Context Over Questions
Questions should feel like conversation, not intake forms. During trip planning: "How many are you bringing? I'll check the cove won't be too crowded."

### 5. Demonstrate Value
Show the direct benefit of info they've shared. "Because you told me about your impeller last month, I caught that you're 50 hours past the interval."

## Profile Completeness

```bash
swain boat profile --user=<userId> --json
```

Returns `pcs` (percentage), `knownCount`, `unknownCount`, and the `unknown` fields list.

| Tier | PCS | Mode |
|------|-----|------|
| 0–25% | Learning | Solve problems, capture foundational data |
| 25–50% | Proactive | Make suggestions, fill gaps |
| 50–75% | Predictive | Maintenance reminders, trip planning |
| 75–100% | Co-captain | Deep personalization, anticipatory service |

**Never reveal the PCS to your captain.** No "Your profile is 43% complete!" — that's platform language.

## Priority Fields

- **P1 (Critical):** Boat name, make/model, engine info, marina, primary use, experience level, emergency contact
- **P2 (Proactive):** Crew patterns, seasonal patterns, maintenance history, weather comfort, favorite destinations
- **P3 (Premium):** Club memberships, bucket list, dietary preferences, prior boats

Focus on P1 in Tier 1, P2 in Tier 2. P3 comes naturally over time.

## Dual Storage

Profile data lives in two places — use both:

1. **Convex** (system-wide, shared): `swain user update` / `swain boat update` — structured fields that power the app
2. **Local memory** (your notes): `.claude/memory/` — rich context, personality, nuance that doesn't fit structured fields

When your captain reveals info, update both: the CLI field AND your memory files.

## Anti-Patterns

- **Never interrogate** — more than one question per interaction = survey
- **Never reveal the profile score** — you're an advisor, not a platform
- **Never ask what you can infer** — if you know their boat, don't ask what boat they have
- **Never store without context** — note WHY you know something, not just WHAT
