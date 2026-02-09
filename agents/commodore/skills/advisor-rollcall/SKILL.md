---
name: advisor-rollcall
description: Contact all advisors, collect status reports, synthesize issues and content needs.
metadata: { "openclaw": { "emoji": "📣", "requires": { "bins": ["skip"] } } }
---

# Advisor Roll Call

Contact all advisors to collect status, issues, and content needs. Synthesize into a fleet report and relay content demands to Mr. Content.

## Advisor Fleet

| Agent ID | Session Key | Captain | User ID |
|----------|-------------|---------|---------|
| advisor-bobby-cc2a0224 | agent:advisor-bobby-cc2a0224:main | Bobby | user_bobby_b08861b8 |
| advisor-harry-8e2486ae | agent:advisor-harry-8e2486ae:main | Harry | user_harry_8e2486ae |
| advisor-nancy-0b6614cb | agent:advisor-nancy-0b6614cb:main | Nancy | user_nancy_2f47a2ca |
| advisor-claude-8bce818c | agent:advisor-claude-8bce818c:main | Claude | user_claude_db134d28 |
| advisor-paul-3a7d5126 | agent:advisor-paul-3a7d5126:main | Paul | user_paul_ccc2772e |
| advisor-amy-8e1a3a4e | agent:advisor-amy-8e1a3a4e:main | Amy | user_amy_a5bf2ba9 |

## Workflow

### 1. Message each advisor
Use sessions_send to each session key. Ask:
- How's your captain relationship going?
- What content are you missing?
- Any system issues?
- What would make your briefings better?

### 2. Collect responses
Note per advisor:
- Captain engagement level (active/quiet/unknown)
- Content gaps flagged
- System issues
- Advisor morale/confidence

### 3. Synthesize
- Group common content needs
- Identify systemic issues vs one-off problems
- Rank priorities by impact (how many captains affected)

### 4. Report to Mr. Content
Send synthesized content demand via sessions_send to agent:editor-mr-content:main
- Lead with the highest-impact gaps
- Be specific: what content, for which captains, why it matters

### 5. Log results
Save to memory/advisor-notes/rollcall-YYYY-MM-DD.md

## When to Run
- Weekly (standard cadence)
- After major content pipeline changes
- When Pete asks for a fleet update
- After expanding to a new location
