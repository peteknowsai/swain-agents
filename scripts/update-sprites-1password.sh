#!/bin/bash
# Update all existing sprites to use 1Password for secrets.
# Run from VPS: bash /root/clawd/swain-agents/scripts/update-sprites-1password.sh

set -euo pipefail

OP_SERVICE_ACCOUNT_TOKEN="${OP_SERVICE_ACCOUNT_TOKEN:?Set OP_SERVICE_ACCOUNT_TOKEN}"
OP_ENVIRONMENT_ID="${OP_ENVIRONMENT_ID:-w6u5notvixg7qdvla4aedg4xcm}"
SWAIN_AGENT_API_URL="${SWAIN_AGENT_API_URL:-http://76.13.106.143:3847}"

export HOME=/root
export PATH="/root/.local/bin:/root/.bun/bin:$PATH"

# Get all sprite names
SPRITES=$(sprite list 2>/dev/null)

if [ -z "$SPRITES" ]; then
  echo "No sprites found"
  exit 1
fi

echo "Found sprites:"
echo "$SPRITES"
echo ""

SPRITE_ENV=$(cat <<ENVEOF
#!/bin/bash
export OP_SERVICE_ACCOUNT_TOKEN="${OP_SERVICE_ACCOUNT_TOKEN}"
export OP_ENVIRONMENT_ID="${OP_ENVIRONMENT_ID}"
eval "\$(op environment read ${OP_ENVIRONMENT_ID} 2>/dev/null | sed 's/^/export /')"
export SWAIN_AGENT_API_URL="${SWAIN_AGENT_API_URL}"
ENVEOF
)

for name in $SPRITES; do
  echo "--- Updating $name ---"

  # 1. Install op CLI if missing
  if ! sprite exec -s "$name" -- test -f /usr/local/bin/op 2>/dev/null; then
    echo "  Installing op CLI..."
    cat /usr/local/bin/op | sprite exec -s "$name" -- bash -c "cat > /usr/local/bin/op && chmod +x /usr/local/bin/op" 2>/dev/null || {
      echo "  WARN: op install failed, skipping $name"
      continue
    }
  else
    echo "  op CLI already installed"
  fi

  # 2. Write .sprite-env
  echo "  Writing .sprite-env..."
  echo "$SPRITE_ENV" | sprite exec -s "$name" -- bash -c "cat > /home/sprite/.sprite-env && chmod +x /home/sprite/.sprite-env" 2>/dev/null

  # 3. Source .sprite-env from .bashrc (if not already)
  echo "  Updating .bashrc..."
  sprite exec -s "$name" -- bash -c "grep -q '.sprite-env' /home/sprite/.bashrc || echo -e '\nsource /home/sprite/.sprite-env' >> /home/sprite/.bashrc" 2>/dev/null

  # 4. Update start.sh to source .sprite-env (add line after #!/bin/bash if not present)
  echo "  Updating start.sh..."
  sprite exec -s "$name" -- bash -c "grep -q '.sprite-env' /home/sprite/start.sh || sed -i '1a source /home/sprite/.sprite-env' /home/sprite/start.sh" 2>/dev/null

  # 5. Verify
  VERIFY=$(sprite exec -s "$name" -- bash -c "source /home/sprite/.sprite-env && echo \$SWAIN_API_TOKEN | head -c 8" 2>/dev/null || echo "FAILED")
  if [ "$VERIFY" = "FAILED" ] || [ -z "$VERIFY" ]; then
    echo "  WARN: Verification failed for $name"
  else
    echo "  OK — SWAIN_API_TOKEN starts with ${VERIFY}..."
  fi

  echo ""
done

echo "Done. All sprites updated."
