#!/usr/bin/env bun

/**
 * Desk Commands
 * swain desk list|get|create|update|delete|pause|unpause|search|request|requests|fulfill
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

function getApiConfig(): { apiUrl: string; apiToken: string } {
  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';
  const apiToken = process.env.SWAIN_AGENT_API_TOKEN || '';
  if (!apiToken) {
    printError('SWAIN_AGENT_API_TOKEN env var required for desk management');
    process.exit(1);
  }
  return { apiUrl, apiToken };
}

function apiHeaders(token: string): Record<string, string> {
  return { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' };
}

/**
 * swain desk list [--json]
 * List all content desk agents — prefers agent API (includes paused status),
 * falls back to Convex if no API token set.
 */
async function listDesks(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';

  const apiToken = process.env.SWAIN_AGENT_API_TOKEN;
  const apiUrl = process.env.SWAIN_AGENT_API_URL || 'http://localhost:3847';

  let desks: any[];

  if (apiToken) {
    // Prefer agent API — has paused status
    const res = await fetch(`${apiUrl}/desks`, {
      headers: { 'Authorization': `Bearer ${apiToken}` },
    });
    const result = await res.json() as any;
    if (!res.ok) {
      printError(result.error || 'Failed to list desks from agent API');
      process.exit(1);
    }
    desks = result.desks || [];
  } else {
    // Fall back to Convex
    const result = await workerRequest('/agents?type=desk');
    desks = (result.agents || []).filter((a: any) => a.type === 'desk');
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, desks, count: desks.length }, null, 2));
    return;
  }

  if (desks.length === 0) {
    print('No content desks found');
    return;
  }

  print(`\n${colors.bold}CONTENT DESKS (${desks.length})${colors.reset}\n`);
  print(`${'AGENT ID'.padEnd(30)} ${'NAME'.padEnd(20)} ${'STATUS'.padEnd(10)} ${'REGION'}`);
  print(`${'-'.repeat(30)} ${'-'.repeat(20)} ${'-'.repeat(10)} ${'-'.repeat(30)}`);

  for (const d of desks) {
    const id = (d.id || d.agentId || d.agent_id || '').slice(0, 29).padEnd(30);
    const name = (d.name || '-').slice(0, 19).padEnd(20);
    const paused = d.paused;
    const status = paused
      ? `${colors.yellow}paused${colors.reset}`.padEnd(10 + colors.yellow.length + colors.reset.length)
      : `${colors.green}active${colors.reset}`.padEnd(10 + colors.green.length + colors.reset.length);
    const region = d.region || '-';
    print(`${id} ${name} ${status} ${region}`);
  }
  print('');
}

/**
 * swain desk get <name> [--json]
 * Get full desk record from Convex
 */
async function getDesk(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk get <name> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/desks/${encodeURIComponent(name)}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const d = result;
  print(`\n${colors.bold}DESK: ${d.name}${colors.reset}\n`);
  print(`  Region:         ${d.region || '-'}`);
  print(`  Status:         ${d.status || '-'}`);
  print(`  Agent ID:       ${d.agentId || '-'}`);
  print(`  Description:    ${d.description || '-'}`);
  print(`  Scope:          ${d.scope || '-'}`);
  if (d.center) {
    print(`  Center:         ${d.center.lat}, ${d.center.lon}`);
  }
  if (d.bounds) {
    print(`  Bounds:         ${d.bounds.sw.lat},${d.bounds.sw.lon} -> ${d.bounds.ne.lat},${d.bounds.ne.lon}`);
  }
  print(`  Created By:     ${d.createdByLocation || '-'}`);
  print(`  Created At:     ${d.createdAt ? new Date(d.createdAt).toISOString() : '-'}`);

  const micros = d.microlocations || [];
  print(`\n  ${colors.bold}Microlocations (${micros.length})${colors.reset}`);
  for (const m of micros) {
    print(`    ${colors.cyan}${m.name}${colors.reset} [${m.type}] — ${m.notes || ''}`);
  }

  const marinas = d.marinas || [];
  print(`\n  ${colors.bold}Marinas (${marinas.length})${colors.reset}`);
  for (const m of marinas) {
    const rating = m.placesData?.rating ? ` (${m.placesData.rating})` : '';
    print(`    ${colors.cyan}${m.name}${colors.reset} [${m.type}]${rating} — ${m.notes || ''}`);
  }

  const topics = d.contentTopics || [];
  print(`\n  ${colors.bold}Topics${colors.reset}: ${topics.join(', ') || '-'}`);

  if (d.cardCount !== undefined) print(`  Cards:          ${d.cardCount}`);
  if (d.userCount !== undefined) print(`  Users:          ${d.userCount}`);
  if (d.pendingRequestCount !== undefined) print(`  Pending Reqs:   ${d.pendingRequestCount}`);
  print('');
}

/**
 * swain desk create --name=<slug> --region=<description> --lat=N --lon=N [--scope=...] [--description=...] [--created-by-location=...] [--json]
 * Provision a new content desk via the agent API
 */
async function createDesk(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = params['name'];
  const region = params['region'];
  const lat = params['lat'];
  const lon = params['lon'];
  const scope = params['scope'];
  const description = params['description'];
  const createdByLocation = params['created-by-location'];

  if (!name || !region) {
    printError('Usage: swain desk create --name=<slug> --region="..." [--lat=N] [--lon=N] [--scope="..."] [--description="..."] [--created-by-location="..."]');
    process.exit(1);
  }

  const { apiUrl, apiToken } = getApiConfig();

  const body: Record<string, any> = { name, region };
  if (lat) body.lat = parseFloat(lat);
  if (lon) body.lon = parseFloat(lon);
  if (scope) body.scope = scope;
  if (description) body.description = description;
  if (createdByLocation) body.createdByLocation = createdByLocation;

  const res = await fetch(`${apiUrl}/desks`, {
    method: 'POST',
    headers: apiHeaders(apiToken),
    body: JSON.stringify(body),
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || 'Failed to create desk');
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Created content desk: ${(result as any).agentId} (region: ${region})`);
  }
}

/**
 * swain desk update <name> [--status=...] [--microlocations='[...]'] [--marinas='[...]'] [--topics='[...]'] [--scope="..."] [--description="..."] [--json]
 * Update desk record in Convex
 */
async function updateDesk(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk update <name> [--status=...] [--microlocations=\'[...]\'] [--marinas=\'[...]\'] [--topics=\'[...]\'] [--scope="..."] [--description="..."] [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = {};

  if (params['status']) body.status = params['status'];
  if (params['scope']) body.scope = params['scope'];
  if (params['description']) body.description = params['description'];

  // JSON array fields
  for (const field of ['microlocations', 'marinas', 'topics'] as const) {
    if (params[field]) {
      try {
        const key = field === 'topics' ? 'contentTopics' : field;
        body[key] = JSON.parse(params[field]);
      } catch {
        printError(`Invalid JSON for --${field}`);
        process.exit(1);
      }
    }
  }

  if (Object.keys(body).length === 0) {
    printError('No fields provided. Use --status, --microlocations, --marinas, --topics, --scope, --description');
    process.exit(1);
  }

  const result = await workerRequest(`/desks/${encodeURIComponent(name)}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success !== false) {
    printSuccess(`Updated desk: ${name}`);
    for (const [key, value] of Object.entries(body)) {
      const display = Array.isArray(value) ? `[${value.length} items]` : value;
      print(`  ${colors.cyan}${key}${colors.reset} = ${display}`);
    }
  } else {
    printError(result.error || 'Update failed');
    process.exit(1);
  }
}

/**
 * swain desk search --lat=N --lon=N [--radius=50] [--json]
 * Search for desks near a point
 */
async function searchDesks(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const lat = params['lat'];
  const lon = params['lon'];
  const radius = params['radius'] || '50';

  if (!lat || !lon) {
    printError('Usage: swain desk search --lat=N --lon=N [--radius=50] [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/desks/search?lat=${lat}&lon=${lon}&radiusMiles=${radius}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const desks = result.desks || [];
  if (desks.length === 0) {
    print(`No desks found within ${radius} miles`);
    return;
  }

  print(`\n${colors.bold}Found ${desks.length} desk(s) within ${radius} miles:${colors.reset}\n`);
  for (const d of desks) {
    const bounds = d.withinBounds ? ` ${colors.green}-- within bounds${colors.reset}` : '';
    print(`  ${colors.bold}${d.name}${colors.reset} (${d.distanceMiles.toFixed(1)} mi)${bounds}`);
    if (d.scope) print(`    ${d.scope}`);
    print('');
  }
}

/**
 * swain desk request --desk=<name> --topic="..." --category=<cat> [--location=...] [--user=...] [--requested-by=...] [--json]
 * File an editorial signal to a desk
 */
async function createRequest(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const desk = params['desk'];
  const topic = params['topic'];
  const category = params['category'];
  const location = params['location'];
  const userId = params['user'];
  const requestedBy = params['requested-by'] || process.env.OPENCLAW_AGENT_ID || 'unknown';

  if (!desk || !topic || !category) {
    printError('Usage: swain desk request --desk=<name> --topic="..." --category=<cat> [--location=...] [--user=...] [--requested-by=<agentId>] [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = { topic, category, requestedBy };
  if (location) body.location = location;
  if (userId) body.userId = userId;

  const result = await workerRequest(`/desks/${encodeURIComponent(desk)}/requests`, {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.id) {
    printSuccess(`Request filed: ${result.id} (${topic})`);
  } else {
    printError(result.error || 'Failed to create request');
    process.exit(1);
  }
}

/**
 * swain desk requests --desk=<name> [--status=pending] [--json]
 * List editorial requests for a desk
 */
async function listRequests(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const desk = params['desk'];
  const status = params['status'];

  if (!desk) {
    printError('Usage: swain desk requests --desk=<name> [--status=pending] [--json]');
    process.exit(1);
  }

  let url = `/desks/${encodeURIComponent(desk)}/requests`;
  if (status) url += `?status=${encodeURIComponent(status)}`;

  const result = await workerRequest(url);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const requests = result.requests || [];
  if (requests.length === 0) {
    print(`No ${status || ''} requests for desk ${desk}`);
    return;
  }

  print(`\n${colors.bold}DESK REQUESTS — ${desk} (${requests.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(20)} ${'STATUS'.padEnd(12)} ${'CATEGORY'.padEnd(20)} ${'TOPIC'}`);
  print(`${'-'.repeat(20)} ${'-'.repeat(12)} ${'-'.repeat(20)} ${'-'.repeat(40)}`);

  for (const r of requests) {
    const id = (r.id || '').slice(0, 19).padEnd(20);
    const st = (r.status || '').padEnd(12);
    const cat = (r.category || '').slice(0, 19).padEnd(20);
    print(`${id} ${st} ${cat} ${r.topic || ''}`);
  }
  print('');
}

/**
 * swain desk fulfill --desk=<name> --request=<id> --card=<cardId> [--json]
 * Mark a desk request as fulfilled
 */
async function fulfillRequest(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const desk = params['desk'];
  const requestId = params['request'];
  const cardId = params['card'];

  if (!desk || !requestId || !cardId) {
    printError('Usage: swain desk fulfill --desk=<name> --request=<id> --card=<cardId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/desks/${encodeURIComponent(desk)}/requests/${encodeURIComponent(requestId)}`, {
    method: 'PATCH',
    body: { status: 'fulfilled', fulfilledBy: cardId },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success !== false) {
    printSuccess(`Request ${requestId} fulfilled by card ${cardId}`);
  } else {
    printError(result.error || 'Failed to fulfill request');
    process.exit(1);
  }
}

/**
 * swain desk delete <name> [--json]
 * Delete a content desk via the agent API
 */
async function deleteDesk(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk delete <name>');
    process.exit(1);
  }

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks/${name}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || `Failed to delete desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Deleted content desk: ${name}`);
  }
}

/**
 * swain desk pause <name> [--json]
 * Pause a content desk (remove heartbeat, keep agent registered)
 */
async function pauseDeskCmd(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk pause <name>');
    process.exit(1);
  }

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks/${name}/pause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || `Failed to pause desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Paused content desk: ${name}`);
  }
}

/**
 * swain desk unpause <name> [--json]
 * Unpause a content desk (restore 4h heartbeat)
 */
async function unpauseDeskCmd(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const name = args.find(a => !a.startsWith('--'));

  if (!name) {
    printError('Usage: swain desk unpause <name>');
    process.exit(1);
  }

  const { apiUrl, apiToken } = getApiConfig();

  const res = await fetch(`${apiUrl}/desks/${name}/unpause`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiToken}` },
  });

  const result = await res.json();

  if (!res.ok) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: (result as any).error }, null, 2));
    } else {
      printError((result as any).error || `Failed to unpause desk ${name}`);
    }
    process.exit(1);
  }

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result as any }, null, 2));
  } else {
    printSuccess(`Unpaused content desk: ${name}`);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain desk${colors.reset} - Content desk management

${colors.bold}COMMANDS${colors.reset}
  list                    List all content desks (with status)
  get <name>              Get full desk record (microlocations, marinas, stats)
  create                  Provision a new content desk
  update <name>           Update desk record (status, microlocations, marinas, etc.)
  delete <name>           Delete a content desk
  pause <name>            Pause a desk (stops heartbeat, keeps agent)
  unpause <name>          Unpause a desk (restores 4h heartbeat)
  search                  Find desks near a point (geo search)
  request                 File an editorial signal to a desk
  requests                List editorial requests for a desk
  fulfill                 Mark a desk request as fulfilled

${colors.bold}CREATE OPTIONS${colors.reset}
  --name=<slug>           Desk name slug (lowercase-hyphenated)
  --region=<description>  Region description (e.g., "Tampa Bay, FL")
  --lat=<number>          Center latitude
  --lon=<number>          Center longitude
  --scope="..."           Natural language geographic boundary
  --description="..."     Cruising ground description
  --created-by-location   Raw user input that triggered creation

${colors.bold}UPDATE OPTIONS${colors.reset}
  --status=<status>       active, paused, provisioning
  --microlocations='[..]' JSON array of microlocation objects
  --marinas='[...]'       JSON array of marina objects
  --topics='[...]'        JSON array of content topic strings
  --scope="..."           Update geographic scope
  --description="..."     Update description

${colors.bold}SEARCH OPTIONS${colors.reset}
  --lat=<number>          Center latitude
  --lon=<number>          Center longitude
  --radius=<miles>        Search radius in miles (default: 50)

${colors.bold}REQUEST OPTIONS${colors.reset}
  --desk=<name>           Target desk
  --topic="..."           What the desk should cover
  --category=<cat>        Card category (weather-tides, fishing-reports, etc.)
  --location="..."        Specific microlocation (optional)
  --user=<userId>         Captain who sparked this (optional context)
  --requested-by=<id>     Advisor agent ID (auto-detected from OPENCLAW_AGENT_ID)

${colors.bold}FULFILL OPTIONS${colors.reset}
  --desk=<name>           Desk name
  --request=<id>          Request ID to fulfill
  --card=<cardId>         Card ID that fulfills the request

${colors.bold}GENERAL OPTIONS${colors.reset}
  --json                  Output as JSON

${colors.bold}ENVIRONMENT${colors.reset}
  SWAIN_AGENT_API_TOKEN   Required for create/delete/pause/unpause (agent API auth)
  SWAIN_AGENT_API_URL     Override agent API URL (default: http://localhost:3847)

${colors.bold}EXAMPLES${colors.reset}
  swain desk list
  swain desk get tampa-bay --json
  swain desk create --name=north-lake-tahoe --region="North Lake Tahoe, CA" --lat=39.18 --lon=-120.14 --scope="North and west shores..." --json
  swain desk update tampa-bay --status=active --microlocations='[{"name":"Tierra Verde","type":"island","notes":"...","addedBy":"places-api"}]' --json
  swain desk search --lat=27.77 --lon=-82.64 --radius=50 --json
  swain desk request --desk=tampa-bay --topic="fuel docks" --category=maintenance-care --json
  swain desk requests --desk=tampa-bay --status=pending --json
  swain desk fulfill --desk=tampa-bay --request=req_123 --card=card_456 --json
`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'list':
        await listDesks(commandArgs);
        break;
      case 'get':
        await getDesk(commandArgs);
        break;
      case 'create':
      case 'add':
        await createDesk(commandArgs);
        break;
      case 'update':
        await updateDesk(commandArgs);
        break;
      case 'delete':
      case 'remove':
        await deleteDesk(commandArgs);
        break;
      case 'pause':
        await pauseDeskCmd(commandArgs);
        break;
      case 'unpause':
      case 'resume':
        await unpauseDeskCmd(commandArgs);
        break;
      case 'search':
        await searchDesks(commandArgs);
        break;
      case 'request':
        await createRequest(commandArgs);
        break;
      case 'requests':
        await listRequests(commandArgs);
        break;
      case 'fulfill':
        await fulfillRequest(commandArgs);
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
