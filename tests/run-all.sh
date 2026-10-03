#!/usr/bin/env bash
#
# Both suites, one command, one answer.
#
#   ./run-all.sh            run everything
#   HEADLESS=0 ./run-all.sh watch the browser work
#
# The Android suite needs a phone on adb. Without one it reports SKIPPED
# rather than passing, because a suite that could not run has not passed.
set -uo pipefail
cd "$(dirname "$0")"

line() { printf '%s\n' "----------------------------------------------------------------"; }
line; echo "  LUMEN - website and Android"; line

echo
echo "1/2  Website  (Selenium, real Chrome, against the live deployment)"
web="$(python3 -m pytest website -q \
       --html=reports/website.html --self-contained-html 2>&1)"
web_code=$?
printf '%s\n' "$web" | tail -2

echo
echo "2/2  Android  (Appium on a real phone)"
app="$(python3 -m pytest android -q \
       --html=reports/android.html --self-contained-html 2>&1)"
app_code=$?
printf '%s\n' "$app" | tail -2

echo; line; echo "  Summary"; line
printf '  %-22s %s\n' "Website" "$(printf '%s' "$web" | tail -1)"
printf '  %-22s %s\n' "Android" "$(printf '%s' "$app" | tail -1)"
line
[ "$web_code" -eq 0 ] && [ "$app_code" -eq 0 ]
