/**
 * update-check.ts
 *
 * Lightweight, non-blocking check for newer CLI versions via GitHub Releases API.
 * Cache in ~/.swain/update-check.json with 24h TTL.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CACHE_DIR = join(homedir(), ".swain");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const REPO = "peteknowsai/swain-agents";

interface CacheData {
  lastCheck: number;
  latestVersion: string | null;
}

function readCache(): CacheData | null {
  try {
    if (!existsSync(CACHE_FILE)) return null;
    return JSON.parse(readFileSync(CACHE_FILE, "utf-8"));
  } catch {
    return null;
  }
}

function writeCache(data: CacheData): void {
  try {
    if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
    writeFileSync(CACHE_FILE, JSON.stringify(data));
  } catch {
    // Silently ignore cache write failures
  }
}

/** Fire-and-forget fetch of latest version. Updates cache. */
function backgroundFetch(): void {
  fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: "application/vnd.github.v3+json" },
    signal: AbortSignal.timeout(5000),
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((data: any) => {
      if (data?.tag_name) {
        writeCache({ lastCheck: Date.now(), latestVersion: data.tag_name });
      }
    })
    .catch(() => {
      // Silently ignore — don't block the CLI
    });
}

/** Compare semver strings, returns true if remote > local */
function isNewer(local: string, remote: string): boolean {
  // Strip leading 'v' and any build metadata (+sha)
  const clean = (v: string) => v.replace(/^v/, "").replace(/\+.*$/, "").replace(/-.*$/, "");
  const localParts = clean(local).split(".").map(Number);
  const remoteParts = clean(remote).split(".").map(Number);

  for (let i = 0; i < 3; i++) {
    const l = localParts[i] || 0;
    const r = remoteParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

/**
 * Check for updates and print a notice to stderr if a newer version exists.
 * Non-blocking: reads cache synchronously, fires background fetch if stale.
 *
 * @param currentVersion - Current CLI version string (e.g. "0.5.0+abc1234")
 */
export function checkForUpdate(currentVersion: string): void {
  // Skip for agents (--json mode) and when explicitly disabled
  if (process.argv.includes("--json") || process.env.SWAIN_NO_UPDATE_CHECK === "1") {
    return;
  }

  // Skip if version is dev build
  if (currentVersion.startsWith("0.0.0-dev")) {
    return;
  }

  const cache = readCache();

  if (!cache || Date.now() - cache.lastCheck > TTL_MS) {
    // Cache is stale or missing — fire background fetch (don't block)
    backgroundFetch();
  }

  // If we have a cached latest version and it's newer, notify
  if (cache?.latestVersion && isNewer(currentVersion, cache.latestVersion)) {
    console.error(
      `\x1b[33mA newer version of swain is available: ${cache.latestVersion} (current: v${currentVersion.replace(/\+.*$/, "")})\x1b[0m`
    );
    console.error(
      `\x1b[2mUpdate: curl -fsSL https://raw.githubusercontent.com/${REPO}/main/cli/install.sh | bash\x1b[0m`
    );
  }
}
