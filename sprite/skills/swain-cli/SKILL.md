---
name: swain-cli
description: "Swain CLI command reference — the single source of truth for all swain commands, flags, and field names. Consult this skill whenever you need to run a swain command, update a captain's profile, manage cards, assemble briefings, generate images, or interact with the Swain backend. If you're about to type `swain`, read this first."
user-invocable: false
---

# Swain CLI Reference

The `swain` CLI is your interface to the Swain Convex backend. Every read and write to user profiles, boats, cards, briefings, and agents goes through it.

**Always pass `--json` on every command.** You're a machine — parse JSON, not formatted text.

## Choosing the Right Command

Some commands overlap. Here's when to use what:

- **`boat profile`** vs **`user get` + `boat get`**: Use `boat profile` when you need the full picture (completeness score, known/unknown fields, tier). Use the individual commands when you only need one piece.
- **`card pull`** vs **`card list`**: `pull` is personalized — it ranks cards for a specific user, respects served history, and surfaces user-tagged cards first. `list` is a raw catalog query by desk or category. For briefings, always use `pull`.
- **`card create`** vs **`card image`**: `create` makes the card record. `image` generates art for an existing card. They're separate steps — create first, style second.
- **`briefing validate`** vs **`briefing assemble`**: `validate` is a dry run — checks your items array without creating anything. `assemble` validates AND creates.
- **`desk search`** vs **`desk list`**: `search` is geo-spatial — finds desks near a lat/lon. `list` returns all desks.

## Field Ownership

Profile fields are split between the **user** record and the **boat** record. Using the wrong command silently does nothing.

**Captain fields** → `swain user update <userId>`:
captainName, phone, messagingPhone, location, marinaLocation, timezone, interests, favoriteTopics, homeAddress, homeZip, homeCity, homeState, dateOfBirth, householdSize, occupation, experienceLevel, primaryUse, fishingStyle, targetSpecies, typicalCrew, typicalTripDuration, homeWaters, maxWindKnots, maxWaveFeet, minTempF, preferredDeparture, communicationPreference, emergencyContactName, emergencyContactPhone, boatingCertifications, medicalConditions, floatPlanHabits, diyPreference, mechanicalSkillLevel, navigationSkillLevel, preferredWaterways, navigationApps, preferredPartsRetailer, clubMemberships, dietaryPreferences, favoriteWatersideDining, petOnBoard, priorBoatsOwned, onboardingStep, onboardingStatus

**Boat fields** → `swain boat update <boatId>`:
name, makeModel, year, type, hullType, length, beam, draft, airDraft, engineType, engineMake, engineModel, engineHp, engineCount, fuelType, fuelCapacity, engineHours, purchaseDate, purchasePrice, hasTrailer, hasLoan, insuranceProvider, insurancePremiumAnnual, insuranceExpiry, registrationExpiry, towingMembership, storageType, slipNumber, slipCostMonthly, dockPower, liveaboard, winterStoragePlan, marinaLocation, primaryLaunchRamp, cruisingRadiusMiles, tripsPerMonthEstimate, lastOilChangeHours, lastOilChangeDate, lastBottomPaint, lastHaulOut, serviceProvider, electronics, isPrimary

Note: `marinaLocation` appears on both user and boat. Default to `user update` — it's the captain's home marina. Only use `boat update` when a captain has multiple boats docked at different marinas.

## Commands

For the full command reference, see [reference.md](reference.md).
