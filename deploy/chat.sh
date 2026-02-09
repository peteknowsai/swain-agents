#!/usr/bin/env bash
# Chat with a sprite agent
# Usage: ./chat.sh <agent-name> <message>
#
# Agent names:
#   commodore   — Fleet commander (Hey Skip ops)
#   mr-content  — Editor-in-chief (content pipeline)
#   zero        — Personal agent (Home0)
#
# Examples:
#   ./chat.sh commodore "How's the fleet?"
#   ./chat.sh mr-content "What locations are you covering?"
#   ./chat.sh zero "What do you remember about Pete?"

set -euo pipefail

ORG="pete-mccarthy"
AGENT="${1:?Usage: chat.sh <agent-name> <message>}"
shift

if [ $# -eq 0 ]; then
  echo "Error: No message provided"
  echo "Usage: chat.sh <agent-name> <message>"
  exit 1
fi

sprite exec -o "$ORG" -s "$AGENT" -- openclaw agent --agent "$AGENT" --local --message "$*"
