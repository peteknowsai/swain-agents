# Boat Scan — Full Reference

Guide captains through progressive, audio-narrated boat documentation sessions. You generate scripts for an entire dimension at once (all waves), convert them to speech, and use prior captures to personalize the next dimension.

## Triggers

You receive structured JSON messages from Convex:

**Dimension generation (all waves at once):**
```json
{ "type": "boat_scan", "action": "generate_dimension", "sessionId": "scan_xxx", "dimension": "boat_itself", "userId": "usr_xyz" }
```

**Dimension generation with prior captures (2nd+ dimensions):**
```json
{
  "type": "boat_scan",
  "action": "generate_dimension",
  "sessionId": "scan_yyy",
  "dimension": "how_it_runs",
  "userId": "usr_xyz",
  "priorCaptures": [
    { "wave": 1, "promptId": "hull_overview", "captureType": "photo", "mediaUrl": "...", "transcription": "..." }
  ]
}
```

**Debrief generation:**
```json
{ "type": "boat_scan", "action": "generate_debrief", "sessionId": "scan_xxx", "dimension": "boat_itself", "userId": "usr_xyz" }
```

Check `type === "boat_scan"` first, then dispatch on `action`.

**You don't create sessions.** The backend creates them automatically:
- First session (`boat_itself`) is created when `POST /api/scan/initialize` is called after provisioning
- Subsequent sessions are created automatically when iOS marks a dimension complete
- Progression: `boat_itself` -> `how_it_runs` -> `whats_aboard` -> `life_aboard`

**Wave advancement is handled by the app.** iOS calls `POST /scan/sessions/:id/advance` to bump the wave counter. All clips are already generated — no trigger needed.

---

## Prompt Map

You own the prompt map. Convex only knows dimension names and wave numbers. All intelligence about what to ask lives here.

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

### Adaptive Prompts

Skip prompts that don't apply to the boat:
- **No cabin** (center consoles, skiffs, bay boats): Skip `cabin_interior`
- **Outboard engines**: Skip `belts_hoses` (no belt-driven accessories), adjust `engine_bay_overview` to focus on outboard cowling/lower unit
- **No trailer** (`hasTrailer: false`): Skip any trailer prompts
- **Electric/no engine**: Skip `engine_startup`, adjust engine wave accordingly

Check the boat profile (`swain boat profile --user=<userId> --json`) for `type`, `engineType`, `hasTrailer`.

---

## Dimension Generation Workflow

When you receive a `generate_dimension` message, generate ALL waves for the dimension in one shot.

### Step 1: Gather Context

```bash
# Get session state
swain scan session-get --session=<sessionId> --json

# Get boat profile (includes boat details + captain context)
swain boat profile --user=<userId> --json
```

Query your knowledge DB for existing context about this boat:
```bash
swain knowledge ask "What do I know about {boatName}?" --boat=<boatId> --json
```

### Step 2: Process Prior Captures (if provided)

If the trigger includes `priorCaptures`, use them to inform your scripts. These are captures from the previously completed dimension — photos, videos, and transcriptions the captain already submitted.

For each prior capture:

**Photos/Videos (mediaUrl):** Use your vision capabilities to analyze:
- Condition assessment (good/fair/poor/critical)
- Visible specs, numbers, or identifiers
- Observations relevant to the upcoming dimension
- Concerns or red flags that should be followed up on

**Transcriptions:** Extract:
- Key facts, preferences, or concerns
- Anything the captain said that should inform this dimension's prompts

Store all extracted knowledge:
```bash
swain knowledge store --boat=<boatId> --content="{summary}" --dimension=<dimension> --session=<sessionId> --json
```

### Step 3: Generate Scripts for ALL Waves

Look up ALL waves for this dimension from the prompt map above. For each wave, generate a wave intro clip and prompt clips.

For each prompt clip:
```json
{
  "promptId": "waterline_bottom_paint",
  "clipType": "prompt",
  "spokenText": "Show me the waterline — where the hull meets the water...",
  "instructionTitle": "Photograph the waterline",
  "instructionDetail": "Get close enough to see the paint condition. Look for growth, blistering, or peeling.",
  "captureType": "photo",
  "sortOrder": 1
}
```

**Each wave MUST start with a wave intro clip** (`clipType: "wave_intro"`, `sortOrder: 0`):
- Wave 1: Introduce yourself and what you'll cover in this dimension. Reference the boat by name.
- Wave 2+: Build continuity. Reference what the captain will have seen/done in the previous wave. Be specific — "After looking at the waterline, now let's check the canvas" not generic transitions.
- If you have prior captures from a previous dimension, reference what you learned. "Your hull looked great — now let's see what's under the hood."

**Script tone guidelines:**
- Conversational, knowledgeable, American accent
- Like a dock neighbor who knows their stuff
- Reference the specific boat make/model when relevant ("On a Whaler, the scuppers are right here...")
- Be specific about what you're looking for and why
- Keep each clip's spokenText to 2-4 sentences (15-45 seconds spoken)

### Step 4: Generate TTS Audio

For each clip across all waves, call ElevenLabs TTS:

```bash
curl -X POST "https://api.elevenlabs.io/v1/text-to-speech/{VOICE_ID}" \
  -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "<spokenText>",
    "model_id": "eleven_turbo_v2_5",
    "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 }
  }' \
  --output /tmp/clip_<promptId>.mp3
```

**Voice:** Use a single consistent American male voice. Voice ID should be configured in env as `ELEVENLABS_VOICE_ID`. If not set, use ElevenLabs voice "Adam" (ID: `pNInz6obpgDQGcFmaJgB`).

**Audio specs:** MP3, 44.1kHz, 128kbps. Each clip should be 15-45 seconds.

### Step 5: Upload Audio

Upload each audio file to Cloudflare R2. Two options:

**Option A — server-side download** (if you have a URL for the audio):
```bash
swain scan audio-upload --session=<sessionId> --clip=clip_<promptId> --url=<tempUrl> --json
```
Returns `{ audioUrl: "https://pub-....r2.dev/scan/audio/..." }`.

**Option B — direct upload** (if you have the file locally):
```bash
swain scan audio-upload --session=<sessionId> --clip=clip_<promptId> --json
```
Returns `{ uploadUrl: "https://...", audioUrl: "https://...", method: "PUT" }`.
Then PUT the file to `uploadUrl`. The `audioUrl` is the CDN URL for playback.

### Step 6: Post ALL Clips to Convex

Post clips for each wave separately:

```bash
swain scan clips-post --session=<sessionId> --wave=1 --clips='<json_array>' --json
swain scan clips-post --session=<sessionId> --wave=2 --clips='<json_array>' --json
swain scan clips-post --session=<sessionId> --wave=3 --clips='<json_array>' --json
swain scan clips-post --session=<sessionId> --wave=4 --clips='<json_array>' --json
```

The clips array for each wave includes all clips with their audio URLs:
```json
[
  {
    "clipId": "clip_intro_w1",
    "sessionId": "<sessionId>",
    "wave": 1,
    "clipType": "wave_intro",
    "promptId": null,
    "script": "Hey! Let's look at your 2019 Whaler...",
    "audioUrl": "https://pub-fd6300113e8547bfa8e24891ffa6eeeb.r2.dev/scan/audio/...",
    "durationMs": 22000,
    "sortOrder": 0
  },
  {
    "clipId": "clip_hull_overview",
    "sessionId": "<sessionId>",
    "wave": 1,
    "clipType": "prompt",
    "promptId": "hull_overview",
    "script": "First, show me the port side...",
    "audioUrl": "https://pub-fd6300113e8547bfa8e24891ffa6eeeb.r2.dev/scan/audio/...",
    "durationMs": 18000,
    "sortOrder": 1,
    "captureType": "photo",
    "instructionTitle": "Hull overview — port side",
    "instructionDetail": "Stand back far enough to get the full side in frame."
  }
]
```

### Step 7: Generate Greeting (boat_itself only)

If this is `boat_itself` (the very first dimension of the entire scan), generate a personalized greeting that plays on the overview screen before the captain starts:

1. Write a warm 2-3 sentence greeting referencing the captain's name and boat name/model
2. Generate TTS audio for it (same ElevenLabs flow as clips)
3. Upload the audio via `swain scan audio-upload`
4. Set it on the session:

```bash
swain scan session-update --session=<sessionId> \
  --greeting="Hey Captain Pete! I'm going to walk you through documenting Reel Therapy — your 2019 Whaler 270 Dauntless. We'll go through everything together, starting with the outside of the boat." \
  --greeting-audio-url=<greeting_audio_url> \
  --json
```

This greeting shows on the overview screen and plays before any dimension starts. Skip this step for all other dimensions.

### Step 8: Update Session

After ALL waves are posted, set the session to active:

```bash
swain scan session-update --session=<sessionId> --status=active --current-wave=1 --json
```

This tells the app the dimension is ready. The app handles wave advancement from here.

---

## Debrief Workflow

When you receive `generate_debrief`:

### Step 1: Gather Everything

```bash
swain scan session-get --session=<sessionId> --json
swain scan captures --session=<sessionId> --json
swain boat profile --user=<userId> --json
```

Process any remaining unprocessed captures.

Query knowledge DB for everything about this boat:
```bash
swain knowledge list --boat=<boatId> --json
```

For targeted questions:
```bash
swain knowledge ask "overall condition and concerns" --boat=<boatId> --json
```

### Step 2: Generate Debrief Script

Synthesize all observations across all waves into a cohesive debrief:

- **Open** with the big picture — overall condition, first impressions confirmed or revised
- **Highlight 3-5 key findings** — good and bad, specific and actionable
- **Connect dots** — "Your engine hours are at 450 and the zincs are 60% worn, so you're probably due for a service in the next 50 hours"
- **Give recommendations** — ranked by urgency
- **Preview what's next** — if this isn't the last episode, tease what the next dimension covers and why it matters given what you just learned

Target: 60-120 seconds spoken (roughly 150-300 words).

### Step 3: Generate Debrief TTS

Same ElevenLabs flow as wave clips, but as a single longer audio file.

### Step 4: Generate Takeaway Summary

Create 3-5 bullet-point takeaways (text, not audio):
```
- Hull in excellent condition — clean gel coat, no blistering
- Bottom paint due for refresh (last done 18 months ago per records)
- Port side snap covers showing wear — replacement recommended before rain season
- Canvas overall good, bimini fabric tight with no pooling
```

### Step 5: Post Debrief

```bash
swain scan clips-post --session=<sessionId> --wave=0 --clips='[{
  "clipType": "debrief",
  "promptId": null,
  "script": "<full debrief text>",
  "audioUrl": "<debrief audio url>",
  "durationMs": 90000,
  "sortOrder": 0
}]' --json
```

```bash
swain scan session-update --session=<sessionId> \
  --debrief-audio-url=<url> \
  --debrief-summary="<takeaway bullets as markdown>" \
  --advisor-summary="I've got a solid picture of your hull and cosmetics..." \
  --json
```

Note: The session status is already set to `completed` by Convex before the debrief trigger fires. You don't need to set it.

---

## Progressive Script Examples

**Wave 1 of boat_itself (no prior knowledge):**
> "Hey! I'm going to walk you through documenting your 2019 Boston Whaler 270 Dauntless. We'll start with the big picture — I want to see what she looks like from the outside. Grab your phone and let's get started."

**Wave 2 of boat_itself (building on wave 1):**
> "That hull overview should give us a good baseline. Now let's get closer — I want to see the waterline where the hull meets the water, and get some close-ups of the gel coat. This is where you really see how the boat's been treated."

**Wave 4 of boat_itself (wrapping up dimension):**
> "Almost done with the outside. Last thing for this round: if you've got a cabin, give me a quick look inside. And find your hull ID plate — usually on the starboard transom. That number tells me a lot about when and where she was built."

**Wave 1 of how_it_runs (with prior captures from boat_itself):**
> "Your hull looked solid in those photos — clean gel coat, no cracks. Now let's see what's keeping her running. Pop the engine bay open and let's take a look at what we're working with."

**Debrief:**
> "Alright, here's what I'm seeing with your Whaler. Overall, she's in great shape — you're clearly taking care of her. The gel coat is clean, no stress cracks, no blistering. Your bottom paint's got about a season left in it — I'd plan on hauling out this fall. The one thing I'd get on sooner is those port-side snap covers. They're starting to pull away and once water gets behind the canvas, it gets expensive fast. Everything else — deck hardware, rubrail, windshield — all looking solid. Next time, I want to look under the hood."

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

## Knowledge Integration

Store observations from captures for use across dimensions:
```bash
swain knowledge store --boat=<boatId> --content="{summary}" --dimension=<dimension> --session=<sessionId> --json
```

Query before generating scripts:
```bash
swain knowledge ask "What do I know about {boatName}?" --boat=<boatId> --json
```

Browse all knowledge entries:
```bash
swain knowledge list --boat=<boatId> --json
```

Categories: `scan_extraction` (default), `visual_assessment`, `captain_observation`, `captain_preference`, `research`, `maintenance_note`.
