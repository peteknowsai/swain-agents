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

  # Update channel server
  cat "$CHANNEL_DIR/server.ts" | sprite exec -s "$name" -- tee /home/sprite/channel/server.ts > /dev/null 2>&1
  cat "$CHANNEL_DIR/sync.ts" | sprite exec -s "$name" -- tee /home/sprite/channel/sync.ts > /dev/null 2>&1
  echo "  channel server: updated"
done
echo ""
echo "Done."
