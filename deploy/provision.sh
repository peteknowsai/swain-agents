#!/usr/bin/env bash
# Provision Hey Skip agent Sprites
# Usage: ./provision.sh [sprite-name|all|advisor <captain-slug> <user-id>]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"

# Required env vars (set in .env or export before running)
: "${SKIP_API_URL:?Set SKIP_API_URL}"
: "${SKIP_API_TOKEN:?Set SKIP_API_TOKEN}"

# --- Helpers ---

create_sprite() {
  local name="$1"
  echo "==> Creating sprite: $name"
  sprite create -skip-console "$name" 2>/dev/null || echo "    (already exists)"
}

upload_workspace() {
  local sprite_name="$1"
  shift
  for path in "$@"; do
    local full_path="$REPO_ROOT/$path"
    if [[ -d "$full_path" ]]; then
      # Upload directory contents
      for file in $(find "$full_path" -type f -name '*.md' -o -name '*.json'); do
        local rel="${file#$REPO_ROOT/}"
        echo "    uploading $rel"
        sprite exec -s "$sprite_name" -file "$file:/workspace/$rel" true
      done
    fi
  done
}

upload_skills() {
  local sprite_name="$1"
  shift
  for skill in "$@"; do
    local skill_dir="$REPO_ROOT/skills/$skill"
    if [[ -d "$skill_dir" ]]; then
      for file in "$skill_dir"/*; do
        local basename="$(basename "$file")"
        echo "    uploading skill $skill/$basename"
        sprite exec -s "$sprite_name" -file "$file:/workspace/skills/$skill/$basename" true
      done
    fi
  done
}

install_skip_cli() {
  local sprite_name="$1"
  echo "    installing skip CLI"
  # TODO: upload compiled skip binary or install from package
  # sprite exec -s "$sprite_name" -file "$HOME/.local/bin/skip:/usr/local/bin/skip" true
  echo "    (skip CLI install — placeholder, needs compiled binary)"
}

# --- Sprite Provisioning ---

provision_commodore() {
  create_sprite "commodore"
  upload_workspace "commodore" "agents/commodore/"
  upload_skills "commodore" "skip-cli"
  install_skip_cli "commodore"
}

provision_mr_content() {
  create_sprite "mr-content"
  upload_workspace "mr-content" "agents/mr-content/" "agents/_shared/"
  upload_skills "mr-content" "skip-cli" "skip-card-create"
  install_skip_cli "mr-content"
}

provision_stylist() {
  create_sprite "stylist"
  upload_workspace "stylist" "agents/stylist/"
  upload_skills "stylist" "skip-cli"
  # nanobanana needs to be installed separately
  echo "    NOTE: install nanobanana on stylist sprite manually"
}

provision_strategist() {
  create_sprite "strategist"
  upload_workspace "strategist" "agents/strategist/"
  upload_skills "strategist" "skip-cli" "skip-library"
  install_skip_cli "strategist"
}

provision_advisor() {
  local captain_slug="$1"
  local user_id="$2"
  local sprite_name="advisor-$captain_slug"

  create_sprite "$sprite_name"
  upload_workspace "$sprite_name" "templates/"
  upload_skills "$sprite_name" "skip-advisor" "skip-library" "skip-onboarding" "skip-cli"
  install_skip_cli "$sprite_name"

  # Set agent-specific env on first exec
  echo "    env: AGENT_ID=advisor-$captain_slug, USER_ID=$user_id"
  sprite exec -s "$sprite_name" \
    -env "AGENT_ID=advisor-$captain_slug,USER_ID=$user_id,SKIP_API_URL=$SKIP_API_URL,SKIP_API_TOKEN=$SKIP_API_TOKEN" \
    echo "Sprite provisioned for captain: $captain_slug"
}

# --- Main ---

case "${1:-help}" in
  commodore)    provision_commodore ;;
  mr-content)   provision_mr_content ;;
  stylist)      provision_stylist ;;
  strategist)   provision_strategist ;;
  advisor)
    [[ -z "${2:-}" || -z "${3:-}" ]] && { echo "Usage: $0 advisor <captain-slug> <user-id>"; exit 1; }
    provision_advisor "$2" "$3"
    ;;
  all)
    provision_commodore
    provision_mr_content
    provision_stylist
    provision_strategist
    echo ""
    echo "==> Core sprites provisioned. Provision advisors individually:"
    echo "    $0 advisor <captain-slug> <user-id>"
    ;;
  *)
    echo "Usage: $0 [commodore|mr-content|stylist|strategist|advisor <slug> <uid>|all]"
    exit 1
    ;;
esac

echo ""
echo "Done. Verify with: sprite list"
