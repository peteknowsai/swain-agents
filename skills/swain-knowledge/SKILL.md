---
name: swain-knowledge
description: "Query and store knowledge in your local vector database. Use before generating scan scripts, during heartbeats, or when your captain asks boat-related questions."
metadata: { "openclaw": { "emoji": "🧠", "requires": { "bins": ["swain"] } } }
---

# Knowledge Base

Your knowledge DB stores everything you've learned about your captain's boat —
scan extractions, visual assessments, captain observations, maintenance notes.
It's powered by vector embeddings, so you can ask natural language questions
and get semantically relevant results.

The DB is local to your workspace. Only you can access it.

## When to Query Knowledge

**Before generating scan scripts** — check what you already know so you
can reference it in the next wave's narration:
```bash
swain knowledge ask "what do I know about the hull condition?" --boat={{boatId}} --json
```

**During heartbeats** — enrich conversations with boat-specific context:
```bash
swain knowledge ask "any maintenance concerns?" --boat={{boatId}} --json
```

**When your captain asks questions** — semantic search for relevant knowledge:
```bash
swain knowledge ask "engine hours and service history" --boat={{boatId}} --json
```

**Before briefing assembly** — personalize cards based on boat condition:
```bash
swain knowledge ask "what needs attention on this boat?" --boat={{boatId}} --json
```

## When to Store Knowledge

**After processing scan captures** — store your extracted observations:
```bash
swain knowledge store --boat={{boatId}} --content="Hull gel coat clean, no stress cracks, minor chalking on starboard bow" --dimension=boat_itself --session={{sessionId}} --prompt=gel_coat_closeups --wave=2 --json
```

**After meaningful conversations** — when your captain shares boat info:
```bash
swain knowledge store --boat={{boatId}} --content="Captain replaces zincs every 6 months, does it himself" --category=captain_preference --json
```

**After research** — boat-specific findings worth remembering:
```bash
swain knowledge store --boat={{boatId}} --content="2019 Whaler 270 Dauntless known issue: transom drain plugs can crack after 5 years" --category=research --json
```

## Understanding Results

The `ask` command returns results ranked by relevance (0-100%):

```json
{
  "results": [
    {
      "content": "Zincs approximately 60% worn, recommend replacement within 50 engine hours",
      "dimension": "how_it_runs",
      "category": "scan_extraction",
      "score": 0.82
    }
  ]
}
```

Higher scores = more relevant. Results below 30% are filtered out by default.
Adjust with `--threshold` if you need broader or narrower results.

## Browsing Knowledge

List everything you know about a boat:
```bash
swain knowledge list --boat={{boatId}} --json
```

Filter by dimension:
```bash
swain knowledge list --boat={{boatId}} --dimension=how_it_runs --json
```

Check your knowledge coverage:
```bash
swain knowledge stats --boat={{boatId}} --json
```

## Categories

Use categories to organize knowledge by source:

| Category | When to Use |
|----------|-------------|
| `scan_extraction` | Observations from processing scan photos/video/audio (default) |
| `visual_assessment` | Your analysis of what you see in photos |
| `captain_observation` | Things the captain told you directly |
| `captain_preference` | Captain's preferences, habits, how they use their boat |
| `research` | Boat-specific info you researched |
| `maintenance_note` | Service history, upcoming maintenance needs |

## Integration with Boat Scan

During scan wave generation, the pattern is:

1. **Query** existing knowledge before generating scripts
2. **Process** captures from the previous wave
3. **Store** each extraction as a knowledge entry
4. **Query** again when building the next wave's progressive narration

This is how your scripts get progressively smarter — each wave builds on
what you learned in previous waves, and it all lives in your knowledge DB.
