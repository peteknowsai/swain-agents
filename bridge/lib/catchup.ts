/**
 * Catch-up polling — replays missed iMessages on Bridge startup.
 *
 * Reads the last-processed timestamp from SQLite.
 * On startup, queries BlueBubbles for anything newer and processes it.
 */

import { queryRecentMessages, parseBBQueryMessage } from "./bluebubbles.ts";
import { getLastProcessed, setLastProcessed } from "./db.ts";

export { setLastProcessed };

type ProcessFn = (parsed: {
  text: string;
  address: string;
  chatGuid: string;
  messageGuid: string;
}) => Promise<boolean>;

/**
 * Query BlueBubbles for missed messages and process them.
 * Paginates if more than 100 results.
 */
export async function runCatchUp(processMessage: ProcessFn): Promise<void> {
  const lastTs = getLastProcessed();
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
        setLastProcessed(cursor);
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
