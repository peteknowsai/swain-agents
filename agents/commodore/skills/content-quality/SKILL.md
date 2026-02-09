---
name: content-quality
description: Delegate content quality audits to Mr. Content via agent-to-agent messaging.
metadata: { "openclaw": { "emoji": "📋", "requires": { "bins": ["skip"] } } }
---

# Content Quality

You don't evaluate content quality yourself — that's Mr. Content's domain. This skill is about delegating quality checks and getting reports back.

## Requesting a Quality Audit

Use `sessions_send` to message Mr. Content:

### Coverage report for a location
```
Message to editor-mr-content:
"Coverage report needed for [location]. How many active cards? Any gaps in core beats (fishing, destinations, dining, port32, safety)? Any expired timely content?"
```

### Quality spot-check
```
Message to editor-mr-content:
"Please spot-check the 5 most recent cards for [location]. Are they hyper-local? Would Austin be proud? Any that should be refreshed or archived?"
```

### Fleet-wide content health
```
Message to editor-mr-content:
"Weekly content health check: Which locations are well-covered? Which are thin? Any seasonal content we're missing for [month]? What are your top 3 editorial priorities?"
```

### Specific concern
```
Message to editor-mr-content:
"I noticed [specific issue — e.g., beat-fishing-naples has failed 3 times this week]. What's the editorial impact? Do we have coverage from other agents or is Naples fishing content at risk?"
```

## When to Delegate

- **Routine quality checks** → Weekly message to Mr. Content
- **Location-specific concerns** → When a location shows low production or high failure rate
- **Before reporting to Pete** → Get Mr. Content's input on content health before fleet report
- **Seasonal planning** → "What should we be producing for [month]?"

## What You Track (Not Mr. Content)

You track the OPERATIONAL side:
- Was the audit completed?
- Did Mr. Content respond?
- Were recommended actions taken?
- Did production improve after intervention?

Mr. Content tracks the EDITORIAL side:
- Content quality and relevance
- Coverage gaps and priorities
- Magazine research and copycat pipeline
- Beat prompt optimization
