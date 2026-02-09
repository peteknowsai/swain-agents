#!/usr/bin/env bash
# Start the Skip Agent API on the VPS
# Usage: ./run.sh
set -euo pipefail

cd "$(dirname "$0")"

# Verify required env
: "${SKIP_AGENT_API_TOKEN:?Set SKIP_AGENT_API_TOKEN before starting}"

echo "Starting skip-agent-api..."
exec bun run index.ts
