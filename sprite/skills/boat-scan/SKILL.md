---
name: boat-scan
description: "Generate podcast-style boat scan episodes — personalized scripts, TTS audio, and capture prompts. Triggered by boat_scan messages from the system."
user-invocable: false
---

# Boat Scan

Generate podcast-style audio episodes that guide captains through documenting their boat. Each episode focuses on a different aspect, builds on what you've learned from prior captures, and asks the captain to submit photos, video, or voice memos.

READ THIS ENTIRE SKILL BEFORE DOING ANYTHING.

## ZERO TEXT OUTPUT

**Every character of plain text you write gets sent to the captain's chat.**

- NEVER write plain text except `NO_REPLY` at the very end of your turn
- All work happens through tool calls (curl, etc.)

---

## Trigger

You receive a JSON message from Convex:

```json
{
  "type": "boat_scan",
  "action": "generate_episode",
  "episodeId": "ep_abc123",
  "episode": "the_boat_itself",
  "title": "The Boat Itself",
  "focus": "Hull, deck, canvas, cabin — full physical survey of the boat",
  "userId": "user_xxx",
  "captainName": "Pete",
  "boatName": "Sea Fox",
  "boatDetails": { "make": "Sea Fox", "model": "228 Commander", "year": 2021, "length": 22 },
  "priorCaptures": [],
  "contentUrl": "https://wandering-sparrow-224.convex.site/api/scan/episodes/ep_abc123/content",
  "audioUploadUrl": "https://wandering-sparrow-224.convex.site/api/scan/episodes/ep_abc123/audio-upload-url"
}
```

Check `type === "boat_scan"` and `action === "generate_episode"`, then follow the workflow below.

Later episodes include `priorCaptures` — photos, videos, and voice memos from all previous episodes. Use them to personalize your script.

---

## Workflow

### Step 1: Write the script

Write a 150-200 word podcast-style script talking directly to the captain.

**Use everything you have:**
- Captain's name and boat name/model/year
- Episode focus area
- Prior captures — reference specific things you saw or heard
- Your Stoolap knowledge DB — query it for anything you've stored about this boat

**Tone:**
- Conversational, knowledgeable, American accent
- Like a dock neighbor who knows their stuff
- Reference the specific boat make/model ("On a Commander, the scuppers are right here...")
- Be specific about what you're looking for and why
- Warm but not cheesy

**Episode 1** will be generic since you know nothing yet — that's fine, lean into the "let's get to know your boat" energy.

**Episodes 2-4** should reference what you learned. "Your hull looked solid in those photos" not "now let's look at the next thing."

### Step 2: Generate TTS audio

Call ElevenLabs to convert the script to speech:

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID:-pNInz6obpgDQGcFmaJgB}" \
  -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "<script text>",
    "model_id": "eleven_turbo_v2_5",
    "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 }
  }' \
  --output /tmp/episode.mp3
```

Voice defaults to "Adam" (`pNInz6obpgDQGcFmaJgB`) if `ELEVENLABS_VOICE_ID` is not set.

### Step 3: Get R2 upload URL

```bash
curl -s -X POST "<audioUploadUrl from trigger>" \
  -H "Authorization: Bearer ${SWAIN_API_TOKEN}" \
  -H "Content-Type: application/json"
```

Returns: `{ "uploadUrl": "https://...", "audioUrl": "https://r2.heyswain.com/..." }`

### Step 4: Upload audio to R2

```bash
curl -s -X PUT "<uploadUrl from step 3>" \
  -H "Content-Type: audio/mpeg" \
  --data-binary @/tmp/episode.mp3
```

### Step 5: Submit episode content

POST to the `contentUrl` from the trigger:

```bash
curl -s -X POST "<contentUrl from trigger>" \
  -H "Authorization: Bearer ${SWAIN_API_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "script": "<the script you wrote>",
    "audioUrl": "<audioUrl from step 3>",
    "durationMs": <audio duration in ms>,
    "captures": [ ... ]
  }'
```

The captures array defines what the captain needs to submit. See the episode definitions below.

End your turn with `NO_REPLY`.

---

## Episodes

Each episode has a recommended set of captures. Adapt based on the boat — skip cabin for center consoles, skip belt inspection for outboards, etc.

### Episode 1: The Boat Itself (`the_boat_itself`)

*First episode, you know nothing. Welcome them and set the tone.*

| id | type | label | detail |
|----|------|-------|--------|
| `hull_port` | photo | Port side | Full length shot from dock level |
| `hull_starboard` | photo | Starboard side | Full length from dock level |
| `stern_transom` | photo | Stern | Transom, motor(s), swim platform |
| `bow` | photo | Bow | Bow, anchor setup if visible |
| `deck_overview` | photo | Deck | Standing at helm looking forward |
| `first_impressions` | voice_memo | First impressions | Walk me around and tell me what you see |

### Episode 2: How It Runs (`how_it_runs`)

*You have exterior photos. Reference what you saw.*

| id | type | label | detail |
|----|------|-------|--------|
| `engine_overview` | photo | Engine | Engine bay or outboard cowling |
| `hours_gauge` | photo | Hours | Hour meter reading |
| `engine_running` | video | Engine running | Start it up, let me hear it |
| `fuel_system` | photo | Fuel system | Filters, tank, lines |
| `batteries` | photo | Batteries | Battery bank |
| `engine_notes` | voice_memo | Engine notes | Any quirks, recent work, concerns? |

### Episode 3: What's Aboard (`whats_aboard`)

*You know the exterior + mechanical state. Now inventory.*

| id | type | label | detail |
|----|------|-------|--------|
| `pfds` | photo | Life jackets | PFDs — count and condition |
| `fire_extinguisher` | photo | Fire extinguisher | Expiration visible if possible |
| `electronics_helm` | photo | Helm electronics | GPS, VHF, fishfinder |
| `registration` | photo | Registration | Registration and insurance docs |
| `gear_storage` | photo | Gear storage | Storage compartments, what's in there |
| `gear_notes` | voice_memo | Gear notes | Anything missing that you've been meaning to get? |

### Episode 4: Life Aboard (`life_aboard`)

*You know the boat well. This one is personal.*

| id | type | label | detail |
|----|------|-------|--------|
| `what_you_love` | voice_memo | What you love | What do you love about this boat? |
| `how_you_use_it` | voice_memo | How you use it | How do you typically use it? |
| `frustrations` | voice_memo | Frustrations | What drives you crazy about it? |
| `favorite_spot` | voice_memo | Favorite spot | Favorite spot to take her? |
| `origin_story` | voice_memo | Origin story | How'd you end up with this boat? |
| `favorite_photo` | photo | Favorite photo | Show me your favorite photo of her |
