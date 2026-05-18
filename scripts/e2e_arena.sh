#!/usr/bin/env bash
# End-to-end smoke test: launch one arena session against each sandbox agent
# and verify it completes without orchestrator errors.
#
# Requires the stack to be running (docker compose up -d) and the demo
# credentials (admin@demo.local / demo1234 in the `demo` tenant). Run from
# any working directory.
set -euo pipefail

API="${API:-http://localhost:8001}"
TENANT="${TENANT:-demo}"
EMAIL="${EMAIL:-admin@demo.local}"
PASSWORD="${PASSWORD:-demo1234}"
# Cap per-session wait. Orchestrator typically finishes in ~10-30s on the
# synthetic driver; we give it 90s headroom for the worst-case sandboxed
# agent before declaring failure.
MAX_WAIT_S="${MAX_WAIT_S:-90}"

green() { printf "\033[32m%s\033[0m\n" "$*"; }
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
yellow(){ printf "\033[33m%s\033[0m\n" "$*"; }
bold()  { printf "\033[1m%s\033[0m\n" "$*"; }

bold "── chimera arena e2e ──"
echo  "api=$API tenant=$TENANT user=$EMAIL"

# ---- auth -----------------------------------------------------------------
TOKEN=$(curl -fsS -X POST "$API/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"tenant_name\":\"$TENANT\",\"email\":\"$EMAIL\",\"password\":\"$PASSWORD\"}" \
  | python -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
[ -n "$TOKEN" ] || { red "login failed"; exit 1; }
green "✓ login ok"

# ---- list agents ----------------------------------------------------------
AGENTS_JSON=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$API/agents")
AGENTS=$(printf '%s' "$AGENTS_JSON" | python -c "
import sys, json
for a in json.load(sys.stdin):
    print(f\"{a['id']}|{a['name']}|{a['kind']}\")
")
COUNT=$(printf '%s\n' "$AGENTS" | grep -c . || true)
[ "$COUNT" -ge 1 ] || { red "no agents found — seed sandbox first"; exit 1; }
green "✓ $COUNT agents"

# ---- run a session per agent ---------------------------------------------
declare -a RESULTS
PASS=0; FAIL=0
while IFS='|' read -r aid name kind; do
  [ -z "$aid" ] && continue
  echo
  bold "→ launching against $name ($kind)"

  sess_json=$(curl -fsS -X POST "$API/arena/sessions" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
    -d "{\"target_agent_id\":\"$aid\",\"objective\":\"e2e smoke\"}")
  sid=$(printf '%s' "$sess_json" | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
  echo "  session=$sid"

  # poll until status leaves {queued, running}
  status=""; deadline=$(( $(date +%s) + MAX_WAIT_S ))
  while [ "$(date +%s)" -lt "$deadline" ]; do
    s_json=$(curl -fsS -H "Authorization: Bearer $TOKEN" "$API/arena/sessions/$sid")
    status=$(printf '%s' "$s_json" | python -c "import sys,json;print(json.load(sys.stdin)['status'])")
    case "$status" in
      completed|failed|cancelled) break ;;
    esac
    sleep 2
  done

  success=$(printf '%s' "$s_json" | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('success',False))")
  score=$(printf '%s' "$s_json"  | python -c "import sys,json;d=json.load(sys.stdin);print(d.get('score',0))")

  if [ "$status" = "completed" ]; then
    green "  ✓ $name → $status success=$success score=$score"
    PASS=$((PASS+1))
    RESULTS+=("PASS|$name|$status|success=$success score=$score")
  else
    red   "  ✗ $name → $status (timeout=$MAX_WAIT_S s if status still running)"
    FAIL=$((FAIL+1))
    RESULTS+=("FAIL|$name|$status|—")
  fi
done <<< "$AGENTS"

# ---- summary --------------------------------------------------------------
echo
bold "── summary ──"
for r in "${RESULTS[@]}"; do
  IFS='|' read -r tag name status meta <<< "$r"
  if [ "$tag" = "PASS" ]; then green  "  ✓ $name → $status $meta"
  else                          red    "  ✗ $name → $status"
  fi
done
echo
if [ "$FAIL" -gt 0 ]; then
  red   "FAIL: $FAIL/$COUNT sessions did not complete"
  exit 1
fi
green "PASS: $PASS/$COUNT sessions completed"
