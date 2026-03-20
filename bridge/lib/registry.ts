/**
 * Registry — maps Discord channels to Sprites.
 *
 * Simple JSON config for now. Move to Convex later.
 */

import type { SpriteConfig } from "./sprites.ts";

export type RegistryEntry = SpriteConfig & {
  name: string;
  discordChannelIds: string[]; // guild channel IDs this Sprite listens to
  allowDMs: boolean; // whether this Sprite accepts DMs
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
 * Find a Sprite that accepts DMs (for now, first one wins).
 */
export function findForDM(): RegistryEntry | undefined {
  return entries.find((e) => e.allowDMs);
}

/**
 * Get all registered Sprites.
 */
export function listAll(): RegistryEntry[] {
  return entries;
}
