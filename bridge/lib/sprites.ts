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
 * Strategy: first wake with a health check (long timeout),
 * then send the actual message once healthy.
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

  // Step 1: Wake the Sprite with a health check (up to 60s)
  console.log(`[sprites] waking ${sprite.id}...`);
  const awake = await waitForHealth(sprite, 60_000);
  if (!awake) {
    console.error(`[sprites] ${sprite.id} failed to wake after 60s`);
    return false;
  }
  console.log(`[sprites] ${sprite.id} is awake`);

  // Step 2: Send the message (Sprite is already running)
  try {
    const res = await fetch(`${sprite.url}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120_000), // claude -p can take a while
    });
    if (res.ok) return true;

    console.error(
      `[sprites] ${sprite.id} message failed: ${res.status} ${res.statusText}`
    );
    return false;
  } catch (err) {
    console.error(`[sprites] ${sprite.id} message error:`, err);
    return false;
  }
}

/**
 * Wait for a Sprite's channel server to be healthy.
 * Polls /health with increasing intervals until ready or timeout.
 */
async function waitForHealth(
  sprite: SpriteConfig,
  timeoutMs: number
): Promise<boolean> {
  const start = Date.now();
  let attempt = 0;

  while (Date.now() - start < timeoutMs) {
    attempt++;
    try {
      const res = await fetch(`${sprite.url}/health`, {
        signal: AbortSignal.timeout(15_000),
      });
      if (res.ok) return true;

      if (res.status === 502 || res.status === 503) {
        console.log(
          `[sprites] ${sprite.id} waking (${res.status}), attempt ${attempt}...`
        );
      }
    } catch {
      console.log(
        `[sprites] ${sprite.id} not reachable yet, attempt ${attempt}...`
      );
    }

    // Wait 3s between attempts
    await Bun.sleep(3000);
  }

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
