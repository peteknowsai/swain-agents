#!/usr/bin/env bun
/**
 * Swain channel server for Claude Code.
 *
 * MCP server (stdio) that bridges HTTP messages from Bridge into a running
 * Claude Code session via the channel contract. Exposes reply() and
 * send_image() tools so the agent can respond through Bridge → iMessage.
 *
 * HTTP endpoints (called by Bridge):
 *   POST /message   — inbound captain message
 *   POST /cron      — cron trigger
 *   GET  /health    — health check
 *
 * MCP tools (used by Claude Code):
 *   reply(text)           — send text back to captain
 *   send_image(url, caption?) — send image to captain
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.env.CHANNEL_PORT ?? 8080);
const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
const SPRITE_ID = process.env.SPRITE_ID ?? "local";

// --- State ---

let claudeState: "idle" | "processing" = "idle";
let lastActivity = Date.now();
let currentChatId: string | null = null; // Discord channel ID for routing replies

function markActive() {
  claudeState = "processing";
  lastActivity = Date.now();
}

function markIdle() {
  claudeState = "idle";
  lastActivity = Date.now();
}

// --- Reply delivery ---

async function sendToBridge(
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!BRIDGE_URL) {
    process.stderr.write(
      `[channel] no BRIDGE_URL — reply logged only: ${JSON.stringify(payload)}\n`
    );
    return true;
  }

  try {
    const res = await fetch(
      `${BRIDGE_URL}/sprites/${SPRITE_ID}/reply`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    if (!res.ok) {
      process.stderr.write(
        `[channel] bridge reply failed: ${res.status} ${res.statusText}\n`
      );
      return false;
    }
    return true;
  } catch (err) {
    process.stderr.write(`[channel] bridge reply error: ${err}\n`);
    return false;
  }
}

// --- MCP Server ---

const mcp = new Server(
  { name: "swain-channel", version: "0.1.0" },
  {
    capabilities: { tools: {}, experimental: { "claude/channel": {} } },
    instructions: [
      "You are a Swain advisor communicating with your captain via iMessage.",
      "Messages from your captain arrive as <channel> notifications.",
      "You MUST use the reply tool to send messages back — plain text output does NOT reach the captain.",
      "Keep replies to 1-2 short sentences. You're texting, not writing essays.",
      "For cron tasks: do your work, use reply() only if there's something to deliver.",
    ].join("\n"),
  }
);

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "reply",
      description:
        "Send a text message back to the captain via iMessage. This is the ONLY way to reach them.",
      inputSchema: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The message to send to the captain",
          },
        },
        required: ["text"],
      },
    },
    {
      name: "send_image",
      description: "Send an image to the captain via iMessage.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "URL of the image to send" },
          caption: {
            type: "string",
            description: "Optional caption to send with the image",
          },
        },
        required: ["url"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;

  switch (req.params.name) {
    case "reply": {
      const text = args.text as string;
      markIdle();
      const ok = await sendToBridge({ type: "text", text, chatId: currentChatId });
      process.stderr.write(`[reply] ${ok ? "sent" : "FAILED"}: ${text}\n`);
      return {
        content: [{ type: "text", text: ok ? "Message sent." : "Failed to send — check logs." }],
      };
    }

    case "send_image": {
      const url = args.url as string;
      const caption = args.caption as string | undefined;
      markIdle();
      const ok = await sendToBridge({ type: "image", url, caption, chatId: currentChatId });
      process.stderr.write(
        `[send_image] ${ok ? "sent" : "FAILED"}: ${url}\n`
      );
      return {
        content: [{ type: "text", text: ok ? "Image sent." : "Failed to send — check logs." }],
      };
    }

    default:
      return {
        content: [{ type: "text", text: `unknown tool: ${req.params.name}` }],
        isError: true,
      };
  }
});

// --- Channel notification (push message into Claude Code) ---

function deliver(
  source: string,
  content: string,
  meta: Record<string, string> = {}
): void {
  markActive();
  void mcp.notification({
    method: "notifications/claude/channel",
    params: {
      content,
      meta: {
        chat_id: SPRITE_ID,
        user: source,
        ts: new Date().toISOString(),
        ...meta,
      },
    },
  });
}

// --- HTTP Server (Bridge-facing) ---

Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({
        ok: true,
        claude: claudeState,
        lastActivity: new Date(lastActivity).toISOString(),
        uptime: Math.floor((Date.now() - startTime) / 1000),
      });
    }

    // Inbound message from captain (via Bridge)
    if (url.pathname === "/message" && req.method === "POST") {
      return (async () => {
        const body = (await req.json()) as {
          text: string;
          chatId?: string;
          messageId?: string;
          user?: string;
          userId?: string;
        };
        // Track chatId for reply routing
        if (body.chatId) currentChatId = body.chatId;
        deliver(body.user ?? "captain", body.text, {
          ...(body.chatId ? { chat_id: body.chatId } : {}),
          ...(body.messageId ? { message_id: body.messageId } : {}),
          ...(body.userId ? { user_id: body.userId } : {}),
        });
        return Response.json({ ok: true });
      })();
    }

    // Cron trigger from Bridge
    if (url.pathname === "/cron" && req.method === "POST") {
      return (async () => {
        const body = (await req.json()) as {
          skill: string;
          name?: string;
        };
        deliver("cron", `Cron triggered: ${body.name ?? body.skill}. Read /data/skills/${body.skill}.md and execute.`, {
          skill: body.skill,
          ...(body.name ? { cron_name: body.name } : {}),
        });
        return Response.json({ ok: true });
      })();
    }

    return new Response("not found", { status: 404 });
  },
});

const startTime = Date.now();
process.stderr.write(`[channel] HTTP server listening on port ${PORT}\n`);

// --- Start MCP transport ---

await mcp.connect(new StdioServerTransport());
process.stderr.write("[channel] MCP connected via stdio\n");
