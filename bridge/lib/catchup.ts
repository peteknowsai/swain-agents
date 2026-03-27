/**
 * Catch-up polling — replays missed iMessages on Bridge startup.
 *
 * Stores the timestamp of the last processed message on disk.
 * On startup, queries BlueBubbles for anything newer and processes it.
 */

import { queryRecentMessages, parseBBQueryMessage } from "./bluebubbles.ts";

const TIMESTAMP_FILE = process.env.CATCHUP_FILE ?? "./last-processed.json";

type ProcessFn = (parsed: {
  text: string;
  address: string;
  chatGuid: string;
  messageGuid: string;
}) => Promise<boolean>;

/**
 * Load the last-processed timestamp from disk.
 * Returns Date.now() on first run (nothing to catch up on).
 */
export async function loadLastProcessed(): Promise<number> {
  try {
    const file = Bun.file(TIMESTAMP_FILE);
    if (await file.exists()) {
      const data = await file.json();
      return data.timestamp ?? Date.now();
    }
  } catch {}

  // First run — initialize file and skip catch-up
  await saveLastProcessed(Date.now());
  return Date.now();
}

/**
 * Persist the last-processed timestamp to disk.
 */
export async function saveLastProcessed(timestampMs: number): Promise<void> {
  await Bun.write(
    TIMESTAMP_FILE,
    JSON.stringify({ timestamp: timestampMs }, null, 2)
  );
}

/**
 * Query BlueBubbles for missed messages and process them.
 * Paginates if more than 100 results.
 */
export async function runCatchUp(processMessage: ProcessFn): Promise<void> {
  const lastTs = await loadLastProcessed();
  const ageSeconds = Math.floor((Date.now() - lastTs) / 1000);
  console.log(
    `[catchup] last processed: ${new Date(lastTs).toISOString()} (${ageSeconds}s ago)`
  );

  let cursor = lastTs;
  let totalProcessed = 0;

  while (true) {
    const messages = await queryRecentMessages(cursor);

    if (messages.length === 0) break;

    for (const msg of messages) {
      const parsed = parseBBQueryMessage(msg);
      if (!parsed) continue;

      console.log(
        `[catchup] replaying message from ${parsed.address}: ${parsed.text.slice(0, 60)}`
      );

      const ok = await processMessage(parsed);
      if (ok) {
        cursor = parsed.dateCreated;
        await saveLastProcessed(cursor);
        totalProcessed++;
      }
    }

    // If we got a full page, there might be more
    if (messages.length < 100) break;
  }

  if (totalProcessed > 0) {
    console.log(`[catchup] processed ${totalProcessed} missed message(s)`);
  } else {
    console.log(`[catchup] no missed messages`);
  }
}
