# Tools Reference

## Skip CLI

The `swain` CLI connects to the Swain API server for all data operations. Always use `--json` for programmatic output.

### Users
```bash
# Get user profile (name, boat, location, interests, etc.)
swain user get <userId> --json

# Update user profile — use this to save what you learn in conversation
swain user update <userId> --field=value [--field=value ...] --json

# Updatable fields:
#   --boatName="Reel Therapy"
#   --boatMakeModel="Boston Whaler 330 Outrage"
#   --boatYear="2024"
#   --location="Fort Lauderdale, FL"          (free text, human-readable)
#   --marinaLocation="fort-lauderdale"         (slug, validated against known locations)
#   --experienceLevel="beginner|intermediate|experienced"
#   --primaryUse="fishing,cruising,diving"     (comma-separated)
#   --fishingStyle="inshore|offshore|both"
#   --targetSpecies="snook,redfish,mahi"       (comma-separated)
#   --typicalCrew="family|solo|friends|mixed"
#   --typicalTripDuration="half-day|full-day|overnight|weekend"
#   --homeWaters="Biscayne Bay"
#   --interests="fishing,weather,dining,events" (comma-separated)
#   --boatLength=33
#   --boatType="center-console|bowrider|pontoon|sailboat|cabin-cruiser|skiff|catamaran"
#   --engineType="outboard|inboard|sterndrive|jet"
#   --fuelType="gas|diesel"
#   --hasTrailer=true
#   --timezone="America/New_York"

# Upload boat image (from URL or file)
swain user upload-boat-image <userId> --url=<imageUrl> --json
swain user upload-boat-image <userId> --file=<path> --json
```

**Important:** The server profile powers card selection and briefing personalization. During onboarding, batch all updates — save everything to memory as you learn it, then do one big `swain user update` call with all fields when you build the first briefing. After onboarding, update the server whenever you learn something new.

### Card Library
```bash
# Browse available cards for a user (fresh + resurfaced)
swain card pull --user=<userId> --exclude-served --json

# Get a specific card's full details
swain card get <cardId> --json
```

### Briefings
```bash
# Check yesterday's briefing (avoid repeats)
swain briefing previous --user=<userId> --json

# Assemble a briefing from selected cards
swain briefing assemble --user=<userId> --items='<json_array>' [--force] --json

# List recent briefings
swain briefing list --user=<userId> --json

# Get briefing details
swain briefing get <briefingId> --json
```

## Key Patterns

### Save What You Learn
After onboarding, update the server when you learn new info:
```bash
swain user update <userId> --marinaLocation=fort-lauderdale --location="Fort Lauderdale, FL" --json
swain user update <userId> --primaryUse=fishing --fishingStyle=offshore --json
swain user update <userId> --boatYear="2024" --hasTrailer=true --json
```
During onboarding, batch all updates into one call when building the first briefing.

### Valid Marina Locations
The `--marinaLocation` field is validated. If unsure which slug to use, try it — the error message will list all valid options.
