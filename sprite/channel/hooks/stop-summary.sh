#!/bin/bash
# Claude Code Stop hook — generates a 1-2 sentence summary after each turn.
# Uses Haiku for speed. POSTs to VPS API for dashboard display.
# Receives JSON on stdin with session_id, last_assistant_message, stop_hook_active.

INPUT=$(cat)

# Prevent infinite recursion — this hook fires on ALL claude calls,
# including the Haiku summary call itself
HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

LAST_MSG=$(echo "$INPUT" | jq -r '.last_assistant_message // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

# Nothing to summarize
if [ -z "$LAST_MSG" ] || [ "$LAST_MSG" = "null" ]; then
  exit 0
fi

# Source env vars for API access
eval $(grep "^export" /home/sprite/start.sh 2>/dev/null)

SPRITE_ID="${SPRITE_ID:-unknown}"
BRIDGE_URL="${BRIDGE_URL:-}"

# Truncate long messages for the summary prompt
TRUNCATED=$(echo "$LAST_MSG" | head -c 2000)

# Generate summary with Haiku (fast + cheap)
SUMMARY=$(claude -p "Summarize what was just done in 1-2 sentences. Be specific about actions taken (cards created, messages sent, data updated). Here is the output: $TRUNCATED" \
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
