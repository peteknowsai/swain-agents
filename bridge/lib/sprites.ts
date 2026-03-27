/**
 * Sprites API client — wake sprites and send messages to their channel servers.
 */

const SPRITE_API_TOKEN = process.env.SPRITE_API_TOKEN ?? "";

export type SpriteConfig = {
  id: string;
  url: string; // e.g. https://swain-advisor-bas32.sprites.app
};

/**
 * Send a message to a Sprite's channel server.
 * Wakes the Sprite if sleeping (hitting the URL triggers wake).
 *
 * The sprite accepts the message and returns 200 immediately — it
 * processes in the background and sends the reply later via
 * POST /sprites/:id/reply. So we only need to wait long enough
 * for the sprite to wake and accept the request (~5-15s).
 */
export async function sendToSprite(
  sprite: SpriteConfig,
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(SPRITE_API_TOKEN
      ? { Authorization: `Bearer ${SPRITE_API_TOKEN}` }
      : {}),
  };
  const payload = JSON.stringify(body);
  const start = Date.now();
  const TIMEOUT_MS = 30_000; // 30s — just need sprite to wake and accept

  console.log(`[sprites] sending to ${sprite.id}...`);

  for (let attempt = 1; Date.now() - start < TIMEOUT_MS; attempt++) {
    try {
      const res = await fetch(`${sprite.url}${path}`, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(10_000),
      });

      if (res.ok) {
        if (attempt > 1) console.log(`[sprites] ${sprite.id} delivered on attempt ${attempt}`);
        return true;
      }

      if (res.status === 502 || res.status === 503) {
        console.log(`[sprites] ${sprite.id} waking (${res.status}), attempt ${attempt}...`);
        await Bun.sleep(2000);
        continue;
      }

      console.error(`[sprites] ${sprite.id} failed: ${res.status} ${res.statusText}`);
      return false;
    } catch (err) {
      console.log(`[sprites] ${sprite.id} not reachable, attempt ${attempt}...`);
      await Bun.sleep(2000);
    }
  }

  console.error(`[sprites] ${sprite.id} failed to accept after ${Math.floor((Date.now() - start) / 1000)}s`);
  return false;
}

/**
 * Check if a Sprite's channel server is healthy (quick check, no retries).
 */
export async function checkHealth(
  sprite: SpriteConfig
): Promise<{ ok: boolean; claude?: string }> {
  try {
    const res = await fetch(`${sprite.url}/health`, {
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) return await res.json();
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
