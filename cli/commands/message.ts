#!/usr/bin/env bun

/**
 * Message Commands
 * swain message send --to=<phone> --text=<message> [--effect=<effect>] [--media=<url>] [--user=<userId>]
 */

import {
  workerRequest,
  print,
  printError,
  printSuccess,
  colors,
} from '../lib/worker-client';
import { parseArgs } from '../lib/args';

/**
 * swain message send --to=<phone> --text="Hello!" [--effect=fireworks] [--media=<url>] [--user=<userId>]
 */
async function sendMessage(args: string[]): Promise<void> {
  const params = parseArgs(args);
  const jsonOutput = params['json'] === 'true';
  const to = params['to'];
  const text = params['text'];
  const mediaUrl = params['media'];
  const caption = params['caption'];
  const effect = params['effect'];
  const userId = params['user'];

  if (!to) {
    printError('Usage: swain message send --to=<phone> --text="message"');
    process.exit(1);
  }
  if (!text && !mediaUrl) {
    printError('Must provide --text or --media');
    process.exit(1);
  }

  const body: Record<string, any> = { to };
  if (text) body.text = text;
  if (mediaUrl) body.mediaUrl = mediaUrl;
  if (caption) body.caption = caption;
  if (effect) body.effect = effect;
  if (userId) body.userId = userId;

  const result = await workerRequest('/api/messages/send', {
    method: 'POST',
    body,
  });

  if (jsonOutput) {
    console.log(JSON.stringify({ success: true, ...result }, null, 2));
    return;
  }

  printSuccess(`Message sent to ${to}`);
  if (result.chatId) print(`  Chat: ${result.chatId}`);
  if (result.messageId) print(`  Message: ${result.messageId}`);
  if (result.service) print(`  Service: ${result.service}`);
}

function showHelp(): void {
  print(`
${colors.bold}swain message${colors.reset} - Send iMessage/SMS via Linq

${colors.bold}COMMANDS${colors.reset}
  send    Send a text or media message

${colors.bold}USAGE${colors.reset}
  swain message send --to=+14155551234 --text="Hey there!"
  swain message send --to=+14155551234 --text="Happy birthday!" --effect=balloons
  swain message send --to=+14155551234 --media=https://example.com/photo.jpg --caption="Check this out"
  swain message send --to=+14155551234 --text="Hello" --user=user_abc --json

${colors.bold}OPTIONS${colors.reset}
  --to=<phone>       Recipient phone number (E.164 format)
  --text=<message>   Message text to send
  --media=<url>      URL of image/video to send (HTTPS, max 10MB)
  --caption=<text>   Caption for media messages
  --effect=<name>    iMessage effect (see below)
  --user=<userId>    Optional: associate with a user for chat persistence
  --json             Output as JSON

${colors.bold}EFFECTS${colors.reset}
  Screen: confetti, fireworks, lasers, sparkles, celebration,
          hearts, love, balloons, happy_birthday, echo, spotlight
  Bubble: slam, loud, gentle, invisible
`);
}

export async function run(args: string[]): Promise<void> {
  const subcommand = args[0];

  if (!subcommand || subcommand === '--help' || subcommand === '-h') {
    showHelp();
    return;
  }

  switch (subcommand) {
    case 'send':
      await sendMessage(args.slice(1));
      break;
    default:
      printError(`Unknown subcommand: ${subcommand}`);
      showHelp();
      process.exit(1);
  }
}
