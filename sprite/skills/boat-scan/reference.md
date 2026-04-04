# Boat Scan — Reference

## Trigger Payload

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

### priorCaptures (episodes 2-4)

Later episodes include captures from all completed episodes:

```json
{
  "priorCaptures": [
    {
      "episodeId": "ep_prev123",
      "episode": "the_boat_itself",
      "captureId": "hull_port",
      "type": "photo",
      "mediaUrl": "https://r2.heyswain.com/scan/captures/...",
      "label": "Port side"
    },
    {
      "episodeId": "ep_prev123",
      "episode": "the_boat_itself",
      "captureId": "first_impressions",
      "type": "voice_memo",
      "mediaUrl": "https://r2.heyswain.com/scan/captures/...",
      "transcription": "She's looking pretty good, the gel coat..."
    }
  ]
}
```

Use your vision capabilities on photo/video captures. Use transcriptions from voice memos. Reference specific things you observe.

---

## Content Submission

POST to `contentUrl` with Bearer auth:

```json
{
  "script": "Hey Captain Pete, let's take a walk around your Sea Fox...",
  "audioUrl": "https://r2.heyswain.com/scan/audio/ep_abc123/episode.mp3",
  "durationMs": 87000,
  "captures": [
    { "id": "hull_port", "type": "photo", "label": "Port side", "detail": "Full length shot from dock level" },
    { "id": "hull_starboard", "type": "photo", "label": "Starboard side", "detail": "Full length from dock level" },
    { "id": "stern_transom", "type": "photo", "label": "Stern", "detail": "Transom, motor(s), swim platform" },
    { "id": "bow", "type": "photo", "label": "Bow", "detail": "Bow, anchor setup if visible" },
    { "id": "deck_overview", "type": "photo", "label": "Deck", "detail": "Standing at helm looking forward" },
    { "id": "first_impressions", "type": "voice_memo", "label": "First impressions", "detail": "Walk me around and tell me what you see" }
  ]
}
```

Capture types: `photo`, `video`, `voice_memo`

---

## Audio Upload Flow

### 1. Get upload URL

```bash
curl -s -X POST "${audioUploadUrl}" \
  -H "Authorization: Bearer ${SWAIN_API_TOKEN}" \
  -H "Content-Type: application/json"
```

Response:
```json
{ "uploadUrl": "https://presigned-r2-url...", "audioUrl": "https://r2.heyswain.com/scan/audio/ep_abc123/episode.mp3" }
```

### 2. Upload the MP3

```bash
curl -s -X PUT "${uploadUrl}" \
  -H "Content-Type: audio/mpeg" \
  --data-binary @/tmp/episode.mp3
```

---

## ElevenLabs TTS

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_VOICE_ID:-pNInz6obpgDQGcFmaJgB}" \
  -H "xi-api-key: ${ELEVENLABS_API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Hey Captain Pete...",
    "model_id": "eleven_turbo_v2_5",
    "voice_settings": { "stability": 0.5, "similarity_boost": 0.75 }
  }' \
  --output /tmp/episode.mp3
```

- Voice: `ELEVENLABS_VOICE_ID` env var, or Adam (`pNInz6obpgDQGcFmaJgB`)
- Model: `eleven_turbo_v2_5`
- Target: 60-90 seconds spoken (150-200 words)

---

## Script Guidelines

- 150-200 words, podcast-style, talking directly to the captain
- Use their name and boat name/model
- Conversational, knowledgeable — dock neighbor who knows their stuff
- Reference the specific make/model when relevant ("On a Commander, the scuppers...")
- Be specific about what you're looking for and why
- Episode 1: "let's get to know your boat" energy (you know nothing yet)
- Episodes 2-4: reference prior captures — "Your hull looked solid" not generic transitions

---

## Episode Types

| Episode | Key | Focus |
|---------|-----|-------|
| 1 | `the_boat_itself` | Hull, deck, canvas, cabin — exterior survey |
| 2 | `how_it_runs` | Engine, fuel, electrical, helm — mechanical |
| 3 | `whats_aboard` | Safety gear, docs, electronics — inventory |
| 4 | `life_aboard` | Captain's story, favorites, frustrations — personal |

Episodes unlock progressively. One per day after the first.
