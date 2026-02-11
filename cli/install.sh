#!/bin/bash
# Install Skip CLI from GitHub Releases
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/peteknowsai/heyskip-agents/main/cli/install.sh | bash
#
# Requires GITHUB_TOKEN for private repo access.
# Set SKIP_VERSION to install a specific version (default: latest).

set -euo pipefail

REPO="peteknowsai/heyskip-agents"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="skip"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "${OS}-${ARCH}" in
  linux-x86_64)  ASSET="skip-linux-x64" ;;
  darwin-arm64)  ASSET="skip-darwin-arm64" ;;
  *)
    echo "Unsupported platform: ${OS}-${ARCH}"
    echo "Supported: linux-x86_64, darwin-arm64"
    exit 1
    ;;
esac

# Check for GitHub token (required for private repo)
if [ -z "${GITHUB_TOKEN:-}" ]; then
  echo "Error: GITHUB_TOKEN is required (repo is private)"
  echo "  export GITHUB_TOKEN=ghp_..."
  exit 1
fi

AUTH_HEADER="Authorization: token ${GITHUB_TOKEN}"

# Get release URL
if [ -n "${SKIP_VERSION:-}" ]; then
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases/tags/${SKIP_VERSION}"
else
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"
fi

echo "Fetching release info..."
RELEASE_JSON=$(curl -fsSL -H "${AUTH_HEADER}" "${RELEASE_URL}")
DOWNLOAD_URL=$(echo "${RELEASE_JSON}" | grep -o "\"browser_download_url\": \"[^\"]*${ASSET}\"" | cut -d'"' -f4)

if [ -z "${DOWNLOAD_URL}" ]; then
  echo "Error: Could not find ${ASSET} in release"
  exit 1
fi

VERSION=$(echo "${RELEASE_JSON}" | grep -o '"tag_name": "[^"]*"' | cut -d'"' -f4)
echo "Installing skip ${VERSION} (${ASSET})..."

# Download binary (private repo needs Accept header for asset redirect)
ASSET_ID=$(echo "${RELEASE_JSON}" | grep -B2 "${ASSET}" | grep -o '"id": [0-9]*' | head -1 | grep -o '[0-9]*')
ASSET_URL="https://api.github.com/repos/${REPO}/releases/assets/${ASSET_ID}"

curl -fsSL \
  -H "${AUTH_HEADER}" \
  -H "Accept: application/octet-stream" \
  "${ASSET_URL}" \
  -o "${INSTALL_DIR}/${BINARY_NAME}"

chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed skip to ${INSTALL_DIR}/${BINARY_NAME}"
skip --version
