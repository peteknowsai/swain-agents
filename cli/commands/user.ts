#!/usr/bin/env bun

/**
 * User Commands
 * swain user list|get|update|onboard-status
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';


/**
 * swain user list
 */
async function listUsers(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const limit = params['limit'] || '200';

  const result = await workerRequest(`/users?limit=${limit}`);
  const users = result.users || [];

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, users, count: users.length }, null, 2));
    return;
  }

  if (users.length === 0) {
    print('No users found');
    return;
  }

  print(`\n${colors.bold}USERS (${users.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(20)} ${'CAPTAIN'.padEnd(18)} ${'BOAT ID'.padEnd(18)} ${'LOCATION'.padEnd(18)} ${'ADVISOR'}`);
  print(`${'-'.repeat(20)} ${'-'.repeat(18)} ${'-'.repeat(18)} ${'-'.repeat(18)} ${'-'.repeat(20)}`);

  for (const user of users) {
    const advisor = user.advisorAgentId ? `${colors.green}${user.advisorAgentId}${colors.reset}` : `${colors.dim}none${colors.reset}`;
    const boatId = user.primaryBoatId ? user.primaryBoatId.slice(0, 17) : '-';
    print(`${(user.id || '').slice(0, 19).padEnd(20)} ${(user.captainName || '-').slice(0, 17).padEnd(18)} ${boatId.padEnd(18)} ${(user.marinaLocation || user.location || '-').slice(0, 17).padEnd(18)} ${advisor}`);
  }
  print('');
}

/**
 * swain user get <userId>
 */
async function getUser(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user get <userId>');
    process.exit(1);
  }

  const [result, boatsResult] = await Promise.all([
    workerRequest(`/users/${userId}`),
    workerRequest(`/boats?userId=${userId}`),
  ]);
  const boats = boatsResult.boats || [];
  const boat = boats.find((b: any) => b.isPrimary) || boats[0] || null;

  if (jsonOutput) {
    console.log(JSON.stringify({ ...result, boats }, null, 2));
    return;
  }

  if (!result.success || !result.user) {
    printError('User not found');
    process.exit(1);
  }

  const u = result.user;
  print(`\n${colors.bold}USER: ${u.captainName || u.id}${colors.reset}\n`);
  print(`  ID:           ${u.id}`);
  print(`  Email:        ${u.email || '-'}`);
  print(`  Captain:      ${u.captainName || '-'}`);
  print(`  Boat:         ${boat?.name || '-'} ${boat?.year ? `(${boat.year})` : ''}`);
  print(`  Make/Model:   ${boat?.makeModel || '-'}`);
  print(`  Location:     ${u.marinaLocation || u.location || '-'}`);
  print(`  Timezone:     ${u.timezone || '-'}`);
  print(`  Phone:        ${u.phone || '-'}`);
  print(`  Onboarding:   ${u.onboardingStatus || 'pending'}`);
  print(`  Onboard Step: ${u.onboardingStep || '-'}`);
  print(`  Advisor:      ${u.advisorAgentId || 'none'} ${u.advisorExists ? `${colors.green}✓${colors.reset}` : ''}`);
  print(`  Created:      ${u.createdAt || '-'}`);

  if (result.stats) {
    print(`\n${colors.bold}STATS${colors.reset}`);
    print(`  Briefings:    ${result.stats.briefingCount || 0}`);
    print(`  Viewed:       ${result.stats.totalViewed || 0}`);
  }

  if (result.memories && result.memories.length > 0) {
    print(`\n${colors.bold}ADVISOR MEMORIES (${result.memories.length})${colors.reset}`);
    for (const m of result.memories) {
      const cat = m.category ? `${colors.cyan}[${m.category}]${colors.reset}` : '';
      print(`  ${cat} ${m.content}`);
    }
  }
  print('');
}

/**
 * swain user onboard-status <userId> [--status=completed] [--json]
 * Get or set onboarding status
 */
async function onboardStatus(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';
  const newStatus = params['status'];

  if (!userId) {
    printError('Usage: swain user onboard-status <userId> [--status=in_progress|completed] [--json]');
    process.exit(1);
  }

  if (newStatus) {
    // Set status
    const result = await workerRequest(`/users/${userId}/onboarding-status`, {
      method: 'POST',
      body: { status: newStatus },
    });

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.success) {
      printSuccess(`Onboarding status updated to "${newStatus}" for ${userId}`);
    } else {
      printError(result.error || 'Failed to update status');
    }
  } else {
    // Get status
    const result = await workerRequest(`/users/${userId}/onboarding-status`);

    if (jsonOutput) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (result.success) {
      print(`\n${colors.bold}ONBOARDING STATUS${colors.reset} for ${userId}\n`);
      print(`  Status:       ${result.status}`);
      print(`  Step:         ${result.onboardingStep || '-'}`);
      print(`  Advisor:      ${result.advisorName || '-'} (${result.advisorAgentId || 'none'})`);
      print(`  Started:      ${result.startedAt ? new Date(result.startedAt * 1000).toISOString() : '-'}`);
      print(`  Completed:    ${result.completedAt ? new Date(result.completedAt * 1000).toISOString() : '-'}`);
      if (result.firstBriefingId) {
        print(`  1st Briefing: ${result.firstBriefingId}`);
      }
      print('');
    } else {
      printError(result.error || 'Failed to get status');
    }
  }
}

/**
 * swain user update <userId> --field=value [--json]
 * Update user profile fields
 */
async function updateUser(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user update <userId> --field=value [--json]');
    process.exit(1);
  }

  // All updatable fields (camelCase keys match API body)
  // Boat fields live in the boats table now — use `swain boat update`
  const updatableFields = [
    // Basics
    'captainName', 'phone', 'messagingPhone', 'location', 'marinaLocation',
    'timezone', 'interests', 'favoriteTopics', 'desk',
    // Identity & contact
    'homeAddress', 'homeZip', 'homeCity', 'homeState',
    'dateOfBirth', 'householdSize', 'occupation',
    // Experience & preferences
    'experienceLevel', 'primaryUse', 'fishingStyle', 'targetSpecies',
    'typicalCrew', 'typicalTripDuration', 'homeWaters',
    // Weather comfort
    'maxWindKnots', 'maxWaveFeet', 'minTempF', 'preferredDeparture',
    // Communication & safety
    'communicationPreference', 'emergencyContactName', 'emergencyContactPhone',
    'boatingCertifications', 'medicalConditions', 'floatPlanHabits',
    // Skills & preferences
    'diyPreference', 'mechanicalSkillLevel', 'navigationSkillLevel',
    'preferredWaterways', 'navigationApps',
    // Lifestyle & social
    'preferredPartsRetailer', 'clubMemberships', 'dietaryPreferences',
    'favoriteWatersideDining', 'petOnBoard', 'priorBoatsOwned',
    // Onboarding
    'onboardingStep', 'onboardingStatus',
  ];

  // Numeric fields
  const numericFields = new Set([
    'maxWindKnots', 'maxWaveFeet', 'minTempF',
    'householdSize', 'dateOfBirth',
  ]);
  // Boolean fields
  const booleanFields = new Set(['petOnBoard']);

  // Build update body from provided flags
  const body: Record<string, any> = {};
  for (const field of updatableFields) {
    if (params[field] !== undefined) {
      let value: any = params[field];
      if (booleanFields.has(field)) {
        value = value === 'true';
      } else if (numericFields.has(field)) {
        const num = parseFloat(value);
        if (!isNaN(num)) value = num;
      } else if (value === 'true') {
        value = true;
      } else if (value === 'false') {
        value = false;
      }
      body[field] = value;
    }
  }

  if (Object.keys(body).length === 0) {
    printError('No fields provided. Use --fieldName=value to set fields.');
    print(`\nAvailable fields: ${updatableFields.join(', ')}`);
    process.exit(1);
  }

  const result = await workerRequest(`/users/${userId}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.success) {
    printSuccess(`Updated ${result.updated.length} field(s) for ${userId}`);
    for (const field of result.updated) {
      print(`  ${colors.cyan}${field}${colors.reset} = ${body[field]}`);
    }
  } else {
    printError(result.error || 'Update failed');
    process.exit(1);
  }
}

function showHelp(): void {
  print(`
${colors.bold}swain user${colors.reset} - User management

${colors.bold}COMMANDS${colors.reset}
  list                    List all users
  get <userId>            Get user details (includes advisor memories)
  update <userId>         Update user profile fields
  onboard-status <id>     Get or set onboarding status

${colors.bold}UPDATE FIELDS${colors.reset}
  ${colors.bold}Basics:${colors.reset}
  --captainName --phone --messagingPhone --location --marinaLocation
  --timezone --interests --favoriteTopics --desk

  ${colors.bold}Boat:${colors.reset}
  Use 'swain boat update' — boat data lives in the boats table.

  ${colors.bold}Identity & contact:${colors.reset}
  --homeAddress --homeZip --homeCity --homeState --dateOfBirth
  --householdSize --occupation

  ${colors.bold}Experience:${colors.reset}
  --experienceLevel --primaryUse --fishingStyle --targetSpecies
  --typicalCrew --typicalTripDuration --homeWaters

  ${colors.bold}Weather comfort:${colors.reset}
  --maxWindKnots --maxWaveFeet --minTempF --preferredDeparture

  ${colors.bold}Safety:${colors.reset}
  --communicationPreference --emergencyContactName --emergencyContactPhone
  --boatingCertifications --medicalConditions --floatPlanHabits

  ${colors.bold}Skills:${colors.reset}
  --diyPreference --mechanicalSkillLevel --navigationSkillLevel
  --preferredWaterways --navigationApps

  ${colors.bold}Lifestyle:${colors.reset}
  --preferredPartsRetailer --clubMemberships --dietaryPreferences
  --favoriteWatersideDining --petOnBoard --priorBoatsOwned

  ${colors.bold}Onboarding:${colors.reset}
  --onboardingStep --onboardingStatus

${colors.bold}OPTIONS${colors.reset}
  --limit=<n>             Limit results (for list, default: 200)
  --status=<status>       Set onboarding status (in_progress|completed)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain user list
  swain user list --json
  swain user get user_abc123
  swain user update user_abc123 --marinaLocation=fort-lauderdale --location="Fort Lauderdale, FL"
  swain user update user_abc123 --experienceLevel=beginner --primaryUse="fishing,diving" --json
  swain user onboard-status user_abc123
  swain user onboard-status user_abc123 --status=completed
`);
}

export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'list':
        await listUsers(commandArgs);
        break;
      case 'get':
        await getUser(commandArgs);
        break;
      case 'update':
        await updateUser(commandArgs);
        break;
      case 'onboard-status':
        await onboardStatus(commandArgs);
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
