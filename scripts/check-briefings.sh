#!/bin/bash
# Check if all active users have today's briefing
# Usage: check-briefings.sh [--json]

TODAY=$(date -u +%Y-%m-%d)
JSON_MODE=""
if [ "$1" = "--json" ]; then JSON_MODE=1; fi

USERS=(
  "user_39XwGbwennMQghib7IRBnTSyDFm:Bob:advisor-bob-39xwgb"
  "user_39YXZ97XjelZDtao2bueVaQeQPj:Val:advisor-val-39yxz9"
  "user_39YVOfcGUqEdIBF1L62DnjwveEq:Gary:advisor-gary-39yvof"
  "user_39YTz0c7Z0mXoPAPeAwbd4wQxGW:Sally:advisor-sally-39ytz0"
)

MISSING=()
OK=()

for entry in "${USERS[@]}"; do
  IFS=: read -r uid name advisor <<< "$entry"
  # Check if latest briefing is for today
  result=$(swain briefing list --user="$uid" --json 2>/dev/null)
  date=$(echo "$result" | python3 -c "
import json,sys
d=json.load(sys.stdin)
briefings=d.get('briefings',[])
if briefings:
    print(briefings[0].get('date','none'))
else:
    print('none')
" 2>/dev/null)
  
  if [ "$date" = "$TODAY" ]; then
    OK+=("$name")
  else
    MISSING+=("$name:$advisor:$uid")
  fi
done

if [ -n "$JSON_MODE" ]; then
  echo "{"
  echo "  \"date\": \"$TODAY\","
  echo "  \"ok\": [$(printf '"%s",' "${OK[@]}" | sed 's/,$//' )],"
  echo "  \"missing\": [$(for m in "${MISSING[@]}"; do IFS=: read -r n a u <<< "$m"; printf '{"name":"%s","advisor":"%s","userId":"%s"},' "$n" "$a" "$u"; done | sed 's/,$//' )]"
  echo "}"
else
  echo "Briefing check for $TODAY"
  echo "========================"
  for name in "${OK[@]}"; do
    echo "  ✅ $name"
  done
  for m in "${MISSING[@]}"; do
    IFS=: read -r name advisor uid <<< "$m"
    echo "  ❌ $name (advisor: $advisor)"
  done
  echo ""
  echo "${#OK[@]} ok, ${#MISSING[@]} missing"
fi
