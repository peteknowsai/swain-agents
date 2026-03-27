/**
 * Sprites — deliver messages to sprites via `sprite exec`.
 *
 * Messages are dropped into the sprite's channel inbox via swain-channel-send.
 * The MCP channel server inside Claude Code picks them up and pushes them
 * to Claude as <channel> notifications. Replies come back async via
 * POST /sprites/:name/reply.
 *
 * sprite exec wakes sleeping sprites automatically — no HTTP polling needed.
 */

const SPRITE_CLI = process.env.SPRITE_CLI ?? "sprite";

export type SpriteConfig = {
  id: string;   // sprite name, used for `sprite exec -s <id>`
  url: string;  // kept for registry compat
};

/**
 * Send a message to a sprite's channel inbox.
 *
 * Fires and forgets — the reply comes back later via the Bridge's
 * /sprites/:name/reply endpoint. sprite exec wakes the sprite if sleeping.
 */
export async function sendMessageToSprite(
  spriteName: string,
  text: string,
  chatId: string,
  options?: { user?: string; messageId?: string; type?: string }
): Promise<boolean> {
  const args = [
    SPRITE_CLI, "exec", "-s", spriteName,
    "--", "swain-channel-send",
    text,
    chatId,
    options?.user ?? "",
    options?.messageId ?? "",
    options?.type ?? "",
  ];

  console.log(`[sprites] → ${spriteName} (${chatId}): ${text.slice(0, 80)}`);

  try {
    const proc = Bun.spawn(args, {
      env: { ...process.env, HOME: process.env.HOME || "/root", PATH: `/root/.local/bin:${process.env.PATH}` },
      stdout: "pipe",
      stderr: "pipe",
    });

    const stdout = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode === 0 && stdout.trim() === "ok") {
      return true;
    }

    const stderr = await new Response(proc.stderr).text();
    console.error(`[sprites] ${spriteName} send failed (exit ${exitCode}): ${stderr.slice(0, 200)}`);
    return false;
  } catch (err) {
    console.error(`[sprites] ${spriteName} send error:`, err);
    return false;
  }
}

/**
 * Check if a sprite is reachable (quick health check via exec).
 */
export async function checkHealth(
  sprite: SpriteConfig
): Promise<{ ok: boolean }> {
  try {
    const proc = Bun.spawn(
      [SPRITE_CLI, "exec", "-s", sprite.id, "--", "echo", "ok"],
      {
        env: { ...process.env, HOME: process.env.HOME || "/root", PATH: `/root/.local/bin:${process.env.PATH}` },
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
