---
name: library-analysis
description: Analyze card library health, coverage gaps, and content freshness.
metadata: { "openclaw": { "emoji": "📊", "requires": { "bins": ["skip"] } } }
---

# Library Analysis

Analyze the Skip card library to understand content health and identify gaps.

## Workflow

1. **Get library analysis**
   ```bash
   skip library analyze --json
   ```
   This returns:
   - Card counts by location and category
   - Expired card count
   - Evergreen card breakdown
   - Coverage gaps (locations with users but few active cards)
   - User coverage (which beats serve which locations)
   - New locations that need beat reporters

2. **Interpret the data**
   - **Coverage gaps**: Locations where users exist but cards are thin (< 5 active cards)
   - **Expired timely cards**: These need refreshing — dispatch beat reporters
   - **Missing beats**: Locations that lack beat types other locations have
   - **New locations**: Users signed up from new marinas with zero beats

3. **Check specific locations** (if needed)
   ```bash
   skip card list --agent=beat-weather-tierra-verde --limit=5 --json
   ```

4. **List current beat reporters**
   ```bash
   skip beat list --json
   ```

5. **Recommend actions**
   Based on the analysis:
   - Which beat reporters to dispatch now
   - Which new beats to register
   - Which locations need attention
   - Which evergreen content is getting stale
