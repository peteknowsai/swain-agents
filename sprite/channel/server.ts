#!/usr/bin/env bun
/**
 * Swain channel server — HTTP wrapper around `claude -p`.
 *
 * Receives messages from Bridge via HTTP, runs `claude -p` with session
 * resume for conversation continuity, sends replies back to Bridge.
 *
 * No MCP, no channels, no TTY, no interactive prompts.
 * Process per message: start → process → exit → Sprite can sleep.
 *
 * HTTP endpoints (called by Bridge):
 *   POST /message   — inbound message, runs claude -p, replies to Bridge
 *   POST /cron      — cron trigger
 *   GET  /health    — health check
 */

import { $ } from "bun";

const PORT = Number(process.env.CHANNEL_PORT ?? 8080);
const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const CLAUDE_PATH = process.env.CLAUDE_PATH ?? "/home/sprite/.local/bin/claude";
const SESSION_DIR = "/home/sprite/.claude-sessions";
const startTime = Date.now();

// Track session IDs per chat for conversation continuity
const sessions = new Map<string, string>();

// Persist sessions to disk so they survive Sprite sleep
const SESSION_MAP_FILE = `${SESSION_DIR}/sessions.json`;

async function loadSessions(): Promise<void> {
  try {
    const file = Bun.file(SESSION_MAP_FILE);
    if (await file.exists()) {
      const data = await file.json();
      for (const [k, v] of Object.entries(data)) {
        sessions.set(k, v as string);
      }
    }
  } catch {}
}

async function saveSessions(): Promise<void> {
  await Bun.write(
    SESSION_MAP_FILE,
    JSON.stringify(Object.fromEntries(sessions), null, 2)
  );
}

await $`mkdir -p ${SESSION_DIR}`.quiet();
await loadSessions();

/**
 * Run claude -p with optional session resume.
 * Returns the response text.
 */
async function runClaude(
  prompt: string,
  chatId?: string
): Promise<string> {
  const args = [
    CLAUDE_PATH,
    "-p",
    prompt,
    "--output-format", "text",
    "--dangerously-skip-permissions",
    "--append-system-prompt", "You are a helpful assistant. Always use WebSearch and WebFetch tools for real-time information like scores, weather, news, prices, etc. Never say you don't have access — you DO have web access via tools.",
  ];

  // Resume existing session for this chat
  if (chatId && sessions.has(chatId)) {
    args.push("--resume", sessions.get(chatId)!);
  }

  try {
    const proc = Bun.spawn(args, {
      env: process.env,
      cwd: "/home/sprite",
      stdout: "pipe",
      stderr: "pipe",
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error(`[claude] exit ${exitCode}: ${stderr.slice(0, 200)}`);
    }

    // Try to extract session ID from stderr for resume
    // Claude -p outputs session info to stderr
    const sessionMatch = stderr.match(/session_id['":\s]+([a-f0-9-]+)/i);
    if (sessionMatch && chatId) {
      sessions.set(chatId, sessionMatch[1]);
      await saveSessions();
    }

    return output.trim();
  } catch (err) {
    console.error(`[claude] error:`, err);
    return "Sorry, I had trouble processing that. Try again in a moment.";
  }
}

/**
 * Send reply back to Bridge.
 */
async function sendToBridge(
  payload: Record<string, unknown>
): Promise<boolean> {
  if (!BRIDGE_URL) {
    console.log(`[channel] no BRIDGE_URL — reply: ${JSON.stringify(payload)}`);
    return true;
  }

  try {
    const res = await fetch(`${BRIDGE_URL}/sprites/${SPRITE_ID}/reply`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.error(`[channel] bridge reply failed: ${res.status}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[channel] bridge reply error:`, err);
    return false;
  }
}

// HTTP Server
Bun.serve({
  port: PORT,
  hostname: "0.0.0.0",
  async fetch(req) {
    const url = new URL(req.url);

    // Health check
    if (url.pathname === "/health" && req.method === "GET") {
      return Response.json({
        ok: true,
        mode: "print",
        uptime: Math.floor((Date.now() - startTime) / 1000),
        sessions: sessions.size,
      });
    }

    // Inbound message from Bridge
    if (url.pathname === "/message" && req.method === "POST") {
      const body = (await req.json()) as {
        text: string;
        chatId?: string;
        messageId?: string;
        user?: string;
        userId?: string;
      };

      console.log(`[channel] message from ${body.user ?? "unknown"}: ${body.text.slice(0, 80)}`);

      // Run claude -p
      const response = await runClaude(body.text, body.chatId);

      // Send reply back to Bridge
      if (response) {
        await sendToBridge({
          type: "text",
          text: response,
          chatId: body.chatId,
        });
      }

      return Response.json({ ok: true });
    }

    // Cron trigger from Bridge
    if (url.pathname === "/cron" && req.method === "POST") {
      const body = (await req.json()) as {
        skill: string;
        name?: string;
      };

      const prompt = `Read /home/sprite/skills/${body.skill}.md and execute the task described in it. Only use the reply tool if there's something to deliver to the captain.`;
      const response = await runClaude(prompt, `cron:${body.skill}`);

      if (response) {
        await sendToBridge({
          type: "text",
          text: response,
          chatId: `cron:${body.skill}`,
        });
      }

      return Response.json({ ok: true });
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`[channel] HTTP server listening on port ${PORT} (print mode)`);
