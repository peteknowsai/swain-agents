# Profile Reference

Detailed technical reference for captain and boat profile management. The SKILL.md has the principles — this has the complete field lists, PCS tiers, and update workflows.

## Reading Profile Data

### Full profile with completeness score
```bash
swain boat profile --user=<userId> --json
```
Returns: `pcs` (percentage), `knownCount`, `unknownCount`, and list of `unknown` fields.

### Just the user record
```bash
swain user get <userId> --json
```

### Just the boat
```bash
swain boat get <boatId> --json
```

### Get boat ID
```bash
swain boat list --user=<userId> --json
```

---

## Writing Profile Data

### Captain-level fields
```bash
swain user update <userId> --fieldName=value --json
```

### Boat-level fields
```bash
swain boat update <boatId> --fieldName=value --json
```

Multiple fields in one command:
```bash
swain user update <userId> --typicalCrew=family --petOnBoard=true --json
```

---

## Captain Field Reference

### Basics
| Field | Description |
|---|---|
| `captainName` | Display name |
| `phone` | Phone number |
| `location` | General location |
| `marinaLocation` | Specific marina or harbor |
| `timezone` | Captain's timezone |
| `interests` | General boating interests |
| `homeWaters` | Primary boating area |

### Identity
| Field | Description |
|---|---|
| `homeAddress` | Street address |
| `homeZip` | ZIP code |
| `homeCity` | City |
| `homeState` | State |
| `dateOfBirth` | Date of birth |
| `householdSize` | Number of people in household |
| `occupation` | What they do for work |

### Experience
| Field | Description |
|---|---|
| `experienceLevel` | Novice, intermediate, experienced, expert |
| `primaryUse` | fishing, cruising, sailing, watersports, diving, liveaboard, mixed |
| `fishingStyle` | Inshore, offshore, fly, trolling, etc. |
| `targetSpecies` | Fish species they target |
| `typicalCrew` | solo, couple, family, friends, mixed |
| `typicalTripDuration` | How long they usually go out |

### Weather Comfort
| Field | Description |
|---|---|
| `maxWindKnots` | Max comfortable wind speed |
| `maxWaveFeet` | Max comfortable wave height |
| `minTempF` | Minimum comfortable temperature |
| `preferredDeparture` | Typical departure time |

### Safety
| Field | Description |
|---|---|
| `communicationPreference` | How they prefer to be contacted |
| `emergencyContactName` | Emergency contact name |
| `emergencyContactPhone` | Emergency contact phone |
| `boatingCertifications` | Any certifications held |
| `medicalConditions` | Relevant medical info |
| `floatPlanHabits` | Whether they file float plans |

### Skills
| Field | Description |
|---|---|
| `diyPreference` | How much they do themselves vs. hire out |
| `mechanicalSkillLevel` | Mechanical aptitude |
| `navigationSkillLevel` | Navigation competency |
| `preferredWaterways` | ICW, open water, lakes, rivers, etc. |
| `navigationApps` | Navionics, Garmin, etc. |

### Lifestyle
| Field | Description |
|---|---|
| `preferredPartsRetailer` | Where they buy parts |
| `clubMemberships` | Yacht clubs, fishing clubs, etc. |
| `dietaryPreferences` | For restaurant/provisioning recommendations |
| `favoriteWatersideDining` | Known favorite restaurants |
| `petOnBoard` | Whether they bring pets |
| `priorBoatsOwned` | Previous boats |

### Onboarding & System
| Field | Description |
|---|---|
| `onboardingStep` | contacting, building_briefing, done |
| `onboardingStatus` | completed |
| `desk` | Assigned content desk slug |
| `microlocation` | Specific spot within desk region |
| `mobility` | fixed, trailerable, coastal_cruising |
| `watercraft-context` | Contextual notes about their boating setup |
| `raw-location-input` | What the captain actually said about their location |

---

## Boat Field Reference

### Identity
| Field | Description |
|---|---|
| `name` | Boat name |
| `makeModel` | Make and model (e.g., "Boston Whaler 280 Outrage") |
| `year` | Model year |
| `type` | Boat type (center console, sailboat, trawler, etc.) |
| `hullType` | Hull construction type |
| `hullId` | HIN (hull identification number) |

### Specs
| Field | Description |
|---|---|
| `length` | Overall length |
| `beam` | Width |
| `draft` | How deep it sits |
| `airDraft` | Height above waterline (bridge clearance) |

### Engine
| Field | Description |
|---|---|
| `engineType` | Outboard, inboard, sterndrive, etc. |
| `engineMake` | Manufacturer (Yamaha, Mercury, etc.) |
| `engineModel` | Specific model |
| `engineHp` | Horsepower per engine |
| `engineCount` | Number of engines |
| `fuelType` | Gas, diesel |
| `fuelCapacity` | Tank size in gallons |
| `engineHours` | Current engine hours |

### Ownership
| Field | Description |
|---|---|
| `purchaseDate` | When they bought it |
| `purchasePrice` | What they paid |
| `hasTrailer` | Whether they have a trailer |
| `hasLoan` | Whether there's a loan |

### Insurance
| Field | Description |
|---|---|
| `insuranceProvider` | Insurance company |
| `insurancePremiumAnnual` | Annual premium |
| `insuranceExpiry` | When policy expires |
| `registrationExpiry` | When registration expires |
| `towingMembership` | TowBoatUS, SeaTow, etc. |

### Storage
| Field | Description |
|---|---|
| `storageType` | wet_slip, dry_stack, trailer, mooring |
| `slipNumber` | Slip or dock number |
| `slipCostMonthly` | Monthly slip/storage cost |
| `dockPower` | Available shore power (30A, 50A, etc.) |
| `liveaboard` | Whether they live on the boat |
| `winterStoragePlan` | What they do for winter |
| `marinaLocation` | Marina name |

### Maintenance
| Field | Description |
|---|---|
| `lastOilChangeHours` | Engine hours at last oil change |
| `lastOilChangeDate` | Date of last oil change |
| `lastBottomPaint` | Date of last bottom paint |
| `lastHaulOut` | Date of last haul-out |
| `serviceProvider` | Preferred mechanic/service shop |

### Usage
| Field | Description |
|---|---|
| `primaryLaunchRamp` | For trailerable boats, usual ramp |
| `cruisingRadiusMiles` | Typical range from home base |
| `tripsPerMonthEstimate` | How often they go out |

---

## Profile Completeness Score (PCS)

| Tier | PCS Range | Agent Mode | Focus |
|---|---|---|---|
| 1 | 0-25% | **Learning** | Solve problems, capture foundational data. P1 fields. |
| 2 | 25-50% | **Proactive** | Make suggestions using partial knowledge, fill gaps. Shift to P2. |
| 3 | 50-75% | **Predictive** | Maintenance reminders, trip planning, seasonal prep. |
| 4 | 75-100% | **Co-captain** | Deep personalization, anticipatory service. P3 comes naturally. |

**Never reveal PCS to the captain.** No "Your profile is 43% complete!" — that's platform language.

---

## Priority Levels

### P1 — Critical (Tier 1 focus)
Boat name, make/model, engine info, marina, primary use, experience level, DIY preference, insurance, towing membership, emergency contact

### P2 — Proactive (Tier 2 focus)
Home address, crew patterns, seasonal patterns, maintenance history, weather comfort, favorite destinations, communication preference

### P3 — Premium (comes naturally over time)
Income signals, club memberships, bucket list, dietary preferences, prior boats

---

## Dual Storage Workflow

Profile data lives in two places — always update both:

1. **Convex** (structured, system-wide): `swain user update` / `swain boat update` — powers the app, briefings, recommendations
2. **Local memory** (rich context): `.claude/memory/` — personality, nuance, stories, context that doesn't fit structured fields

### Example

Captain says: "Yeah we're heading to Peanut Island, just me and my wife and the dog."

**Convex update:**
```bash
swain user update <userId> --typicalCrew=family --petOnBoard=true --json
```

**Memory update:** Write to `.claude/memory/captain.md`: "Trip to Peanut Island with wife and dog. Peanut Island is a favorite destination."

---

## Heartbeat Profile Check

During heartbeats, review the profile:

1. Run `swain boat profile --user=<userId> --json` to check PCS
2. Look at the `unknown` list — pick 2-3 P1/P2 fields to naturally pursue next
3. Think about which conversations would reveal those fields
4. If recent conversations revealed data you didn't capture yet, update now

---

## Example Update Sequences

### After learning about their marina and boating style
```bash
swain user update <userId> --marinaLocation='Tierra Verde Marina' --primaryUse=fishing --experienceLevel=experienced --json
swain boat update <boatId> --storageType=wet_slip --slipNumber=A42 --json
```

### After a conversation about their typical trips
```bash
swain user update <userId> --typicalCrew=couple --typicalTripDuration='half day' --maxWindKnots=20 --json
swain boat update <boatId> --cruisingRadiusMiles=25 --tripsPerMonthEstimate=8 --json
```

### After they mention maintenance details
```bash
swain boat update <boatId> --engineHours=450 --lastOilChangeHours=400 --serviceProvider='Bay Marine Service' --json
```

### After they share safety info
```bash
swain user update <userId> --emergencyContactName='Sarah' --emergencyContactPhone='+15551234567' --towingMembership='TowBoatUS' --json
```
