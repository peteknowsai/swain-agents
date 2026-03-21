#!/bin/bash
# Send a test message to the channel server.
# Usage: ./test-send.sh "hello from pete"

PORT="${CHANNEL_PORT:-8080}"
TEXT="${1:-Hello, this is a test message from your captain!}"

echo "Sending to channel server on port $PORT..."
curl -s -X POST "http://localhost:$PORT/message" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"$TEXT\", \"phone\": \"+15551234567\"}" | jq .

echo ""
echo "Check the Claude Code session for the channel notification."
