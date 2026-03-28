#!/bin/bash
# Claude Code Stop hook — generates a 3-sentence max summary of the entire turn.
# Uses Haiku for speed. POSTs to VPS API for dashboard display.
# Receives JSON on stdin with session_id, transcript_path, stop_hook_active.

INPUT=$(cat)

# Prevent infinite recursion — this hook fires on ALL claude calls,
# including the Haiku summary call itself
HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')

# Need a transcript to summarize
if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# Source env vars for API access
eval $(grep "^export" /home/sprite/start.sh 2>/dev/null)

SPRITE_ID="${SPRITE_ID:-unknown}"
BRIDGE_URL="${BRIDGE_URL:-}"

# Extract full turn activity from transcript: prompts, tool calls, results, output
ACTIVITY=$(python3 -c "
import json, sys
lines = []
for line in open('$TRANSCRIPT'):
    line = line.strip()
    if not line: continue
    try:
        msg = json.loads(line)
        t = msg.get('type','')
        if t == 'human':
            for block in msg.get('message',{}).get('content',[]):
                if block.get('type') == 'text':
                    lines.append(f'PROMPT: {block[\"text\"][:300]}')
        elif t == 'assistant':
            for block in msg.get('message',{}).get('content',[]):
                if block.get('type') == 'tool_use':
                    name = block.get('name','')
                    inp = block.get('input',{})
                    if name == 'reply':
                        lines.append(f'SENT: {inp.get(\"text\",\"\")[:200]}')
                    elif name == 'Bash':
                        lines.append(f'RAN: {inp.get(\"command\",\"\")[:200]}')
                    elif name in ('Read','Write','Edit'):
                        lines.append(f'{name.upper()}: {inp.get(\"file_path\",\"\")[:150]}')
                    else:
                        lines.append(f'TOOL {name}: {str(inp)[:100]}')
                elif block.get('type') == 'text' and block.get('text','').strip():
                    lines.append(f'OUTPUT: {block[\"text\"][:200]}')
        elif t == 'tool_result' and msg.get('is_error'):
            lines.append(f'ERROR: {str(msg.get(\"content\",\"\"))[:150]}')
    except: pass
sample = lines[:3] + lines[-7:] if len(lines) > 10 else lines
for l in sample: print(l)
" 2>/dev/null)

# Nothing worth summarizing
if [ -z "$ACTIVITY" ]; then
  exit 0
fi

TRUNCATED=$(echo "$ACTIVITY" | head -c 2000)

# Generate summary with Haiku (fast + cheap)
SUMMARY=$(claude -p "Summarize this AI agent's entire turn in 3 sentences max. Include what triggered it, what tools it used, and the outcome. Be specific. Here is the activity log: $TRUNCATED" \
  --model claude-haiku-4-5-20251001 \
  --dangerously-skip-permissions \
  --max-turns 1 \
  2>/dev/null)

# POST to VPS API for dashboard
if [ -n "$BRIDGE_URL" ] && [ -n "$SUMMARY" ]; then
  curl -s -X POST "${BRIDGE_URL}/sprites/${SPRITE_ID}/summary" \
    -H "Content-Type: application/json" \
    -d "$(jq -n --arg s "$SUMMARY" --arg sid "$SESSION_ID" --arg aid "$SPRITE_ID" \
      '{summary: $s, sessionId: $sid, agentId: $aid, ts: (now | todate)}')" \
    >/dev/null 2>&1
fi

# Also write locally for debugging
echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) $SUMMARY" >> /home/sprite/logs/summaries.log 2>/dev/null

exit 0
