# Briefing — Full Reference

Create a personalized daily briefing for your captain. You run in the main session — the same session where your captain chats with you. Full conversation history and memory files are available. Use them.

## Workflow

### 1. Get captain context

```bash
swain user get <userId> --json
swain boat profile --user=<userId> --json
```

Read `.claude/memory/` for personality, preferences, recent conversations.

**Use profile data to personalize everything** — card selection, commentary tone, and question strategy all flow from what you know:
- Match cards to their `primaryUse`, `fishingStyle`, `targetSpecies`
- Reference their `experienceLevel` when picking complexity
- Check maintenance dates for relevant service content
- Use `favoriteWatersideDining`, `preferredWaterways` for destination cards

**Review recently answered fields.** Compare today's `known` fields against what you remember from prior briefings. New answers are signals — the captain just told you something. Use them:
- **Personalize today's content** based on new answers. If the captain just said `diyPreference: "I handle most things myself"`, lean into DIY maintenance cards, not "find a pro" content.
- **Chain into follow-up questions.** Every answer opens a door:
  - `diyPreference: "I handle most things myself"` -> ask about `mechanicalSkillLevel`
  - `experienceLevel: "Brand new to it"` -> ask about `boatingCertifications` or `navigationSkillLevel`
  - `interests: "DJ nights / dancing"` -> ask about `typicalTripDuration` or `dietaryPreferences`
  - `primaryUse: "entertaining"` + `typicalCrew: "10-20"` -> ask about `dockPower`
- **Don't re-ask answered fields.** Check `known` before building interactive items.

**Study the `unknown` fields.** The profile JSON returns an `unknown` array — every field you haven't learned yet. Each briefing, pick 1-2 unknowns that connect to today's content and turn them into `survey`, `text_input`, or `multi_select` items. Prefer unknowns that chain naturally from recent answers over random picks.

**Don't just ask — give a reason.** Tie the question to something in the briefing or to an answer the captain recently gave. "This report covers redfish and snook — curious what you usually go after?" then follow with the survey. The question should feel like it belongs in the conversation, not like a form.

### 2. Generate boat art (do this early — it goes first in the briefing)

```bash
swain card boat-art --user=<userId> --json
```
Returns `image`, `styleName`, and `boatName`. Save these for assembly — the boat art item goes immediately after the greeting, before any content cards. If generation fails, retry with `--best`. Read the **boat-art** skill for style options.

### 3. Check yesterday's briefing

```bash
swain briefing previous --user=<userId> --json
```
Returns card IDs and titles from the last briefing. Use this to pick different topics today.

### 4. Check liked flyers (strongest interest signals)

```bash
swain flyer list --user=<userId> --status=liked --json
```

For each liked flyer, research the business/topic deeper and create a personalized card:
- A liked **marina** flyer -> research slip rates, amenities, fuel prices, reviews
- A liked **dining** flyer -> research the menu, dock-and-dine options, hours, reservation tips
- A liked **services** flyer -> research pricing, scheduling, reviews, what's included
- A liked **deals** flyer -> verify the deal is still active, add context on how/when to use it
- A liked **events** flyer -> research dates, registration, cost, what to expect

```bash
swain card create --desk=<desk> --user=<userId> \
  --category=<category> --title="<headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full researched markdown>" \
  --freshness=timely --json
```

**Liked flyer cards get priority in the briefing.** Your captain already told you they care.

### 5. Pull fresh card candidates

```bash
swain card pull --user=<userId> --exclude-served --json
```
Returns lightweight card summaries sorted by relevance. **User-tagged cards appear first** — these are cards you created specifically for this captain during heartbeats. Prioritize them. Then liked-flyer cards, then timely cards, then evergreen.

### 6. Fill the gap if needed

Count how many usable content cards came back from the pull (exclude boat art). If fewer than **9** content candidates:

1. Identify topics the captain cares about — check their profile, `.claude/memory/`, and recent conversations
2. Research 2-3 topics with web search — quick searches, not deep dives
3. Create cards one at a time:
   ```bash
   swain card create --desk=<desk> --user=<userId> \
     --category=<category> --title="<headline>" \
     --subtext="<2-3 sentence preview>" \
     --content="<full markdown>" \
     --freshness=<timely|evergreen> --json
   ```
4. These cards go straight into today's briefing selection pool

**Create cards one at a time** — research, create, then move to the next. Don't try to batch all research and all creation into one pass.

### 7. Select 8-10 cards

Selection priority:
- **Liked-flyer cards first** — captain explicitly said they want this
- **User-tagged cards next** — cards you created for this captain (marked `forUser` in pull results)
- **Prioritize timely cards** that are still valid today (check `expires_at`)
- **Mix in evergreen cards** the captain hasn't seen yet
- **Match the captain's interests** from `.claude/memory/` and recent conversations
- **Avoid repeating** cards from yesterday's briefing

**Hard floor: every briefing must have at least 8 cards total** (including boat art).

### 8. File desk requests (if needed)

If your captain cares about something and the library doesn't have it:
```bash
swain desk request --desk=<desk> --topic="fuel dock locations and hours" --category=maintenance-care --user=<userId> --json
```

### 9. Read full card content

```bash
swain card get <cardId> --json
```
Read each card to understand the content before writing your commentary.

### 10. Quality gate — style and polish every card

`boat_art` items aren't cards — they don't go through the quality gate.

**First, browse the style catalog:**
```bash
swain style list --json
```

**For every content card missing an image:**

1. **Pick a style** from the catalog that matches the card's category and mood. Vary your picks — don't reuse the same style in one briefing.
2. **Write a scene prompt** that captures the card's content. Be specific ("Redfish tailing in shallow grass flats at dawn") not generic ("fish in water"). Bake the style's aesthetic into the prompt. 1-2 sentences.
3. **Pick a background color** — muted, dark enough for white text contrast. Match the style and content mood.
4. **Generate:**
   ```bash
   swain card image <cardId> --style=<styleId> --bg-color=<hex> --prompt="<scene description>" --json
   ```

**For cards that have images but no `backgroundColor`:**
View the image (you're multimodal), pick a dominant color darkened enough for white text contrast, then:
```bash
swain card update <cardId> --bg-color=#... --json
```

**Verify all cards before assembly:**
```bash
swain card verify <cardId1> <cardId2> ... --json
```
Every card must pass (`allPass: true` — has both `image` and `backgroundColor`). If any fail, fix them and re-verify. Up to 3 total attempts. If cards still fail after retries, drop them and pick replacements.

**Do not proceed to assembly with unstyled cards.**

### 11. Build briefing items

JSON array structure:
- Always start with a `greeting`, followed immediately by `boat_art`, then a merch nudge `text` item
- Then: `text` commentary and `card` references
- End with a `closing`
- You don't have to introduce every card — sometimes one `text` item sets up two or three cards. Mix it up.
- **Include 1-2 interactive items** from your curiosity list (step 1). Weave them into the flow alongside related content — don't stack them at the end like a survey.
- For boat art (always the second item, right after greeting):
  ```json
  { "type": "boat_art", "image": "<url>", "styleName": "Art Deco", "boatName": "Fat Cat" }
  ```
- For the merch nudge (always right after boat art):
  ```json
  { "type": "text", "content": "That one came out nice — want it on a shirt or mug? https://www.heyswain.com/art/art_abc123" }
  ```
  Use the `shareUrl` from the `swain card boat-art` response. Vary the wording daily.

### 12. Assemble the briefing

```bash
swain briefing assemble --user=<userId> --items='<json_array>' --json
```
The CLI validates item format locally, then the server validates cards, fills in full card data, and marks them as served. Response includes `artIds`:
```json
{ "success": true, "briefingId": "...", "itemCount": 5, "date": "2026-02-22", "artIds": ["art_a1b2c3d4"] }
```
Each art ID maps to: `https://www.heyswain.com/art/{artId}`

---

## Briefing Item Types

The CLI validates all items before sending to the API. Every briefing follows: **greeting -> commentary + cards -> closing.**

### Text items

All use `"content"` for the message body.

| Type | Purpose |
|------|---------|
| `greeting` | Opening — first item in every briefing |
| `text` | Commentary between cards |
| `closing` | Sign-off — last item in every briefing |

```json
{ "type": "greeting", "content": "Morning, Bobby!" }
{ "type": "text", "content": "The redfish have been stacking up near your marina." }
{ "type": "closing", "content": "Tight lines, Captain." }
```

### Card references

Just the ID — the server hydrates title, image, content, everything.
```json
{ "type": "card", "id": "card_f498db98" }
```

### Boat art

First-class type — not a card reference. Built from `swain card boat-art` output.
```json
{ "type": "boat_art", "image": "https://imagedelivery.net/.../public", "styleName": "Art Deco", "boatName": "Fat Cat" }
```

### Interactive items

Use these to learn about your captain over time — weave them into briefings when it feels natural.

**Schema v1.2.0: `prompt` and `question` fields have been REMOVED from all interactive item types. Items with those fields will fail validation. Put all contextual copy in a preceding `text` item instead.**

| Type | Fields | Purpose |
|------|--------|---------|
| `survey` | `id`, `field`, `options` | Single-select question |
| `multi_select` | `id`, `field`, `options`, `min_selections?`, `max_selections?` | Multi-select question |
| `text_input` | `id`, `field`, `placeholder?`, `optional?` | Free text input |
| `photo_upload` | `id?`, `field?` | Ask for a photo (boat, dock, catch) |
| `image_upload` | `id`, `title`, `description?`, `optional?` | Generic image upload |

Always place a `text` item before an interactive item to provide context:

```json
{ "type": "text", "content": "How would you describe your boating experience?" }
{ "type": "survey", "id": "experience", "field": "experienceLevel", "options": ["New to boating", "A few seasons", "Seasoned captain"] }
{ "type": "text", "content": "Where do you keep your boat?" }
{ "type": "text_input", "id": "home_dock", "field": "marinaLocation", "placeholder": "e.g. Tampa Bay Marina" }
{ "type": "text", "content": "Got a photo of your boat? Makes the art way better." }
{ "type": "photo_upload" }
```

### Inline cards

For content that lives in the briefing itself, not the cards table.

| Type | Fields |
|------|--------|
| `image_card` | `id?`, `title?`, `subtext?`, `image?`, `content_markdown?`, `backgroundColor?`, `category?` |

---

## Commentary Guidelines

Your commentary for each card should:
- Be 1-2 sentences, warm and personal
- Reference the captain's boat, marina, or interests when relevant
- Explain why this card matters to THEM specifically
- Reference recent conversations when appropriate ("You mentioned wanting to try...")
- Feel like a knowledgeable friend at the marina

---

## Creating Personalized Cards

Between briefings, create cards tailored to your captain's interests and conversations:

```bash
swain card create \
  --desk=<captain's regional desk> \
  --user=<userId> \
  --category=<category> \
  --title="<short headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full markdown, researched content>" \
  --freshness=<timely|evergreen> \
  --json
```

The `--user` flag tags the card for this specific captain. It will surface at the top of pull results next time you build a briefing.

**Research before creating.** Use web search for real data. Never fabricate content.

---

## Example Briefing

```json
[
  { "type": "greeting", "content": "Morning, Bobby! Looks like a great day to get out on the water." },
  { "type": "boat_art", "image": "https://imagedelivery.net/.../public", "styleName": "Watercolor", "boatName": "Sea Dog" },
  { "type": "text", "content": "The watercolor version of Sea Dog came out sharp — want it on a shirt or mug? https://www.heyswain.com/art/art_abc123" },
  { "type": "text", "content": "Conditions are looking perfect for your usual run out of Tierra Verde." },
  { "type": "card", "id": "card_weather_123" },
  { "type": "text", "content": "The redfish have been active near the mangroves this week." },
  { "type": "card", "id": "card_fishing_456" },
  { "type": "closing", "content": "Have a great day on the water!" }
]
```

## Ordering

greeting -> boat art + merch nudge -> text + card pairs -> interactive items woven in -> closing
