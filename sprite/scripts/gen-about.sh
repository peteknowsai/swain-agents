#!/bin/bash
export PATH=/.sprite/bin:/home/sprite/.local/bin:$PATH

OS=$(lsb_release -d 2>/dev/null | cut -f2)
ARCH=$(uname -m)
TODAY=$(date +%Y-%m-%d)
CLAUDE_PATH=$(which claude 2>/dev/null || echo "not found")
CLAUDE_V=$(claude --version 2>/dev/null || echo "unknown")
SWAIN_PATH=$(which swain 2>/dev/null || echo "not found")
SWAIN_V=$(swain --version 2>/dev/null || echo "unknown")
BUN_PATH=$(which bun 2>/dev/null || echo "not found")
BUN_V=$(bun --version 2>/dev/null || echo "unknown")
NODE_PATH=$(which node 2>/dev/null || echo "not found")
NODE_V=$(node --version 2>/dev/null || echo "unknown")
PY_PATH=$(which python3 2>/dev/null || echo "not found")
PY_V=$(python3 --version 2>&1 | awk '{print $2}')
GIT_PATH=$(which git 2>/dev/null || echo "not found")
GIT_V=$(git version 2>/dev/null | awk '{print $3}')
CURL_PATH=$(which curl 2>/dev/null || echo "not found")
CURL_V=$(curl --version 2>/dev/null | head -1 | awk '{print $2}')
DISK=$(df -h /home/sprite | tail -1 | awk '{print $3"/"$2}')

cat > /home/sprite/about.md << EOF
---
type: sprite
name: $(hostname)
updated: $TODAY
tags: [sprite, system]
---

# $(hostname)

## System
- **OS:** $OS
- **Arch:** $ARCH

## CLIs
| Tool | Path | Version |
|------|------|---------|
| claude | $CLAUDE_PATH | $CLAUDE_V |
| swain | $SWAIN_PATH | $SWAIN_V |
| bun | $BUN_PATH | $BUN_V |
| node | $NODE_PATH | $NODE_V |
| python3 | $PY_PATH | $PY_V |
| git | $GIT_PATH | $GIT_V |
| curl | $CURL_PATH | $CURL_V |

## Skills
$(ls /home/sprite/.claude/skills/ 2>/dev/null | while read d; do echo "- **$d**"; done)

## Services
$(sprite-env services list 2>/dev/null | python3 -c 'import json,sys;[print(f"- **{s[\"name\"]}** — {s[\"cmd\"]} (port {s.get(\"http_port\",\"-\")})") for s in json.load(sys.stdin)]' 2>/dev/null || echo "- none")

## Storage
- **Disk:** $DISK used
EOF

echo "about.md generated"
