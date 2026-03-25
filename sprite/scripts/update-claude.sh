#!/bin/bash
# Update Claude Code to latest on all advisor sprites.
# Run from VPS: bash /root/clawd/swain-agents/sprite/scripts/update-claude.sh

export PATH=/root/.local/bin:$PATH
export HOME=/root

echo "Updating Claude Code on all sprites..."
for name in $(sprite list 2>/dev/null | grep -E '^advisor-'); do
  echo -n "  $name: "
  OLD=$(sprite exec -s "$name" -- claude --version 2>/dev/null || echo "unknown")
  sprite exec -s "$name" -- bash -c "curl -fsSL https://claude.ai/install.sh | bash" >/dev/null 2>&1
  NEW=$(sprite exec -s "$name" -- claude --version 2>/dev/null || echo "failed")
  if [ "$OLD" = "$NEW" ]; then
    echo "$NEW (already latest)"
  else
    echo "$OLD → $NEW"
  fi
done
echo "Done."
