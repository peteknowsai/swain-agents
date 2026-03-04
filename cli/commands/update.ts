/**
 * Update Command
 * swain update check [--json]
 *
 * Explicit version check against GitHub Releases.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { parseArgs } from "../lib/args";
import { print, printSuccess, printError, colors } from "../lib/worker-client";

const CACHE_DIR = join(homedir(), ".swain");
const CACHE_FILE = join(CACHE_DIR, "update-check.json");
const REPO = "peteknowsai/swain-agents";

const VERSION = `${process.env.CLI_VERSION || "0.0.0-dev"}`;

function cleanVersion(v: string): string {
  return v.replace(/^v/, "").replace(/\+.*$/, "").replace(/-.*$/, "");
}

function isNewer(local: string, remote: string): boolean {
  const localParts = cleanVersion(local).split(".").map(Number);
  const remoteParts = cleanVersion(remote).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const l = localParts[i] || 0;
    const r = remoteParts[i] || 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

async function fetchLatest(): Promise<string | null> {
  try {
    const res = await fetch(
      `https://api.github.com/repos/${REPO}/releases/latest`,
      {
        headers: { Accept: "application/vnd.github.v3+json" },
        signal: AbortSignal.timeout(10000),
      }
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const tag = data?.tag_name;
    if (tag) {
      // Update cache
      if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(
        CACHE_FILE,
        JSON.stringify({ lastCheck: Date.now(), latestVersion: tag })
      );
    }
    return tag || null;
  } catch {
    return null;
  }
}

async function check(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params["json"] === "true";

  const latest = await fetchLatest();

  if (!latest) {
    if (jsonOutput) {
      console.log(
        JSON.stringify({ success: false, error: "Could not reach GitHub" })
      );
    } else {
      printError("Could not reach GitHub Releases API");
    }
    process.exit(1);
  }

  const current = cleanVersion(VERSION);
  const latestClean = cleanVersion(latest);
  const updateAvailable = isNewer(VERSION, latest);

  if (jsonOutput) {
    console.log(
      JSON.stringify({
        current,
        latest: latestClean,
        updateAvailable,
      })
    );
    return;
  }

  print(`  Current: ${colors.bold}v${current}${colors.reset}`);
  print(`  Latest:  ${colors.bold}v${latestClean}${colors.reset}`);

  if (updateAvailable) {
    print(
      `\n  ${colors.yellow}Update available!${colors.reset} Run:\n  curl -fsSL https://raw.githubusercontent.com/${REPO}/main/cli/install.sh | bash`
    );
  } else {
    printSuccess("You're on the latest version");
  }
}

export async function run(args: string[]): Promise<void> {
  const sub = args[0];
  const subArgs = args.slice(1);

  switch (sub) {
    case "check":
      await check(subArgs);
      break;
    case "--help":
    case "-h":
    case undefined:
      print(`
${colors.bold}swain update${colors.reset} — Version management

${colors.bold}SUBCOMMANDS${colors.reset}
  check [--json]    Check for a newer CLI version
`);
      break;
    default:
      printError(`Unknown subcommand: ${sub}`);
      process.exit(1);
  }
}
