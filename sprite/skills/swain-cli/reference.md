# Swain CLI — Full Command Reference

The `swain` CLI is your interface to the Swain Convex backend. Every read and write to user profiles, boats, cards, briefings, and agents goes through it.

**Always pass `--json` on every command.** You're a machine — parse JSON, not formatted text.

## Choosing the Right Command

Some commands overlap. Here's when to use what:

- **`boat profile`** vs **`user get` + `boat get`**: Use `boat profile` when you need the full picture (completeness score, known/unknown fields, tier). Use the individual commands when you only need one piece.
- **`card pull`** vs **`card list`**: `pull` is personalized — it ranks cards for a specific user, respects served history, and surfaces user-tagged cards first. `list` is a raw catalog query by desk or category. For briefings, always use `pull`.
- **`card create`** vs **`card image`**: `create` makes the card record. `image` generates art for an existing card. They're separate steps — create first, style second.
- **`card image`** vs **`card regen-image`**: Same command, different name. `regen-image` is an alias for `image` — use either.
- **`briefing validate`** vs **`briefing assemble`**: `validate` is a dry run — checks your items array without creating anything. Use it if you're unsure about format. `assemble` validates AND creates.
- **`desk search`** vs **`desk list`**: `search` is geo-spatial — finds desks near a lat/lon. `list` returns all desks.

## Field Ownership

Profile fields are split between the **user** record and the **boat** record. Using the wrong command silently does nothing — the field just won't update.

**Captain fields** -> `swain user update <userId>`:
captainName, phone, messagingPhone, location, marinaLocation, timezone, interests, favoriteTopics, homeAddress, homeZip, homeCity, homeState, dateOfBirth, householdSize, occupation, experienceLevel, primaryUse, fishingStyle, targetSpecies, typicalCrew, typicalTripDuration, homeWaters, maxWindKnots, maxWaveFeet, minTempF, preferredDeparture, communicationPreference, emergencyContactName, emergencyContactPhone, boatingCertifications, medicalConditions, floatPlanHabits, diyPreference, mechanicalSkillLevel, navigationSkillLevel, preferredWaterways, navigationApps, preferredPartsRetailer, clubMemberships, dietaryPreferences, favoriteWatersideDining, petOnBoard, priorBoatsOwned, onboardingStep, onboardingStatus

**Boat fields** -> `swain boat update <boatId>`:
name, makeModel, year, type, hullType, length, beam, draft, airDraft, engineType, engineMake, engineModel, engineHp, engineCount, fuelType, fuelCapacity, engineHours, purchaseDate, purchasePrice, hasTrailer, hasLoan, insuranceProvider, insurancePremiumAnnual, insuranceExpiry, registrationExpiry, towingMembership, storageType, slipNumber, slipCostMonthly, dockPower, liveaboard, winterStoragePlan, marinaLocation, primaryLaunchRamp, cruisingRadiusMiles, tripsPerMonthEstimate, lastOilChangeHours, lastOilChangeDate, lastBottomPaint, lastHaulOut, serviceProvider, electronics, isPrimary

Note: `marinaLocation` appears on both user and boat. Default to `user update` — it's the captain's home marina. Only use `boat update` for marinaLocation when a captain has multiple boats docked at different marinas and you're recording where a specific boat lives.

---

## Commands

### Users
```bash
swain user list [--limit=<n>] --json
swain user get <userId> --json
swain user update <userId> --field=value --json
swain user onboard-status <userId> [--status=completed] --json
```

### Boats
```bash
swain boat list --user=<userId> --json
swain boat get <boatId> --json
swain boat create --user=<userId> --name=<name> [--makeModel=<mm>] [--year=<y>] --json
swain boat update <boatId> --field=value --json
swain boat delete <boatId> --json
swain boat profile --user=<userId> --json
swain boat photo upload --user=<userId> --url=<url> [--boat=<boatId>] [--caption=<text>] [--primary] --json
swain boat photo list --user=<userId> [--boat=<boatId>] --json
swain boat photo delete <photoId> --json
```

**Profile** returns combined owner+boat data with completeness score, known/unknown fields, and tier.

### Cards
```bash
swain card pull --user=<userId> [--exclude-served] [--category=<cat>] [--limit=<n>] --json
swain card list [--desk=<desk>] [--category=<cat>] [--limit=<n>] --json
swain card list-today --json
swain card get <cardId> --json
swain card create --desk=<desk> --title=<text> --subtext=<text> --content=<md> [options] --json
swain card update <cardId> [--title=<text>] [--subtext=<text>] [--content=<md>] [--image=<url>] [--bg-color=<hex>] [--style-id=<id>] [--category=<cat>] [--desk=<name>] [--freshness=<type>] [--expires-at=<date>] --json
swain card image <cardId> --prompt="..." [--style=<id>] [--aspect-ratio=<ratio>] [--resolution=<res>] [--bg-color=<hex>] --json
swain card verify <cardId> [<cardId> ...] --json
swain card check --desk=<name> [--date=YYYY-MM-DD] --json
swain card archive <cardId> --json
swain card unarchive <cardId> --json
swain card audit [--agent=<id>] [--location=<loc>] --json
swain card coverage [--desk=<desk>] --json
swain card boat-art --user=<userId> [--best] [--style=<id>] [--sampler] --json
```

- **pull** ranks cards for a specific user. Use for briefings.
- **list-today** shows all cards created today. Useful for checking your own output.
- **update** patches any subset of card fields. Only sends what you pass.
- **verify** checks that cards have both `image` and `backgroundColor` set. Returns `allPass: true/false`. Use before briefing assembly.
- **check** tests if a card exists for a desk on a given date. Defaults to today.
- **archive / unarchive** soft-archives or restores a card.
- **audit** finds cards with issues: missing location, missing style, expired-but-active, missing image.

### Boat Art (generate + save)
```bash
swain boat-art create --user=<userId> [--best] [--style=<id>] --json
swain boat-art list --user=<userId> --json
```
`create` generates art AND saves it as a boatArt record with a shareable URL (`heyswain.com/art/{artId}`). Use this when a captain requests art outside of briefings.

### Briefings
```bash
swain briefing previous --user=<userId> --json
swain briefing assemble --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--force] --json
swain briefing validate --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] --json
swain briefing history --user=<userId> [--days=<n>] --json
swain briefing list [--user=<userId>] [--limit=<n>] --json
swain briefing get <briefingId> --json
swain briefing delete <briefingId> --confirm --json
```

**Assemble and validate** run local schema validation before hitting the API. Malformed items fail instantly with fix-it messages.

### Agents & Advisors
```bash
swain agent list [--type=<type>] --json
swain agent get <agentId> --json
swain advisor list --json
swain advisor delete <agentId> --json
```

### Desks
```bash
swain desk list --json
swain desk get <name> --json
swain desk create --name=<slug> --region=<description> [--lat=N] [--lon=N] [--scope="..."] --json
swain desk update <name> [--status=<s>] [--microlocations='[...]'] [--marinas='[...]'] [--topics='[...]'] [--scope="..."] --json
swain desk delete <name> --json
swain desk pause <name> --json
swain desk unpause <name> --json
swain desk search --lat=N --lon=N [--radius=50] --json
swain desk request --desk=<name> --topic="..." --category=<cat> [--user=<userId>] --json
swain desk requests --desk=<name> [--status=pending] --json
swain desk fulfill --desk=<name> --request=<id> --card=<cardId> --json
```

- **get** returns full desk metadata: region, scope, coordinates, bounds, microlocations, marinas, topics, card/user counts.
- **pause / unpause** suspends or restores a desk's crons without deleting it.
- **search** finds desks near coordinates within a radius (default 50 miles).
- **request** files an editorial signal — tells a desk "captains care about this topic."
- **requests** lists pending editorial requests for a desk.
- **fulfill** marks a request as fulfilled by linking it to a card.

### Flyers
```bash
swain flyer batch --user=<userId> --date=<YYYY-MM-DD> --flyers='<json>' [--dry-run] --json
swain flyer list [--user=<userId>] [--status=<status>] [--date=<YYYY-MM-DD>] [--limit=<n>] --json
swain flyer run-start --user=<userId> --date=<YYYY-MM-DD> --agent=<agentId> [--meta='<json>'] --json
swain flyer run-update <runId> --status=<completed|failed> [--flyer-count=<n>] [--error="<msg>"] --json
```

- **batch** creates flyers for a user. `--flyers` is a JSON array of `{ imageUrl, meta: { title, category, ... } }`. Max 50. Array order = display order. Use `--dry-run` to validate locally without submitting.
- **list** queries existing flyers. Filter by user, status, date.
- **run-start** logs the beginning of a generation run for observability.
- **run-update** marks a run completed or failed.

### Knowledge
```bash
swain knowledge ask "question" [--boat=<boatId>] [--limit=5] [--threshold=0.3] --json
swain knowledge store --boat=<boatId> --content="text" [--dimension=<dim>] [--category=<cat>] [--session=<id>] [--prompt=<id>] [--wave=N] --json
swain knowledge list [--boat=<boatId>] [--dimension=<dim>] [--category=<cat>] [--limit=20] --json
swain knowledge stats [--boat=<boatId>] --json
swain knowledge init --json
```

- **ask** performs semantic search — embeds your question via Gemini, queries the local Stoolap vector DB, returns ranked results with relevance scores. Use before generating scan scripts, during heartbeats, or when your captain asks about their boat.
- **store** embeds text content via Gemini and stores it in the knowledge DB. Auto-initializes the DB on first use.
- **list** browses entries by boat, dimension, or category. No embedding needed — this is a metadata/content browse.
- **stats** shows counts by dimension, category, and boat. Quick way to check knowledge coverage.
- **init** creates the knowledge DB and schema. Also runs automatically on first `store`.

Categories: `scan_extraction` (default), `visual_assessment`, `captain_observation`, `captain_preference`, `research`, `maintenance_note`.

Requires `GEMINI_API_KEY` environment variable for embedding operations (`ask` and `store`).

### Scan Sessions
```bash
swain scan sessions --user=<userId> [--boat=<boatId>] [--dimension=<dim>] --json
swain scan session-get --session=<sessionId> --json
swain scan session-update --session=<sessionId> --status=<s> [--current-wave=N] [--advisor-summary="..."] [--debrief-audio-url=<url>] [--debrief-summary="..."] [--greeting="..."] [--greeting-audio-url=<url>] --json
swain scan captures --session=<sessionId> [--wave=N] [--unprocessed] --json
swain scan capture-update <captureId> --processed [--transcription="..."] --json
swain scan clips --session=<sessionId> [--wave=N] --json
swain scan clips-post --session=<sessionId> --wave=N --clips='<json>' --json
swain scan audio-upload --session=<sessionId> --clip=<clipId> [--url=<sourceUrl>] [--format=mp3] --json
swain scan initialize --user=<userId> --boat=<boatId> --json
swain scan generate-wave --session=<sessionId> --wave=N --json
swain scan generate-debrief --session=<sessionId> --json
```

- **sessions** lists all scan sessions for a user, optionally filtered by boat or dimension.
- **session-get** returns full session state including status, current wave, and summaries.
- **session-update** patches session fields — status, currentWave, advisorSummary, debriefAudioUrl, debriefSummary, greeting, greetingAudioUrl. Greeting fields are for the first session only (boat_itself wave 1).
- **captures** lists captures for a session. Use `--unprocessed` to get only unprocessed captures for batch processing.
- **capture-update** marks a capture as processed and optionally sets transcription text.
- **clips** lists audio clips. Filter by wave with `--wave`.
- **clips-post** posts a batch of generated audio clips. `--clips` is a JSON array of `{ clipType, script, audioUrl, sortOrder, promptId?, captureType?, instructionTitle?, instructionDetail?, durationMs? }`. Validates locally before posting.
- **audio-upload** uploads TTS audio to R2. With `--url`: server downloads and uploads, returns `{ audioUrl }`. Without `--url`: returns `{ uploadUrl, audioUrl, method: "PUT" }` for direct upload.
- **initialize** kicks off the scan progression for a user/boat. Creates the first session (`boat_itself`), sets status to `generating`, and sends `generate_wave` to the advisor.
- **generate-wave** and **generate-debrief** are testing triggers — they hit the Convex trigger endpoint which messages the advisor agent.

### Styles & Images
```bash
swain style list --json
swain style get <styleId> --json
swain image generate "prompt" [--style=<id>] [--aspect-ratio=<ratio>] [--resolution=<res>] [--mode=flyer] --json
swain image upload --url=<imageUrl> [--filename=<name>] --json
```

**Image upload** fetches from any URL (or local file with `--file`), uploads to Cloudflare via the server, and returns a public `imagedelivery.net` URL. Use this for any image that needs a permanent CDN URL.

**`--mode=flyer`** switches from photo-style generation to designed promotional graphics. Use for flyers — produces bold headlines, color blocks, and layout elements instead of "no text" photography.

### Setup & Skills
```bash
swain setup [--dir=<path>] --json
swain skill list --json
swain skill show <name> --json
swain update check --json
```

---

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SWAIN_API_URL` | Override API URL (default: prod Convex) |
| `SWAIN_API_TOKEN` | Admin token for authenticated access |
| `GEMINI_API_KEY` | Google Gemini API key (required for `knowledge ask` and `knowledge store`) |

- Prod: `https://wandering-sparrow-224.convex.site`
- Dev: Override with `SWAIN_API_URL`
