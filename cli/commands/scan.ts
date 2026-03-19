#!/usr/bin/env bun

/**
 * Scan Commands
 * swain scan sessions|session-get|session-update|captures|capture-update|clips|clips-post|audio-upload|generate-wave|generate-debrief
 */

import {
  workerRequest,
  print,
  printSuccess,
  printError,
  colors
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

function isJsonMode(params: Record<string, string>): boolean {
  return params['json'] === 'true' || !process.stdout.isTTY;
}

const VALID_STATUSES = ['not_started', 'generating', 'active', 'awaiting_captures', 'completed'] as const;
const VALID_CLIP_TYPES = ['wave_intro', 'prompt', 'debrief'] as const;
const VALID_CAPTURE_TYPES = ['photo', 'voice', 'text'] as const;

interface ScanClip {
  clipId?: string;
  sessionId?: string;
  wave?: number;
  clipType: string;
  promptId?: string | null;
  script: string;
  audioUrl: string;
  durationMs?: number;
  sortOrder: number;
  captureType?: string;
  instructionTitle?: string;
  instructionDetail?: string;
}

/**
 * Validate a clips array locally. Returns null if valid, or an array of error strings.
 */
function validateClips(clips: any[]): string[] | null {
  const errors: string[] = [];

  if (!Array.isArray(clips)) {
    return ['--clips must be a JSON array'];
  }

  if (clips.length === 0) {
    return ['--clips array is empty'];
  }

  if (clips.length > 20) {
    errors.push(`batch contains ${clips.length} clips, max is 20`);
  }

  for (let i = 0; i < clips.length; i++) {
    const c = clips[i];
    const prefix = `clip[${i}]`;

    if (!c || typeof c !== 'object') {
      errors.push(`${prefix}: must be an object`);
      continue;
    }

    if (!c.clipType || !VALID_CLIP_TYPES.includes(c.clipType)) {
      errors.push(`${prefix}: clipType must be one of: ${VALID_CLIP_TYPES.join(', ')}`);
    }

    if (!c.script || typeof c.script !== 'string' || c.script.trim() === '') {
      errors.push(`${prefix}: script is required and must be a non-empty string`);
    }

    if (!c.audioUrl || typeof c.audioUrl !== 'string') {
      errors.push(`${prefix}: audioUrl is required and must be a string`);
    } else if (!c.audioUrl.startsWith('https://')) {
      errors.push(`${prefix}: audioUrl must be an HTTPS URL`);
    }

    if (typeof c.sortOrder !== 'number') {
      errors.push(`${prefix}: sortOrder is required and must be a number`);
    }

    if (c.captureType && !VALID_CAPTURE_TYPES.includes(c.captureType)) {
      errors.push(`${prefix}: captureType must be one of: ${VALID_CAPTURE_TYPES.join(', ')}`);
    }
  }

  return errors.length > 0 ? errors : null;
}

/**
 * swain scan sessions --user=<userId> [--boat=<boatId>] [--dimension=<dim>] --json
 */
async function listSessions(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const userId = params['user'] || params['user-id'];
  const boatId = params['boat'] || params['boat-id'];
  const dimension = params['dimension'];

  if (!userId) {
    printError('Usage: swain scan sessions --user=<userId> [--boat=<boatId>] [--dimension=<dim>] [--json]');
    process.exit(1);
  }

  const queryParts: string[] = [`userId=${userId}`];
  if (boatId) queryParts.push(`boatId=${boatId}`);
  if (dimension) queryParts.push(`dimension=${dimension}`);
  const qs = queryParts.join('&');

  const result = await workerRequest(`/scan/sessions?${qs}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const sessions = result.sessions || result.data || [];

  if (sessions.length === 0) {
    print('No scan sessions found');
    return;
  }

  print(`\n${colors.bold}SCAN SESSIONS (${sessions.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(30)} ${'DIMENSION'.padEnd(16)} ${'STATUS'.padEnd(18)} ${'WAVE'.padEnd(6)} ${'BOAT'}`);
  print(`${'-'.repeat(30)} ${'-'.repeat(16)} ${'-'.repeat(18)} ${'-'.repeat(6)} ${'-'.repeat(20)}`);

  for (const s of sessions) {
    const wave = `${s.currentWave || 0}/${s.totalWaves || 4}`;
    print(`${(s.sessionId || '').slice(0, 29).padEnd(30)} ${(s.dimension || '-').padEnd(16)} ${(s.status || '-').padEnd(18)} ${wave.padEnd(6)} ${s.boatId || '-'}`);
  }
  print('');
}

/**
 * swain scan session-get --session=<sessionId> --json
 */
async function getSession(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'] || args.find(a => !a.startsWith('--'));

  if (!sessionId) {
    printError('Usage: swain scan session-get --session=<sessionId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest(`/scan/sessions/${sessionId}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const s = result.session || result.data || result;

  print(`\n${colors.bold}SCAN SESSION: ${s.sessionId}${colors.reset}\n`);
  print(`  User:       ${s.userId}`);
  print(`  Boat:       ${s.boatId}`);
  print(`  Dimension:  ${s.dimension}`);
  print(`  Status:     ${s.status}`);
  print(`  Wave:       ${s.currentWave || 0} / ${s.totalWaves || 4}`);
  if (s.advisorSummary) print(`  Summary:    ${s.advisorSummary}`);
  if (s.debriefAudioUrl) print(`  Debrief:    ${s.debriefAudioUrl}`);
  print('');
}

/**
 * swain scan session-update --session=<sessionId> --status=<s> [--current-wave=N] [--advisor-summary="..."] [--debrief-audio-url=<url>] [--debrief-summary="..."] --json
 */
async function updateSession(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];

  if (!sessionId) {
    printError('Usage: swain scan session-update --session=<sessionId> --status=<s> [options] [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = {};
  if (params['status']) {
    if (!VALID_STATUSES.includes(params['status'] as any)) {
      printError(`--status must be one of: ${VALID_STATUSES.join(', ')}`);
      process.exit(1);
    }
    body.status = params['status'];
  }
  if (params['current-wave']) body.currentWave = parseInt(params['current-wave'], 10);
  if (params['advisor-summary']) body.advisorSummary = params['advisor-summary'];
  if (params['debrief-audio-url']) body.debriefAudioUrl = params['debrief-audio-url'];
  if (params['debrief-summary']) body.debriefSummary = params['debrief-summary'];
  if (params['greeting']) body.greeting = params['greeting'];
  if (params['greeting-audio-url']) body.greetingAudioUrl = params['greeting-audio-url'];

  if (Object.keys(body).length === 0) {
    printError('No fields to update. Pass --status, --current-wave, --advisor-summary, --debrief-audio-url, --debrief-summary, --greeting, or --greeting-audio-url');
    process.exit(1);
  }

  const result = await workerRequest(`/scan/sessions/${sessionId}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to update session');
    process.exit(1);
  }

  printSuccess(`Session updated: ${sessionId}`);
  print('');
}

/**
 * swain scan captures --session=<sessionId> [--wave=N] [--unprocessed] --json
 */
async function listCaptures(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];

  if (!sessionId) {
    printError('Usage: swain scan captures --session=<sessionId> [--wave=N] [--unprocessed] [--json]');
    process.exit(1);
  }

  const queryParts: string[] = [`sessionId=${sessionId}`];
  if (params['wave']) queryParts.push(`wave=${params['wave']}`);
  if (args.includes('--unprocessed')) queryParts.push('processed=false');
  const qs = queryParts.join('&');

  const result = await workerRequest(`/scan/captures?${qs}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const captures = result.captures || result.data || [];

  if (captures.length === 0) {
    print('No captures found');
    return;
  }

  print(`\n${colors.bold}CAPTURES (${captures.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(30)} ${'PROMPT'.padEnd(24)} ${'TYPE'.padEnd(8)} ${'WAVE'.padEnd(6)} ${'PROCESSED'}`);
  print(`${'-'.repeat(30)} ${'-'.repeat(24)} ${'-'.repeat(8)} ${'-'.repeat(6)} ${'-'.repeat(10)}`);

  for (const c of captures) {
    const processed = c.processed ? `${colors.green}yes${colors.reset}` : `${colors.yellow}no${colors.reset}`;
    print(`${(c.captureId || '').slice(0, 29).padEnd(30)} ${(c.promptId || '-').slice(0, 23).padEnd(24)} ${(c.captureType || '-').padEnd(8)} ${String(c.wave || 0).padEnd(6)} ${processed}`);
  }
  print('');
}

/**
 * swain scan capture-update <captureId> --processed [--transcription="..."] --json
 */
async function updateCapture(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const captureId = args.find(a => !a.startsWith('--'));

  if (!captureId) {
    printError('Usage: swain scan capture-update <captureId> --processed [--transcription="..."] [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = {};
  if (args.includes('--processed')) body.processed = true;
  if (params['transcription']) body.transcription = params['transcription'];

  if (Object.keys(body).length === 0) {
    printError('No fields to update. Pass --processed and/or --transcription');
    process.exit(1);
  }

  const result = await workerRequest(`/scan/captures/${captureId}`, {
    method: 'PATCH',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to update capture');
    process.exit(1);
  }

  printSuccess(`Capture updated: ${captureId}`);
  print('');
}

/**
 * swain scan clips --session=<sessionId> [--wave=N] --json
 */
async function listClips(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];

  if (!sessionId) {
    printError('Usage: swain scan clips --session=<sessionId> [--wave=N] [--json]');
    process.exit(1);
  }

  const queryParts: string[] = [`sessionId=${sessionId}`];
  if (params['wave']) queryParts.push(`wave=${params['wave']}`);
  const qs = queryParts.join('&');

  const result = await workerRequest(`/scan/clips?${qs}`);

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  const clips = result.clips || result.data || [];

  if (clips.length === 0) {
    print('No clips found');
    return;
  }

  print(`\n${colors.bold}AUDIO CLIPS (${clips.length})${colors.reset}\n`);
  print(`${'ID'.padEnd(24)} ${'TYPE'.padEnd(12)} ${'WAVE'.padEnd(6)} ${'ORDER'.padEnd(7)} ${'DURATION'}`);
  print(`${'-'.repeat(24)} ${'-'.repeat(12)} ${'-'.repeat(6)} ${'-'.repeat(7)} ${'-'.repeat(10)}`);

  for (const c of clips) {
    const dur = c.durationMs ? `${(c.durationMs / 1000).toFixed(1)}s` : '-';
    print(`${(c.clipId || '').slice(0, 23).padEnd(24)} ${(c.clipType || '-').padEnd(12)} ${String(c.wave || 0).padEnd(6)} ${String(c.sortOrder || 0).padEnd(7)} ${dur}`);
  }
  print('');
}

/**
 * swain scan clips-post --session=<sessionId> --wave=N --clips='<json>' --json
 */
async function postClips(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];
  const wave = params['wave'];
  const clipsJson = params['clips'];

  if (!sessionId || !wave || !clipsJson) {
    printError("Usage: swain scan clips-post --session=<sessionId> --wave=N --clips='<json>' [--json]");
    process.exit(1);
  }

  let clips: any[];
  try {
    clips = JSON.parse(clipsJson);
  } catch {
    printError('Invalid JSON in --clips parameter');
    process.exit(1);
  }

  const validationErrors = validateClips(clips);
  if (validationErrors) {
    for (const err of validationErrors) {
      console.error(`${colors.red}${err}${colors.reset}`);
    }
    process.exit(1);
  }

  const result = await workerRequest('/scan/clips', {
    method: 'POST',
    body: {
      sessionId,
      wave: parseInt(wave, 10),
      clips,
    },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to post clips');
    process.exit(1);
  }

  printSuccess(`Posted ${clips.length} clips for wave ${wave}`);
  print('');
}

/**
 * swain scan audio-upload --session=<sessionId> --clip=<clipId> [--url=<sourceUrl>] [--format=mp3] --json
 *
 * Two modes:
 * 1. With --url: server downloads from sourceUrl and uploads to R2, returns { audioUrl }
 * 2. Without --url: returns { uploadUrl, audioUrl, method: "PUT" } for direct upload
 */
async function uploadAudio(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];
  const clipId = params['clip'] || params['clip-id'];
  const sourceUrl = params['url'];
  const format = params['format'] || 'mp3';

  if (!sessionId || !clipId) {
    printError('Usage: swain scan audio-upload --session=<sessionId> --clip=<clipId> [--url=<sourceUrl>] [--format=mp3] [--json]');
    process.exit(1);
  }

  const body: Record<string, any> = { sessionId, clipId, format };
  if (sourceUrl) body.sourceUrl = sourceUrl;

  const result = await workerRequest('/scan/audio', {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (result.audioUrl) {
    if (result.uploadUrl) {
      printSuccess(`Upload URL ready: ${result.uploadUrl}`);
      print(`  Method: ${result.method}`);
      print(`  Audio URL (after upload): ${result.audioUrl}`);
    } else {
      printSuccess(`Audio uploaded: ${result.audioUrl}`);
    }
  } else {
    printError(result.error || 'Upload failed');
    process.exit(1);
  }
}

/**
 * swain scan initialize --user=<userId> --boat=<boatId> --json
 * Kick off the scan progression — creates the first session (boat_itself) and triggers wave 1
 */
async function initializeScan(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const userId = params['user'] || params['user-id'];
  const boatId = params['boat'] || params['boat-id'];

  if (!userId || !boatId) {
    printError('Usage: swain scan initialize --user=<userId> --boat=<boatId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest('/scan/initialize', {
    method: 'POST',
    body: { userId, boatId },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to initialize scan');
    process.exit(1);
  }

  printSuccess(`Scan initialized for ${userId}`);
  print(`  Session: ${result.sessionId}`);
  print(`  Dimension: boat_itself`);
  print(`  Status: generating`);
  print('');
}

/**
 * swain scan generate-wave --session=<sessionId> --wave=N --json
 * Testing trigger — sends generate_wave message to the advisor agent via Convex
 */
async function triggerGenerateWave(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];
  const wave = params['wave'];

  if (!sessionId || !wave) {
    printError('Usage: swain scan generate-wave --session=<sessionId> --wave=N [--json]');
    process.exit(1);
  }

  const result = await workerRequest('/scan/trigger', {
    method: 'POST',
    body: {
      action: 'generate_wave',
      sessionId,
      wave: parseInt(wave, 10),
    },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to trigger wave generation');
    process.exit(1);
  }

  printSuccess(`Triggered generate_wave: session=${sessionId}, wave=${wave}`);
  print('');
}

/**
 * swain scan generate-debrief --session=<sessionId> --json
 * Testing trigger — sends generate_debrief message to the advisor agent via Convex
 */
async function triggerGenerateDebrief(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = isJsonMode(params);
  const sessionId = params['session'] || params['session-id'];

  if (!sessionId) {
    printError('Usage: swain scan generate-debrief --session=<sessionId> [--json]');
    process.exit(1);
  }

  const result = await workerRequest('/scan/trigger', {
    method: 'POST',
    body: {
      action: 'generate_debrief',
      sessionId,
    },
  });

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  if (!result.success) {
    printError(result.error || 'Failed to trigger debrief generation');
    process.exit(1);
  }

  printSuccess(`Triggered generate_debrief: session=${sessionId}`);
  print('');
}

/**
 * Show help
 */
function showHelp(): void {
  print(`
${colors.bold}swain scan${colors.reset} - Boat scan session management

${colors.bold}COMMANDS${colors.reset}
  sessions                List scan sessions for a user
  session-get             Get session details
  session-update          Update session state
  captures                List captures for a session
  capture-update          Mark capture processed, set transcription
  clips                   List audio clips for a session
  clips-post              Post generated audio clips (batch)
  audio-upload            Upload audio file to Cloudflare R2
  initialize              Kick off scan progression for a user/boat
  generate-wave           Trigger wave generation (testing)
  generate-debrief        Trigger debrief generation (testing)

${colors.bold}OPTIONS${colors.reset}
  --session=<id>          Session ID
  --user=<id>             User ID (for sessions)
  --boat=<id>             Boat ID (for sessions)
  --dimension=<dim>       Dimension filter (hull, engine, safety, lifestyle)
  --wave=N                Wave number
  --status=<s>            Session status (not_started, generating, active, awaiting_captures, completed)
  --current-wave=N        Current wave number (for session-update)
  --advisor-summary="..."  Advisor summary text (for session-update)
  --debrief-audio-url=<url> Debrief audio URL (for session-update)
  --debrief-summary="..."  Debrief summary text (for session-update)
  --greeting="..."         Personalized intro greeting (for session-update, first session only)
  --greeting-audio-url=<url> Greeting TTS audio URL (for session-update)
  --clips=<json>          JSON array of clip objects (for clips-post)
  --unprocessed           Filter to unprocessed captures only
  --processed             Mark capture as processed (for capture-update)
  --transcription="..."   Transcription text (for capture-update)
  --clip=<id>             Clip ID (for audio-upload)
  --url=<url>             Source URL for server-side download (for audio-upload)
  --format=<fmt>          Audio format, default: mp3 (for audio-upload)
  --json                  Output as JSON

${colors.bold}EXAMPLES${colors.reset}
  swain scan initialize --user=user_abc --boat=boat_xyz --json
  swain scan sessions --user=user_abc --json
  swain scan session-get --session=scan_sess_123 --json
  swain scan session-update --session=scan_sess_123 --status=active --current-wave=2 --json
  swain scan captures --session=scan_sess_123 --unprocessed --json
  swain scan capture-update cap_xyz --processed --transcription="The zincs are about 60% worn" --json
  swain scan clips --session=scan_sess_123 --wave=1 --json
  swain scan clips-post --session=scan_sess_123 --wave=1 --clips='[{"clipType":"wave_intro","script":"Hey!","audioUrl":"https://...","sortOrder":0}]' --json
  swain scan audio-upload --session=scan_sess_123 --clip=clip_abc --url=https://example.com/clip.mp3 --json
  swain scan audio-upload --session=scan_sess_123 --clip=clip_abc --json
  swain scan generate-wave --session=scan_sess_123 --wave=1 --json
  swain scan generate-debrief --session=scan_sess_123 --json
`);
}

/**
 * Main entry point
 */
export async function run(args: string[]): Promise<void> {
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    switch (command) {
      case 'sessions':
        await listSessions(commandArgs);
        break;
      case 'session-get':
        await getSession(commandArgs);
        break;
      case 'session-update':
        await updateSession(commandArgs);
        break;
      case 'captures':
        await listCaptures(commandArgs);
        break;
      case 'capture-update':
        await updateCapture(commandArgs);
        break;
      case 'clips':
        await listClips(commandArgs);
        break;
      case 'clips-post':
        await postClips(commandArgs);
        break;
      case 'audio-upload':
        await uploadAudio(commandArgs);
        break;
      case 'initialize':
        await initializeScan(commandArgs);
        break;
      case 'generate-wave':
        await triggerGenerateWave(commandArgs);
        break;
      case 'generate-debrief':
        await triggerGenerateDebrief(commandArgs);
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
