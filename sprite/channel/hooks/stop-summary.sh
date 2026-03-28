#!/bin/bash
# Claude Code Stop hook — posts structured activity log after each turn.
# No AI interpretation — just the raw facts of what happened.

INPUT=$(cat)

# Prevent recursion
HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
TRANSCRIPT=$(echo "$INPUT" | jq -r '.transcript_path // empty')

if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0
fi

# Source env vars
eval $(grep "^export" /home/sprite/start.sh 2>/dev/null)
SPRITE_ID="${SPRITE_ID:-unknown}"
BRIDGE_URL="${BRIDGE_URL:-}"

# Extract structured activity from the transcript
ACTIVITY=$(TRANSCRIPT_PATH="$TRANSCRIPT" python3 << 'PYEOF'
import json, sys, os

transcript = os.environ.get("TRANSCRIPT_PATH", "")
if not transcript:
    sys.exit(0)

lines = []
trigger = ""

for raw in open(transcript):
    raw = raw.strip()
    if not raw: continue
    try:
        msg = json.loads(raw)
        t = msg.get("type", "")

        if t == "human":
            for block in msg.get("message", {}).get("content", []):
                if block.get("type") == "text":
                    text = block["text"][:300].replace("\n", " ")
                    if not trigger:
                        trigger = text[:150]
                    lines.append(f"REQUEST: {text}")

        elif t == "assistant":
            for block in msg.get("message", {}).get("content", []):
                if block.get("type") == "tool_use":
                    name = block.get("name", "")
                    inp = block.get("input", {})
                    if name == "reply":
                        lines.append(f"SENT: {inp.get('text', '')[:200]}")
                    elif name == "Bash":
                        cmd = inp.get("command", "")[:200]
                        lines.append(f"RAN: {cmd}")
                    elif name in ("Read", "Write", "Edit"):
                        lines.append(f"{name.upper()}: {inp.get('file_path', '')[:150]}")
                    elif name in ("WebSearch", "WebFetch"):
                        q = inp.get("query", "") or inp.get("url", "")
                        lines.append(f"{name}: {q[:150]}")
                    elif name == "Skill":
                        lines.append(f"SKILL: {inp.get('skill', '')}")
                    elif name in ("Glob", "Grep"):
                        lines.append(f"{name}: {inp.get('pattern', '')[:100]}")
                    else:
                        lines.append(f"TOOL {name}")
                elif block.get("type") == "text" and block.get("text", "").strip():
                    text = block["text"][:200].replace("\n", " ")
                    lines.append(f"OUTPUT: {text}")

        elif t == "tool_result" and msg.get("is_error"):
            err = str(msg.get("content", ""))[:150].replace("\n", " ")
            lines.append(f"ERROR: {err}")

    except:
        pass

# Print trigger on first line, then actions
if trigger:
    print(f"TRIGGER: {trigger}")
for l in lines[-20:]:  # last 20 actions
    print(l)
PYEOF
)

if [ -z "$ACTIVITY" ]; then
  exit 0
fi

# Extract trigger line
TRIGGER=$(echo "$ACTIVITY" | head -1 | sed 's/^TRIGGER: //')

# POST to VPS
if [ -n "$BRIDGE_URL" ]; then
  # Use jq to safely encode the activity text
  PAYLOAD=$(jq -n \
    --arg actions "$ACTIVITY" \
    --arg sid "$SESSION_ID" \
    --arg aid "$SPRITE_ID" \
    --arg trigger "$TRIGGER" \
    '{actions: $actions, sessionId: $sid, agentId: $aid, trigger: $trigger, ts: (now | todate)}')

  curl -s -X POST "${BRIDGE_URL}/sprites/${SPRITE_ID}/activity" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    >/dev/null 2>&1
fi

exit 0
