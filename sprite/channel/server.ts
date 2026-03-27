#!/usr/bin/env bun
/**
 * Swain channel server — HTTP wrapper around `claude -p`.
 *
 * Receives messages from Bridge via HTTP, runs `claude -p` with session
 * resume for conversation continuity, sends replies back to Bridge.
 *
 * Async: returns 200 immediately, processes in the background,
 * sends reply to Bridge when done.
 *
 * HTTP endpoints (called by Bridge):
 *   POST /message   — inbound message → 200 OK → runs claude → replies to Bridge
 *   POST /cron      — cron trigger → 200 OK → runs claude → replies to Bridge
 *   GET  /health    — health check
 */

import { syncToR2 } from "./sync";

const PORT = Number(process.env.CHANNEL_PORT ?? 8080);
const BRIDGE_URL = process.env.BRIDGE_URL ?? "";
const SPRITE_ID = process.env.SPRITE_ID ?? "local";
const CLAUDE_PATH = process.env.CLAUDE_PATH ?? "/home/sprite/.local/bin/claude";
const SESSION_DIR = "/home/sprite/.claude-sessions";
const IDLE_TIMEOUT_MS = 5 * 60_000; // 5 minutes — exit so sprite goes cold
const startTime = Date.now();
let lastActivity = Date.now();
let activeRequests = 0;

// Idle shutdown — only when no requests are in flight
setInterval(() => {
  if (activeRequests > 0) return; // don't exit while working
  if (Date.now() - lastActivity > IDLE_TIMEOUT_MS) {
    console.log(`[channel] idle for ${IDLE_TIMEOUT_MS / 1000}s — shutting down`);
    process.exit(0);
  }
}, 30_000);

// --- Session persistence (per-chatId files) ---

await Bun.spawn(["mkdir", "-p", SESSION_DIR]).exited;

// Migrate old sessions.json to per-chatId files
try {
  const oldFile = Bun.file(`${SESSION_DIR}/sessions.json`);
  if (await oldFile.exists()) {
    const old: Record<string, string> = await oldFile.json();
    for (const [chatId, sessionId] of Object.entries(old)) {
      await Bun.write(`${SESSION_DIR}/${encodeKey(chatId)}`, sessionId);
    }
    await Bun.spawn(["rm", `${SESSION_DIR}/sessions.json`]).exited;
    console.log(`[channel] migrated ${Object.keys(old).length} session(s) to per-chatId files`);
  }
} catch {}

function encodeKey(chatId: string): string {
  return chatId.replace(/[^a-zA-Z0-9_-]/g, "_") + ".session";
}

async function getSession(chatId: string): Promise<string | null> {
  try {
    const file = Bun.file(`${SESSION_DIR}/${encodeKey(chatId)}`);
    if (await file.exists()) return (await file.text()).trim();
  } catch {}
  return null;
}

async function saveSession(chatId: string, sessionId: string): Promise<void> {
  await Bun.write(`${SESSION_DIR}/${encodeKey(chatId)}`, sessionId);
}

async function deleteSession(chatId: string): Promise<void> {
  try {
    await Bun.spawn(["rm", "-f", `${SESSION_DIR}/${encodeKey(chatId)}`]).exited;
  } catch {}
}

async function countSessions(): Promise<number> {
  try {
    const proc = Bun.spawn(["ls", SESSION_DIR], { stdout: "pipe" });
    const out = await new Response(proc.stdout).text();
    return out.split("\n").filter((f) => f.endsWith(".session")).length;
  } catch {
    return 0;
  }
}

/**
 * Run claude -p with session resume.
 * Returns the response text.
 */
async function runClaude(
  prompt: string,
  chatId: string,
  options?: { light?: boolean }
): Promise<string> {
  const args = [
    CLAUDE_PATH,
    "-p",
    prompt,
    "--output-format", "json",
    "--dangerously-skip-permissions",
  ];

  // Light mode: no system prompt, no file reading — just respond to the prompt
  if (!options?.light) {
    args.push("--append-system-prompt");
    [
      "Read your CLAUDE.md for identity and context.",
      "At the start of every conversation, read .claude/memory/MEMORY.md to recall what you know about your captain.",
      "You have tools — USE THEM:",
      "- .claude/memory/ — your memory files (captain profile, boat, marina, preferences, notes)",
      "- swain CLI (/usr/local/bin/swain --json) — look up briefings, cards, user profiles, desk data, flyer data",
      "- stoolap (/usr/local/bin/stoolap) — your local SQL database for structured data and embeddings",
      "- goplaces (/usr/local/bin/goplaces --json) — look up marinas, fuel docks, restaurants, places",
      "- WebSearch and WebFetch — real-time info (weather, news, tides, scores, events)",
      "Never say you don't have access to something. Never say 'that was a different session.' You share memory across all sessions — read your memory files to know what happened.",
      "If asked about something you should know, LOOK IT UP with your tools before answering.",
      "For image generation, ALWAYS use the swain CLI (swain card image, swain image generate) — never call Replicate directly. The CLI uses the correct model and handles uploads.",
      "Your text output is sent to the captain as an iMessage. Only output text you want them to see. If you have nothing to say (backend work only), output nothing.",
    ].join(" "));
  }

  // Resume existing session for this chat
  const existingSession = await getSession(chatId);
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
        await deleteSession(chatId);
        return runClaude(prompt, chatId);
      }

      return "";
    }

    // Parse JSON response to get session_id and result
    try {
      const result = JSON.parse(stdout.trim());
      const sessionId = result.session_id;
      const text = result.result ?? "";

      if (sessionId) {
        await saveSession(chatId, sessionId);
        console.log(`[claude] session ${sessionId.slice(0, 8)}... → ${text.slice(0, 60)}`);
      }

      return text;
    } catch {
      console.error(`[claude] failed to parse JSON output, returning raw`);
      return stdout.trim();
    }
  } catch (err) {
    console.error(`[claude] error:`, err);
    return "";
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

/**
 * Process a message in the background — run claude, send reply, sync vault.
 */
async function processMessage(text: string, chatId: string, chatIdForReply?: string, options?: { light?: boolean }): Promise<void> {
  activeRequests++;
  lastActivity = Date.now();
  try {
    const response = await runClaude(text, chatId, options);

    // Send reply if Claude produced text output
    if (response.trim()) {
      await sendToBridge({
        type: "text",
        text: response,
        chatId: chatIdForReply ?? chatId,
      });
    }

    // Sync vault to R2
    syncToR2().catch((err) => console.error("[channel] vault sync error:", err));
  } catch (err) {
    console.error(`[channel] processMessage error:`, err);
  } finally {
    activeRequests--;
    lastActivity = Date.now();
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
        sessions: await countSessions(),
        activeRequests,
      });
    }

    // Inbound message from Bridge — accept immediately, process async
    if (url.pathname === "/message" && req.method === "POST") {
      const body = (await req.json()) as {
        text: string;
        chatId?: string;
        messageId?: string;
        user?: string;
        userId?: string;
        light?: boolean;
      };

      const chatId = body.chatId ?? body.userId ?? "default";
      console.log(`[channel] message from ${body.user ?? "unknown"}: ${body.text.slice(0, 80)}${body.light ? " (light)" : ""}`);

      // Fire and forget — process in background
      processMessage(body.text, chatId, body.chatId, { light: body.light });

      return Response.json({ ok: true, async: true });
    }

    // Cron trigger — accept immediately, process async
    if (url.pathname === "/cron" && req.method === "POST") {
      const body = (await req.json()) as {
        skill: string;
        name?: string;
      };

      const prompt = `Run the ${body.skill} skill. Read your CLAUDE.md for context, then follow the skill's instructions.`;
      const cronId = `cron:${body.skill}:${Date.now()}`;
      console.log(`[channel] cron: ${body.skill}`);

      // Fire and forget — process in background
      processMessage(prompt, cronId, `cron:${body.skill}`);

      return Response.json({ ok: true, async: true });
    }

    // Reverse proxy: /data/* and /_next/* and /api/* → Stoolap Studio on port 3000
    if (url.pathname.startsWith("/data") || url.pathname.startsWith("/_next") || url.pathname.startsWith("/api/")) {
      lastActivity = Date.now();
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

console.log(`[channel] HTTP server listening on port ${PORT} (async mode)`);
