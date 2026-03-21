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
  // macOS 26 uses "any" prefix instead of "iMessage"
  const chatGuid = `any;-;${address}`;

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
        }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
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

  const chatGuid = data.chats?.[0]?.guid ?? `any;-;${address}`;

  return {
    text,
    address,
    chatGuid,
    messageGuid: data.guid ?? "",
  };
}
