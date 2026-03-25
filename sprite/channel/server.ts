#!/usr/bin/env bun
/**
 * Swain channel server — HTTP wrapper around `claude -p`.
 *
 * Receives messages from Bridge via HTTP, runs `claude -p` with session
 * resume for conversation continuity, sends replies back to Bridge.
 *
 * One persistent session per captain — resumes the same conversation
 * every time. Session survives Sprite sleep via disk persistence.
 *
 * HTTP endpoints (called by Bridge):
 *   POST /message   — inbound message, runs claude -p --resume, replies to Bridge
 *   POST /cron      — cron trigger (separate session per cron type)
 *   GET  /health    — health check
 */

import { syncToR2 } from "./sync";

const PORT = Number(process.env.CHANNEL_PORT ?? 8080);
const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const CLAUDE_PATH = process.env.CLAUDE_PATH ?? "/home/sprite/.local/bin/claude";
const SESSION_FILE = "/home/sprite/.claude-sessions/sessions.json";
const startTime = Date.now();

// Session map: chatId → sessionId
let sessions: Record<string, string> = {};

async function loadSessions(): Promise<void> {
  try {
    const file = Bun.file(SESSION_FILE);
    if (await file.exists()) {
      sessions = await file.json();
      console.log(`[channel] loaded ${Object.keys(sessions).length} session(s)`);
    }
  } catch {}
}

async function saveSessions(): Promise<void> {
  await Bun.write(SESSION_FILE, JSON.stringify(sessions, null, 2));
}

// Ensure session dir exists
await Bun.spawn(["mkdir", "-p", "/home/sprite/.claude-sessions"]).exited;
await loadSessions();

/**
 * Run claude -p with session resume.
 * Returns the response text.
 */
async function runClaude(
  prompt: string,
  chatId: string
): Promise<string> {
  const args = [
    CLAUDE_PATH,
    "-p",
    prompt,
    "--output-format", "json",
    "--dangerously-skip-permissions",
    "--append-system-prompt",
    "Read your CLAUDE.md for identity and context. Use WebSearch and WebFetch tools for real-time information. You have full web access — never say you can't look something up.",
  ];

  // Resume existing session for this chat
  const existingSession = sessions[chatId];
  if (existingSession) {
    args.push("--resume", existingSession);
    console.log(`[claude] resuming session ${existingSession.slice(0, 8)}... for ${chatId}`);
  } else {
    console.log(`[claude] starting new session for ${chatId}`);
  }

  try {
    const proc = Bun.spawn(args, {
      env: process.env,
      cwd: "/home/sprite",
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      console.error(`[claude] exit ${exitCode}: ${stderr.slice(0, 300)}`);

      // If resume failed (corrupt/missing session), try fresh
      if (existingSession && stderr.includes("session")) {
        console.log(`[claude] session ${existingSession.slice(0, 8)} may be invalid, retrying fresh...`);
        delete sessions[chatId];
        await saveSessions();
        return runClaude(prompt, chatId);
      }

      return "Sorry, I had trouble processing that. Try again in a moment.";
    }

    // Parse JSON response to get session_id and result
    try {
      const result = JSON.parse(stdout.trim());
      const sessionId = result.session_id;
      const text = result.result ?? "";

      if (sessionId) {
        sessions[chatId] = sessionId;
        await saveSessions();
        console.log(`[claude] session ${sessionId.slice(0, 8)}... → ${text.slice(0, 60)}`);
      }

      return text;
    } catch {
      // If JSON parse fails, return raw output
      console.error(`[claude] failed to parse JSON output, returning raw`);
      return stdout.trim();
    }
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
        sessions: Object.keys(sessions).length,
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

      const chatId = body.chatId ?? body.userId ?? "default";
      console.log(`[channel] message from ${body.user ?? "unknown"}: ${body.text.slice(0, 80)}`);

      // Run claude -p with session resume
      const response = await runClaude(body.text, chatId);

      // Send reply back to Bridge
      if (response) {
        await sendToBridge({
          type: "text",
          text: response,
          chatId: body.chatId,
        });
      }

      // Sync vault to R2 in background — don't block the response
      syncToR2().catch((err) => console.error("[channel] vault sync error:", err));

      return Response.json({ ok: true });
    }

    // Cron trigger from Bridge (separate sessions per cron)
    if (url.pathname === "/cron" && req.method === "POST") {
      const body = (await req.json()) as {
        skill: string;
        name?: string;
      };

      const prompt = `Run the ${body.skill} skill. Read your CLAUDE.md for context, then follow the skill's instructions.`;
      const response = await runClaude(prompt, `cron:${body.skill}`);

      if (response) {
        await sendToBridge({
          type: "text",
          text: response,
          chatId: `cron:${body.skill}`,
        });
      }

      // Sync vault to R2 after cron too
      syncToR2().catch((err) => console.error("[channel] vault sync error:", err));

      return Response.json({ ok: true });
    }

    // Reverse proxy: /data/* and /_next/* and /api/* → Stoolap Studio on port 3000
    if (url.pathname.startsWith("/data") || url.pathname.startsWith("/_next") || url.pathname.startsWith("/api/")) {
      const studioPath = url.pathname.startsWith("/data")
        ? (url.pathname.replace(/^\/data/, "") || "/")
        : url.pathname;
      const studioUrl = `http://localhost:3000${studioPath}${url.search}`;
      try {
        const proxyReq = new Request(studioUrl, {
          method: req.method,
          headers: req.headers,
          body: req.method !== "GET" && req.method !== "HEAD" ? req.body : undefined,
        });
        const proxyRes = await fetch(proxyReq);
        const body = await proxyRes.arrayBuffer();
        const headers = new Headers(proxyRes.headers);
        headers.delete("content-encoding");
        return new Response(body, {
          status: proxyRes.status,
          headers,
        });
      } catch (err) {
        console.error("[channel] studio proxy error:", err);
        return Response.json({ error: "Studio unavailable" }, { status: 502 });
      }
    }

    return new Response("not found", { status: 404 });
  },
});

console.log(`[channel] HTTP server listening on port ${PORT} (print mode)`);
