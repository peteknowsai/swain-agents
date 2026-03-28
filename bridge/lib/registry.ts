/**
 * Registry — maps Discord channels and phone numbers to Sprites.
 *
 * Queries the shared SQLite database on every call. No in-memory cache —
 * SQLite is fast enough and this way the Bridge always sees fresh data
 * without needing a reload endpoint.
 */

import {
  findRouteByPhone,
  findRouteByChannel,
  findRouteForDM,
  listRoutes,
  type BridgeRoute,
} from "./db.ts";

export type RegistryEntry = {
  id: string;
  url: string;
  name: string;
  discordChannelIds: string[];
  allowDMs: boolean;
  phoneNumbers: string[];
};

/** Convert a DB route to the RegistryEntry shape used throughout the Bridge. */
function toEntry(route: BridgeRoute): RegistryEntry {
  return {
    id: route.agent_id,
    url: route.url,
    name: route.name,
    discordChannelIds: route.discord_channel_ids,
    allowDMs: route.allow_dms,
    phoneNumbers: route.phone_numbers,
  };
}

/**
 * Find a Sprite by Discord channel ID.
 */
export function findByChannel(channelId: string): RegistryEntry | undefined {
  const route = findRouteByChannel(channelId);
  return route ? toEntry(route) : undefined;
}

/**
 * Find a Sprite that accepts Discord DMs (first one wins).
 */
export function findForDM(): RegistryEntry | undefined {
  const route = findRouteForDM();
  return route ? toEntry(route) : undefined;
}

/**
 * Find a Sprite by phone number or iMessage address.
 */
export function findByPhone(address: string): RegistryEntry | undefined {
  const route = findRouteByPhone(address);
  return route ? toEntry(route) : undefined;
}

/**
 * Find the default Sprite for unregistered iMessage senders.
 */
export function findDefaultForIMessage(): RegistryEntry | undefined {
  const routes = listRoutes();
  const route = routes.find((r) => r.phone_numbers.length > 0);
  return route ? toEntry(route) : undefined;
}

/**
 * Get all registered Sprites.
 */
export function listAll(): RegistryEntry[] {
  return listRoutes().map(toEntry);
}
