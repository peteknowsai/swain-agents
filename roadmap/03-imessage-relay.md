# Part 3: iMessage Relay

## Goal

Wire up a Mac mini running BlueBubbles so that iMessages flow into Bridge and replies flow back to iMessage. End-to-end text messaging works.

## What Gets Built

**On the Mac mini:**
- BlueBubbles installed + configured with Private API (SIP disabled)
- Dedicated Apple ID signed in to Messages.app
- Phone number registered with Apple ID
- Cloudflare tunnel (`cloudflared`) exposing BlueBubbles API to the internet
- BlueBubbles webhook configured to POST to Bridge

**In Bridge (additions):**
```
bridge/
  lib/
    bluebubbles.ts            # BlueBubbles REST API client
  routes/
    webhooks.ts               # Flesh out POST /webhooks/bluebubbles
```

**BlueBubbles client (`bluebubbles.ts`):**
- `sendMessage(phone, text)` — send iMessage to a phone number
- `sendImage(phone, url, caption?)` — send image via iMessage
- `startTyping(chatGuid)` / `stopTyping(chatGuid)` — typing indicators
- Phone number normalization (handle +1, spaces, dashes)

## How It Works

**Inbound:**
1. Someone texts the Mac mini's iMessage number
2. BlueBubbles fires webhook to `https://{tunnel}.cfargotunnel.com/webhooks/bluebubbles`
3. Cloudflare tunnel routes to Bridge on Fly
4. Bridge extracts sender phone + message text from BlueBubbles payload
5. Bridge looks up phone → spriteId, wakes Sprite if needed
6. Bridge POSTs message to Sprite's channel server
7. Returns 200 to BlueBubbles

**Outbound:**
1. Sprite calls `reply("text")` MCP tool
2. Channel server POSTs to Bridge: `POST /sprites/:spriteId/reply`
3. Bridge looks up spriteId → phone
4. Bridge calls BlueBubbles API: `POST /api/v1/message/text`
5. BlueBubbles sends iMessage via Messages.app

**Typing indicators:**
1. On inbound message: Bridge immediately calls `startTyping`
2. On reply received: Bridge calls `stopTyping`
3. Timeout: auto-stop typing after 60s as safety net

## Key Questions to Resolve

- **Apple ID**: Use a fresh Apple ID or Pete's? Fresh is cleaner — no bleed between personal and Swain messages.
- **Phone number for iMessage**: Need a real phone number associated with the Apple ID. Options: cheap prepaid SIM, Google Voice (may not work with iMessage), eSIM. The number becomes the "Swain advisor" number that captains text.
- **SIP disable**: Required for BlueBubbles Private API. `csrutil disable` in recovery mode. Understood and accepted?
- **Cloudflare tunnel auth**: Should the tunnel require a token/header that Bridge includes? Or rely on BlueBubbles server password?
- **BlueBubbles webhook format**: Need to parse the exact webhook payload shape. Check BlueBubbles docs.
- **Group messages**: Ignore? Swain is 1:1 only.

## Acceptance Criteria

- [ ] BlueBubbles running on Mac mini, accessible via Cloudflare tunnel
- [ ] Send a text to the Swain number → webhook fires → Bridge receives it → logs the message
- [ ] Bridge routes message to a Sprite → Sprite processes → Sprite replies → Bridge sends via BlueBubbles → iMessage arrives on phone
- [ ] Typing indicator shows while Sprite is processing
- [ ] Round-trip latency under 5s for a simple reply (excluding Claude thinking time)
- [ ] Non-iMessage phones (Android) get gracefully rejected or SMS fallback (decide in implementation)

## Out of Scope

- Multiple phone numbers (one number for all captains for now)
- Image receiving (inbound photos from captains — future)
- Read receipts
- Mac mini monitoring/alerting

## Estimated Effort

Medium. BlueBubbles setup is mostly config. The API client is straightforward REST. Cloudflare tunnel is quick. The fiddly part is Apple ID + phone number registration and SIP disable.
