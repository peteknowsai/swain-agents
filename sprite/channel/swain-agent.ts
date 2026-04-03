#!/usr/bin/env bun
/**
 * Swain Agent — on-demand Claude agent on a sprite.
 *
 * Processes iMessage conversations via the v1 query() API with session
 * resumption. Each inbound message becomes a query() call that resumes
 * the captain's ongoing conversation.
 *
 * Polls an inbox directory for messages, processes them, then exits
 * after IDLE_TIMEOUT_MS of inactivity. Sprite sleeps when process exits.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import { readdir, readFile, unlink, mkdir, writeFile } from "fs/promises";
import { join } from "path";

// --- Config ---

const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const INBOX_DIR = "/home/sprite/.channel/inbox";
const SESSION_FILE = "/home/sprite/.agent-session";
const POLL_INTERVAL_MS = 500;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of no messages → exit

const QUERY_OPTIONS = {
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions" as const,
  cwd: "/home/sprite",
  settingSources: ["project" as const],
  allowedTools: [
    "Bash", "Read", "Write", "Edit", "Glob", "Grep",
    "WebSearch", "WebFetch", "Skill",
  ],
};

// --- Session Management ---

let currentSessionId: string | null = null;

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
let lastActivityMs = Date.now();

async function processMessage(msg: InboxMessage): Promise<void> {
  const prompt = `<channel source="swain" chat_id="${msg.chatId}">${msg.text}</channel>`;
  console.log(`[agent] ← ${msg.chatId}: ${msg.text.slice(0, 80)}`);

  try {
    const sessionId = currentSessionId ?? await loadSessionId();
    const options = {
      ...QUERY_OPTIONS,
      ...(sessionId ? { resume: sessionId } : {}),
    };

    for await (const message of query({ prompt, options })) {
      // Track session ID from init
      if (message.type === "system" && message.subtype === "init") {
        const newId = (message as any).session_id;
        if (newId && newId !== currentSessionId) {
          currentSessionId = newId;
          await saveSessionId(newId);
          console.log(`[agent] session: ${newId.slice(0, 8)}...`);
        }
      }

      // Log text output
      if (message.type === "assistant") {
        const content = (message as any).message?.content ?? [];
        const texts = content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");
        if (texts) {
          console.log(`[agent] text: ${texts.slice(0, 100)}`);
        }
      }

      // Log result
      if (message.type === "result") {
        console.log(`[agent] result: ${message.subtype} (${(message as any).duration_ms}ms)`);
        // Capture session ID from result
        const resultSessionId = (message as any).session_id;
        if (resultSessionId && resultSessionId !== currentSessionId) {
          currentSessionId = resultSessionId;
          await saveSessionId(resultSessionId);
        }
      }
    }

    console.log(`[agent] done processing ${msg.chatId}`);
  } catch (err) {
    console.error(`[agent] processing error:`, err);

    // If session is broken, clear it so next message gets a fresh one
    if (String(err).includes("session") || String(err).includes("closed") || String(err).includes("resume")) {
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

currentSessionId = await loadSessionId();
console.log(`[agent] started — ${SPRITE_ID} — session: ${currentSessionId?.slice(0, 8) ?? "new"} — idle timeout: ${IDLE_TIMEOUT_MS / 1000}s`);
