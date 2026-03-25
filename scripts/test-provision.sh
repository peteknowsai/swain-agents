#!/bin/bash
#
# Smoke test: provision a test advisor on a sprite and verify the chain.
# Run from Pete's machine after deploying to VPS.
#
# Usage: ./scripts/test-provision.sh
#
# Requires: SWAIN_AGENT_API_TOKEN in env (from .zshrc)

set -euo pipefail

API_URL="${SWAIN_AGENT_API_URL:-http://76.13.106.143:3847}"
TOKEN="${SWAIN_AGENT_API_TOKEN:?SWAIN_AGENT_API_TOKEN not set}"
BRIDGE_URL="${SWAIN_BRIDGE_URL:-http://76.13.106.143:3848}"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${YELLOW}→ $1${NC}"; }

# --- 1. Health check ---
info "Checking API health..."
HEALTH=$(curl -sf "$API_URL/health" 2>&1) || fail "API server not reachable"
echo "$HEALTH" | jq -e '.status == "ok"' > /dev/null || fail "API unhealthy: $HEALTH"
pass "API server healthy"

# --- 2. Bridge health ---
info "Checking Bridge health..."
BRIDGE_HEALTH=$(curl -sf "$BRIDGE_URL/health" 2>&1) || fail "Bridge not reachable"
echo "$BRIDGE_HEALTH" | jq -e '.ok == true' > /dev/null || fail "Bridge unhealthy: $BRIDGE_HEALTH"
pass "Bridge healthy ($(echo "$BRIDGE_HEALTH" | jq -r '.sprites') sprites)"

# --- 3. Pool status ---
info "Checking pool status..."
POOL=$(curl -sf "$API_URL/pool/status" \
  -H "Authorization: Bearer $TOKEN" 2>&1) || fail "Pool status check failed"
AVAILABLE=$(echo "$POOL" | jq -r '.available')
info "Pool: $AVAILABLE available sprites"

if [ "$AVAILABLE" -eq 0 ]; then
  info "No sprites in pool. Provisioning 1 sprite (this takes ~2 min)..."
  PROVISION=$(curl -sf -X POST "$API_URL/pool/provision" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"count": 1}') || fail "Pool provisioning failed"
  echo "$PROVISION" | jq .
  CREATED=$(echo "$PROVISION" | jq -r '.created')
  [ "$CREATED" -ge 1 ] || fail "No sprites created: $PROVISION"
  pass "Pool sprite created"
fi

# --- 4. Assign advisor ---
TEST_USER_ID="usr_smoke_$(date +%s)"
info "Assigning advisor for $TEST_USER_ID..."
RESULT=$(curl -sf -X POST "$API_URL/advisors" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"userId\": \"$TEST_USER_ID\",
    \"name\": \"Smoke Test Captain\",
    \"phone\": \"+15550000001\",
    \"boatName\": \"Test Vessel\"
  }") || fail "Advisor assignment failed"
echo "$RESULT" | jq .

AGENT_ID=$(echo "$RESULT" | jq -r '.agentId')
SPRITE_URL=$(echo "$RESULT" | jq -r '.spriteUrl')
[ "$AGENT_ID" != "null" ] || fail "No agentId returned"
[ "$SPRITE_URL" != "null" ] || fail "No spriteUrl returned"
pass "Advisor assigned: $AGENT_ID at $SPRITE_URL"

# --- 5. Verify lookup ---
info "Looking up advisor by userId..."
LOOKUP=$(curl -sf "$API_URL/advisors?userId=$TEST_USER_ID" \
  -H "Authorization: Bearer $TOKEN") || fail "Lookup failed"
LOOKUP_ID=$(echo "$LOOKUP" | jq -r '.agentId')
[ "$LOOKUP_ID" = "$AGENT_ID" ] || fail "Lookup returned wrong agent: $LOOKUP_ID (expected $AGENT_ID)"
pass "Lookup correct"

# --- 6. Check sprite health ---
info "Checking sprite health at $SPRITE_URL..."
SPRITE_HEALTH=$(curl -sf "$SPRITE_URL/health" 2>&1) || {
  info "Sprite may be waking up, retrying in 10s..."
  sleep 10
  SPRITE_HEALTH=$(curl -sf "$SPRITE_URL/health" 2>&1) || fail "Sprite not reachable at $SPRITE_URL"
}
echo "$SPRITE_HEALTH" | jq -e '.ok == true' > /dev/null || fail "Sprite unhealthy: $SPRITE_HEALTH"
pass "Sprite healthy"

# --- 7. Verify bridge registry ---
info "Checking bridge knows about the sprite..."
SPRITES=$(curl -sf "$BRIDGE_URL/sprites") || fail "Bridge sprites list failed"
FOUND=$(echo "$SPRITES" | jq -r ".[] | select(.id == \"$AGENT_ID\") | .id")
[ "$FOUND" = "$AGENT_ID" ] || fail "Bridge doesn't know about $AGENT_ID"
pass "Bridge has sprite registered"

# --- 8. Cleanup ---
info "Cleaning up: deleting advisor $AGENT_ID..."
DELETE=$(curl -sf -X DELETE "$API_URL/advisors/$AGENT_ID" \
  -H "Authorization: Bearer $TOKEN") || fail "Deletion failed"
echo "$DELETE" | jq -e '.status == "deleted"' > /dev/null || fail "Deletion response unexpected: $DELETE"
pass "Advisor deleted (recycled to pool)"

# --- 9. Verify cleanup ---
info "Verifying cleanup..."
LOOKUP_AFTER=$(curl -sf "$API_URL/advisors?userId=$TEST_USER_ID" \
  -H "Authorization: Bearer $TOKEN")
LOOKUP_AFTER_ID=$(echo "$LOOKUP_AFTER" | jq -r '.agentId')
[ "$LOOKUP_AFTER_ID" = "null" ] || fail "Agent still assigned after deletion: $LOOKUP_AFTER_ID"
pass "Cleanup verified"

echo ""
echo -e "${GREEN}All smoke tests passed!${NC}"
