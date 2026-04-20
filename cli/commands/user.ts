#!/usr/bin/env bun

/**
 * User Commands
 * swain user list|get|update|engagement|pause|resume|onboard-status
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
    // Desk & location context
    'microlocation', 'mobility', 'watercraftContext', 'rawLocationInput',
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

/**
 * swain user engagement <userId> [--json]
 * Get engagement stats by merging Convex user data with iMessage analytics.
 */
async function getEngagement(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = args[0] && !args[0].startsWith('--') ? args[0] : params['id'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user engagement <userId> [--json]');
    process.exit(1);
  }

  // Get user profile for phone number
  const userResult = await workerRequest(`/users/${userId}`);
  if (!userResult.success || !userResult.user) {
    if (jsonOutput) {
      console.log(JSON.stringify({ success: false, error: 'User not found' }, null, 2));
    } else {
      printError('User not found');
    }
    process.exit(1);
  }

  const phone = userResult.user.messagingPhone || userResult.user.phone;

  // Fetch Convex engagement (best-effort)
  let convexEngagement: any = null;
  try {
    const convexResult = await workerRequest(`/users/${userId}/engagement`);
    if (convexResult.success) convexEngagement = convexResult.engagement;
  } catch {}

  // Fetch iMessage analytics (best-effort)
  let imessageStats: any = null;
  let imessageSummary: any = null;
  const imessageApiUrl = process.env.IMESSAGE_API_URL ?? 'https://imessage-api.heyswain.com';
  const imessageToken = process.env.IMESSAGE_API_TOKEN;

  if (phone && imessageToken) {
    const chatGuid = encodeURIComponent(`any;-;${phone}`);
    const headers = { 'Authorization': `Bearer ${imessageToken}` };

    // Fetch detailed stats and chat summary in parallel
    const [detailRes, summaryRes] = await Promise.all([
      fetch(`${imessageApiUrl}/analytics/chats/${chatGuid}`, {
        headers, signal: AbortSignal.timeout(10_000),
      }).catch(() => null),
      fetch(`${imessageApiUrl}/analytics/chats`, {
        headers, signal: AbortSignal.timeout(10_000),
      }).catch(() => null),
    ]);

    if (detailRes?.ok) {
      const json = await detailRes.json() as any;
      imessageStats = json.data;
    }

    if (summaryRes?.ok) {
      const json = await summaryRes.json() as any;
      const chats = json.data ?? [];
      imessageSummary = chats.find((c: any) => c.guid === `any;-;${phone}`);
    }
  }

  // 7-day message count from recent messages
  let messageCount7d = 0;
  if (phone && imessageToken) {
    try {
      const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
      const chatGuid = encodeURIComponent(`any;-;${phone}`);
      const res = await fetch(`${imessageApiUrl}/chats/${chatGuid}/messages?after=${sevenDaysAgo}&limit=500`, {
        headers: { 'Authorization': `Bearer ${imessageToken}` },
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) {
        const json = await res.json() as any;
        const msgs = json.data ?? [];
        messageCount7d = msgs.filter((m: any) => !m.isFromMe).length;
      }
    } catch {}
  }

  // Merge: prefer iMessage analytics for message data, Convex for app data
  const lastMessageAt = imessageSummary?.dateRange?.to ?? null;
  const daysSinceMessage = lastMessageAt
    ? Math.floor((Date.now() - new Date(lastMessageAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;

  const engagement = {
    lastActiveAt: convexEngagement?.lastActiveAt ?? lastMessageAt,
    lastMessageAt,
    daysSinceActive: convexEngagement?.daysSinceActive ?? daysSinceMessage,
    daysSinceMessage,
    briefingsOpened7d: convexEngagement?.briefingsOpened7d ?? 0,
    messageCount7d,
    totalMessages: imessageStats?.totalMessages ?? 0,
    sentByAdvisor: imessageStats?.sent ?? 0,
    receivedFromCaptain: imessageStats?.received ?? 0,
    onboardedAt: convexEngagement?.onboardedAt ?? null,
    paused: convexEngagement?.paused ?? false,
    pausedAt: convexEngagement?.pausedAt ?? null,
    pausedReason: convexEngagement?.pausedReason ?? null,
    needsSleepBriefing: convexEngagement?.needsSleepBriefing ?? false,
    outreachPaused: convexEngagement?.outreachPaused ?? false,
    outreachPausedAt: convexEngagement?.outreachPausedAt ?? null,
    outreachPausedReason: convexEngagement?.outreachPausedReason ?? null,
  };

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, engagement }, null, 2));
    return;
  }

  print(`\n${colors.bold}ENGAGEMENT${colors.reset} for ${userId}\n`);
  print(`  Last Active:     ${engagement.lastActiveAt || '-'}`);
  print(`  Days Since:      ${engagement.daysSinceActive ?? '-'}`);
  print(`  Last Message:    ${engagement.lastMessageAt || '-'}`);
  print(`  Days Silent:     ${engagement.daysSinceMessage ?? '-'}`);
  print(`  Messages (7d):   ${engagement.messageCount7d}`);
  print(`  Total Messages:  ${engagement.totalMessages} (${engagement.sentByAdvisor} sent / ${engagement.receivedFromCaptain} received)`);
  print(`  Briefings (7d):  ${engagement.briefingsOpened7d}`);
  print(`  Onboarded:       ${engagement.onboardedAt || '-'}`);
  if (engagement.paused) {
    const reason = engagement.pausedReason ? ` (${engagement.pausedReason})` : '';
    print(`  ${colors.yellow}Paused:          ${engagement.pausedAt || 'yes'}${reason}${colors.reset}`);
    print(`  ${colors.yellow}Needs sleep brf: ${engagement.needsSleepBriefing ? 'yes' : 'no'}${colors.reset}`);
  }
  if (engagement.outreachPaused) {
    const reason = engagement.outreachPausedReason ? ` — "${engagement.outreachPausedReason}"` : '';
    print(`  ${colors.yellow}Outreach muted:  ${engagement.outreachPausedAt || 'yes'}${reason}${colors.reset}`);
  }
  print('');
}

/**
 * swain user pause <userId> [--reason=manual|auto_inactive] [--json]
 * Manually pause a captain (skips daily briefings, cascades to desk).
 */
async function pauseUser(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || args.find(a => !a.startsWith('--'));
  const reason = params['reason'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user pause <userId> [--reason=manual|auto_inactive] [--json]');
    process.exit(1);
  }

  if (reason && reason !== 'manual' && reason !== 'auto_inactive') {
    printError(`Invalid --reason: ${reason}. Must be 'manual' or 'auto_inactive'.`);
    process.exit(1);
  }

  const body: Record<string, string> = {};
  if (reason) body.reason = reason;

  const result = await workerRequest(`/users/${userId}/pause`, {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to pause user');
    process.exit(1);
  }

  printSuccess(`Paused ${userId}${reason ? ` (${reason})` : ''}`);
  print('');
}

/**
 * swain user resume <userId> [--json]
 * Manually resume a paused captain (reactivates desk if it was paused alongside).
 */
async function resumeUser(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || args.find(a => !a.startsWith('--'));
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user resume <userId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/users/${userId}/resume`, {
    method: 'POST',
    body: {},
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to resume user');
    process.exit(1);
  }

  printSuccess(`Resumed ${userId}`);
  print('');
}

/**
 * swain user outreach-pause <userId> --reason="<verbatim quote>" [--json]
 * Stop unsolicited outbound messages to a captain. Orthogonal to content pause —
 * briefings still build, only the push/notification side is muted. Replies to
 * captain-initiated messages are still allowed.
 */
async function outreachPauseUser(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || args.find(a => !a.startsWith('--'));
  const reason = params['reason'];
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user outreach-pause <userId> --reason="<verbatim quote>" [--json]');
    process.exit(1);
  }

  const body: Record<string, string> = {};
  if (reason) body.reason = reason;

  const result = await workerRequest(`/users/${userId}/pauseOutreach`, {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to pause outreach');
    process.exit(1);
  }

  printSuccess(`Outreach paused for ${userId}${reason ? ` — "${reason}"` : ''}`);
  print('');
}

/**
 * swain user outreach-resume <userId> [--json]
 * Re-enable unsolicited outbound messages. Only runs when the captain has
 * explicitly asked to be contacted again.
 */
async function outreachResumeUser(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const userId = params['user'] || args.find(a => !a.startsWith('--'));
  const jsonOutput = params['json'] === 'true';

  if (!userId) {
    printError('Usage: swain user outreach-resume <userId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/users/${userId}/resumeOutreach`, {
    method: 'POST',
    body: {},
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to resume outreach');
    process.exit(1);
  }

  printSuccess(`Outreach resumed for ${userId}`);
  print('');
}

function showHelp(): void {
  print(`
${colors.bold}swain user${colors.reset} - User management

${colors.bold}COMMANDS${colors.reset}
  list                    List all users
  get <userId>            Get user details (includes advisor memories)
  update <userId>         Update user profile fields
  engagement <userId>     Get engagement stats (last active, message count)
  pause <userId>          Manually pause a captain (cascades to desk)
  resume <userId>         Manually resume a paused captain
  outreach-pause <userId> Mute unsolicited outbound (captain asked to stop)
  outreach-resume <userId>  Un-mute unsolicited outbound
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

  ${colors.bold}Desk & location:${colors.reset}
  --microlocation --mobility --watercraftContext --rawLocationInput

${colors.bold}OPTIONS${colors.reset}
  --limit=<n>             Limit results (for list, default: 200)
  --status=<status>       Set onboarding status (in_progress|completed)
  --reason=<reason>       Pause reason: manual|auto_inactive (default: manual)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain user list
  swain user list --json
  swain user get user_abc123
  swain user update user_abc123 --marinaLocation=fort-lauderdale --location="Fort Lauderdale, FL"
  swain user update user_abc123 --experienceLevel=beginner --primaryUse="fishing,diving" --json
  swain user engagement user_abc123 --json
  swain user pause user_abc123
  swain user pause user_abc123 --reason=auto_inactive
  swain user resume user_abc123
  swain user outreach-pause user_abc123 --reason="stop texting me"
  swain user outreach-resume user_abc123
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
      case 'engagement':
        await getEngagement(commandArgs);
        break;
      case 'pause':
        await pauseUser(commandArgs);
        break;
      case 'resume':
        await resumeUser(commandArgs);
        break;
      case 'outreach-pause':
        await outreachPauseUser(commandArgs);
        break;
      case 'outreach-resume':
        await outreachResumeUser(commandArgs);
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
