#!/usr/bin/env bun

/**
 * Boat Commands
 * swain boat list|get|create|update|delete|photo
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';
import { fetchImageAsBase64 } from '../lib/image';

// All boat fields that can be set via CLI flags
const BOAT_FIELDS = [
  // Identity
  'name', 'makeModel', 'year', 'type', 'hullType', 'hullId', 'imageUrl',
  // Specs
  'length', 'beam', 'draft', 'airDraft',
  // Engine
  'engineType', 'engineMake', 'engineModel', 'engineHp', 'engineCount',
  'fuelType', 'fuelCapacity', 'engineHours',
  // Ownership
  'purchaseDate', 'purchasePrice', 'hasTrailer', 'hasLoan',
  // Insurance & registration
  'insuranceProvider', 'insurancePremiumAnnual', 'insuranceExpiry',
  'registrationExpiry', 'towingMembership',
  // Storage & marina
  'storageType', 'slipNumber', 'slipCostMonthly', 'dockPower',
  'liveaboard', 'winterStoragePlan', 'marinaLocation',
  // Usage
  'primaryLaunchRamp', 'cruisingRadiusMiles', 'tripsPerMonthEstimate',
  // Maintenance
  'lastOilChangeHours', 'lastOilChangeDate', 'lastBottomPaint',
  'lastHaulOut', 'serviceProvider',
  // Electronics
  'electronics',
  // Flags
  'isPrimary',
] as const;

// Fields that should be parsed as numbers
const NUMERIC_FIELDS = new Set([
  'length', 'draft', 'airDraft', 'engineHp', 'engineCount',
  'fuelCapacity', 'engineHours', 'purchaseDate', 'purchasePrice',
  'insurancePremiumAnnual', 'insuranceExpiry', 'registrationExpiry',
  'slipCostMonthly', 'cruisingRadiusMiles', 'tripsPerMonthEstimate',
  'lastOilChangeHours', 'lastOilChangeDate', 'lastBottomPaint', 'lastHaulOut',
]);

// Fields that should be parsed as booleans
const BOOLEAN_FIELDS = new Set([
  'hasTrailer', 'hasLoan', 'liveaboard', 'isPrimary',
]);

function parseFieldValue(field: string, value: string): any {
  if (BOOLEAN_FIELDS.has(field)) {
    return value === 'true';
  }
  if (NUMERIC_FIELDS.has(field)) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  return value;
}

/**
 * swain boat list --user=<userId> [--json]
 */
async function listBoats(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain boat list --user=<userId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/boats?userId=${userId}`);
  const boats = result.boats || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, boats, count: boats.length }, null, 2));
    return;
  }

  if (boats.length === 0) {
    print('No boats found for this user');
    return;
  }

  print(`\n${colors.bold}BOATS (${boats.length})${colors.reset}\n`);
  for (const b of boats) {
    const primary = b.isPrimary ? ` ${colors.green}★ PRIMARY${colors.reset}` : '';
    print(`${colors.bold}${b.name}${colors.reset}${primary}`);
    print(`  ID:         ${b.boatId}`);
    if (b.makeModel) print(`  Make/Model: ${b.makeModel}${b.year ? ` (${b.year})` : ''}`);
    if (b.length) print(`  Length:     ${b.length} ft`);
    if (b.engineMake || b.engineModel) print(`  Engine:     ${[b.engineMake, b.engineModel].filter(Boolean).join(' ')}${b.engineHp ? ` (${b.engineHp} HP)` : ''}${b.engineCount ? ` x${b.engineCount}` : ''}`);
    if (b.fuelType) print(`  Fuel:       ${b.fuelType}${b.fuelCapacity ? ` (${b.fuelCapacity} gal)` : ''}`);
    if (b.engineHours) print(`  Hours:      ${b.engineHours}`);
    if (b.marinaLocation) print(`  Marina:     ${b.marinaLocation}${b.slipNumber ? ` / Slip ${b.slipNumber}` : ''}`);
    if (b.storageType) print(`  Storage:    ${b.storageType}`);
    if (b.insuranceProvider) print(`  Insurance:  ${b.insuranceProvider}`);
    if (b.towingMembership) print(`  Towing:     ${b.towingMembership}`);
    print('');
  }
}

/**
 * swain boat get <boatId> [--json]
 */
async function getBoat(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const boatId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!boatId) {
    printError('Usage: swain boat get <boatId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/boats/${boatId}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success || !result.boat) {
    printError('Boat not found');
    process.exit(1);
  }

  const b = result.boat;
  const primary = b.isPrimary ? ` ${colors.green}★ PRIMARY${colors.reset}` : '';
  print(`\n${colors.bold}BOAT: ${b.name}${colors.reset}${primary}\n`);

  // Group fields by category for readability
  const sections: [string, [string, any][]][] = [
    ['IDENTITY', [
      ['ID', b.boatId], ['Name', b.name], ['Make/Model', b.makeModel], ['Year', b.year],
      ['Type', b.type], ['Hull Type', b.hullType], ['Hull ID', b.hullId],
    ]],
    ['SPECS', [
      ['Length', b.length ? `${b.length} ft` : null], ['Beam', b.beam],
      ['Draft', b.draft ? `${b.draft} ft` : null], ['Air Draft', b.airDraft ? `${b.airDraft} ft` : null],
    ]],
    ['ENGINE', [
      ['Engine Make', b.engineMake], ['Engine Model', b.engineModel], ['Type', b.engineType],
      ['HP', b.engineHp], ['Count', b.engineCount], ['Fuel Type', b.fuelType],
      ['Fuel Capacity', b.fuelCapacity ? `${b.fuelCapacity} gal` : null],
      ['Engine Hours', b.engineHours],
    ]],
    ['OWNERSHIP', [
      ['Purchase Date', b.purchaseDate ? new Date(b.purchaseDate).toISOString().slice(0, 10) : null],
      ['Purchase Price', b.purchasePrice ? `$${b.purchasePrice.toLocaleString()}` : null],
      ['Has Trailer', b.hasTrailer], ['Has Loan', b.hasLoan],
    ]],
    ['INSURANCE & REGISTRATION', [
      ['Insurance Provider', b.insuranceProvider],
      ['Annual Premium', b.insurancePremiumAnnual ? `$${b.insurancePremiumAnnual.toLocaleString()}` : null],
      ['Insurance Expiry', b.insuranceExpiry ? new Date(b.insuranceExpiry).toISOString().slice(0, 10) : null],
      ['Registration Expiry', b.registrationExpiry ? new Date(b.registrationExpiry).toISOString().slice(0, 10) : null],
      ['Towing Membership', b.towingMembership],
    ]],
    ['STORAGE', [
      ['Marina', b.marinaLocation], ['Slip #', b.slipNumber], ['Storage Type', b.storageType],
      ['Slip Cost', b.slipCostMonthly ? `$${b.slipCostMonthly}/mo` : null],
      ['Dock Power', b.dockPower], ['Liveaboard', b.liveaboard],
      ['Winter Storage', b.winterStoragePlan],
    ]],
    ['USAGE', [
      ['Launch Ramp', b.primaryLaunchRamp],
      ['Cruising Radius', b.cruisingRadiusMiles ? `${b.cruisingRadiusMiles} mi` : null],
      ['Trips/Month', b.tripsPerMonthEstimate],
    ]],
    ['MAINTENANCE', [
      ['Service Provider', b.serviceProvider],
      ['Last Oil Change', b.lastOilChangeHours ? `${b.lastOilChangeHours} hrs` : null],
      ['Last Haul Out', b.lastHaulOut ? new Date(b.lastHaulOut).toISOString().slice(0, 10) : null],
      ['Last Bottom Paint', b.lastBottomPaint ? new Date(b.lastBottomPaint).toISOString().slice(0, 10) : null],
    ]],
  ];

  for (const [title, fields] of sections) {
    const filled = fields.filter(([_, v]) => v !== null && v !== undefined);
    if (filled.length === 0) continue;
    print(`  ${colors.bold}${title}${colors.reset}`);
    for (const [label, value] of filled) {
      print(`  ${label.padEnd(18)} ${value}`);
    }
    print('');
  }
}

/**
 * swain boat create --user=<userId> --name=<name> [--field=value...] [--json]
 */
async function createBoat(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'];
  const jsonOutput = params['json'] === 'true';

  if (!userId || !params['name']) {
    printError('Usage: swain boat create --user=<userId> --name=<name> [--field=value...] [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = { userId };
  for (const field of BOAT_FIELDS) {
    if (params[field] !== undefined) {
      body[field] = parseFieldValue(field, params[field]);
    }
  }

  const result = await workerRequest('/boats', { method: 'POST', body });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    printSuccess(`Boat "${params['name']}" created: ${result.boatId}`);
  } else {
    printError(result.error || 'Create failed');
    process.exit(1);
  }
}

/**
 * swain boat update <boatId> --field=value [--json]
 */
async function updateBoat(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const boatId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!boatId) {
    printError('Usage: swain boat update <boatId> --field=value [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = {};
  for (const field of BOAT_FIELDS) {
    if (params[field] !== undefined) {
      body[field] = parseFieldValue(field, params[field]);
    }
  }

  if (Object.keys(body).length === 0) {
    printError('No fields provided. Use --fieldName=value to set fields.');
    print(`\nAvailable fields: ${BOAT_FIELDS.join(', ')}`);
    process.exit(1);
  }

  const result = await workerRequest(`/boats/${boatId}`, { method: 'PATCH', body });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    printSuccess(`Updated boat ${boatId}`);
    for (const [field, value] of Object.entries(body)) {
      print(`  ${colors.cyan}${field}${colors.reset} = ${value}`);
    }
  } else {
    printError(result.error || 'Update failed');
    process.exit(1);
  }
}

/**
 * swain boat delete <boatId> [--json]
 */
async function deleteBoat(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const boatId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!boatId) {
    printError('Usage: swain boat delete <boatId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/boats/${boatId}`, { method: 'DELETE' });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    printSuccess(`Boat ${boatId} deleted`);
  } else {
    printError(result.error || 'Delete failed');
    process.exit(1);
  }
}

/**
 * swain boat profile --user=<userId> [--json]
 * Show complete boat + owner profile data in one view — what we know and what's missing
 */
async function showProfile(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain boat profile --user=<userId> [--json]');
    process.exit(1);
  }

  // Fetch user + boats in parallel
  const [userResult, boatsResult] = await Promise.all([
    workerRequest(`/users/${userId}`),
    workerRequest(`/boats?userId=${userId}`),
  ]);

  const user = userResult.user;
  const boats = boatsResult.boats || [];
  const boat = boats.find((b: any) => b.isPrimary) || boats[0] || null;

  if (jsonOutput) {
    // Return structured profile with known/unknown fields
    const fields: Record<string, { value: any; source: string }> = {};
    const unknown: string[] = [];

    // User-level fields
    const userFields: [string, string, any][] = [
      ['captainName', 'user', user?.captainName],
      ['email', 'user', user?.email],
      ['phone', 'user', user?.phone],
      ['homeAddress', 'user', user?.homeAddress],
      ['homeZip', 'user', user?.homeZip],
      ['homeCity', 'user', user?.homeCity],
      ['homeState', 'user', user?.homeState],
      ['dateOfBirth', 'user', user?.dateOfBirth],
      ['householdSize', 'user', user?.householdSize],
      ['occupation', 'user', user?.occupation],
      ['marinaLocation', 'user', user?.marinaLocation],
      ['homeWaters', 'user', user?.homeWaters],
      ['experienceLevel', 'user', user?.experienceLevel],
      ['primaryUse', 'user', user?.primaryUse],
      ['fishingStyle', 'user', user?.fishingStyle],
      ['targetSpecies', 'user', user?.targetSpecies],
      ['typicalCrew', 'user', user?.typicalCrew],
      ['typicalTripDuration', 'user', user?.typicalTripDuration],
      ['interests', 'user', user?.interests],
      ['maxWindKnots', 'user', user?.maxWindKnots],
      ['maxWaveFeet', 'user', user?.maxWaveFeet],
      ['communicationPreference', 'user', user?.communicationPreference],
      ['emergencyContactName', 'user', user?.emergencyContactName],
      ['emergencyContactPhone', 'user', user?.emergencyContactPhone],
      ['boatingCertifications', 'user', user?.boatingCertifications],
      ['diyPreference', 'user', user?.diyPreference],
      ['mechanicalSkillLevel', 'user', user?.mechanicalSkillLevel],
      ['navigationSkillLevel', 'user', user?.navigationSkillLevel],
      ['preferredWaterways', 'user', user?.preferredWaterways],
      ['navigationApps', 'user', user?.navigationApps],
      ['preferredPartsRetailer', 'user', user?.preferredPartsRetailer],
      ['clubMemberships', 'user', user?.clubMemberships],
      ['dietaryPreferences', 'user', user?.dietaryPreferences],
      ['favoriteWatersideDining', 'user', user?.favoriteWatersideDining],
      ['petOnBoard', 'user', user?.petOnBoard],
      ['priorBoatsOwned', 'user', user?.priorBoatsOwned],
    ];

    // Helper: treat null, undefined, empty string, and 0 as "unknown"
    // (0 is never a meaningful value for profile fields — lengths, hours, etc. are always > 0)
    const hasValue = (v: any): boolean =>
      v !== null && v !== undefined && v !== '' && v !== 0;

    for (const [name, source, value] of userFields) {
      if (hasValue(value)) {
        fields[name] = { value, source };
      } else {
        unknown.push(name);
      }
    }

    // Boat-level fields
    if (boat) {
      const boatFields: [string, any][] = [
        ['boatName', boat.name], ['makeModel', boat.makeModel], ['year', boat.year],
        ['type', boat.type], ['hullType', boat.hullType], ['length', boat.length],
        ['beam', boat.beam], ['draft', boat.draft],
        ['engineMake', boat.engineMake], ['engineModel', boat.engineModel],
        ['engineType', boat.engineType], ['engineHp', boat.engineHp],
        ['engineCount', boat.engineCount], ['fuelType', boat.fuelType],
        ['fuelCapacity', boat.fuelCapacity], ['engineHours', boat.engineHours],
        ['hasTrailer', boat.hasTrailer], ['insuranceProvider', boat.insuranceProvider],
        ['towingMembership', boat.towingMembership], ['storageType', boat.storageType],
        ['slipNumber', boat.slipNumber], ['dockPower', boat.dockPower],
        ['serviceProvider', boat.serviceProvider],
        ['lastOilChangeHours', boat.lastOilChangeHours],
        ['lastHaulOut', boat.lastHaulOut], ['lastBottomPaint', boat.lastBottomPaint],
      ];

      for (const [name, value] of boatFields) {
        if (hasValue(value)) {
          fields[name] = { value, source: 'boat' };
        } else {
          unknown.push(name);
        }
      }
    }

    const total = Object.keys(fields).length + unknown.length;
    const pcs = total > 0 ? Math.round((Object.keys(fields).length / total) * 100) : 0;

    console.log(JSON.stringify({
      success: true,
      userId,
      boatId: boat?.boatId || null,
      known: fields,
      unknown,
      pcs,
      knownCount: Object.keys(fields).length,
      unknownCount: unknown.length,
      totalFields: total,
    }, null, 2));
    return;
  }

  // Human-readable output
  if (!user) {
    printError('User not found');
    process.exit(1);
  }

  print(`\n${colors.bold}OWNER PROFILE: ${user.captainName}${colors.reset}\n`);

  // Count known vs unknown
  let known = 0;
  let total = 0;
  const unknownList: string[] = [];

  const check = (label: string, value: any) => {
    total++;
    if (value !== null && value !== undefined && value !== '' && value !== 0) {
      known++;
      return true;
    }
    unknownList.push(label);
    return false;
  };

  // Display known fields
  print(`  ${colors.bold}CAPTAIN${colors.reset}`);
  if (check('captainName', user.captainName)) print(`  Name:           ${user.captainName}`);
  if (check('email', user.email)) print(`  Email:          ${user.email}`);
  if (check('phone', user.phone)) print(`  Phone:          ${user.phone}`);
  check('homeAddress', user.homeAddress);
  check('dateOfBirth', user.dateOfBirth);
  check('householdSize', user.householdSize);
  check('occupation', user.occupation);
  if (check('experienceLevel', user.experienceLevel)) print(`  Experience:     ${user.experienceLevel}`);
  if (check('primaryUse', user.primaryUse)) print(`  Primary Use:    ${user.primaryUse}`);
  if (check('homeWaters', user.homeWaters)) print(`  Home Waters:    ${user.homeWaters}`);
  check('communicationPreference', user.communicationPreference);
  check('diyPreference', user.diyPreference);
  check('navigationSkillLevel', user.navigationSkillLevel);

  if (boat) {
    print(`\n  ${colors.bold}VESSEL: ${boat.name}${colors.reset}`);
    if (check('makeModel', boat.makeModel)) print(`  Make/Model:     ${boat.makeModel}`);
    if (check('year', boat.year)) print(`  Year:           ${boat.year}`);
    check('type', boat.type);
    if (check('length', boat.length)) print(`  Length:         ${boat.length} ft`);
    check('hullType', boat.hullType);
    check('engineMake', boat.engineMake);
    check('engineModel', boat.engineModel);
    check('engineType', boat.engineType);
    check('engineHp', boat.engineHp);
    check('engineCount', boat.engineCount);
    check('fuelType', boat.fuelType);
    check('fuelCapacity', boat.fuelCapacity);
    if (check('engineHours', boat.engineHours)) print(`  Engine Hours:   ${boat.engineHours}`);
    check('hasTrailer', boat.hasTrailer);
    check('insuranceProvider', boat.insuranceProvider);
    check('towingMembership', boat.towingMembership);
    check('storageType', boat.storageType);
    check('serviceProvider', boat.serviceProvider);
  } else {
    print(`\n  ${colors.dim}No boat record found${colors.reset}`);
  }

  const pcs = total > 0 ? Math.round((known / total) * 100) : 0;
  const tier = pcs < 25 ? 1 : pcs < 50 ? 2 : pcs < 75 ? 3 : 4;

  print(`\n  ${colors.bold}PROFILE COMPLETENESS${colors.reset}`);
  print(`  Known:   ${known}/${total} fields (${pcs}%)`);
  print(`  Tier:    ${tier} ${tier === 1 ? '(Learning)' : tier === 2 ? '(Proactive)' : tier === 3 ? '(Predictive)' : '(Co-Captain)'}`);

  if (unknownList.length > 0) {
    print(`\n  ${colors.bold}UNKNOWN FIELDS (${unknownList.length})${colors.reset}`);
    // Show first 10 unknown fields
    for (const field of unknownList.slice(0, 15)) {
      print(`  ${colors.dim}• ${field}${colors.reset}`);
    }
    if (unknownList.length > 15) {
      print(`  ${colors.dim}... and ${unknownList.length - 15} more${colors.reset}`);
    }
  }
  print('');
}

/**
 * swain boat photo upload|list|delete
 */
async function handlePhoto(args: string[]): Promise<void> {
  const subcommand = args[0];
  const subArgs = args.slice(1);

  switch (subcommand) {
    case 'upload':
      await photoUpload(subArgs);
      break;
    case 'list':
      await photoList(subArgs);
      break;
    case 'delete':
      await photoDelete(subArgs);
      break;
    case 'help':
    case '--help':
    case '-h':
    case undefined:
      showPhotoHelp();
      break;
    default:
      printError(`Unknown photo command: ${subcommand}`);
      showPhotoHelp();
      process.exit(1);
  }
}

async function photoUpload(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'];
  const source = params['url'] || params['file'];
  const boatId = params['boat'];
  const caption = params['caption'];
  const isPrimary = params['primary'] === 'true';
  const jsonOutput = params['json'] === 'true';

  if (!userId || !source) {
    printError('Usage: swain boat photo upload --user=<userId> --url=<imageUrl> [--boat=<boatId>] [--caption=<text>] [--primary] [--json]');
    process.exit(1);
  }

  // Fetch image and base64-encode it for server-side Cloudflare upload
  let base64: string;
  let filename: string | undefined;
  try {
    ({ base64, filename } = await fetchImageAsBase64(source));
  } catch (err: any) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: `Failed to fetch image: ${err.message}` }));
    } else {
      printError(`Failed to fetch image: ${err.message}`);
    }
    process.exit(1);
  }

  const body: any = { userId, image: base64 };
  if (boatId) body.boatId = boatId;
  if (caption) body.caption = caption;
  if (isPrimary) body.isPrimary = true;
  if (filename) body.filename = filename;

  const result = await workerRequest('/boat-photos/upload', { method: 'POST', body });

  // When --primary, also set imageUrl on the boat record so boat-art uses it
  if (isPrimary && result.imageUrl) {
    let targetBoatId = boatId || result.boatId;
    if (!targetBoatId) {
      // Look up primary boat for this user
      try {
        const boatsResult = await workerRequest(`/boats?userId=${userId}`);
        const boats = boatsResult.boats || [];
        const primary = boats.find((b: any) => b.isPrimary) || boats[0];
        if (primary) targetBoatId = primary.boatId;
      } catch {}
    }
    if (targetBoatId) {
      try {
        await workerRequest(`/boats/${targetBoatId}`, {
          method: 'PATCH',
          body: { imageUrl: result.imageUrl },
        });
      } catch (err: any) {
        // Non-fatal — photo is uploaded, just the boat record sync failed
        if (!jsonOutput) print(`${colors.dim}Warning: photo uploaded but failed to set boat imageUrl: ${err.message}${colors.reset}`);
      }
    }
  }

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.photoId) {
    printSuccess(`Photo uploaded${isPrimary ? ' (primary)' : ''}: ${result.photoId}`);
    print(`  URL: ${result.imageUrl}`);
  } else {
    printError(result.error || 'Upload failed');
    process.exit(1);
  }
}

async function photoList(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'];
  const boatId = params['boat'];
  const jsonOutput = params['json'] === 'true';

  if (!userId && !boatId) {
    printError('Usage: swain boat photo list --user=<userId> [--boat=<boatId>] [--json]');
    process.exit(1);
  }

  const qs = boatId ? `boatId=${boatId}` : `userId=${userId}`;
  const result = await workerRequest(`/boat-photos?${qs}`);
  const photos = result.photos || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, photos, count: photos.length }, null, 2));
    return;
  }

  if (photos.length === 0) {
    print('No photos found');
    return;
  }

  print(`\n${colors.bold}BOAT PHOTOS (${photos.length})${colors.reset}\n`);
  print(`${'PHOTO ID'.padEnd(18)} ${'PRIMARY'.padEnd(9)} ${'SOURCE'.padEnd(10)} ${'CAPTION'.padEnd(20)} URL`);
  print(`${'-'.repeat(18)} ${'-'.repeat(9)} ${'-'.repeat(10)} ${'-'.repeat(20)} ${'-'.repeat(30)}`);

  for (const p of photos) {
    const primary = p.isPrimary ? `${colors.green}★ yes${colors.reset}` : 'no';
    const caption = (p.caption || '-').slice(0, 19);
    const url = (p.imageUrl || '-').slice(0, 50);
    print(`${(p.photoId || '').slice(0, 17).padEnd(18)} ${primary.padEnd(9 + (p.isPrimary ? colors.green.length + colors.reset.length : 0))} ${(p.source || '-').padEnd(10)} ${caption.padEnd(20)} ${url}`);
  }
  print('');
}

async function photoDelete(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const photoId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!photoId) {
    printError('Usage: swain boat photo delete <photoId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/boat-photos/${photoId}`, { method: 'DELETE' });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    printSuccess(`Photo ${photoId} deleted`);
  } else {
    printError(result.error || 'Delete failed');
    process.exit(1);
  }
}

function showPhotoHelp(): void {
  print(`
${colors.bold}swain boat photo${colors.reset} - Boat photo gallery

${colors.bold}COMMANDS${colors.reset}
  upload --user=<id> --url=<url>  Add a photo from URL
  list --user=<id>                List photos for a user
  delete <photoId>                Delete a photo

${colors.bold}OPTIONS${colors.reset}
  --boat=<boatId>     Target a specific boat (default: user's primary)
  --caption=<text>    Photo caption
  --primary           Set as hero image across the app
  --json              Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain boat photo upload --user=usr_34a9954e --url=https://example.com/boat.jpg --primary --json
  swain boat photo list --user=usr_34a9954e --json
  swain boat photo delete photo_abc123 --json
`);
}

function showHelp(): void {
  print(`
${colors.bold}swain boat${colors.reset} - Boat management

${colors.bold}COMMANDS${colors.reset}
  list --user=<userId>        List boats for a user
  get <boatId>                Get boat details
  create --user=<id> --name=  Create a new boat
  update <boatId> --field=val Update boat fields
  delete <boatId>             Delete a boat
  profile --user=<userId>     Show combined owner+boat profile with completeness
  photo upload|list|delete    Manage boat photo gallery

${colors.bold}FIELDS${colors.reset}
  ${colors.bold}Identity:${colors.reset}     --name --makeModel --year --type --hullType --hullId --imageUrl
  ${colors.bold}Specs:${colors.reset}        --length --beam --draft --airDraft
  ${colors.bold}Engine:${colors.reset}       --engineType --engineMake --engineModel --engineHp --engineCount
                --fuelType --fuelCapacity --engineHours
  ${colors.bold}Ownership:${colors.reset}    --purchaseDate --purchasePrice --hasTrailer --hasLoan
  ${colors.bold}Insurance:${colors.reset}    --insuranceProvider --insurancePremiumAnnual --insuranceExpiry
                --registrationExpiry --towingMembership
  ${colors.bold}Storage:${colors.reset}      --storageType --slipNumber --slipCostMonthly --dockPower
                --liveaboard --winterStoragePlan --marinaLocation
  ${colors.bold}Usage:${colors.reset}        --primaryLaunchRamp --cruisingRadiusMiles --tripsPerMonthEstimate
  ${colors.bold}Maintenance:${colors.reset}  --lastOilChangeHours --lastOilChangeDate --lastBottomPaint
                --lastHaulOut --serviceProvider
  ${colors.bold}Other:${colors.reset}        --electronics --isPrimary

${colors.bold}OPTIONS${colors.reset}
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain boat list --user=usr_34a9954e-d1f
  swain boat get boat_abc123
  swain boat create --user=usr_34a9954e-d1f --name="Jolly Rancher" --makeModel="Boston Whaler 280" --json
  swain boat update boat_abc123 --engineHours=280 --engineMake=Yamaha --json
  swain boat profile --user=usr_34a9954e-d1f --json
`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'list':
        await listBoats(commandArgs);
        break;
      case 'get':
        await getBoat(commandArgs);
        break;
      case 'create':
        await createBoat(commandArgs);
        break;
      case 'update':
        await updateBoat(commandArgs);
        break;
      case 'delete':
        await deleteBoat(commandArgs);
        break;
      case 'profile':
        await showProfile(commandArgs);
        break;
      case 'photo':
        await handlePhoto(commandArgs);
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
