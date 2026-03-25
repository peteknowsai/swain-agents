#!/bin/bash
#
# Migrate all OpenClaw agents (desks + advisors) to sprites.
# Run from Pete's machine. Requires: SWAIN_AGENT_API_TOKEN in env.
#
# Usage: ./scripts/migrate-openclaw.sh

set -euo pipefail

API_URL="http://76.13.106.143:3847"
TOKEN="${SWAIN_AGENT_API_TOKEN:?Set SWAIN_AGENT_API_TOKEN}"
VPS="root@76.13.106.143"
SWAIN_TOKEN="ef2276b30029d27592e35d93394ba19428738081d0a8e436d49d185dd6dc6fb1"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

pass() { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }
info() { echo -e "${CYAN}→ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

api() {
  local method=$1 path=$2
  shift 2
  curl -sf -X "$method" "$API_URL$path" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    "$@"
}

# ============================================================
echo ""
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo -e "${CYAN}  OpenClaw → Sprites Migration${NC}"
echo -e "${CYAN}═══════════════════════════════════════════════${NC}"
echo ""

# ============================================================
info "Step 1: Check pool levels"
# ============================================================

ADVISOR_AVAIL=$(api GET "/pool/status" | jq -r '.available')
info "Advisor pool: $ADVISOR_AVAIL available"

# Need at least 4 advisors
if [ "$ADVISOR_AVAIL" -lt 4 ]; then
  NEED=$((4 - ADVISOR_AVAIL))
  info "Provisioning $NEED more advisor sprites..."
  api POST "/pool/provision" -d "{\"count\": $NEED}" | jq .
fi

# Need at least 4 desks — check how many we have
DESK_AVAIL=$(api GET "/desks" | jq '[.desks[] | select(.status == "available")] | length')
info "Desk pool: $DESK_AVAIL available"

if [ "$DESK_AVAIL" -lt 4 ]; then
  NEED=$((4 - DESK_AVAIL))
  info "Provisioning $NEED more desk sprites..."
  api POST "/desk-pool/provision" -d "{\"count\": $NEED}" | jq .
fi

pass "Pool levels OK"

# ============================================================
info "Step 2: Migrate desks"
# ============================================================

# Get desk data from Convex via VPS
DESKS=$(ssh "$VPS" "export PATH=/root/.bun/bin:\$PATH && SWAIN_API_TOKEN=$SWAIN_TOKEN swain desk list --json 2>/dev/null")

for DESK_NAME in nyc-harbor baja-cortez-norte perdido-gulf biscayne-bay; do
  info "Migrating desk: $DESK_NAME"

  # Get desk details from Convex
  DESK_DATA=$(ssh "$VPS" "export PATH=/root/.bun/bin:\$PATH && SWAIN_API_TOKEN=$SWAIN_TOKEN swain desk get $DESK_NAME --json 2>/dev/null" || echo '{}')
  REGION=$(echo "$DESK_DATA" | jq -r '.desk.region // "Unknown"')
  SCOPE=$(echo "$DESK_DATA" | jq -r '.desk.scope // ""')
  LAT=$(echo "$DESK_DATA" | jq -r '.desk.center.lat // 0')
  LON=$(echo "$DESK_DATA" | jq -r '.desk.center.lon // 0')
  CREATED_BY=$(echo "$DESK_DATA" | jq -r '.desk.createdByLocation // .desk.region // ""')

  if [ "$LAT" = "0" ] || [ "$REGION" = "Unknown" ]; then
    warn "Skipping $DESK_NAME — no Convex data"
    continue
  fi

  # Assign desk sprite
  RESULT=$(api POST "/desks" -d "{
    \"name\": \"$DESK_NAME\",
    \"region\": \"$REGION\",
    \"lat\": $LAT,
    \"lon\": $LON,
    \"scope\": $(echo "$SCOPE" | jq -Rs .),
    \"createdByLocation\": $(echo "$CREATED_BY" | jq -Rs .)
  }" 2>&1) || true

  AGENT_ID=$(echo "$RESULT" | jq -r '.agentId // "failed"')
  if [ "$AGENT_ID" = "failed" ]; then
    warn "$DESK_NAME assignment failed: $RESULT"
    continue
  fi

  pass "$DESK_NAME assigned to $AGENT_ID"

  # Promote to permanent name
  info "Promoting $AGENT_ID → ${DESK_NAME}-desk"
  PROMOTE=$(api POST "/agents/$AGENT_ID/promote" -d "{\"name\": \"${DESK_NAME}-desk\"}" 2>&1) || true
  echo "$PROMOTE" | jq -r '.newSprite // .error // "unknown"'
done

pass "Desks migrated"

# ============================================================
info "Step 3: Wake desks for first content run"
# ============================================================

for DESK_NAME in nyc-harbor baja-cortez-norte perdido-gulf biscayne-bay; do
  info "Waking ${DESK_NAME}-desk..."
  api POST "/agents/${DESK_NAME}-desk/wake" -d '{"skill": "content-desk"}' &
done
wait
pass "All desks waking"

# ============================================================
info "Step 4: Migrate advisors"
# ============================================================

# Captain data
declare -A CAPTAINS=(
  ["usr_2ac63c66-7c9"]="Jarrett|+14156239773|jarrett"
  ["usr_ef68d564-bbb"]="Joe Bono|+15102907221|joe"
  ["usr_a942857e-eb6"]="Austin Schell|+14155179469|austin"
  ["usr_b6271f66-106"]="Manny|+17862271774|manny"
)

for USER_ID in "${!CAPTAINS[@]}"; do
  IFS='|' read -r NAME PHONE SLUG <<< "${CAPTAINS[$USER_ID]}"
  info "Migrating advisor for $NAME ($USER_ID)"

  # Get boat name from Convex
  BOAT_NAME=$(ssh "$VPS" "export PATH=/root/.bun/bin:\$PATH && SWAIN_API_TOKEN=$SWAIN_TOKEN swain boat list --user=$USER_ID --json 2>/dev/null" | jq -r '.boats[0].name // "their boat"')

  # Assign advisor
  RESULT=$(api POST "/advisors" -d "{
    \"userId\": \"$USER_ID\",
    \"name\": \"$NAME\",
    \"phone\": \"$PHONE\",
    \"boatName\": \"$BOAT_NAME\"
  }" 2>&1) || true

  AGENT_ID=$(echo "$RESULT" | jq -r '.agentId // "failed"')
  if [ "$AGENT_ID" = "failed" ]; then
    warn "$NAME assignment failed: $RESULT"
    continue
  fi

  pass "$NAME assigned to $AGENT_ID"

  # Promote
  info "Promoting $AGENT_ID → ${SLUG}-advisor"
  PROMOTE=$(api POST "/agents/$AGENT_ID/promote" -d "{\"name\": \"${SLUG}-advisor\"}" 2>&1) || true
  echo "$PROMOTE" | jq -r '.newSprite // .error // "unknown"'
done

pass "Advisors migrated"

# ============================================================
info "Step 5: Update Convex agent references"
# ============================================================

ssh "$VPS" "export PATH=/root/.bun/bin:\$PATH && SWAIN_API_TOKEN=$SWAIN_TOKEN
swain user update usr_2ac63c66-7c9 --advisorAgentId=jarrett-advisor --json 2>/dev/null | jq -r '.success'
swain user update usr_ef68d564-bbb --advisorAgentId=joe-advisor --json 2>/dev/null | jq -r '.success'
swain user update usr_a942857e-eb6 --advisorAgentId=austin-advisor --json 2>/dev/null | jq -r '.success'
swain user update usr_b6271f66-106 --advisorAgentId=manny-advisor --json 2>/dev/null | jq -r '.success'"

pass "Convex references updated"

# ============================================================
info "Step 6: Decommission OpenClaw"
# ============================================================

ssh "$VPS" "
systemctl stop openclaw 2>/dev/null || true
systemctl disable openclaw 2>/dev/null || true
echo 'OpenClaw gateway stopped'

# Remove old OpenClaw desk entries from registry
python3 -c \"
import json
with open('/root/swain-agent-api/registry.json') as f:
    d = json.load(f)
removed = []
for k in list(d['agents'].keys()):
    e = d['agents'][k]
    if e.get('type') == 'desk' and not e.get('spriteName'):
        removed.append(k)
        del d['agents'][k]
with open('/root/swain-agent-api/registry.json', 'w') as f:
    json.dump(d, f, indent=2)
print(f'Removed {len(removed)} OpenClaw entries: {removed}')
\"
"

pass "OpenClaw decommissioned"

# ============================================================
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  Migration complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
info "Verify:"
echo "  - Check desks: swain card list --desk=nyc-harbor --json"
echo "  - Text Jarrett's advisor from +14156239773"
echo "  - Check vault: bun scripts/vault-pull.ts"
echo "  - Check sprites: ssh $VPS 'sprite list'"
