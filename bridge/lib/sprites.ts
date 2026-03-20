/**
 * Sprites API client — wake sprites and send messages to their channel servers.
 */

const SPRITE_API_TOKEN = process.env.SPRITE_API_TOKEN ?? "";
const SPRITE_CHANNEL_PORT = Number(process.env.SPRITE_CHANNEL_PORT ?? 8080);

export type SpriteConfig = {
  id: string;
  url: string; // e.g. https://swain-advisor-bas32.sprites.app
};

/**
 * Send a message to a Sprite's channel server.
 * Wakes the Sprite if sleeping (hitting the URL triggers wake).
 * Retries until the channel server is ready.
 */
export async function sendToSprite(
  sprite: SpriteConfig,
  path: string,
  body: Record<string, unknown>
): Promise<boolean> {
  const url = `${sprite.url}${path}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(SPRITE_API_TOKEN
      ? { Authorization: `Bearer ${SPRITE_API_TOKEN}` }
      : {}),
  };

  // Retry up to 5 times with 2s delay — Sprite may be waking up
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return true;

      // 502/503 = Sprite waking up, retry
      if (res.status === 502 || res.status === 503) {
        console.log(
          `[sprites] ${sprite.id} not ready (${res.status}), retry ${attempt + 1}/5...`
        );
        await Bun.sleep(2000);
        continue;
      }

      console.error(
        `[sprites] ${sprite.id} error: ${res.status} ${res.statusText}`
      );
      return false;
    } catch (err) {
      console.log(
        `[sprites] ${sprite.id} unreachable, retry ${attempt + 1}/5...`
      );
      await Bun.sleep(2000);
    }
  }

  console.error(`[sprites] ${sprite.id} failed after 5 attempts`);
  return false;
}

/**
 * Check if a Sprite's channel server is healthy.
 */
export async function checkHealth(
  sprite: SpriteConfig
): Promise<{ ok: boolean; claude?: string }> {
  const url = `${sprite.url}/health`;
  const headers: Record<string, string> = SPRITE_API_TOKEN
    ? { Authorization: `Bearer ${SPRITE_API_TOKEN}` }
    : {};

  try {
    const res = await fetch(url, {
      headers,
      signal: AbortSignal.timeout(5_000),
    });
    if (res.ok) return await res.json();
    return { ok: false };
  } catch {
    return { ok: false };
  }
}
