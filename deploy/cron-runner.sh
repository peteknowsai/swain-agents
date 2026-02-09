#!/usr/bin/env bash
# Cron runner for Hey Skip agents
# Called by systemd timer every minute. Checks crons.json schedules
# and triggers sprite exec commands when it's time.
#
# This is a simple approach — checks current time against cron schedules.
# For production, consider a proper cron daemon or use systemd timers per job.
set -euo pipefail

DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
CRONS_FILE="$DEPLOY_DIR/crons.json"
LOG="/tmp/heyskip-cron.log"

# Current time in ET
CURRENT_HOUR=$(TZ=America/New_York date +%H)
CURRENT_MIN=$(TZ=America/New_York date +%M)
CURRENT_DOW=$(TZ=America/New_York date +%u)  # 1=Mon, 7=Sun

log() { echo "$(date -Iseconds) $*" >> "$LOG"; }

# --- Daily jobs (4 AM ET) ---
if [[ "$CURRENT_HOUR" == "04" && "$CURRENT_MIN" == "00" ]]; then
  log "Triggering daily-news-sweep"
  sprite exec -s mr-content \
    -env "AGENT_ID=mr-content,SKIP_API_URL=$SKIP_API_URL,SKIP_API_TOKEN=$SKIP_API_TOKEN" \
    clawdbot agent --message "Run daily content sweep. Dispatch beat reporters for all active locations." \
    >> "$LOG" 2>&1 &
fi

# --- Daily styling (5 AM ET) ---
if [[ "$CURRENT_HOUR" == "05" && "$CURRENT_MIN" == "00" ]]; then
  log "Triggering daily-styling"
  sprite exec -s stylist \
    -env "AGENT_ID=stylist,SKIP_API_URL=$SKIP_API_URL,SKIP_API_TOKEN=$SKIP_API_TOKEN" \
    clawdbot agent --message "Style all unstyled cards. Budget: 50 images." \
    >> "$LOG" 2>&1 &
fi

# --- Daily briefings (6 AM ET) ---
if [[ "$CURRENT_HOUR" == "06" && "$CURRENT_MIN" == "00" ]]; then
  log "Triggering daily-briefings"
  # Iterate all advisor sprites and trigger each
  for advisor_sprite in $(sprite list | grep '^advisor-'); do
    log "  triggering $advisor_sprite"
    sprite exec -s "$advisor_sprite" \
      -env "SKIP_API_URL=$SKIP_API_URL,SKIP_API_TOKEN=$SKIP_API_TOKEN" \
      clawdbot agent --message "Create today's briefing." \
      >> "$LOG" 2>&1 &
    sleep 2  # stagger to avoid thundering herd
  done
fi

# --- Weekly memory review (Sunday 8 AM ET) ---
if [[ "$CURRENT_DOW" == "7" && "$CURRENT_HOUR" == "08" && "$CURRENT_MIN" == "00" ]]; then
  log "Triggering weekly-memory-review"
  for advisor_sprite in $(sprite list | grep '^advisor-'); do
    sprite exec -s "$advisor_sprite" \
      -env "SKIP_API_URL=$SKIP_API_URL,SKIP_API_TOKEN=$SKIP_API_TOKEN" \
      clawdbot agent --message "Review and consolidate your memories. Archive stale observations, note gaps." \
      >> "$LOG" 2>&1 &
    sleep 2
  done
fi

# --- Weekly library health (Monday 9 AM ET) ---
if [[ "$CURRENT_DOW" == "1" && "$CURRENT_HOUR" == "09" && "$CURRENT_MIN" == "00" ]]; then
  log "Triggering weekly-library-health"
  sprite exec -s mr-content \
    -env "AGENT_ID=mr-content,SKIP_API_URL=$SKIP_API_URL,SKIP_API_TOKEN=$SKIP_API_TOKEN" \
    clawdbot agent --message "Run weekly library health check. Report coverage gaps, stale content, category balance." \
    >> "$LOG" 2>&1 &
fi
