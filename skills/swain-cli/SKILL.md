---
name: swain-cli
description: Swain CLI command reference for cards, briefings, users, boats, and agents.
metadata: { "openclaw": { "emoji": "💻", "requires": { "bins": ["swain"] } } }
---

# Swain CLI Reference

The `swain` CLI connects to the Swain Convex API.

## Commands

### Boats
```bash
swain boat list --user=<userId> [--json]
swain boat get <boatId> [--json]
swain boat create --user=<userId> --name=<name> [--makeModel=<mm>] [--year=<y>] [--json]
swain boat update <boatId> --field=value [--json]
swain boat delete <boatId> [--json]
swain boat profile --user=<userId> [--json]
swain boat photo upload --user=<userId> --url=<url> [--boat=<boatId>] [--caption=<text>] [--primary] [--json]
swain boat photo list --user=<userId> [--boat=<boatId>] [--json]
swain boat photo delete <photoId> [--json]
```

**Profile** returns combined owner+boat data with completeness score, known/unknown fields, and tier.

**Boat update fields:** name, makeModel, year, type, hullType, length, beam, draft,
airDraft, engineType, engineMake, engineModel, engineHp, engineCount, fuelType,
fuelCapacity, engineHours, purchaseDate, purchasePrice, hasTrailer, hasLoan,
insuranceProvider, insurancePremiumAnnual, insuranceExpiry, registrationExpiry,
towingMembership, storageType, slipNumber, slipCostMonthly, dockPower, liveaboard,
winterStoragePlan, marinaLocation, primaryLaunchRamp, cruisingRadiusMiles,
tripsPerMonthEstimate, lastOilChangeHours, lastOilChangeDate, lastBottomPaint,
lastHaulOut, serviceProvider, electronics, isPrimary

### Users
```bash
swain user list [--limit=<n>] [--json]
swain user get <userId> [--json]
swain user update <userId> --field=value [--json]
swain user onboard-status <userId> [--status=completed] [--json]

```

**User update fields:** captainName, phone, messagingPhone, location, marinaLocation,
timezone, interests, favoriteTopics, homeAddress, homeZip, homeCity, homeState,
dateOfBirth, householdSize, occupation, experienceLevel, primaryUse, fishingStyle,
targetSpecies, typicalCrew, typicalTripDuration, homeWaters, maxWindKnots, maxWaveFeet,
minTempF, preferredDeparture, communicationPreference, emergencyContactName,
emergencyContactPhone, boatingCertifications, medicalConditions, floatPlanHabits,
diyPreference, mechanicalSkillLevel, navigationSkillLevel, preferredWaterways,
navigationApps, preferredPartsRetailer, clubMemberships, dietaryPreferences,
favoriteWatersideDining, petOnBoard, priorBoatsOwned, onboardingStep, onboardingStatus

### Cards
```bash
swain card pull --user=<userId> [--exclude-served] [--category=<cat>] [--limit=<n>] [--json]
swain card list [--desk=<desk>] [--category=<cat>] [--limit=<n>] [--json]
swain card get <cardId> [--json]
swain card library --user=<userId> [--json]
swain card create --desk=<desk> --title=<text> --subtext=<text> --content=<md> [options] [--json]
swain card image <cardId> --prompt="..." [--style=<id>] [--bg-color=<hex>] [--json]
swain card boat-art --user=<userId> [--best] [--style=<id>] [--sampler] [--json]
swain card coverage [--desk=<desk>] [--json]
```

### Boat Art (generate + save)
```bash
swain boat-art create --user=<userId> [--best] [--style=<id>] [--json]
swain boat-art list --user=<userId> [--json]
```
`create` generates art AND saves it as a boatArt record with a shareable URL (`heyswain.com/art/{artId}`). Use this when a captain requests art outside of briefings.

### Briefings
```bash
swain briefing previous --user=<userId> [--json]
swain briefing assemble --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--force] [--json]
swain briefing validate --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--json]
swain briefing history --user=<userId> [--days=<n>] [--json]
swain briefing list [--user=<userId>] [--limit=<n>] [--json]
swain briefing get <briefingId> [--json]
swain briefing delete <briefingId> --confirm [--json]
```

**Assemble and validate** run local schema validation before hitting the API.
Malformed items fail instantly with fix-it messages.

### Agents
```bash
swain agent list [--type=<type>] [--json]
swain agent get <agentId> [--json]
```

### Advisors
```bash
swain advisor list [--json]
swain advisor delete <agentId> [--json]
```

### Desks
```bash
swain desk list [--json]
swain desk create --name=<slug> --region=<description> [--json]
swain desk delete <name> [--json]
```

### Styles & Images
```bash
swain style list [--json]
swain style get <styleId> [--json]
swain image generate "prompt" [--style=<id>] [--json]
swain image upload --url=<imageUrl> [--filename=<name>] [--json]
```

**Image upload** fetches from any URL (or local file with `--file`), uploads to Cloudflare via the server, and returns a public `imagedelivery.net` URL. Use this for any image that needs a permanent CDN URL.

## Environment

- `SWAIN_API_URL` — Override API URL
- `SWAIN_API_TOKEN` — Admin token for authenticated access
- Prod: `https://wandering-sparrow-224.convex.site`
- Dev: `https://calm-basilisk-210.convex.site`

## JSON Output

All commands support `--json` for machine-readable output. Always use `--json` when
parsing output programmatically.
