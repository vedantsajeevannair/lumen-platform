#!/usr/bin/env bash
#
# Every test in the project, in one run.
#
# The three suites live beside the code they test, because jest and pytest
# both expect that and moving them breaks their imports. This runs all three
# and prints one summary, so there is a single command and a single answer.
#
#   ./tests/run-all.sh          run everything
#   ./tests/run-all.sh --watch  run the browser tests visibly
#
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT="$PWD"

WATCH=""
[ "${1:-}" = "--watch" ] && WATCH="1"

pass=0; fail=0
line() { printf '%s\n' "----------------------------------------------------------------"; }
result() { # name, exit code, detail
  if [ "$2" -eq 0 ]; then pass=$((pass+1)); printf '  PASS  %-28s %s\n' "$1" "$3"
  else fail=$((fail+1)); printf '  FAIL  %-28s %s\n' "$1" "$3"; fi
}

line; echo "  LUMEN — full test run"; line

# --- the website, in a real browser -----------------------------------------
echo
echo "1/3  Website  (Selenium, real Chrome, against the live deployment)"
if [ -n "$WATCH" ]; then export HEADLESS=0; fi
web_out="$(cd "$ROOT" && python3 -m pytest tests/selenium -q 2>&1)"
web_code=$?
web_sum="$(printf '%s' "$web_out" | tail -1)"
printf '%s\n' "$web_out" | tail -3

# --- the mobile app ----------------------------------------------------------
echo
echo "2/3  App  (jest — screens, logic, and the live API contract)"
app_out="$(cd "$ROOT/mobile" && npx jest --watchAll=false 2>&1)"
app_code=$?
app_sum="$(printf '%s' "$app_out" | grep -E '^Tests:' | tail -1)"
printf '%s\n' "$app_out" | grep -E '^(Test Suites|Tests):'

# --- the backend -------------------------------------------------------------
echo
echo "3/3  Backend  (node:test)"
be_out="$(cd "$ROOT/backend" && npm test 2>&1)"
be_code=$?
# node:test prefixes its totals with a multibyte info glyph, so match the
# words rather than the start of the line.
be_pass="$(printf '%s' "$be_out" | grep -oE 'pass [0-9]+' | head -1 | tr -d 'pass ')"
be_fail="$(printf '%s' "$be_out" | grep -oE 'fail [0-9]+' | head -1 | tr -d 'fail ')"
be_sum="${be_pass:-0} passed, ${be_fail:-0} failed"
printf '%s\n' "$be_out" | grep -E 'tests [0-9]+|pass [0-9]+|fail [0-9]+' | head -3

echo; line; echo "  Summary"; line
result "Website (Selenium)" "$web_code" "$web_sum"
result "App (jest)"         "$app_code" "$app_sum"
result "Backend (node:test)" "$be_code" "$be_sum"
line
if [ "$fail" -eq 0 ]; then
  echo "  All $pass suites passed."
  exit 0
else
  echo "  $fail of $((pass+fail)) suites failed."
  exit 1
fi
