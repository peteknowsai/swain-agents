# wacli — WhatsApp CLI

Send WhatsApp messages using the `wacli` CLI.

## Sending Text Messages

```bash
wacli send text --to <phone>@s.whatsapp.net --message "Your message here" --json
```

**Phone format:** Strip the `+` from E.164, add `@s.whatsapp.net`:
- `+12025550123` → `12025550123@s.whatsapp.net`
- `+12025550199` → `12025550199@s.whatsapp.net`

**Always use `--json`** for parseable output:
```json
{"success":true,"data":{"id":"3EB0...","sent":true,"to":"12025550123@s.whatsapp.net"},"error":null}
```

## Sending Files / Images

```bash
# Image with caption
wacli send file --to 12025550123@s.whatsapp.net --file /path/to/image.jpg --caption "Check this out" --json

# File with custom display name
wacli send file --to 12025550123@s.whatsapp.net --file /tmp/report.pdf --filename "Report.pdf" --json
```

## Sending to Groups

Use the group JID (ends in `@g.us`):
```bash
wacli send text --to 120363422658195199@g.us --message "Hey everyone" --json
```

## Key Points

- wacli sends do NOT end your agent turn — use it freely mid-turn
- Always use `--json` so you can check `success` in the response
- Phone numbers: strip the `+`, append `@s.whatsapp.net`
