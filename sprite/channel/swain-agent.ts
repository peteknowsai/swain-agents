#!/usr/bin/env bun
/**
 * Swain Agent — on-demand Claude agent on a sprite.
 *
 * Started by swain-channel-send when a message arrives. Processes messages
 * from the inbox, then exits after IDLE_TIMEOUT_MS of inactivity.
 * Sprite goes back to sleep when the process exits.
 *
 * Uses the Claude Agent SDK (v2 session API) for conversations.
 * Session persists across runs via .agent-session file.
 */

import {
  unstable_v2_createSession,
  unstable_v2_resumeSession,
} from "@anthropic-ai/claude-agent-sdk";
import { readdir, readFile, unlink, mkdir, writeFile } from "fs/promises";
import { join } from "path";

// --- Config ---

const INBOX_DIR = "/home/sprite/.channel/inbox";
const SESSION_FILE = "/home/sprite/.agent-session";
const POLL_INTERVAL_MS = 500;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of no messages → exit

const SYSTEM_PROMPT = [
  "Read your CLAUDE.md for identity and context.",
  "Read .claude/memory/MEMORY.md to recall what you know about your captain.",
  "",
  "Messages arrive with a chat_id. Reply via Bash: swain-reply \"<chat_id>\" \"<message>\"",
  "Plain text output does NOT reach the captain — only swain-reply does.",
  "You can call swain-reply multiple times per turn.",
].join("\n");

// --- Session Options ---

const SESSION_OPTIONS = {
  model: "claude-sonnet-4-6",
  permissionMode: "bypassPermissions" as const,
  cwd: "/home/sprite",
  allowedTools: ["Bash", "Read", "Write", "Edit", "Glob", "Grep", "WebSearch", "WebFetch", "Skill"],
  systemPrompt: SYSTEM_PROMPT,
};

// --- Session Management ---

type Session = ReturnType<typeof unstable_v2_createSession>;
let session: Session | null = null;
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

async function getOrCreateSession(): Promise<Session> {
  if (session) return session;

  const savedId = await loadSessionId();
  if (savedId) {
    try {
      session = unstable_v2_resumeSession(savedId, SESSION_OPTIONS);
      currentSessionId = savedId;
      console.log(`[agent] resumed session ${savedId.slice(0, 8)}...`);
      return session;
    } catch (err) {
      console.log(`[agent] resume failed: ${err}`);
      console.log(`[agent] creating fresh session`);
    }
  }

  session = unstable_v2_createSession(SESSION_OPTIONS);
  console.log(`[agent] created new session`);
  return session;
}

// Clean shutdown on signals
process.on("SIGTERM", () => {
  if (session) session.close();
  process.exit(0);
});
process.on("SIGINT", () => {
  if (session) session.close();
  process.exit(0);
});

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
    const s = await getOrCreateSession();
    await s.send(prompt);

    for await (const event of s.stream()) {
      // Track session ID
      const eventSessionId = (event as any).session_id;
      if (eventSessionId && eventSessionId !== currentSessionId) {
        currentSessionId = eventSessionId;
        await saveSessionId(currentSessionId!);
        console.log(`[agent] session: ${currentSessionId!.slice(0, 8)}...`);
      }

      if (event.type === "assistant") {
        const content = (event as any).message?.content ?? [];
        const texts = content
          .filter((b: any) => b.type === "text")
          .map((b: any) => b.text)
          .join("");
        if (texts) {
          console.log(`[agent] text output: ${texts.slice(0, 100)}`);
        }
      }
    }

    console.log(`[agent] done processing ${msg.chatId}`);
  } catch (err) {
    console.error(`[agent] processing error:`, err);

    // If session is broken, clear it so next message gets a fresh one
    if (String(err).includes("session") || String(err).includes("closed")) {
      console.log(`[agent] clearing broken session`);
      session = null;
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
    if (session) session.close();
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

const savedId = await loadSessionId();
const SPRITE_ID = process.env.SPRITE_ID ?? "local";
console.log(`[agent] started — ${SPRITE_ID} — session: ${savedId?.slice(0, 8) ?? "new"} — idle timeout: ${IDLE_TIMEOUT_MS / 1000}s`);
