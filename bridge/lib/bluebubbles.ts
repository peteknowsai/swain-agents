/**
 * BlueBubbles API client — send/receive iMessages via the Mac mini.
 */

const BB_URL = process.env.BLUEBUBBLES_URL ?? "https://messages.heyswain.com";
const BB_PASSWORD = process.env.BLUEBUBBLES_PASSWORD ?? "swain2026";

/**
 * Send a text message via iMessage.
 */
export async function sendMessage(
  address: string,
  text: string
): Promise<boolean> {
  const chatGuid = `iMessage;-;${address}`;

  try {
    const res = await fetch(
      `${BB_URL}/api/v1/message/text?password=${BB_PASSWORD}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatGuid,
          tempGuid: `bridge-${Date.now()}`,
          message: text,
          method: "private-api",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      // If chat doesn't exist, create it and send
      if (err.includes("Chat does not exist") || err.includes("not found")) {
        console.log(`[bluebubbles] chat not found for ${address}, creating new chat...`);
        return await sendNewChat(address, text);
      }
      console.error(`[bluebubbles] send failed: ${res.status} ${err}`);
      return false;
    }

    console.log(`[bluebubbles] sent to ${address}: ${text.slice(0, 50)}...`);
    return true;
  } catch (err) {
    console.error(`[bluebubbles] send error:`, err);
    return false;
  }
}

/**
 * Create a new iMessage chat and send the first message.
 * Used when the chat doesn't exist yet (first contact with this number).
 */
async function sendNewChat(address: string, text: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${BB_URL}/api/v1/chat/new?password=${BB_PASSWORD}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participants: [address],
          message: text,
          method: "private-api",
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[bluebubbles] new chat failed: ${res.status} ${err}`);
      return false;
    }

    console.log(`[bluebubbles] new chat + sent to ${address}: ${text.slice(0, 50)}...`);
    return true;
  } catch (err) {
    console.error(`[bluebubbles] new chat error:`, err);
    return false;
  }
}

/**
 * Send typing indicator via Private API.
 */
export async function startTyping(chatGuid: string): Promise<void> {
  try {
    await fetch(
      `${BB_URL}/api/v1/chat/${chatGuid}/typing?password=${BB_PASSWORD}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "typing" }),
      }
    );
  } catch {}
}

export async function stopTyping(chatGuid: string): Promise<void> {
  try {
    await fetch(
      `${BB_URL}/api/v1/chat/${chatGuid}/typing?password=${BB_PASSWORD}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "idle" }),
      }
    );
  } catch {}
}

/**
 * Query recent messages from BlueBubbles (for catch-up after restart).
 */
export async function queryRecentMessages(
  afterMs: number
): Promise<any[]> {
  try {
    const res = await fetch(
      `${BB_URL}/api/v1/message/query?password=${BB_PASSWORD}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          after: afterMs,
          sort: "ASC",
          limit: 100,
          with: ["chat", "handle"],
          where: [
            {
              statement: "message.is_from_me = :value",
              args: { value: 0 },
            },
          ],
        }),
        signal: AbortSignal.timeout(15_000),
      }
    );

    if (!res.ok) {
      console.error(`[bluebubbles] query failed: ${res.status}`);
      return [];
    }

    const json = await res.json();
    return json.data ?? json ?? [];
  } catch (err) {
    console.error(`[bluebubbles] query error:`, err);
    return [];
  }
}

/**
 * Parse a BlueBubbles query API message into the same shape as parseWebhook.
 */
export function parseBBQueryMessage(msg: any): {
  text: string;
  address: string;
  chatGuid: string;
  messageGuid: string;
  dateCreated: number;
} | null {
  if (msg.isFromMe) return null;
  const address = msg.handle?.address;
  if (!address) return null;
  const text = msg.text;
  if (!text) return null;
  const chatGuid = msg.chats?.[0]?.guid ?? `iMessage;-;${address}`;
  return {
    text,
    address,
    chatGuid,
    messageGuid: msg.guid ?? "",
    dateCreated: msg.dateCreated ?? Date.now(),
  };
}

/**
 * Parse an inbound BlueBubbles webhook payload.
 * Returns null if the message should be ignored (e.g. from us).
 */
export function parseWebhook(body: any): {
  text: string;
  address: string;
  chatGuid: string;
  messageGuid: string;
} | null {
  const type = body.type;

  // Only handle new messages
  if (type !== "new-message") return null;

  const data = body.data;
  if (!data) return null;

  // Ignore messages we sent
  if (data.isFromMe) return null;

  // Extract sender address
  const address = data.handle?.address;
  if (!address) return null;

  const text = data.text;
  if (!text) return null;

  const chatGuid = data.chats?.[0]?.guid ?? `iMessage;-;${address}`;

  return {
    text,
    address,
    chatGuid,
    messageGuid: data.guid ?? "",
  };
}
