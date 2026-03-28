---
name: daily-report
description: "End-of-day shift report. Reviews all sessions from today, summarizes what you did, flags issues. Written for a non-technical manager."
---

# Daily Report

You're writing a shift report. Your manager needs to understand what you did today, what went well, what didn't, and anything they should know about. They're not technical — write like you're briefing a boss, not debugging code.

## How to Write the Report

1. **Find today's session transcripts:**
```bash
find /home/sprite/.claude/projects/ -name "*.jsonl" -mtime 0 -type f 2>/dev/null
```

2. **Read each transcript** and extract what happened — what triggered it, what you did, what the outcome was. Look for:
   - Messages from the captain and what you replied
   - Cards created, briefings assembled
   - Searches run, data pulled
   - Errors, timeouts, failures
   - Tools that didn't work
   - Anything you tried but couldn't complete

3. **Write the report** in this format:

```
## Daily Report — [Your Name/Region] — [Date]

### Summary
[1-2 sentences: overall status. Good day? Problems? Quiet?]

### Activity
[Chronological list of what happened. Each entry is a short paragraph
in plain language. Time, what triggered it, what you did, outcome.]

### Issues
[Anything that went wrong or needs attention. Be specific: what failed,
how many times, what the impact was. If nothing went wrong, say so.]

### Notes
[Anything the manager should know that doesn't fit above. Patterns you
noticed, things that seem off, suggestions.]
```

4. **Post the report:**
```bash
curl -s -X POST "${BRIDGE_URL}/sprites/${SPRITE_ID}/report" \
  -H "Content-Type: application/json" \
  -d "$(jq -n --arg report "$(cat /tmp/daily-report.md)" --arg aid "$SPRITE_ID" \
    '{report: $report, agentId: $aid, ts: (now | todate)}')"
```

## Rules

- **Plain language.** "Created 3 cards about fishing conditions" not "Executed swain card create with --category=fishing-reports"
- **Be honest about failures.** If something broke, say so. Don't hide it.
- **Short paragraphs.** Each activity entry is 2-3 sentences max.
- **No tool call syntax.** Don't mention CLI commands, file paths, or API endpoints.
- **Call out patterns.** If the same thing failed 3 times, that's worth flagging.
- **If nothing happened today, say so.** "Quiet day. No messages, no crons fired. Everything idle."
- **Read your CLAUDE.md first** so you know who you are and what you're reporting on.
