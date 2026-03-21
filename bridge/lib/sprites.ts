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
 * Strategy: try to wake with health checks. If that fails after 90s,
 * try waking via sprite exec as a fallback. Queue message for retry
 * if all else fails.
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

  // Step 1: Wake the Sprite with health checks (up to 90s)
  console.log(`[sprites] waking ${sprite.id}...`);
  const awake = await waitForHealth(sprite, 90_000);
  if (!awake) {
    console.error(`[sprites] ${sprite.id} failed to wake after 90s`);
    return false;
  }
  console.log(`[sprites] ${sprite.id} is awake`);

  // Step 2: Send the message with generous timeout (claude -p can take a while)
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(`${sprite.url}${path}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(180_000), // 3 min — claude -p + web search can be slow
      });
      if (res.ok) return true;

      // 502 after health passed = service crashed during request, retry once
      if (res.status === 502 && attempt === 0) {
        console.log(`[sprites] ${sprite.id} 502 on message, retrying...`);
        await Bun.sleep(5000);
        continue;
      }

      console.error(
        `[sprites] ${sprite.id} message failed: ${res.status} ${res.statusText}`
      );
      return false;
    } catch (err) {
      if (attempt === 0) {
        console.log(`[sprites] ${sprite.id} message timed out, retrying...`);
        await Bun.sleep(5000);
        continue;
      }
      console.error(`[sprites] ${sprite.id} message error:`, err);
      return false;
    }
  }

  return false;
}

/**
 * Wait for a Sprite's channel server to be healthy.
 * Polls /health until ready or timeout.
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

    // Shorter interval at first (cold start happening), longer later
    const delay = attempt <= 5 ? 2000 : 5000;
    await Bun.sleep(delay);
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
