/**
 * Sprite exec — run Claude on sprites directly from the VPS.
 *
 * No HTTP, no channel server. Just: sprite exec → claude -p → parse result.
 * Session IDs stored in SQLite for resume across sprite sleep cycles.
 */

import { getSession, saveSession, deleteSession } from "./db.ts";

export { getSession, saveSession, deleteSession };

const SPRITE_CLI = process.env.SPRITE_CLI ?? "sprite";

const SYSTEM_PROMPT = [
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
  "For image generation, ALWAYS use the swain CLI (swain card image, swain image generate) — never call external image APIs directly. The CLI handles generation via Gemini and uploads to Cloudflare.",
  "Your text output is sent to the captain as an iMessage. Only output text you want them to see. If you have nothing to say (backend work only), output nothing.",
].join(" ");

export interface RunResult {
  result: string;
  sessionId: string;
  cost: number;
  durationMs: number;
  error?: string;
}

/**
 * Run claude -p on a sprite via sprite exec.
 *
 * Env vars are sourced from the sprite's start.sh — no tokens passed from VPS.
 * Session resume via --resume if sessionId provided.
 * Light mode skips the system prompt for fast, simple responses.
 */
export async function runOnSprite(
  spriteName: string,
  prompt: string,
  options?: {
    sessionId?: string;
    light?: boolean;
    cwd?: string;
  }
): Promise<RunResult> {
  // Build the claude command that runs inside the sprite
  const claudeArgs = [
    "claude", "-p",
    prompt.replace(/'/g, "'\\''"), // escape single quotes for shell
    "--output-format", "json",
    "--dangerously-skip-permissions",
  ];

  if (!options?.light) {
    claudeArgs.push("--append-system-prompt", SYSTEM_PROMPT.replace(/'/g, "'\\''"));
  }

  if (options?.sessionId) {
    claudeArgs.push("--resume", options.sessionId);
  }

  // Wrap in bash -c with env var sourcing
  const shellCmd = `source /home/sprite/.sprite-env && eval $(grep "^export" /home/sprite/start.sh) && ${claudeArgs.map((a) => `'${a}'`).join(" ")}`;

  const execArgs = [
    SPRITE_CLI, "exec",
    "-s", spriteName,
    "--", "bash", "-c", shellCmd,
  ];

  if (options?.cwd) {
    // Insert --dir before --
    const dashIdx = execArgs.indexOf("--");
    execArgs.splice(dashIdx, 0, "--dir", options.cwd);
  }

  const start = Date.now();
  console.log(`[sprite-exec] ${spriteName}: ${prompt.slice(0, 80)}${options?.light ? " (light)" : ""}`);

  try {
    const proc = Bun.spawn(execArgs, {
      env: { ...process.env, HOME: process.env.HOME || "/root", PATH: `/root/.local/bin:${process.env.PATH}` },
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    const exitCode = await proc.exited;
    const durationMs = Date.now() - start;

    if (exitCode !== 0) {
      console.error(`[sprite-exec] ${spriteName} exit ${exitCode} (${durationMs}ms): ${stderr.slice(0, 300)}`);
      return {
        result: "",
        sessionId: "",
        cost: 0,
        durationMs,
        error: stderr.slice(0, 300),
      };
    }

    // Parse claude's JSON output
    try {
      const json = JSON.parse(stdout.trim());
      const result = json.result ?? "";
      const sessionId = json.session_id ?? "";
      const cost = json.total_cost_usd ?? 0;

      console.log(
        `[sprite-exec] ${spriteName} done (${durationMs}ms, $${cost.toFixed(4)}): ${result.slice(0, 80)}`
      );

      return { result, sessionId, cost, durationMs };
    } catch {
      console.error(`[sprite-exec] ${spriteName} JSON parse failed, raw: ${stdout.slice(0, 200)}`);
      return { result: stdout.trim(), sessionId: "", cost: 0, durationMs };
    }
  } catch (err) {
    const durationMs = Date.now() - start;
    console.error(`[sprite-exec] ${spriteName} error (${durationMs}ms):`, err);
    return { result: "", sessionId: "", cost: 0, durationMs, error: String(err) };
  }
}

