# Onboarding Reference

Detailed technical reference for the onboarding workflow. The SKILL.md has the flow — this has the field values, CLI commands, and JSON formats.

## Phase 1: CLI Commands

### Update onboarding step after intro
```bash
swain user update <userId> --onboardingStep=contacting --json
```

### Valid onboardingStep values
- `contacting` — intro message sent, waiting for reply
- `building_briefing` — conversation complete, building first briefing
- `done` — briefing assembled and delivered

### Valid onboardingStatus values
- `completed` — full onboarding finished successfully

---

## Phase 2: What to Capture

During the conversation, you're collecting:

| Data Point | Why It Matters | Where It Goes |
|---|---|---|
| Exact location (city, state) | Desk assignment | `--marinaLocation`, `--raw-location-input` |
| Specific spot (marina, harbor, ramp) | Microlocation within desk | `--microlocation` |
| Storage type | Determines range and desk scope | `--storageType` on boat |
| Primary use | Content selection | `--primaryUse` |
| Typical range | Desk scope sizing | Desk reasoning notes |
| Mobility pattern | Desk vs multi-desk | `--mobility` |

### Storage types and their implications
- **Wet slip** — fixed home base, desk centered on marina cruising ground
- **Dry stack** — same as wet slip, different logistics
- **Trailer** — wider range, desk covers most-frequented waters (not home address)
- **Mooring** — specific harbor, tight desk scope

### Mobility values
- `fixed` — boats from one spot
- `trailerable` — launches from ramps, variable locations
- `coastal_cruising` — extended range cruiser

---

## Phase 3: Briefing Build — Step by Step

### Step 1: Update status
```bash
swain user update <userId> --onboardingStep=building_briefing --json
```

### Step 2: Update profile
```bash
swain user update <userId> --marinaLocation='<marina>' --primaryUse=<use> --json
```

Valid `primaryUse` values: fishing, cruising, sailing, watersports, diving, liveaboard, mixed

### Step 3: Desk assignment

Resolve coordinates:
```bash
goplaces resolve '<marina or location>' --limit=1 --json
```

Search for existing desks:
```bash
swain desk search --lat=<lat> --lon=<lon> --json
```

Assign to existing desk:
```bash
swain user update <userId> --desk=<deskName> --microlocation='<specific spot>' --json
```

Or create a new desk:
```bash
swain desk create --name=<slug> --region='<region>' --lat=<lat> --lon=<lon> \
  --scope='<coverage description>' --created-by-location='<what captain said>' --json
```

Then assign:
```bash
swain user update <userId> --desk=<slug> --microlocation='<specific spot>' --json
```

**Desk field reference:**
- `--name` — URL-safe slug (e.g., `tampa-bay`, `marco-island`)
- `--region` — Human-readable name (e.g., "Tampa Bay", "Marco Island & Ten Thousand Islands")
- `--lat`/`--lon` — Center of coverage area
- `--scope` — Plain-English description of geographic extent. This is the most important field. Be specific: "Tampa Bay from the Sunshine Skyway north to the Courtney Campbell Causeway, including Tierra Verde, St. Pete Beach, and the Manatee River" not just "Tampa Bay area"
- `--created-by-location` — Raw text the captain gave you

**Key concept:** "Tierra Verde" is a microlocation. "Tampa Bay" is a desk. One desk covers many microlocations.

### Step 4: Additional profile fields
```bash
swain user update <userId> --mobility=<inferred> --watercraft-context='<context>' --raw-location-input='<raw>' --json
```

### Step 5: Boat record
```bash
swain boat list --user=<userId> --json
```
Create if none exists. See the boat fields in the profile skill reference.

### Step 6: Pull card candidates
```bash
swain card pull --user=<userId> --exclude-served --include-no-image --json
```

**Minimum 5 cards for first briefing** (including boat art = 4 content cards minimum).

If fewer than 4 content cards, create on the fly:
```bash
firecrawl search "<topic>" --limit 5
swain card create --desk=<desk> --user=<userId> \
  --title='<3-6 word headline>' \
  --subtext='<2-3 sentence preview>' \
  --content='<full markdown>' \
  --category=<category> --freshness=<timely|evergreen> --json
```

### Step 7: Style every content card

Browse styles once:
```bash
swain style list --json
```

For each card missing an image:
```bash
swain card image <cardId> --style=<styleId> --bg-color=<hex> \
  --prompt='<scene description>' --json
```

For cards with images but no backgroundColor:
```bash
swain card update <cardId> --bg-color=#... --json
```

**Style rules:**
- Pick styles that match category/mood
- Vary picks across cards in a briefing
- Scene prompts must be specific ("Redfish tailing in shallow grass flats at dawn"), not generic ("fish in water")
- Background colors: muted, dark enough for white text contrast

### Step 8: Generate boat art
```bash
swain card boat-art --user=<userId> --best --json
```
Returns `image`, `styleName`, and `boatName` — used in briefing assembly.

### Step 9: Assemble the briefing

Build a JSON array of items and pass to:
```bash
swain briefing assemble --user=<userId> --items='<json_array>' --json
```

**Item types:**

```json
{ "type": "greeting", "content": "Morning!" }
```
```json
{ "type": "text", "content": "Your commentary paragraph" }
```
```json
{ "type": "card", "id": "card_xxx" }
```
```json
{ "type": "boat_art", "image": "<url>", "styleName": "Art Deco", "boatName": "Fat Cat" }
```
```json
{ "type": "closing", "content": "Have a great day!" }
```
```json
{ "type": "photo_upload" }
```

**Required ordering (closing is ALWAYS last):**

1. `greeting`
2. `text` + `card` pairs (commentary introducing each card)
3. `boat_art`
4. `text` (bridge from boat art to photo ask, e.g., "Here's [boatName] in [styleName]. Every day you get a new one in a different style. Send me a photo and these get way better.")
5. `photo_upload` (immediately after the boat art bridge text)
6. `closing` (always the final item)

### Step 10: Finalize
```bash
swain user update <userId> --onboardingStep=done --onboardingStatus=completed --json
```

Then send the "all set" message as text output (goes to iMessage):
> You're all set — first one's ready for you https://www.heyswain.com/app

### Step 11: Write memory
Write everything learned to `.claude/memory/captain.md` and any other relevant memory files.

### Step 12: Send nudge
After the "all set" message, send a casual follow-up reminding them they can text you anytime.

---

## Timing Target

Entire flow from captain's first reply to "you're all set" should take **under 5 minutes**. A thin briefing delivered fast beats a perfect one that takes 20 minutes. Tomorrow's briefing will be better.

**If anything fails, recover silently. Never send errors to the captain.**
