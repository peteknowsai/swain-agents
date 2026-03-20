/**
 * Swain Bridge — always-on gateway that routes Discord messages to Sprites.
 *
 * Runs on the VPS. Holds the Discord bot gateway connection.
 * Forwards messages to Sprites via HTTP, relays replies back to Discord.
 */

import { startBot, sendReply, sendImage } from "./lib/discord.ts";
import { loadRegistry, listAll } from "./lib/registry.ts";
import { checkHealth } from "./lib/sprites.ts";

const PORT = Number(process.env.BRIDGE_PORT ?? 3847);

// Load registry from config file
const REGISTRY_PATH = process.env.REGISTRY_PATH ?? "./registry.json";
try {
  const file = Bun.file(REGISTRY_PATH);
  const config = await file.json();
  loadRegistry(config);
} catch (err) {
  console.error(`[bridge] failed to load registry from ${REGISTRY_PATH}:`, err);
  console.error("[bridge] create a registry.json with sprite configs");
  process.exit(1);
}

// HTTP server — receives replies from Sprites
Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({ ok: true, sprites: listAll().length });
    }

    // Sprite reply endpoint — POST /sprites/:spriteId/reply
    const replyMatch = url.pathname.match(
      /^\/sprites\/([^/]+)\/reply$/
    );
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

      if (body.type === "image" && body.url) {
        await sendImage(body.chatId, body.url, body.caption);
      } else if (body.text) {
        await sendReply(body.chatId, body.text, body.replyTo);
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
