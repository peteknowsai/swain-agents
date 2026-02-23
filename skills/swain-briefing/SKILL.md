---
name: swain-briefing
description: Create personalized daily briefings using the advisor toolkit.
metadata: { "openclaw": { "emoji": "📋", "requires": { "bins": ["swain"] } } }
---

# Daily Briefing Creation

Create a personalized daily briefing for your captain.

## Context

You run in the **main session** — the same session where your captain chats with you.
This means you have full conversation history and memory files. Use them. If your captain
said "I'm thinking about upgrading my electronics" yesterday, that should shape today's
briefing.

## Workflow

1. **Get user profile**
   ```bash
   swain user get {{userId}} --json
   ```

2. **Check yesterday's briefing** (avoid repeating topics)
   ```bash
   swain briefing previous --user={{userId}} --json
   ```
   Returns card IDs and titles from the last briefing. Use this to pick different topics today.

3. **Pull fresh card candidates**
   ```bash
   swain card pull --user={{userId}} --exclude-served --json
   ```
   Returns lightweight card summaries sorted by relevance. **User-tagged cards appear
   first** — these are cards you created specifically for this captain during heartbeats,
   inspired by your conversations. Prioritize them. Then timely cards, then evergreen.

4. **Fill the gap if needed**
   Count how many usable content cards came back from the pull (exclude boat art).
   If fewer than **9** content candidates:

   1. Identify topics the captain cares about — check their profile, MEMORY.md,
      and recent conversations
   2. Research 2-3 topics with `firecrawl search "<topic>" --limit 5` — quick searches, not deep dives
   3. Create cards one at a time:
      ```bash
      swain card create --desk=<desk> --user={{userId}} \
        --category=<category> --title="<headline>" \
        --subtext="<2-3 sentence preview>" \
        --content="<full markdown>" \
        --freshness=<timely|evergreen> --json
      ```
   4. These cards go straight into today's briefing selection pool

   **Create cards one at a time** — research, create, then move to the next. Don't
   try to batch all research and all creation into one pass.

   If `firecrawl` is slow or rate-limited, create cards from your own knowledge
   (boat type tips, general boating content for the captain's region) rather than failing.

5. **Get captain context from Convex and memory**
   ```bash
   swain boat profile --user={{userId}} --json
   ```
   This gives you the full picture: known fields, unknown fields, and completeness.
   Read `MEMORY.md` for personality notes and current situation. Use `memory_search`
   for specific past conversations. You're in the main session, so recent conversation
   history is already in context.

   Use profile data to personalize card selection:
   - Match cards to their `primaryUse`, `fishingStyle`, `targetSpecies`
   - Reference their `experienceLevel` when picking complexity
   - Check maintenance dates for relevant service content
   - Use `favoriteWatersideDining`, `preferredWaterways` for destination cards

   **Study the `unknown` fields.** The profile JSON returns an `unknown` array —
   every field you haven't learned yet. This is your curiosity list. Each
   briefing, pick 1-2 unknowns that connect to today's content and turn them
   into `survey`, `text_input`, or `multi_select` items.

   **Don't just ask — give a reason.** Tie the question to something in the
   briefing. If you're including a fishing card and don't know their
   `targetSpecies`, don't ask "What species do you target?" Instead, introduce
   it: "This report covers redfish and snook — curious what you usually go
   after?" then follow with the survey. If there's a weather card and you
   don't know `maxWindKnots`, try "Winds are picking up this weekend — what's
   your comfort zone?" The question should feel like it belongs in the
   conversation, not like a form.

6. **Generate today's boat art**
   ```bash
   swain card boat-art --user={{userId}} --json
   ```
   This returns image data for the captain's boat art. Take the `image`, `styleName`,
   and `boatName` from the result — you'll use these in step 11. Read the
   **swain-boat-art** skill for style options.

7. **Select 8-10 cards** based on:
   - **User-tagged cards first** — cards you created for this captain (marked `forUser` in pull results)
   - **Prioritize timely cards** that are still valid today (check `expires_at`)
   - **Mix in evergreen cards** the captain hasn't seen yet
   - **Match the captain's interests** from MEMORY.md and recent conversations
   - **Avoid repeating** cards from yesterday's briefing

   **Hard floor: every briefing must have at least 8 cards total** (including boat art).
   If you still can't reach 8 after creating cards on the fly, include what you have —
   but this should be rare.

8. **Flag content gaps** — If your captain cares about something and the library
   doesn't have it, tell Mr. Content:
   ```
   sessions_send(sessionKey="agent:mr-content:main", message="My captain [name] is into [topic] around [location] but I can't find anything in the library on it. Would be great to get some content on this.")
   ```
   Mr. Content coordinates the content desks — he'll route it to the right one.

9. **Read full card content** for each selected card:
   ```bash
   swain card get <cardId> --json
   ```
   Read each card to understand the content before writing your commentary.

10. **Quality gate — style and polish every card before assembly**

    `boat_art` items aren't cards — they don't go through the quality gate.

    **First, browse the style catalog:**
    ```bash
    swain style list --json
    ```
    This returns all available styles with IDs and descriptions. You'll pick from
    these for each card.

    **For every content card missing an image:**

    1. **Pick a style** from the catalog that matches the card's category and mood.
       Vary your picks — don't reuse the same style in one briefing.
    2. **Write a scene prompt** that captures the card's content. Be specific
       ("Redfish tailing in shallow grass flats at dawn") not generic ("fish in
       water"). Bake the style's aesthetic into the prompt. 1-2 sentences.
    3. **Pick a background color** — muted, dark enough for white text contrast.
       Match the style and content mood.
    4. **Generate:**
       ```bash
       swain card image <cardId> --fast --style=<styleId> --bg-color=<hex> --prompt="<scene description>" --json
       ```

    **For cards that have images but no `backgroundColor`:**
    View the image (you're multimodal), pick a dominant color darkened enough for
    white text contrast, then:
    ```bash
    swain card update <cardId> --bg-color=#... --json
    ```

11. **Build briefing items** as a JSON array:
   - Always start with a `greeting` and end with a `closing`
   - In between: `text` commentary, `card` references, and `boat_art`
   - You don't have to introduce every card — sometimes one `text` item
     sets up two or three cards. Sometimes a card speaks for itself.
     Mix it up based on what feels right for this captain today.
   - **Include 1-2 interactive items** from your curiosity list (step 5).
     Weave them into the flow alongside related content — don't stack
     them at the end like a survey.
   - For boat art, build the item from step 6's result:
     ```json
     { "type": "boat_art", "image": "<url from step 6>", "styleName": "Art Deco", "boatName": "Fat Cat" }
     ```

   Your commentary is where you make this feel personal. What you say, which
   cards you pick, how you connect them to the captain's life — that's all you.
   Learn what resonates with your captain over time and adapt.

12. **Assemble the briefing**
    ```bash
    swain briefing assemble --user={{userId}} --items='<json_array>' --json
    ```
    The CLI validates item format locally, then the server validates cards,
    fills in full card data, and marks them as served. The response includes
    `artIds` — shareable art record IDs for any `boat_art` items:
    ```json
    { "success": true, "briefingId": "...", "itemCount": 5, "date": "2026-02-22", "artIds": ["art_a1b2c3d4"] }
    ```
    Each art ID maps to a shareable URL: `https://www.heyswain.com/art/{artId}`

13. **Notify your captain**
    Send a short WhatsApp message letting them know the briefing is ready. Include
    the `heyswain://` deep link so they can tap straight into the app.

    ```
    message action=send channel=whatsapp target={{phone}} message="<your message>"
    ```

    Keep it short and natural — one sentence. Don't list what's in the briefing.
    Let the app surprise them.

    Examples:
    - "Morning! New stuff for you 🤙 https://www.heyswain.com/app"
    - "Fresh stuff for you today — https://www.heyswain.com/app"
    - "Got a good one for you this morning 🚤 https://www.heyswain.com/app"

## Creating Personalized Cards

Between briefings, you can create cards tailored to your captain's interests
and conversations. Use this during heartbeats when you notice something worth
turning into content:

```bash
swain card create \
  --desk=<captain's regional desk> \
  --user={{userId}} \
  --category=<category> \
  --title="<short headline>" \
  --subtext="<2-3 sentence preview>" \
  --content="<full markdown, researched content>" \
  --freshness=<timely|evergreen> \
  --json
```

The `--user` flag tags the card for this specific captain. It will surface at the
top of the pull results next time you build a briefing.

**Research before creating.** Use `web_search` and `web_fetch` for real data.
Never fabricate content.

## Briefing Item Types

The CLI validates all items before sending to the API. If you get the format
wrong, it tells you exactly what to fix.

Every briefing follows the same skeleton: **greeting → commentary + cards → closing.**
Within that, you have the full toolkit below.

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
First-class type for boat art — not a card reference. Built from `swain card boat-art` output.

```json
{ "type": "boat_art", "image": "https://imagedelivery.net/.../public", "styleName": "Art Deco", "boatName": "Fat Cat" }
```

### Interactive items
Use these to learn about your captain over time — weave them into briefings
when it feels natural, not as a survey dump.

**⚠️ Schema v1.2.0: `prompt` and `question` fields have been REMOVED from all
interactive item types. Items with those fields will fail validation at assembly
time. Put all contextual copy in a preceding `text` item instead.**

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

## Commentary Guidelines

Your commentary for each card should:
- Be 1-2 sentences, warm and personal
- Reference the captain's boat, marina, or interests when relevant
- Explain why this card matters to THEM specifically
- Reference recent conversations when appropriate ("You mentioned wanting to try...")
- Feel like a knowledgeable friend at the marina

## Example Briefing

```json
[
  { "type": "greeting", "content": "Morning, Bobby! Looks like a great day to get out on the water." },
  { "type": "text", "content": "Conditions are looking perfect for your usual run out of Tierra Verde." },
  { "type": "card", "id": "card_weather_123" },
  { "type": "text", "content": "The redfish have been active near the mangroves this week." },
  { "type": "card", "id": "card_fishing_456" },
  { "type": "boat_art", "image": "https://imagedelivery.net/.../public", "styleName": "Watercolor", "boatName": "Sea Dog" },
  { "type": "closing", "content": "Have a great day on the water!" }
]
```
