#!/usr/bin/env bun
/**
 * One-time backfill: generate AI summaries from existing session transcripts.
 *
 * Run on VPS: cd /root/clawd/swain-agents/api && bun run backfill-summaries.ts
 *
 * Finds session JSONL files on each sprite, extracts the last assistant message
 * from each, calls Haiku for a 1-2 sentence summary, stores in DB.
 */

import { listAgents, addSummary, getSummaries } from "./db";

const SPRITE_CLI = "sprite";
const HOME = "/root";
const PATH = `/root/.local/bin:/root/.bun/bin:${process.env.PATH}`;

async function spriteExec(name: string, cmd: string): Promise<string> {
  const proc = Bun.spawn([SPRITE_CLI, "exec", "-s", name, "--", "bash", "-c", cmd], {
    stdout: "pipe", stderr: "pipe",
    env: { ...process.env, HOME, PATH },
  });
  const stdout = await new Response(proc.stdout).text();
  await proc.exited;
  return stdout.trim();
}

async function claudeHaiku(prompt: string, spriteName: string): Promise<string> {
  // Source env vars from sprite's start.sh and call Haiku
  const escaped = prompt.replace(/'/g, "'\\''");
  const cmd = `eval $(grep "^export" /home/sprite/start.sh) && claude -p '${escaped}' --model claude-haiku-4-5-20251001 --dangerously-skip-permissions --max-turns 1 2>/dev/null`;
  const result = await spriteExec(spriteName, cmd);
  // claude -p with no --output-format returns plain text
  return result.trim();
}

async function backfillSprite(agentId: string, spriteName: string): Promise<number> {
  console.log(`\n=== ${agentId} (${spriteName}) ===`);

  // Find session JSONL files
  const sessionFiles = await spriteExec(spriteName,
    "find /home/sprite/.claude/projects/ -name '*.jsonl' -type f 2>/dev/null | sort -t/ -k6 | tail -10"
  );

  if (!sessionFiles) {
    console.log("  no sessions found");
    return 0;
  }

  const files = sessionFiles.split("\n").filter(Boolean);
  console.log(`  found ${files.length} session files`);

  let count = 0;
  for (const file of files) {
    // Extract session ID from filename
    const sessionId = file.split("/").pop()?.replace(".jsonl", "") || "";

    // Check if we already have a summary for this session
    const existing = getSummaries({ agentId, limit: 100 });
    if (existing.some(s => s.session_id === sessionId)) {
      console.log(`  ${sessionId.slice(0, 8)}... already summarized, skipping`);
      continue;
    }

    // Extract activity from session: tool calls (reply, Bash, Write, etc.) and any text output
    const lastMessages = await spriteExec(spriteName,
      `tail -200 '${file}' 2>/dev/null | python3 -c "
import json, sys
lines = []
for line in sys.stdin:
    line = line.strip()
    if not line: continue
    try:
        msg = json.loads(line)
        # Extract reply tool calls (what the agent said to the captain)
        if msg.get('type') == 'assistant':
            for block in msg.get('message',{}).get('content',[]):
                if block.get('type') == 'tool_use' and block.get('name') == 'reply':
                    text = block.get('input',{}).get('text','')
                    if text: lines.append(f'Sent: {text[:200]}')
                elif block.get('type') == 'tool_use':
                    name = block.get('name','')
                    inp = str(block.get('input',{}))[:100]
                    lines.append(f'Used {name}: {inp}')
                elif block.get('type') == 'text' and block.get('text','').strip():
                    lines.append(block['text'][:200])
    except: pass
# Keep last 10 actions
for l in lines[-10:]: print(l)
" 2>/dev/null`
    );

    if (!lastMessages.trim()) {
      console.log(`  ${sessionId.slice(0, 8)}... no assistant messages, skipping`);
      continue;
    }

    // Get session timestamp from file modification time
    const fileStat = await spriteExec(spriteName, `stat -c %Y '${file}' 2>/dev/null || date +%s`);
    const ts = new Date(parseInt(fileStat) * 1000).toISOString();

    // Call Haiku for summary
    const truncated = lastMessages.trim().slice(0, 1500);
    try {
      const summary = await claudeHaiku(
        `Summarize what this AI agent did in 1-2 sentences. Be specific about actions taken. Here is the agent output:\n\n${truncated}`,
        spriteName
      );

      if (summary && summary.length > 10) {
        addSummary(agentId, summary, sessionId, ts);
        console.log(`  ${sessionId.slice(0, 8)}... ${ts.slice(0, 19)} → ${summary.slice(0, 80)}`);
        count++;
      } else {
        console.log(`  ${sessionId.slice(0, 8)}... empty summary, skipping`);
      }
    } catch (err) {
      console.log(`  ${sessionId.slice(0, 8)}... Haiku failed: ${err}`);
    }
  }

  return count;
}

// --- Main ---

const agents = listAgents().filter(a => a.status === "active" && a.sprite_name);
console.log(`Backfilling summaries for ${agents.length} active agents...`);

let total = 0;
for (const agent of agents) {
  try {
    const count = await backfillSprite(agent.id, agent.sprite_name!);
    total += count;
  } catch (err) {
    console.error(`  ${agent.id} failed: ${err}`);
  }
}

console.log(`\nDone. ${total} summaries backfilled.`);
