#!/usr/bin/env bash
# Gateway VPS setup for OpenClaw
# Run on the VPS after SSH'ing in
set -euo pipefail

echo "==> OpenClaw Gateway Setup"

# --- Install openclaw ---
echo "==> Installing openclaw (latest)"
sudo npm i -g openclaw@latest

# --- Configure openclaw ---
echo "==> Configuring openclaw gateway"
openclaw config set gateway.mode local
openclaw config set gateway.port 18789
openclaw config set gateway.bind loopback

# --- Install systemd service ---
echo "==> Installing systemd service"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
sudo cp "$SCRIPT_DIR/openclaw.service" /etc/systemd/system/openclaw.service
sudo systemctl daemon-reload
sudo systemctl enable openclaw

echo ""
echo "==> Setup complete. Next steps:"
echo "  1. Configure auth:  openclaw login"
echo "  2. Start gateway:   sudo systemctl start openclaw"
echo "  3. Check status:    sudo systemctl status openclaw"
