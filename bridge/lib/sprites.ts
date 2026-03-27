/**
 * Sprites — run Claude on sprites via `sprite exec`.
 *
 * No HTTP, no channel server. The VPS orchestrates everything.
 */

import { runOnSprite, getSession, saveSession, type RunResult } from "./sprite-exec";

export type SpriteConfig = {
  id: string;   // sprite name, used for `sprite exec -s <id>`
  url: string;  // kept for backward compat but not used for messaging
};

/**
 * Send a message to a sprite, get the response.
 *
 * Runs claude -p on the sprite via `sprite exec`. Returns the response
 * text and saves the session for future resume.
 */
export async function sendMessageToSprite(
  spriteName: string,
  prompt: string,
  chatId: string,
  options?: { light?: boolean }
): Promise<RunResult> {
  const sessionId = await getSession(chatId);

  const result = await runOnSprite(spriteName, prompt, {
    sessionId: sessionId ?? undefined,
    light: options?.light,
  });

  // Save session for resume on next message
  if (result.sessionId) {
    await saveSession(chatId, result.sessionId);
  }

  return result;
}

/**
 * Check if a sprite is reachable (quick health check via exec).
 */
export async function checkHealth(
  sprite: SpriteConfig
): Promise<{ ok: boolean }> {
  try {
    const proc = Bun.spawn(
      ["sprite", "exec", "-s", sprite.id, "--", "echo", "ok"],
      {
        env: { ...process.env, PATH: `/root/.local/bin:${process.env.PATH}` },
        stdout: "pipe",
        stderr: "pipe",
      }
    );
    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;
    return { ok: exitCode === 0 && stdout.trim() === "ok" };
  } catch {
    return { ok: false };
  }
}
