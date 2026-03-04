#!/bin/bash
# Install Swain CLI from GitHub Releases
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/peteknowsai/swain-agents/main/cli/install.sh | bash
#
# Set SWAIN_VERSION to install a specific version (default: latest).
# Set INSTALL_DIR to change install location (default: /usr/local/bin).

set -euo pipefail

REPO="peteknowsai/swain-agents"
INSTALL_DIR="${INSTALL_DIR:-/usr/local/bin}"
BINARY_NAME="swain"

# Detect platform
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "${OS}-${ARCH}" in
  linux-x86_64)  ASSET="swain-linux-x64" ;;
  darwin-arm64)  ASSET="swain-darwin-arm64" ;;
  *)
    echo "Unsupported platform: ${OS}-${ARCH}"
    echo "Supported: linux-x86_64, darwin-arm64"
    exit 1
    ;;
esac

# Get release URL
if [ -n "${SWAIN_VERSION:-}" ]; then
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases/tags/${SWAIN_VERSION}"
else
  RELEASE_URL="https://api.github.com/repos/${REPO}/releases/latest"
fi

echo "Fetching release info..."
RELEASE_JSON=$(curl -fsSL "${RELEASE_URL}")
VERSION=$(echo "${RELEASE_JSON}" | grep -o '"tag_name": "[^"]*"' | cut -d'"' -f4)

if [ -z "${VERSION}" ]; then
  echo "Error: Could not determine release version"
  exit 1
fi

DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET}"
echo "Installing swain ${VERSION} (${ASSET})..."

# Download binary
curl -fsSL -o "${INSTALL_DIR}/${BINARY_NAME}" "${DOWNLOAD_URL}"
chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

echo "Installed swain to ${INSTALL_DIR}/${BINARY_NAME}"
"${INSTALL_DIR}/${BINARY_NAME}" --version
