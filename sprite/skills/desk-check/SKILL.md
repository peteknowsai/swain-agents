---
name: desk-check
description: "Verify the captain's content desk exists. If it's missing, create it from the captain's location data. Safety net for failed desk creation during onboarding."
---

# Desk Check

Quick verification that your captain's content desk actually exists. This runs daily
as a safety net — most of the time it's a no-op.

## Steps

1. Get your captain's profile:
   ```bash
   swain user get <userId> --json
   ```

2. Check the `desk` field. If it's empty or missing, stop — onboarding isn't complete yet.

3. Verify the desk exists:
   ```bash
   swain desk get <deskName> --json
   ```

4. **If the desk exists** — done. No action needed.

5. **If the desk doesn't exist** (404 or error) — create it:

   Resolve the captain's marina to coordinates:
   ```bash
   goplaces resolve '<marinaLocation from profile>' --limit=1 --json
   ```

   Create the desk using the captain's location data:
   ```bash
   swain desk create --name=<deskName> --region='<region from location>' \
     --lat=<lat> --lon=<lon> \
     --scope='<natural boating boundary description>' \
     --created-by-location='<marinaLocation>' --json
   ```

   Verify creation succeeded — output must contain `"status": "assigned"`.

   If creation fails, log the error but do not change the captain's desk assignment.
   The desk-check will retry tomorrow.
