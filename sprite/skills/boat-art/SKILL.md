---
name: boat-art
description: "Generate personalized boat art for captains — their boat rendered in 30 different art styles. Use whenever building a briefing (every briefing gets one), when a captain requests art, or during onboarding to create the first wow moment."
---

# Boat Art

Every captain gets a new piece of art featuring their boat, every day. This is a signature Swain feature.

## Two Ways to Create

### In Briefings (daily)
```bash
swain card boat-art --user=<userId> --json          # random style
swain card boat-art --user=<userId> --best --json    # best for boat type
```
Use `image`, `styleName`, `boatName` from the result to build a `boat_art` briefing item. The backend creates the art record during assembly.

### On Demand
When a captain asks — "hey can you make me a pop art version?"
```bash
swain boat-art create --user=<userId> --style=pop-art --json
```
Returns `artId`, `image`, `styleName`, `boatName`, `shareUrl`. Send the image to the captain with the share URL.

## How It Works

- **With boat photo on file** — image-to-image restyling. Boat stays recognizable.
- **Without photo** — generated from text description of boat name/type/model. Still good, but a real photo is dramatically better.

## Getting a Boat Photo

Ask during onboarding or in the first briefing: "Got a pic of your boat? I use it to make custom art for you every day."

When they send one, save it immediately:
```bash
swain boat photo upload --user=<userId> --url=<photo_path> --primary --json
```
Do this BEFORE generating art — otherwise it uses text prompts instead of the actual photo.

## Available Styles

For the complete style catalog, see [reference.md](reference.md).

## Shareable URLs

Every piece gets a shareable URL: `https://www.heyswain.com/art/{artId}`
```bash
swain boat-art list --user=<userId> --json    # see all art for a captain
```
