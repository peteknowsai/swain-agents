#!/usr/bin/env bun
/**
 * Swain Channel — MCP channel server for Claude Code.
 *
 * Runs as a subprocess of Claude Code (spawned via .mcp.json).
 * Watches an inbox directory for message files dropped by `sprite exec`.
 * Pushes them into Claude as <channel> notifications.
 * Exposes a reply tool so Claude can send iMessages mid-task.
 *
 * Message flow:
 *   Bridge → sprite exec → swain-channel-send → inbox file
 *   → this server picks it up → pushes to Claude
 *   → Claude calls reply tool → POST to Bridge → iMessage
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readdir, readFile, unlink, mkdir } from "fs/promises";
import { join } from "path";
import { syncToR2 } from "./sync";

const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const INBOX_DIR = "/home/sprite/.channel/inbox";
const POLL_INTERVAL_MS = 500;

// Ensure inbox directory exists
await mkdir(INBOX_DIR, { recursive: true });

// --- MCP Server ---

const mcp = new Server(
  { name: "swain-channel", version: "0.1.0" },
  {
    capabilities: {
      experimental: { "claude/channel": {} },
      tools: {},
    },
    instructions: [
      "Messages from your captain arrive as <channel source=\"swain\" chat_id=\"...\">.  ",
      "Reply using the reply tool, passing the chat_id from the tag.",
      "You can send multiple messages during a single task — call reply whenever you need to communicate.",
      "Your captain communicates via iMessage — keep messages short (1-2 sentences), casual, no markdown, no bullet lists.",
      "Read your CLAUDE.md for identity and context.",
      "At the start of every conversation, read .claude/memory/MEMORY.md to recall what you know about your captain.",
      "You have tools — USE THEM:",
      "- .claude/memory/ — your memory files (captain profile, boat, marina, preferences, notes)",
      "- swain CLI (/usr/local/bin/swain --json) — look up briefings, cards, user profiles, desk data, flyer data",
      "- stoolap (/usr/local/bin/stoolap) — your local SQL database for structured data and embeddings",
      "- goplaces (/usr/local/bin/goplaces --json) — look up marinas, fuel docks, restaurants, places",
      "- WebSearch and WebFetch — real-time info (weather, news, tides, scores, events)",
      "Never say you don't have access to something. Never say 'that was a different session.'",
      "You share memory across all sessions — read your memory files to know what happened.",
      "If asked about something you should know, LOOK IT UP with your tools before answering.",
      "For image generation, ALWAYS use the swain CLI (swain card image, swain image generate) — never call Replicate directly.",
    ].join("\n"),
  }
);

// --- Reply Tool ---

mcp.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "reply",
      description:
        "Send an iMessage to the captain. Use this to communicate — your text output is NOT sent as a message. Only the reply tool sends messages.",
      inputSchema: {
        type: "object" as const,
        properties: {
          chat_id: {
            type: "string",
            description: "The chat_id from the inbound <channel> tag",
          },
          text: {
            type: "string",
            description: "The message to send",
          },
        },
        required: ["chat_id", "text"],
      },
    },
  ],
}));

mcp.setRequestHandler(CallToolRequestSchema, async (req) => {
  if (req.params.name === "reply") {
    const { chat_id, text } = req.params.arguments as {
      chat_id: string;
      text: string;
    };

    if (!BRIDGE_URL) {
      console.error("[swain-channel] no BRIDGE_URL — reply:", text);
      return { content: [{ type: "text" as const, text: "sent (no bridge)" }] };
    }

    try {
      const res = await fetch(
        `${BRIDGE_URL}/sprites/${SPRITE_ID}/reply`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "text", text, chatId: chat_id }),
        }
      );

      if (!res.ok) {
        console.error(`[swain-channel] bridge reply failed: ${res.status}`);
        return {
          content: [{ type: "text" as const, text: `send failed: ${res.status}` }],
        };
      }

      console.error(`[swain-channel] reply → ${chat_id}: ${text.slice(0, 60)}`);

      // Sync vault after sending a reply
      syncToR2().catch(() => {});

      return { content: [{ type: "text" as const, text: "sent" }] };
    } catch (err) {
      console.error(`[swain-channel] reply error:`, err);
      return {
        content: [{ type: "text" as const, text: `send error: ${err}` }],
      };
    }
  }

  throw new Error(`unknown tool: ${req.params.name}`);
});

// --- Connect to Claude Code ---

await mcp.connect(new StdioServerTransport());

// --- Inbox Watcher ---

async function pollInbox(): Promise<void> {
  try {
    const files = await readdir(INBOX_DIR);
    const jsonFiles = files
      .filter((f) => f.endsWith(".json"))
      .sort(); // timestamp-based names = chronological order

    for (const file of jsonFiles) {
      const filePath = join(INBOX_DIR, file);
      try {
        const content = await readFile(filePath, "utf-8");
        const msg = JSON.parse(content);

        await mcp.notification({
          method: "notifications/claude/channel",
          params: {
            content: msg.text ?? "",
            meta: {
              chat_id: msg.chatId ?? "default",
              user: msg.user ?? "",
              message_id: msg.messageId ?? "",
              ...(msg.type ? { type: msg.type } : {}),
            },
          },
        });

        console.error(
          `[swain-channel] inbox → ${msg.chatId}: ${(msg.text ?? "").slice(0, 60)}`
        );

        // Delete processed file
        await unlink(filePath);
      } catch (err) {
        console.error(`[swain-channel] failed to process ${file}:`, err);
        // Delete bad files so they don't block the queue
        await unlink(filePath).catch(() => {});
      }
    }
  } catch (err) {
    // Inbox dir might not exist yet on first run
    if ((err as any)?.code !== "ENOENT") {
      console.error("[swain-channel] inbox poll error:", err);
    }
  }
}

// Poll inbox every 500ms
setInterval(pollInbox, POLL_INTERVAL_MS);

// Run once immediately in case messages are already waiting
await pollInbox();

console.error("[swain-channel] running — watching inbox for messages");
