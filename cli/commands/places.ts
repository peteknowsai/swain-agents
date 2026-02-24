#!/usr/bin/env bun

/**
 * Places Commands
 * swain places geocode|search
 *
 * Direct Google API calls — no Convex involved.
 */

import {
  print,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

function getApiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    printError('GOOGLE_PLACES_API_KEY env var required for places commands');
    process.exit(1);
  }
  return key;
}

/**
 * swain places geocode --location="Tierra Verde, FL" [--json]
 */
async function geocode(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const location = params['location'];

  if (!location) {
    printError('Usage: swain places geocode --location="Tierra Verde, FL" [--json]');
    process.exit(1);
  }

  const apiKey = getApiKey();
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.status !== 'OK' || !data.results?.length) {
    printError(`Geocoding failed: ${data.status} — ${data.error_message || 'no results'}`);
    process.exit(1);
  }

  const result = data.results[0];
  const geo = result.geometry;

  const output = {
    formattedAddress: result.formatted_address,
    lat: geo.location.lat,
    lon: geo.location.lng,
    viewport: {
      ne: { lat: geo.viewport.northeast.lat, lon: geo.viewport.northeast.lng },
      sw: { lat: geo.viewport.southwest.lat, lon: geo.viewport.southwest.lng },
    },
    placeId: result.place_id,
  };

  if (jsonOutput) {
    console.log(JSON.stringify(output, null, 2));
    return;
  }

  print(`\n${colors.bold}${output.formattedAddress}${colors.reset}`);
  print(`  lat: ${output.lat}  lon: ${output.lon}`);
  print(`  viewport: ${output.viewport.sw.lat},${output.viewport.sw.lon} -> ${output.viewport.ne.lat},${output.viewport.ne.lon}`);
  print(`  placeId: ${output.placeId}`);
  print('');
}

/**
 * swain places search --query="marina" --lat=27.77 --lon=-82.64 [--radius=5000] [--type=marina] [--json]
 */
async function search(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const query = params['query'];
  const lat = params['lat'];
  const lon = params['lon'];
  const radius = params['radius'] || '5000';
  const type = params['type'];

  if (!query || !lat || !lon) {
    printError('Usage: swain places search --query="marina" --lat=N --lon=N [--radius=5000] [--type=marina] [--json]');
    process.exit(1);
  }

  const apiKey = getApiKey();
  let url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lon}&radius=${radius}&keyword=${encodeURIComponent(query)}&key=${apiKey}`;
  if (type) {
    url += `&type=${encodeURIComponent(type)}`;
  }

  const res = await fetch(url);
  const data = await res.json() as any;

  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    printError(`Places search failed: ${data.status} — ${data.error_message || 'unknown error'}`);
    process.exit(1);
  }

  const results = (data.results || []).map((r: any) => ({
    name: r.name,
    address: r.vicinity || r.formatted_address || '',
    placeId: r.place_id,
    lat: r.geometry?.location?.lat,
    lon: r.geometry?.location?.lng,
    rating: r.rating || null,
    totalRatings: r.user_ratings_total || 0,
    types: r.types || [],
  }));

  if (jsonOutput) {
    console.log(JSON.stringify({ results }, null, 2));
    return;
  }

  if (results.length === 0) {
    print('No results found');
    return;
  }

  print(`\n${colors.bold}PLACES (${results.length})${colors.reset}\n`);
  print(`${'NAME'.padEnd(35)} ${'ADDRESS'.padEnd(40)} ${'RATING'}`);
  print(`${'-'.repeat(35)} ${'-'.repeat(40)} ${'-'.repeat(10)}`);

  for (const r of results) {
    const name = (r.name || '').slice(0, 34).padEnd(35);
    const addr = (r.address || '').slice(0, 39).padEnd(40);
    const rating = r.rating ? `${r.rating} (${r.totalRatings})` : '-';
    print(`${name} ${addr} ${rating}`);
  }
  print('');
}

function showHelp(): void {
  print(`
${colors.bold}swain places${colors.reset} - Google Places API tools

${colors.bold}COMMANDS${colors.reset}
  geocode                 Geocode a location string to lat/lon + viewport
  search                  Search for nearby places (marinas, ramps, etc.)

${colors.bold}OPTIONS${colors.reset}
  --location=<string>     Location to geocode (for geocode)
  --query=<string>        Search term (for search)
  --lat=<number>          Center latitude (for search)
  --lon=<number>          Center longitude (for search)
  --radius=<meters>       Search radius in meters (default: 5000)
  --type=<string>         Google Places type filter (e.g., marina, gas_station)
  --json                  Output as JSON

${colors.bold}ENVIRONMENT${colors.reset}
  GOOGLE_PLACES_API_KEY   Required. Google API key with Geocoding + Places enabled.

${colors.bold}EXAMPLES${colors.reset}
  swain places geocode --location="Tampa Bay, FL" --json
  swain places search --query="marina" --lat=27.77 --lon=-82.64 --radius=25000 --json
  swain places search --query="boat ramp" --lat=27.77 --lon=-82.64 --type=marina --json
`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'geocode':
        await geocode(commandArgs);
        break;
      case 'search':
        await search(commandArgs);
        break;
      case 'help':
      case '--help':
      case '-h':
      case undefined:
        showHelp();
        break;
      default:
        printError(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (err: any) {
    printError(err.message);
    process.exit(1);
  }
}
