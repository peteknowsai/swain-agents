#!/bin/bash
# Update all CLIs on all sprites to latest versions.
# Run from VPS: bash /root/clawd/swain-agents/sprite/scripts/update-clis.sh

export PATH=/root/.local/bin:$PATH
export HOME=/root

echo "Updating CLIs on all sprites..."
for name in $(sprite list 2>/dev/null | grep -E '^(advisor-|desk-)'); do
  echo ""
  echo "=== $name ==="

  # swain CLI
  OLD_SWAIN=$(sprite exec -s "$name" -- swain --version 2>/dev/null || echo "missing")
  sprite exec -s "$name" -- bash -c "curl -fsSL -o /usr/local/bin/swain https://github.com/peteknowsai/swain-agents/releases/latest/download/swain-linux-x64 && chmod +x /usr/local/bin/swain" 2>/dev/null
  NEW_SWAIN=$(sprite exec -s "$name" -- swain --version 2>/dev/null || echo "failed")
  echo "  swain: $OLD_SWAIN → $NEW_SWAIN"

  # firecrawl CLI
  OLD_FC=$(sprite exec -s "$name" -- firecrawl --version 2>/dev/null || echo "missing")
  sprite exec -s "$name" -- bash -c "npm install -g firecrawl-cli 2>/dev/null && ln -sf /.sprite/languages/node/nvm/versions/node/*/bin/firecrawl /usr/local/bin/firecrawl" 2>/dev/null
  NEW_FC=$(sprite exec -s "$name" -- firecrawl --version 2>/dev/null || echo "failed")
  echo "  firecrawl: $OLD_FC → $NEW_FC"

  # goplaces (copy from VPS)
  OLD_GP=$(sprite exec -s "$name" -- goplaces --version 2>/dev/null || echo "missing")
  cat /usr/local/bin/goplaces | sprite exec -s "$name" -- bash -c "cat > /usr/local/bin/goplaces && chmod +x /usr/local/bin/goplaces" 2>/dev/null
  NEW_GP=$(sprite exec -s "$name" -- goplaces --version 2>/dev/null || echo "failed")
  echo "  goplaces: $OLD_GP → $NEW_GP"

  # stoolap (copy from VPS)
  OLD_ST=$(sprite exec -s "$name" -- stoolap --version 2>/dev/null || echo "missing")
  cat /usr/local/bin/stoolap | sprite exec -s "$name" -- bash -c "cat > /usr/local/bin/stoolap && chmod +x /usr/local/bin/stoolap" 2>/dev/null
  NEW_ST=$(sprite exec -s "$name" -- stoolap --version 2>/dev/null || echo "failed")
  echo "  stoolap: $OLD_ST → $NEW_ST"
done
echo ""
echo "Done."
