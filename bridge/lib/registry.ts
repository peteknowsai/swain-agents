/**
 * Registry — maps Discord channels and phone numbers to Sprites.
 *
 * Simple JSON config for now. Move to Convex later.
 */

import type { SpriteConfig } from "./sprites.ts";

export type RegistryEntry = SpriteConfig & {
  name: string;
  discordChannelIds: string[]; // guild channel IDs this Sprite listens to
  allowDMs: boolean; // whether this Sprite accepts Discord DMs
  phoneNumbers: string[]; // iMessage addresses (phone or email) routed to this Sprite
};

let entries: RegistryEntry[] = [];

/**
 * Load registry from a config file or env var.
 */
export function loadRegistry(config: RegistryEntry[]): void {
  entries = config;
  console.log(
    `[registry] loaded ${entries.length} sprite(s): ${entries.map((e) => e.name).join(", ")}`
  );
}

/**
 * Find a Sprite by Discord channel ID.
 */
export function findByChannel(channelId: string): RegistryEntry | undefined {
  return entries.find((e) => e.discordChannelIds.includes(channelId));
}

/**
 * Find a Sprite that accepts Discord DMs (first one wins).
 */
export function findForDM(): RegistryEntry | undefined {
  return entries.find((e) => e.allowDMs);
}

/**
 * Find a Sprite by phone number or iMessage address.
 */
export function findByPhone(address: string): RegistryEntry | undefined {
  // Normalize: strip spaces/dashes for comparison
  const normalized = address.replace(/[\s\-()]/g, "");
  return entries.find((e) =>
    e.phoneNumbers.some((p) => p.replace(/[\s\-()]/g, "") === normalized)
  );
}

/**
 * Find the default Sprite for unregistered iMessage senders.
 */
export function findDefaultForIMessage(): RegistryEntry | undefined {
  // For now, first sprite with any phoneNumbers config gets unregistered messages
  return entries.find((e) => e.phoneNumbers.length > 0);
}

/**
 * Get all registered Sprites.
 */
export function listAll(): RegistryEntry[] {
  return entries;
}
