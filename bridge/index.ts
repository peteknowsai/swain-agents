/**
 * Swain Bridge — always-on gateway that routes Discord and iMessage to Sprites.
 *
 * Runs on the VPS. Holds the Discord bot gateway connection.
 * Receives BlueBubbles webhooks for iMessage.
 * Forwards messages to Sprites via HTTP, relays replies back.
 */

import {
  startBot,
  sendReply as discordReply,
  sendImage as discordImage,
} from "./lib/discord.ts";
import {
  sendMessage as imessageReply,
  parseWebhook,
  startTyping as bbStartTyping,
} from "./lib/bluebubbles.ts";
import {
  loadRegistry,
  listAll,
  findByPhone,
  findDefaultForIMessage,
} from "./lib/registry.ts";
import { sendToSprite, checkHealth } from "./lib/sprites.ts";

const PORT = Number(process.env.BRIDGE_PORT ?? 3847);

// Track which channel each chatId came from so replies go to the right place
const chatSources = new Map<string, "discord" | "imessage">();
// Track iMessage address for each chatId so we can reply
const chatAddresses = new Map<string, string>();

// Load registry from config file
const REGISTRY_PATH = process.env.REGISTRY_PATH ?? "./registry.json";
try {
  const file = Bun.file(REGISTRY_PATH);
  const config = await file.json();
  loadRegistry(config);
} catch (err) {
  console.error(
    `[bridge] failed to load registry from ${REGISTRY_PATH}:`,
    err
  );
  console.error("[bridge] create a registry.json with sprite configs");
  process.exit(1);
}

// HTTP server
Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({ ok: true, sprites: listAll().length });
    }

    // BlueBubbles webhook — inbound iMessage
    if (url.pathname === "/webhooks/bluebubbles" && req.method === "POST") {
      const body = await req.json();
      const parsed = parseWebhook(body);

      if (!parsed) {
        return Response.json({ ok: true, skipped: true });
      }

      console.log(
        `[bridge] iMessage from ${parsed.address}: ${parsed.text.slice(0, 80)}`
      );

      // Find the Sprite for this sender
      const entry =
        findByPhone(parsed.address) ?? findDefaultForIMessage();
      if (!entry) {
        console.log(
          `[bridge] no sprite for ${parsed.address}, ignoring`
        );
        return Response.json({ ok: true, skipped: true });
      }

      // Track source for reply routing
      const chatId = `im:${parsed.address}`;
      chatSources.set(chatId, "imessage");
      chatAddresses.set(chatId, parsed.address);

      // Send typing indicator
      void bbStartTyping(parsed.chatGuid);

      // Forward to Sprite
      const ok = await sendToSprite(entry, "/message", {
        text: parsed.text,
        chatId,
        messageId: parsed.messageGuid,
        user: parsed.address,
        userId: parsed.address,
      });

      if (!ok) {
        console.error(
          `[bridge] failed to reach sprite ${entry.id} for iMessage from ${parsed.address}`
        );
        // Let the captain know we're having trouble
        await imessageReply(parsed.address, "Hey, give me a sec — just waking up. Try again in a minute.");
      }

      return Response.json({ ok: true });
    }

    // Sprite reply endpoint — POST /sprites/:spriteId/reply
    const replyMatch = url.pathname.match(/^\/sprites\/([^/]+)\/reply$/);
    if (replyMatch && req.method === "POST") {
      const spriteId = replyMatch[1];
      const body = (await req.json()) as {
        type: string;
        text?: string;
        url?: string;
        caption?: string;
        chatId: string;
        replyTo?: string;
      };

      console.log(
        `[bridge] reply from ${spriteId}: ${body.type} → ${body.chatId}`
      );

      const source = chatSources.get(body.chatId);

      if (source === "imessage" || body.chatId.startsWith("im:")) {
        // Route reply through iMessage
        const address = chatAddresses.get(body.chatId) ?? body.chatId.replace("im:", "");
        if (body.text) {
          await imessageReply(address, body.text);
        }
        // TODO: handle image sending via iMessage
      } else {
        // Route reply through Discord
        if (body.type === "image" && body.url) {
          await discordImage(body.chatId, body.url, body.caption);
        } else if (body.text) {
          await discordReply(body.chatId, body.text, body.replyTo);
        }
      }

      return Response.json({ ok: true });
    }

    // List sprites
    if (url.pathname === "/sprites" && req.method === "GET") {
      const sprites = listAll();
      const statuses = await Promise.all(
        sprites.map(async (s) => ({
          ...s,
          health: await checkHealth(s),
        }))
      );
      return Response.json(statuses);
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`[bridge] HTTP server listening on port ${PORT}`);

// Start Discord bot
await startBot();
