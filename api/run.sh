#!/usr/bin/env bash
# Start the Swain Agent API on the VPS
# Usage: ./run.sh
set -euo pipefail

cd "$(dirname "$0")"

# Verify required env
: "${SWAIN_AGENT_API_TOKEN:?Set SWAIN_AGENT_API_TOKEN before starting}"

echo "Starting swain-agent-api..."
exec bun run index.ts
