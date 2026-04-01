---
name: daily-report
description: "End-of-day shift report. Reviews all sessions from today, summarizes what you did, flags issues, and recommends system improvements. Written for a non-technical manager."
---

# Daily Report

You're writing a shift report. Your manager needs to understand what you did today, what went well, what didn't, and what should change. They're not technical — write like you're briefing a boss, not debugging code.

## How to Write the Report

> **Important:** Use `bash` to write the report file (`cat > /tmp/daily-report.md <<'EOF' ... EOF`). Do NOT use the Write tool — it requires a prior Read and will fail on new files.

1. **Read your CLAUDE.md first** so you know who you are and what you're reporting on.

2. **Find today's session transcripts:**
```bash
find /home/sprite/.claude/projects/ -name "*.jsonl" -mtime 0 -type f 2>/dev/null
```

3. **Read each transcript** and extract what happened — what triggered it, what you did, what the outcome was. Look for:
   - Messages from the captain and what you replied
   - Cards created, briefings assembled, flyers generated
   - Searches run, data pulled
   - Errors, timeouts, failures
   - Tools that didn't work or were missing
   - Permission blocks or auth failures
   - Anything you tried but couldn't complete
   - Patterns across sessions (same error repeating, same tool failing)

4. **Write the report** in this format:

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

### Recommendations
[Forward-looking suggestions based on what you observed today.
Think about each of these — skip any that don't apply:]

- **Errors needing fixes** — recurring failures, broken tools, bad data.
  What specifically broke and what would fix it?
- **Auth / permissions issues** — anything you were blocked from doing.
  What couldn't you access and what access would you need?
- **Missing skills or tools** — workflows you needed but don't have.
  What would you build if you could?
- **Skill improvements** — existing skills that could work better.
  What's clunky, slow, or unclear?
- **New subagent or desk ideas** — patterns suggesting a new agent
  would be useful. Regions with no coverage, tasks that should be
  split out, specializations that would help.
- **Content gaps** — topics, categories, or regions with no coverage
  that captains are asking about or would benefit from.
- **System improvements** — infrastructure, pipeline, or workflow
  changes that would make your job easier or more reliable.

[Be specific and actionable. "Card images fail sometimes" is useless.
"Card image generation fails ~30% of the time on the oil-painting style
— should either fix the model or remove that style" is useful.]

### Notes
[Anything else the manager should know — patterns, observations,
things that seem off but aren't clearly issues yet.]
```

5. **Post the report:**
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
- **Recommendations must be specific.** Name the skill, tool, or workflow. Say what's wrong and what should change. Vague suggestions waste everyone's time.
- **If nothing happened today, say so.** "Quiet day. No messages, no crons fired. Everything idle." Still write recommendations if you have them.
