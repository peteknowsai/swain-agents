# Swain CLI Command Reference

## Users
```bash
swain user list [--limit=<n>] --json
swain user get <userId> --json
swain user update <userId> --field=value --json
swain user onboard-status <userId> [--status=completed] --json
```

## Boats
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

## Cards
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

## Boat Art
```bash
swain boat-art create --user=<userId> [--best] [--style=<id>] --json
swain boat-art list --user=<userId> --json
```
`create` generates art AND saves it as a boatArt record with a shareable URL (`heyswain.com/art/{artId}`).

## Briefings
```bash
swain briefing previous --user=<userId> --json
swain briefing assemble --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] [--force] --json
swain briefing validate --user=<userId> --items='<json>' [--date=<YYYY-MM-DD>] --json
swain briefing history --user=<userId> [--days=<n>] --json
swain briefing list [--user=<userId>] [--limit=<n>] --json
swain briefing get <briefingId> --json
swain briefing delete <briefingId> --confirm --json
```

## Agents & Advisors
```bash
swain agent list [--type=<type>] --json
swain agent get <agentId> --json
swain advisor list --json
swain advisor delete <agentId> --json
```

## Desks
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

## Flyers
```bash
swain flyer batch --user=<userId> --date=<YYYY-MM-DD> --flyers='<json>' [--dry-run] --json
swain flyer list [--user=<userId>] [--status=<status>] [--date=<YYYY-MM-DD>] [--limit=<n>] --json
```

## Knowledge
```bash
swain knowledge ask "question" [--boat=<boatId>] [--limit=5] [--threshold=0.3] --json
swain knowledge store --boat=<boatId> --content="text" [--dimension=<dim>] [--category=<cat>] --json
swain knowledge list [--boat=<boatId>] [--dimension=<dim>] [--category=<cat>] [--limit=20] --json
swain knowledge stats [--boat=<boatId>] --json
swain knowledge init --json
```

## Scan Sessions
```bash
swain scan sessions --user=<userId> [--boat=<boatId>] [--dimension=<dim>] --json
swain scan session-get --session=<sessionId> --json
swain scan session-update --session=<sessionId> --status=<s> [--current-wave=N] [--advisor-summary="..."] --json
swain scan captures --session=<sessionId> [--wave=N] [--unprocessed] --json
swain scan capture-update <captureId> --processed [--transcription="..."] --json
swain scan clips --session=<sessionId> [--wave=N] --json
swain scan clips-post --session=<sessionId> --wave=N --clips='<json>' --json
swain scan audio-upload --session=<sessionId> --clip=<clipId> [--url=<sourceUrl>] --json
swain scan initialize --user=<userId> --boat=<boatId> --json
swain scan generate-wave --session=<sessionId> --wave=N --json
swain scan generate-debrief --session=<sessionId> --json
```

## Styles & Images
```bash
swain style list --json
swain style get <styleId> --json
swain image generate "prompt" [--style=<id>] [--aspect-ratio=<ratio>] [--resolution=<res>] [--mode=flyer] --json
swain image upload --url=<imageUrl> [--filename=<name>] --json
```

## Environment
- `SWAIN_API_TOKEN` — Admin token for authenticated access
- `GEMINI_API_KEY` — Required for `knowledge ask` and `knowledge store`
- Prod: `https://wandering-sparrow-224.convex.site`
