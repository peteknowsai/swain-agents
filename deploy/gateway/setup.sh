#!/usr/bin/env bash
# Gateway VPS setup for Hey Skip
# Run on the VPS after SSH'ing in: ssh exe.dev && ssh vm-name
set -euo pipefail

echo "==> Hey Skip Gateway Setup"

# --- Install clawdbot ---
echo "==> Installing clawdbot (latest)"
sudo npm i -g clawdbot@latest

# --- Install sprite CLI ---
echo "==> Installing sprite CLI"
# sprite CLI install (already installed per user)
which sprite || { echo "ERROR: sprite CLI not found. Install from https://sprites.dev"; exit 1; }

# --- Install skip CLI ---
echo "==> Installing skip CLI"
# TODO: download compiled skip binary
# curl -fsSL https://skip.heyskip.com/install.sh | bash
echo "    (skip CLI install — placeholder)"

# --- Configure clawdbot ---
echo "==> Configuring clawdbot gateway"
clawdbot config set gateway.mode local
clawdbot config set gateway.port 18789
clawdbot config set gateway.bind loopback

echo ""
echo "==> Setup complete. Next steps:"
echo "  1. Configure auth:  clawdbot login"
echo "  2. Start gateway:   sudo systemctl start heyskip-gateway"
echo "  3. Install crons:   sudo cp systemd/* /etc/systemd/system/ && sudo systemctl daemon-reload"
echo "  4. Enable services: sudo systemctl enable heyskip-gateway heyskip-cron.timer"
