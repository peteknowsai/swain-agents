---
name: boat-scan
description: "Generate progressive audio-guided boat scan sessions — scripts, TTS, and knowledge extraction. Use when you receive a boat_scan trigger message from the system, or when a captain's boat scan session needs wave generation or debrief."
---

# Boat Scan

Guide captains through progressive, audio-narrated boat documentation sessions. You generate scripts for an entire dimension at once (all waves), convert them to speech, and use prior captures to personalize the next dimension.

## Triggers

You receive structured JSON messages from the system:

**Dimension generation:**
```json
{ "type": "boat_scan", "action": "generate_dimension", "sessionId": "scan_xxx", "dimension": "boat_itself", "userId": "usr_xyz" }
```

**With prior captures (2nd+ dimensions):**
```json
{ "type": "boat_scan", "action": "generate_dimension", "sessionId": "scan_yyy", "dimension": "how_it_runs", "userId": "usr_xyz", "priorCaptures": [...] }
```

**Debrief generation:**
```json
{ "type": "boat_scan", "action": "generate_debrief", "sessionId": "scan_xxx", "dimension": "boat_itself", "userId": "usr_xyz" }
```

## Dimensions

Four episodes in progression:
1. **boat_itself** — hull, deck, canvas, cabin (4 waves)
2. **how_it_runs** — engine, fuel, electrical, helm (4 waves)
3. **whats_aboard** — safety gear, docs, electronics (4 waves)
4. **life_aboard** — captain's relationship with the boat (4 waves)

For the full prompt map (wave-by-wave prompts and capture types), see [reference.md](reference.md).

## Workflow

### 1. Gather Context
```bash
swain scan session-get --session=<sessionId> --json
swain boat profile --user=<userId> --json
swain knowledge ask "What do I know about this boat?" --json
```

### 2. Process Prior Captures
If the trigger includes `priorCaptures`, analyze photos with vision and transcribe audio. Store each extraction:
```bash
swain knowledge store --content="<observation>" --dimension=<dim> --category=scan_extraction --json
```

### 3. Generate Scripts
For each wave in the dimension, write a narration script that:
- References the captain by name
- Mentions their specific boat
- Builds on what you've already learned
- Tells them exactly what to capture (photo, video, voice, text)
- Adapts for boat type (skip cabin for center consoles, etc.)

### 4. Generate Audio (TTS)
Convert each script to speech. Post clips:
```bash
swain scan clips-post --session=<sessionId> --wave=<N> --clips='<json>' --json
```

### 5. Update Session
```bash
swain scan session-update --session=<sessionId> --status=ready --json
```

### 6. Debrief
For debrief triggers, summarize everything learned across all waves. Store key findings in knowledge DB and memory files.

## Adaptive Prompts

Skip prompts that don't apply:
- **No cabin** (center consoles, skiffs): skip `cabin_interior`
- **Outboard engines**: skip `belts_hoses`, adjust engine prompts
- **No trailer**: skip trailer prompts

Check `type`, `engineType`, `hasTrailer` from boat profile.
