/**
 * Discord bot — receives messages, forwards to Sprites, relays replies.
 */

import {
  Client,
  GatewayIntentBits,
  Partials,
  ChannelType,
  type Message,
  type TextBasedChannel,
} from "discord.js";
import { findByChannel, findForDM } from "./registry.ts";
import { sendToSprite } from "./sprites.ts";

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
if (!DISCORD_BOT_TOKEN) {
  console.error("[discord] DISCORD_BOT_TOKEN required");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

// Track pending replies so we can show typing indicators
const activeChats = new Map<string, NodeJS.Timeout>();

function startTyping(channel: TextBasedChannel): void {
  const chatId = channel.id;
  if (activeChats.has(chatId)) return;

  // Send typing indicator every 8s (Discord typing lasts ~10s)
  const send = () => {
    if ("sendTyping" in channel) {
      void channel.sendTyping().catch(() => {});
    }
  };
  send();
  activeChats.set(chatId, setInterval(send, 8000));
}

function stopTyping(chatId: string): void {
  const timer = activeChats.get(chatId);
  if (timer) {
    clearInterval(timer);
    activeChats.delete(chatId);
  }
}

client.on("messageCreate", (msg) => {
  if (msg.author.bot) return;
  handleMessage(msg).catch((err) =>
    console.error("[discord] handleMessage error:", err)
  );
});

async function handleMessage(msg: Message): Promise<void> {
  const isDM = msg.channel.type === ChannelType.DM;

  // Find the right Sprite for this message
  const entry = isDM ? findForDM() : findByChannel(msg.channelId);
  if (!entry) return; // no Sprite registered for this channel

  // Start typing indicator
  startTyping(msg.channel as TextBasedChannel);

  // Forward to Sprite's channel server
  const ok = await sendToSprite(entry, "/message", {
    text: msg.content,
    chatId: msg.channelId,
    messageId: msg.id,
    user: msg.author.username,
    userId: msg.author.id,
  });

  if (!ok) {
    stopTyping(msg.channelId);
    await msg.reply("Sorry, I couldn't reach that advisor right now.").catch(() => {});
  }
}

/**
 * Send a reply back to Discord. Called when a Sprite responds.
 */
export async function sendReply(
  chatId: string,
  text: string,
  replyTo?: string
): Promise<string | null> {
  stopTyping(chatId);

  try {
    const channel = await client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) {
      console.error(`[discord] channel ${chatId} not found or not text-based`);
      return null;
    }

    // Chunk if > 2000 chars
    const chunks = chunkText(text, 2000);
    let lastId: string | null = null;

    for (let i = 0; i < chunks.length; i++) {
      const sent = await (channel as TextBasedChannel).send({
        content: chunks[i],
        ...(i === 0 && replyTo
          ? { reply: { messageReference: replyTo, failIfNotExists: false } }
          : {}),
      });
      lastId = sent.id;
    }

    return lastId;
  } catch (err) {
    console.error(`[discord] sendReply error:`, err);
    return null;
  }
}

/**
 * Send an image to Discord.
 */
export async function sendImage(
  chatId: string,
  url: string,
  caption?: string
): Promise<string | null> {
  stopTyping(chatId);

  try {
    const channel = await client.channels.fetch(chatId);
    if (!channel || !channel.isTextBased()) return null;

    const sent = await (channel as TextBasedChannel).send({
      content: caption ?? "",
      files: [url],
    });
    return sent.id;
  } catch (err) {
    console.error(`[discord] sendImage error:`, err);
    return null;
  }
}

function chunkText(text: string, limit: number): string[] {
  if (text.length <= limit) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    const cut = rest.lastIndexOf("\n", limit);
    const split = cut > limit / 2 ? cut : limit;
    out.push(rest.slice(0, split));
    rest = rest.slice(split).replace(/^\n+/, "");
  }
  if (rest) out.push(rest);
  return out;
}

export async function startBot(): Promise<void> {
  client.once("ready", (c) => {
    console.log(`[discord] connected as ${c.user.tag}`);
  });
  await client.login(DISCORD_BOT_TOKEN);
}
