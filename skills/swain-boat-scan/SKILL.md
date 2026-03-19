---
name: swain-boat-scan
description: "Generate progressive audio-guided boat scan sessions — script generation, TTS, capture processing, and knowledge extraction. Activated by generate_wave and generate_debrief trigger messages."
metadata: { "openclaw": { "emoji": "🔍", "requires": { "bins": ["swain"] } } }
---

# Boat Scan

Guide captains through progressive, audio-narrated boat documentation sessions.
You generate scripts, convert them to speech, process captures, extract knowledge,
and use what you learn to personalize the next wave.

READ THIS ENTIRE SKILL BEFORE DOING ANYTHING.

## ZERO TEXT OUTPUT

**Every character of plain text you write gets sent to the captain's WhatsApp.**
This is a hard technical fact. There is no "thinking out loud."

**Rules:**
- NEVER write plain text except `NO_REPLY` at the very end of your turn
- No planning text, no status updates, no thinking out loud
- If you need to communicate with the captain, use the `message` tool
- All work happens through tool calls (CLI, memory, LLM tools)

---

## Triggers

You receive structured JSON messages from Convex via OpenClaw:

**Wave generation:**
```json
{ "type": "boat_scan", "action": "generate_wave", "sessionId": "scan_sess_abc", "dimension": "hull", "wave": 1, "userId": "user_xyz" }
```

**Debrief generation:**
```json
{ "type": "boat_scan", "action": "generate_debrief", "sessionId": "scan_sess_abc", "dimension": "hull", "userId": "user_xyz" }
```

Check `type === "boat_scan"` first, then dispatch on `action`.

**You don't create sessions.** The backend creates them automatically:
- First session (`hull`) is created when `POST /api/scan/initialize` is called after provisioning
- Subsequent sessions are created automatically when iOS marks a dimension complete
- Progression: `hull` → `engine` → `safety` → `lifestyle`

---

## Prompt Map

You own the prompt map. Convex only knows dimension names and wave numbers.
All intelligence about what to ask lives here.

### The Boat Itself (boat_itself / hull) — Episode 1

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `hull_overview` — Hull overview (port + starboard), `bow_stern` — Bow and stern | photo |
| 2 | `waterline_bottom_paint` — Waterline & bottom paint, `gel_coat_closeups` — Gel coat close-ups | photo |
| 3 | `canvas_bimini` — Canvas & bimini, `cockpit_deck` — Cockpit/deck layout | photo + voice |
| 4 | `cabin_interior` — Cabin interior (if applicable), `hull_id_plate` — Hull ID plate | photo + text |

### How It Runs (engine) — Episode 2

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `engine_bay_overview` — Engine bay overview, `hours_gauge` — Hours gauge reading | photo |
| 2 | `zincs_anodes` — Zincs/anodes, `belts_hoses` — Belts & hoses | photo |
| 3 | `fuel_system` — Fuel system (filters, tank), `batteries` — Batteries | photo + voice |
| 4 | `helm_electronics` — Helm console & electronics, `engine_startup` — Engine startup sound | photo + voice |

### What's Aboard (safety) — Episode 3

| Wave | Prompts | Capture |
|------|---------|---------|
| 1 | `pfds` — PFDs (count + condition), `fire_extinguisher` — Fire extinguisher | photo |
| 2 | `flares_signaling` — Flares & signaling, `first_aid` — First aid kit | photo + text |
| 3 | `registration_insurance` — Registration & insurance docs, `service_records` — Service records | photo |
| 4 | `electronics_inventory` — Electronics inventory (GPS, VHF, fishfinder) | photo + voice |

### Life Aboard (lifestyle) — Episode 4

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

## Wave Generation Workflow

When you receive a `generate_wave` message:

### Step 1: Gather Context

```bash
# Get session state
swain scan session-get --session=<sessionId> --json

# Get boat profile (includes boat details + captain context)
swain boat profile --user=<userId> --json
```

Query your knowledge DB for existing context about this boat:
```bash
swain knowledge ask "What do I know about {boatName}?" --boat={boatId} --json
```

### Step 2: Process Previous Captures (if wave > 1)

```bash
# Fetch unprocessed captures from previous waves
swain scan captures --session=<sessionId> --unprocessed --json
```

For each capture, process based on type:

**Photos:** Use your vision capabilities to analyze:
- Condition assessment (good/fair/poor/critical)
- Visible specs, numbers, or identifiers
- Observations relevant to the dimension
- Concerns or red flags

**Voice:** Transcribe and extract:
- Key facts, preferences, or concerns
- Anything the captain said that should inform future waves

**Text:** Extract structured data directly.

After processing each capture:
```bash
swain scan capture-update <captureId> --processed [--transcription="..."] --json
```

Store all extracted knowledge in your knowledge DB:
```bash
swain knowledge store --boat={boatId} --content="{summary}" --dimension={dimension} --session={sessionId} --prompt={promptId} --wave={wave} --json
```

### Step 3: Generate Scripts

Look up this wave's prompts from the prompt map above. For each prompt, generate:

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

**Always start with a wave intro clip** (`clipType: "wave_intro"`, `sortOrder: 0`):
- Wave 1: Introduce yourself and what you'll cover. Reference the boat by name.
- Wave 2+: Reference what you learned from previous waves. Be specific — "Your gel coat looked clean" not "I've reviewed your previous photos."

**Script tone guidelines:**
- Conversational, knowledgeable, American accent
- Like a dock neighbor who knows their stuff
- Reference the specific boat make/model when relevant ("On a Whaler, the scuppers are right here...")
- Be specific about what you're looking for and why
- Keep each clip's spokenText to 2-4 sentences (15-45 seconds spoken)

### Step 4: Generate TTS Audio

For each clip, call ElevenLabs TTS:

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

**Voice:** Use a single consistent American male voice. Voice ID should be configured
in your workspace env as `ELEVENLABS_VOICE_ID`. If not set, use ElevenLabs voice
"Adam" (ID: `pNInz6obpgDQGcFmaJgB`).

**Audio specs:** MP3, 44.1kHz, 128kbps. Each clip should be 15-45 seconds.

### Step 5: Upload Audio

Upload each audio file to Cloudflare R2 via the Swain API. Two options:

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

### Step 6: Post Clips to Convex

```bash
swain scan clips-post --session=<sessionId> --wave=<N> --clips='<json_array>' --json
```

The clips array includes all clips for this wave with their audio URLs:
```json
[
  {
    "clipId": "clip_intro_001",
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

### Step 7: Generate Greeting (wave 1 of hull only)

If this is wave 1 of `hull` (the very first wave of the entire scan), generate
a personalized greeting that plays on the overview screen before the captain starts:

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

This greeting shows on the overview screen and plays before any dimension starts.
Skip this step for all other waves and dimensions.

### Step 8: Update Session

```bash
swain scan session-update --session=<sessionId> --status=active --current-wave=<N> --json
```

End your turn with `NO_REPLY`.

---

## Debrief Workflow

When you receive `generate_debrief: sessionId=X`:

### Step 1: Gather Everything

```bash
swain scan session-get --session=<sessionId> --json
swain scan captures --session=<sessionId> --json
swain boat profile --user=<userId> --json
```

Process any remaining unprocessed captures (same as wave generation step 2).

Query knowledge DB for everything about this boat:
```bash
swain knowledge list --boat={boatId} --json
```

For targeted questions:
```bash
swain knowledge ask "overall condition and concerns" --boat={boatId} --json
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
  --status=completed \
  --debrief-audio-url=<url> \
  --debrief-summary="<takeaway bullets as markdown>" \
  --advisor-summary="I've got a solid picture of your hull and cosmetics..." \
  --json
```

End your turn with `NO_REPLY`.

---

## Progressive Script Examples

**Wave 1 (no prior knowledge):**
> "Hey! I'm going to walk you through documenting your 2019 Boston Whaler 270 Dauntless. We'll start with the big picture — I want to see what she looks like from the outside. Grab your phone and let's get started."

**Wave 2 (after processing wave 1 captures):**
> "That hull is in really nice shape — clean gel coat, no cracks I can see from the wide shots. Now let's look closer at the waterline. Your bottom paint looked fresh in those first photos, but I want to see the details up close."

**Wave 4 (deep into the session):**
> "You've shown me a lot already. The hull's solid, the paint's good, the canvas needs some attention on the port side snap covers — I caught that in your photos. Last thing for this round: if you've got a cabin, give me a quick look inside. And find your hull ID plate — usually on the starboard transom."

**Debrief:**
> "Alright, here's what I'm seeing with your Whaler. Overall, she's in great shape — you're clearly taking care of her. The gel coat is clean, no stress cracks, no blistering. Your bottom paint's got about a season left in it — I'd plan on hauling out this fall. The one thing I'd get on sooner is those port-side snap covers. They're starting to pull away and once water gets behind the canvas, it gets expensive fast. Everything else — deck hardware, rubrail, windshield — all looking solid. Next time, I want to look under the hood."
