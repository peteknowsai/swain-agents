#!/bin/bash
# Push skill updates from the repo to all sprites.
# Run from VPS: bash /root/clawd/swain-agents/sprite/scripts/update-skills.sh

export PATH=/root/.local/bin:$PATH
export HOME=/root

SKILLS_DIR="/root/clawd/swain-agents/sprite/skills"
CHANNEL_DIR="/root/clawd/swain-agents/sprite/channel"

echo "Updating skills + channel server on all sprites..."
for name in $(sprite list 2>/dev/null | grep -E '^(advisor-|pete-|joe-|austin-|manny-|.*-desk)'); do
  echo ""
  echo "=== $name ==="

  # Update skills
  for skill in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill")
    sprite exec -s "$name" -- mkdir -p "/home/sprite/.claude/skills/$skill_name" 2>/dev/null

    # Copy SKILL.md
    if [ -f "$skill/SKILL.md" ]; then
      cat "$skill/SKILL.md" | sprite exec -s "$name" -- tee "/home/sprite/.claude/skills/$skill_name/SKILL.md" > /dev/null 2>&1
    fi

    # Copy reference.md if it exists
    if [ -f "$skill/reference.md" ]; then
      cat "$skill/reference.md" | sprite exec -s "$name" -- tee "/home/sprite/.claude/skills/$skill_name/reference.md" > /dev/null 2>&1
    fi
  done
  echo "  skills: $(ls -d "$SKILLS_DIR"/*/ | wc -l | tr -d ' ') updated"

  # Update agent + sync
  cat "$CHANNEL_DIR/swain-agent.ts" | sprite exec -s "$name" -- tee /home/sprite/channel/swain-agent.ts > /dev/null 2>&1
  cat "$CHANNEL_DIR/sync.ts" | sprite exec -s "$name" -- tee /home/sprite/channel/sync.ts > /dev/null 2>&1
  cat "$CHANNEL_DIR/swain-channel-send" | sprite exec -s "$name" -- tee /usr/local/bin/swain-channel-send > /dev/null 2>&1
  sprite exec -s "$name" -- chmod +x /usr/local/bin/swain-channel-send 2>/dev/null
  echo "  agent: updated"

  # Ensure directories exist
  sprite exec -s "$name" -- mkdir -p /home/sprite/.channel/inbox /home/sprite/stoolap /home/sprite/logs /home/sprite/media 2>/dev/null

  # Inject new env vars into start.sh if missing
  if ! sprite exec -s "$name" -- grep -q SWAIN_AGENT_API_URL /home/sprite/start.sh 2>/dev/null; then
    AGENT_API_URL="${SWAIN_AGENT_API_URL:-http://76.13.106.143:3847}"
    AGENT_API_TOKEN="${SWAIN_AGENT_API_TOKEN:-}"
    if [ -n "$AGENT_API_TOKEN" ]; then
      sprite exec -s "$name" -- sed -i "/^export SWAIN_API_TOKEN/a export SWAIN_AGENT_API_URL=\"$AGENT_API_URL\"\nexport SWAIN_AGENT_API_TOKEN=\"$AGENT_API_TOKEN\"" /home/sprite/start.sh 2>/dev/null
      echo "  env: added SWAIN_AGENT_API_URL + TOKEN"
    else
      echo "  env: SWAIN_AGENT_API_TOKEN not set on VPS, skipping"
    fi
  fi
done
echo ""
echo "Done."
