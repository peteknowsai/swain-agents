#!/bin/bash
# Push skill updates from the repo to all sprites.
# Run from VPS: bash /root/clawd/swain-agents/sprite/scripts/update-skills.sh

export PATH=/root/.local/bin:$PATH
export HOME=/root

SKILLS_DIR="/root/clawd/swain-agents/sprite/skills"
CHANNEL_DIR="/root/clawd/swain-agents/sprite/channel"

echo "Updating skills + channel server on all sprites..."
for name in $(sprite list 2>/dev/null | grep -E '^(advisor-|desk-|pete-|joe-|austin-|manny-|.*-desk)'); do
  echo ""
  echo "=== $name ==="

  # Update skills
  for skill in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill")
    sprite exec -s "$name" -- mkdir -p "/home/sprite/.claude/skills/$skill_name" 2>/dev/null

    if [ -f "$skill/SKILL.md" ]; then
      cat "$skill/SKILL.md" | sprite exec -s "$name" -- tee "/home/sprite/.claude/skills/$skill_name/SKILL.md" > /dev/null 2>&1
    fi

    if [ -f "$skill/reference.md" ]; then
      cat "$skill/reference.md" | sprite exec -s "$name" -- tee "/home/sprite/.claude/skills/$skill_name/reference.md" > /dev/null 2>&1
    fi
  done
  echo "  skills: $(ls -d "$SKILLS_DIR"/*/ | wc -l | tr -d ' ') updated"

  # Update agent + channel-send + package.json + hooks
  cat "$CHANNEL_DIR/swain-agent.ts" | sprite exec -s "$name" -- tee /home/sprite/channel/swain-agent.ts > /dev/null 2>&1
  cat "$CHANNEL_DIR/sync.ts" | sprite exec -s "$name" -- tee /home/sprite/channel/sync.ts > /dev/null 2>&1
  cat "$CHANNEL_DIR/package.json" | sprite exec -s "$name" -- tee /home/sprite/channel/package.json > /dev/null 2>&1
  cat "$CHANNEL_DIR/swain-channel-send" | sprite exec -s "$name" -- tee /usr/local/bin/swain-channel-send > /dev/null 2>&1
  sprite exec -s "$name" -- chmod +x /usr/local/bin/swain-channel-send 2>/dev/null
  cat "$CHANNEL_DIR/swain-reply" | sprite exec -s "$name" -- tee /usr/local/bin/swain-reply > /dev/null 2>&1
  sprite exec -s "$name" -- chmod +x /usr/local/bin/swain-reply 2>/dev/null

  echo "  agent: updated"

  # Ensure directories exist, clean up old hooks
  sprite exec -s "$name" -- mkdir -p /home/sprite/.channel/inbox /home/sprite/stoolap /home/sprite/logs /home/sprite/media 2>/dev/null
  sprite exec -s "$name" -- rm -rf /home/sprite/channel/hooks /home/sprite/.claude/settings.json 2>/dev/null

  # Inject new env vars into start.sh if missing
  if ! sprite exec -s "$name" -- grep -q SWAIN_AGENT_API_URL /home/sprite/start.sh 2>/dev/null; then
    AGENT_API_URL="${SWAIN_AGENT_API_URL:-http://76.13.106.143:3847}"
    AGENT_API_TOKEN="${SWAIN_AGENT_API_TOKEN:-}"
    if [ -n "$AGENT_API_TOKEN" ]; then
      sprite exec -s "$name" -- sed -i "/^export SWAIN_API_TOKEN/a export SWAIN_AGENT_API_URL=\"$AGENT_API_URL\"\nexport SWAIN_AGENT_API_TOKEN=\"$AGENT_API_TOKEN\"" /home/sprite/start.sh 2>/dev/null
      echo "  env: added SWAIN_AGENT_API_URL + TOKEN"
    fi
  fi

  # Inject ElevenLabs API key if missing (needed for scan episode TTS)
  if ! sprite exec -s "$name" -- grep -q ELEVENLABS_API_KEY /home/sprite/start.sh 2>/dev/null; then
    ELEVENLABS_KEY="${ELEVENLABS_API_KEY:-}"
    ELEVENLABS_VOICE="${ELEVENLABS_VOICE_ID:-1SM7GgM6IMuvQlz2BwM3}"
    if [ -n "$ELEVENLABS_KEY" ]; then
      sprite exec -s "$name" -- sed -i "/^export SPRITE_ID/i export ELEVENLABS_API_KEY=\"$ELEVENLABS_KEY\"\nexport ELEVENLABS_VOICE_ID=\"$ELEVENLABS_VOICE\"" /home/sprite/start.sh 2>/dev/null
      echo "  env: added ELEVENLABS_API_KEY + VOICE_ID"
    fi
  fi

  # Inject IMESSAGE_API_TOKEN if missing (needed for swain user engagement)
  if ! sprite exec -s "$name" -- grep -q IMESSAGE_API_TOKEN /home/sprite/start.sh 2>/dev/null; then
    IMESSAGE_TOKEN="${IMESSAGE_API_TOKEN:-}"
    if [ -n "$IMESSAGE_TOKEN" ]; then
      sprite exec -s "$name" -- sed -i "/^export SPRITE_ID/i export IMESSAGE_API_TOKEN=\"$IMESSAGE_TOKEN\"" /home/sprite/start.sh 2>/dev/null
      echo "  env: added IMESSAGE_API_TOKEN"
    fi
  fi

  # Ensure start.sh launches the Agent SDK (service auto-restarts it on wake)
  if ! sprite exec -s "$name" -- grep -q "exec bun run channel/swain-agent.ts" /home/sprite/start.sh 2>/dev/null; then
    # Remove old launcher lines
    sprite exec -s "$name" -- sed -i '/^cd \/home\/sprite/d; /^exec bun/d; /^exec sleep/d; /^exit 0/d; /^# No persistent/d; /^# Keep service/d; /^# Desk.pool/d' /home/sprite/start.sh 2>/dev/null
    # Add Agent SDK launcher
    printf 'cd /home/sprite\nexec bun run channel/swain-agent.ts >> /home/sprite/logs/agent.log 2>&1\n' | sprite exec -s "$name" -- tee -a /home/sprite/start.sh > /dev/null 2>&1
    echo "  launcher: set to Agent SDK service"
  fi

  # Ensure Agent SDK is installed
  if ! sprite exec -s "$name" -- test -d /home/sprite/channel/node_modules/@anthropic-ai/claude-agent-sdk 2>/dev/null; then
    sprite exec -s "$name" -- bash -c "cd /home/sprite/channel && bun add @anthropic-ai/claude-agent-sdk 2>/dev/null && bun install 2>/dev/null" 2>/dev/null
    echo "  sdk: installed"
  fi

  # Kill stale processes so the service can take over on next wake
  sprite exec -s "$name" -- pkill -f 'bun run channel/' 2>/dev/null
  sprite exec -s "$name" -- pkill -f 'bun run server' 2>/dev/null
  sprite exec -s "$name" -- pkill -f 'sleep infinity' 2>/dev/null
  sprite exec -s "$name" -- pkill -f 'claude setup-token' 2>/dev/null

  # Recreate service without httpPort (idempotent — overwrites existing)
  sprite exec -s "$name" -- sprite-env services create channel --cmd /home/sprite/start.sh 2>/dev/null
  echo "  service: registered"
done
echo ""
echo "Done."
