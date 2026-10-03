# LUMEN — test suite

Two suites against the deployed system: the website in a real Chrome, and
the Android app on a real phone.

```
website/   19 cases   Selenium   https://140-238-246-75.sslip.io
android/   24 cases   Appium     gov.lumen.report on a handset
```

## Run both and write the report

```bash
pip install -r tests/requirements.txt
python3 tests/make-report.py
```

Writes `tests/reports/LUMEN_Test_Report.html` and `.pdf` — one table of every
case with its result — and a screenshot per test under `tests/screenshots/`.

## Run one suite

```bash
python3 -m pytest tests/website -v
python3 -m pytest tests/android -v
HEADLESS=0 python3 -m pytest tests/website -v    # watch the browser
```

Nothing is hardcoded. The website suite takes `LUMEN_BASE_URL`,
`LUMEN_STAFF_EMAIL` and `LUMEN_STAFF_PASSWORD`; the defaults are the deployed
site and the seeded demo supervisor whose credentials the login page prints.

## The Android suite needs a phone

```bash
brew install android-platform-tools
npm install -g appium && appium driver install uiautomator2
appium &                      # leave running

adb pair    <phone-ip>:<pairing-port> <6-digit-code>
adb connect <phone-ip>:<connect-port>
```

Install the current build first — `https://140-238-246-75.sslip.io/lumen.apk`.
Uninstall any older LUMEN before it: the signing key changed, so Android will
not upgrade in place.

TC-02 signs in and needs an account:

```bash
export LUMEN_APP_EMAIL=... LUMEN_APP_PASSWORD=...
```

## Skips are not passes

Every test SKIPS, rather than passing, when it cannot really run: no phone,
no Appium, no credentials. A run that is entirely skips is a run that did
not happen.

## What these check

Where a page exists to show numbers, the test insists on numbers greater
than zero. A dashboard of dashes is what a dead endpoint looks like, and it
renders every heading perfectly — so checking headings proves nothing.

Two cases are negative: a wrong password on the website, and an empty report
on the app. A suite in which nothing can fail is not evidence.

No credential appears in any file; they all come from the environment.
