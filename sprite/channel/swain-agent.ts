#!/usr/bin/env bun
/**
 * Swain Agent — on-demand Claude agent on a sprite.
 *
 * Started by swain-channel-send when a message arrives. Processes messages
 * from the inbox, then exits after IDLE_TIMEOUT_MS of inactivity.
 * Sprite goes back to sleep when the process exits.
 *
 * Uses the Claude Agent SDK (v1 query API) for conversations.
 * Session persists across runs via .agent-session file.
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
const PID_FILE = "/home/sprite/.agent-pid";
const POLL_INTERVAL_MS = 500;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of no messages → exit

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

// --- PID file (so swain-channel-send knows if we're running) ---

await writeFile(PID_FILE, String(process.pid));
process.on("exit", () => {
  try { require("fs").unlinkSync(PID_FILE); } catch {}
});
process.on("SIGTERM", () => process.exit(0));
process.on("SIGINT", () => process.exit(0));

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
let lastActivityMs = Date.now();

async function processMessage(msg: InboxMessage): Promise<void> {
  const prompt = `<channel source="swain" chat_id="${msg.chatId}">${msg.text}</channel>`;
  console.log(`[agent] ← ${msg.chatId}: ${msg.text.slice(0, 80)}`);

  try {
    const result = query({
      prompt,
      options: {
        model: "claude-sonnet-4-6",
        permissionMode: "bypassPermissions",
        cwd: "/home/sprite",
        settingSources: ["user", "project"],
        allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Skill"],
        systemPrompt: { type: "preset" as const, preset: "claude_code" as const, append: SYSTEM_PROMPT },
        mcpServers: [mcpServer],
        ...(currentSessionId ? { resume: currentSessionId } : {}),
      },
    });

    for await (const event of result) {
      const eventSessionId = (event as any).session_id;
      if (eventSessionId && eventSessionId !== currentSessionId) {
        currentSessionId = eventSessionId;
        await saveSessionId(currentSessionId!);
        console.log(`[agent] session: ${currentSessionId!.slice(0, 8)}...`);
      }

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

    if (String(err).includes("session")) {
      console.log(`[agent] clearing broken session`);
      currentSessionId = null;
      try { await unlink(SESSION_FILE); } catch {}
    }
  }
}

async function processQueue(): Promise<void> {
  if (processing) return;
  processing = true;

  try {
    while (messageQueue.length > 0) {
      const msg = messageQueue.shift()!;
      lastActivityMs = Date.now();
      await processMessage(msg);
      lastActivityMs = Date.now();
    }
  } finally {
    processing = false;
  }
}

// --- Inbox Poller + Idle Timeout ---

const poller = setInterval(async () => {
  const messages = await readInbox();
  if (messages.length > 0) {
    lastActivityMs = Date.now();
    messageQueue.push(...messages);
    processQueue();
  }

  // Exit if idle for too long and not processing
  if (!processing && Date.now() - lastActivityMs > IDLE_TIMEOUT_MS) {
    console.log(`[agent] idle for ${IDLE_TIMEOUT_MS / 1000}s, shutting down`);
    clearInterval(poller);
    process.exit(0);
  }
}, POLL_INTERVAL_MS);

// Process any messages already in inbox on startup
const initial = await readInbox();
if (initial.length > 0) {
  lastActivityMs = Date.now();
  messageQueue.push(...initial);
  processQueue();
}

console.log(`[agent] started — ${SPRITE_ID} — session: ${currentSessionId?.slice(0, 8) ?? "new"} — idle timeout: ${IDLE_TIMEOUT_MS / 1000}s`);
