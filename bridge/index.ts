/**
 * Swain Bridge — always-on gateway that routes iMessage and Discord to Sprites.
 *
 * Runs on the VPS. Receives BlueBubbles webhooks for iMessage.
 * Runs Claude on sprites via `sprite exec` and sends replies back.
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
  listAll,
  findByPhone,
  findDefaultForIMessage,
} from "./lib/registry.ts";
import { sendMessageToSprite, checkHealth } from "./lib/sprites.ts";
import { runCatchUp, setLastProcessed } from "./lib/catchup.ts";

const PORT = Number(process.env.BRIDGE_PORT ?? 3848);

console.log(`[bridge] registry: ${listAll().length} sprite(s) from DB`);

/**
 * Process an inbound iMessage — deliver to sprite, reply comes async.
 * Returns true if message was successfully delivered to the sprite's inbox.
 */
async function processInboundIMessage(parsed: {
  text: string;
  address: string;
  chatGuid: string;
  messageGuid: string;
}): Promise<boolean> {
  console.log(
    `[bridge] iMessage from ${parsed.address}: ${parsed.text.slice(0, 80)}`
  );

  const entry = findByPhone(parsed.address) ?? findDefaultForIMessage();
  if (!entry) {
    console.log(`[bridge] no sprite for ${parsed.address}, ignoring`);
    return false;
  }

  const chatId = `im:${parsed.address}`;

  // Show typing indicator
  void bbStartTyping(parsed.chatGuid);

  // Drop message into sprite's channel inbox — reply comes async via /sprites/:name/reply
  const ok = await sendMessageToSprite(entry.id, parsed.text, chatId, {
    user: parsed.address,
    messageId: parsed.messageGuid,
  });

  if (!ok) {
    console.error(`[bridge] failed to deliver to sprite ${entry.id}`);
    await imessageReply(parsed.address, "Hey, give me a sec — just waking up. Try again in a minute.");
  }

  return ok;
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

      // Process in background — don't block the webhook response
      (async () => {
        await processInboundIMessage(parsed);
        setLastProcessed(Date.now());
      })();

      return Response.json({ ok: true });
    }

    // Sprite reply endpoint — kept for backward compat with channel server
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

      console.log(`[bridge] reply from ${spriteId}: ${body.type} → ${body.chatId}`);

      // Normalize chatId — bare phone numbers ("+1234567890") should route to iMessage
      const isPhone = /^\+\d{7,15}$/.test(body.chatId);
      if (isPhone) {
        console.log(`[bridge] bare phone chatId "${body.chatId}" → adding im: prefix`);
        body.chatId = `im:${body.chatId}`;
      }

      let sent = false;
      if (body.chatId.startsWith("im:")) {
        const address = body.chatId.replace("im:", "");
        if (body.text) {
          sent = await imessageReply(address, body.text);
        }
      } else {
        if (body.type === "image" && body.url) {
          await discordImage(body.chatId, body.url, body.caption);
          sent = true;
        } else if (body.text) {
          await discordReply(body.chatId, body.text, body.replyTo);
          sent = true;
        }
      }

      if (!sent) {
        return Response.json({ ok: false, error: "message delivery failed" }, { status: 502 });
      }
      return Response.json({ ok: true });
    }

    // Sprite daily report endpoint
    const reportMatch = url.pathname.match(/^\/sprites\/([^/]+)\/report$/);
    if (reportMatch && req.method === "POST") {
      const spriteId = reportMatch[1];
      const body = (await req.json()) as { report: string; agentId?: string; ts?: string };
      console.log(`[bridge] daily report from ${spriteId} (${body.report?.length || 0} chars)`);

      try {
        const { addReport } = await import("./lib/db.ts");
        addReport(body.agentId || spriteId, body.report, body.ts);
      } catch (err) {
        console.error(`[bridge] report save failed:`, err);
      }

      return Response.json({ ok: true });
    }

    // Registry reload — no-op, DB is always current
    if (url.pathname === "/registry/reload" && req.method === "POST") {
      return Response.json({ ok: true, sprites: listAll().length });
    }

    // Agent-to-agent messaging — POST /agents/:agentId/message
    const agentMsgMatch = url.pathname.match(/^\/agents\/([^/]+)\/message$/);
    if (agentMsgMatch && req.method === "POST") {
      const targetId = agentMsgMatch[1];
      const entry = listAll().find((e) => e.id === targetId);
      if (!entry) {
        return Response.json({ ok: false, error: `Agent ${targetId} not found` }, { status: 404 });
      }

      const body = await req.json() as { text: string; from?: string; chatId?: string };
      console.log(`[bridge] agent message: ${body.from || "unknown"} → ${targetId}: ${body.text?.slice(0, 80)}`);

      const chatId = body.chatId || `agent:${body.from || "unknown"}`;
      const ok = await sendMessageToSprite(entry.id, body.text, chatId, { user: body.from });

      return Response.json({ ok });
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

// Catch up on any iMessages missed while Bridge was down
await runCatchUp(processInboundIMessage);

// Start Discord bot
await startBot();
