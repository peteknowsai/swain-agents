# Boat Scan — Prompt Map & Detailed Workflow

## Prompt Map

### The Boat Itself (boat_itself) — Episode 1

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `hull_overview` — Hull overview (port + starboard), `bow_stern` — Bow and stern | photo |
| 2 | `waterline_bottom_paint` — Waterline & bottom paint, `gel_coat_closeups` — Gel coat close-ups | photo |
| 3 | `canvas_bimini` — Canvas & bimini, `cockpit_deck` — Cockpit/deck layout | photo + voice |
| 4 | `cabin_interior` — Cabin interior (if applicable), `hull_id_plate` — Hull ID plate | photo + text |

### How It Runs (how_it_runs) — Episode 2

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `engine_bay_overview` — Engine bay overview, `hours_gauge` — Hours gauge reading | photo |
| 2 | `zincs_anodes` — Zincs/anodes, `belts_hoses` — Belts & hoses | photo |
| 3 | `fuel_system` — Fuel system (filters, tank), `batteries` — Batteries | photo + voice |
| 4 | `helm_electronics` — Helm console & electronics, `engine_startup` — Engine startup sound | photo + voice |

### What's Aboard (whats_aboard) — Episode 3

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `pfds` — PFDs (count + condition), `fire_extinguisher` — Fire extinguisher | photo |
| 2 | `flares_signaling` — Flares & signaling, `first_aid` — First aid kit | photo + text |
| 3 | `registration_insurance` — Registration & insurance docs, `service_records` — Service records | photo |
| 4 | `electronics_inventory` — Electronics inventory (GPS, VHF, fishfinder) | photo + voice |

### Life Aboard (life_aboard) — Episode 4

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `what_you_love` — "What do you love about this boat?", `typical_use` — "How do you typically use it?" | voice |
| 2 | `frustrations` — "What drives you crazy about it?", `recurring_issues` — "Any recurring issues?" | voice |
| 3 | `typical_crew` — "Tell me about your typical crew", `favorite_trips` — "Favorite trips or spots" | voice + text |
| 4 | `what_youd_change` — "What would you change?", `origin_story` — "How'd you end up with this boat?" | voice |

## Adaptive Prompts

Skip prompts that don't apply:
- **No cabin** (center consoles, skiffs, bay boats): Skip `cabin_interior`
- **Outboard engines**: Skip `belts_hoses`, adjust `engine_bay_overview` to focus on outboard cowling/lower unit
- **No trailer**: Skip trailer prompts
- **Electric/no engine**: Skip `engine_startup`

## Script Clip Format

```json
{
  "clipId": "clip_hull_overview",
  "sessionId": "<sessionId>",
  "wave": 1,
  "clipType": "prompt",
  "promptId": "hull_overview",
  "script": "First, show me the port side...",
  "audioUrl": "https://...",
  "durationMs": 18000,
  "sortOrder": 1,
  "captureType": "photo",
  "instructionTitle": "Hull overview — port side",
  "instructionDetail": "Stand back far enough to get the full side in frame."
}
```

Every wave starts with a `wave_intro` clip (`sortOrder: 0`, `clipType: "wave_intro"`).

## TTS

Use ElevenLabs:
```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}" \
  -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{"text": "<script>", "model_id": "eleven_turbo_v2_5", "voice_settings": {"stability": 0.5, "similarity_boost": 0.75}}' \
  --output /tmp/clip.mp3
```

Default voice: "Adam" (`pNInz6obpgDQGcFmaJgB`). Override with `ELEVENLABS_VOICE_ID`.

## Progressive Script Examples

**Wave 1 (no prior knowledge):**
> "Hey! I'm going to walk you through documenting your 2019 Boston Whaler 270 Dauntless. We'll start with the big picture."

**Wave 2 (building on wave 1):**
> "That hull overview should give us a good baseline. Now let's get closer — I want to see the waterline."

**Wave 1 of how_it_runs (with prior captures):**
> "Your hull looked solid in those photos — clean gel coat, no cracks. Now let's see what's keeping her running."

## Debrief Format

Debrief clips use `wave=0`, `clipType="debrief"`. Include:
- Big picture assessment
- 3-5 key findings (good and bad)
- Connected insights ("Your hours + zinc wear = service soon")
- Ranked recommendations
- Preview of next dimension

Target: 60-120 seconds spoken.
