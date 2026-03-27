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
 * Strategy: send the message directly — the request itself wakes the
 * Sprite. If it fails (502, connection error), retry with backoff.
 * Falls back to health-poll only if direct attempts keep failing.
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
  const TIMEOUT_MS = 90_000; // total time budget for wake + delivery

  console.log(`[sprites] sending to ${sprite.id}...`);

  // Try sending directly with retries — the request itself triggers wake
  for (let attempt = 1; Date.now() - start < TIMEOUT_MS; attempt++) {
    try {
      const res = await fetch(`${sprite.url}${path}`, {
        method: "POST",
        headers,
        body: payload,
        signal: AbortSignal.timeout(180_000), // 3 min — claude -p can be slow
      });

      if (res.ok) {
        if (attempt > 1) console.log(`[sprites] ${sprite.id} delivered on attempt ${attempt}`);
        return true;
      }

      // 502/503 = sprite still waking, retry
      if (res.status === 502 || res.status === 503) {
        console.log(`[sprites] ${sprite.id} waking (${res.status}), attempt ${attempt}...`);
        await Bun.sleep(attempt <= 3 ? 2000 : 5000);
        continue;
      }

      // Any other error status is not recoverable
      console.error(`[sprites] ${sprite.id} failed: ${res.status} ${res.statusText}`);
      return false;
    } catch (err) {
      // Connection refused / timeout = sprite not up yet
      console.log(`[sprites] ${sprite.id} not reachable, attempt ${attempt}...`);
      await Bun.sleep(attempt <= 3 ? 2000 : 5000);
    }
  }

  console.error(`[sprites] ${sprite.id} failed to respond after ${Math.floor((Date.now() - start) / 1000)}s`);
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
