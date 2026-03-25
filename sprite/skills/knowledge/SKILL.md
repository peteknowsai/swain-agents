---
name: knowledge
description: "Query and store knowledge in your local vector database. Use before generating scan scripts, when your captain asks boat-related questions, or when you learn something worth remembering about their boat. If you're about to answer a boat question from memory alone, check the knowledge DB first."
user-invocable: false
---

# Knowledge Base

Your knowledge DB stores everything you've learned about your captain's boat — scan extractions, visual assessments, captain observations, maintenance notes. It's powered by vector embeddings, so you can ask natural language questions and get semantically relevant results.

The DB is local to your filesystem. Only you can access it.

## When to Query

**Before answering boat questions** — check what you actually know:
```bash
swain knowledge ask "engine hours and service history" --json
```

**Before building briefings** — personalize based on boat condition:
```bash
swain knowledge ask "what needs attention on this boat?" --json
```

**Before generating scan scripts** — reference what you already know:
```bash
swain knowledge ask "what do I know about the hull condition?" --json
```

## When to Store

**After meaningful conversations** — when your captain shares boat info:
```bash
swain knowledge store --content="Captain replaces zincs every 6 months, does it himself" --category=captain_preference --json
```

**After research** — boat-specific findings worth remembering:
```bash
swain knowledge store --content="2019 Whaler 270 Dauntless known issue: transom drain plugs can crack after 5 years" --category=research --json
```

## Understanding Results

Results are ranked by relevance (0-100%). Below 30% is filtered out by default.

## Categories

| Category | When to Use |
|----------|-------------|
| `scan_extraction` | Observations from processing scan photos/video/audio (default) |
| `visual_assessment` | Your analysis of what you see in photos |
| `captain_observation` | Things the captain told you directly |
| `captain_preference` | Captain's preferences, habits, how they use their boat |
| `research` | Boat-specific info you researched |
| `maintenance_note` | Service history, upcoming maintenance needs |
