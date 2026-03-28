#!/usr/bin/env bun
/**
 * Swain Agent — persistent Claude agent on a sprite.
 *
 * Uses the Claude Agent SDK (v1 query API) for conversations.
 * Messages arrive via file drops from `sprite exec -- swain-channel-send`.
 * Claude responds via the `reply` tool which POSTs to the Bridge.
 * Session persists across calls via --resume.
 */

import { query, tool, createSdkMcpServer } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { readdir, readFile, unlink, mkdir, writeFile } from "fs/promises";
import { join } from "path";
import { syncToR2 } from "./sync";

// --- Config ---

const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const INBOX_DIR = "/home/sprite/.channel/inbox";
const SESSION_FILE = "/home/sprite/.agent-session";
const POLL_INTERVAL_MS = 500;

const SYSTEM_PROMPT = [
  "Read your CLAUDE.md for identity and context.",
  "At the start of every conversation, read .claude/memory/MEMORY.md to recall what you know about your captain.",
  "",
  "Messages from your captain arrive with a chat_id. Use the reply tool to send messages back.",
  "You can call reply MULTIPLE TIMES during a single task — use it whenever you want to communicate.",
  "Your captain communicates via iMessage — keep messages short (1-2 sentences), casual, no markdown.",
  "",
  "You have full access to the sprite filesystem. Use your tools:",
  "- reply(chat_id, text) — send an iMessage to the captain",
  "- Bash — run commands: swain CLI, stoolap, goplaces, firecrawl",
  "- Read/Write/Edit — manage memory files, CLAUDE.md, skills",
  "- Glob/Grep — search files",
  "- WebSearch/WebFetch — real-time info (weather, tides, news)",
  "",
  "Never say you don't have access to something. Read your memory files to know what happened.",
  "For image generation, ALWAYS use the swain CLI (swain card image, swain image generate).",
].join("\n");

// --- Reply Tool ---

const replyTool = tool(
  "reply",
  "Send an iMessage to the captain. Use this for ALL outbound communication. You can call this multiple times during a task.",
  { chat_id: z.string().describe("The chat_id from the inbound message"), text: z.string().describe("The message to send") },
  async ({ chat_id, text }) => {
    if (!BRIDGE_URL) {
      console.log(`[agent] reply (no bridge): ${text}`);
      return { content: [{ type: "text" as const, text: "sent (no bridge)" }] };
    }

    try {
      const res = await fetch(`${BRIDGE_URL}/sprites/${SPRITE_ID}/reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "text", text, chatId: chat_id }),
      });

      if (!res.ok) {
        console.error(`[agent] reply failed: ${res.status}`);
        return { content: [{ type: "text" as const, text: `send failed: ${res.status}` }] };
      }

      console.log(`[agent] reply → ${chat_id}: ${text.slice(0, 60)}`);
      syncToR2().catch(() => {});
      return { content: [{ type: "text" as const, text: "sent" }] };
    } catch (err) {
      console.error(`[agent] reply error:`, err);
      return { content: [{ type: "text" as const, text: `send error: ${err}` }] };
    }
  }
);

const mcpServer = createSdkMcpServer({
  name: "swain-tools",
  tools: [replyTool],
});

// --- Session Management ---

async function loadSessionId(): Promise<string | null> {
  try {
    return (await readFile(SESSION_FILE, "utf-8")).trim() || null;
  } catch {
    return null;
  }
}

async function saveSessionId(id: string): Promise<void> {
  await writeFile(SESSION_FILE, id);
}

// --- Inbox ---

await mkdir(INBOX_DIR, { recursive: true });

interface InboxMessage {
  text: string;
  chatId: string;
  user?: string;
  messageId?: string;
  type?: string;
}

async function readInbox(): Promise<InboxMessage[]> {
  try {
    const files = await readdir(INBOX_DIR);
    const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
    const messages: InboxMessage[] = [];

    for (const file of jsonFiles) {
      const filePath = join(INBOX_DIR, file);
      try {
        const content = await readFile(filePath, "utf-8");
        messages.push(JSON.parse(content));
        await unlink(filePath);
      } catch (err) {
        console.error(`[agent] bad inbox file ${file}:`, err);
        await unlink(filePath).catch(() => {});
      }
    }

    return messages;
  } catch (err) {
    if ((err as any)?.code !== "ENOENT") {
      console.error("[agent] inbox error:", err);
    }
    return [];
  }
}

// --- Message Processing ---

let processing = false;
const messageQueue: InboxMessage[] = [];
let currentSessionId: string | null = await loadSessionId();

async function processMessage(msg: InboxMessage): Promise<void> {
  const prompt = `<channel source="swain" chat_id="${msg.chatId}">${msg.text}</channel>`;
  console.log(`[agent] ← ${msg.chatId}: ${msg.text.slice(0, 80)}`);

  try {
    const result = query({
      prompt,
      options: {
        model: "claude-sonnet-4-6",
        permissionMode: "bypassPermissions",
        systemPrompt: SYSTEM_PROMPT,
        mcpServers: [mcpServer],
        ...(currentSessionId ? { resume: currentSessionId } : {}),
      },
    });

    for await (const event of result) {
      // Save session ID
      if (event.type === "result" && (event as any).session_id) {
        currentSessionId = (event as any).session_id;
        await saveSessionId(currentSessionId!);
        console.log(`[agent] session: ${currentSessionId!.slice(0, 8)}...`);
      }

      // Log assistant text output (shouldn't happen if reply tool is used, but just in case)
      if (event.type === "assistant") {
        const texts = (event as any).message?.content
          ?.filter((b: any) => b.type === "text")
          ?.map((b: any) => b.text)
          ?.join("");
        if (texts) {
          console.log(`[agent] text output: ${texts.slice(0, 100)}`);
        }
      }
    }

    console.log(`[agent] done processing ${msg.chatId}`);
  } catch (err) {
    console.error(`[agent] processing error:`, err);

    // If session is broken, clear it and retry
    if (String(err).includes("session")) {
      console.log(`[agent] clearing broken session`);
      currentSessionId = null;
      try {
        await unlink(SESSION_FILE);
      } catch {}
    }
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      await processMessage(msg);
    }
  } finally {
    processing = false;
  }
}

// --- Inbox Poller ---

setInterval(async () => {
  const messages = await readInbox();
  if (messages.length > 0) {
    messageQueue.push(...messages);
    processQueue();
  }
}, POLL_INTERVAL_MS);

// Process any messages already in inbox on startup
const initial = await readInbox();
if (initial.length > 0) {
  messageQueue.push(...initial);
  processQueue();
}

// Health endpoint — sprite service manager expects something on port 8080
const PORT = Number(process.env.CHANNEL_PORT ?? 8080);
Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  fetch(req) {
    return Response.json({
      ok: true,
      mode: "agent-sdk",
      session: currentSessionId?.slice(0, 8) ?? null,
      queueLength: messageQueue.length,
      processing,
    });
  },
});

console.log(`[agent] running — ${SPRITE_ID} — session: ${currentSessionId?.slice(0, 8) ?? "new"} — health on :${PORT}`);
