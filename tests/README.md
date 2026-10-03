# LUMEN — test suite

Two suites against the deployed system: the website in a real Chrome, and
the Android app on a real phone.

```
tests/website/    19 cases   Selenium   https://140-238-246-75.sslip.io
tests/android/    22 cases   Appium     gov.lumen.report on a handset
screenshots/      one per test, pass or fail
reports/          HTML and PDF
```

## Run everything

```bash
pip install -r requirements.txt
./run-all.sh                 # headless
HEADLESS=0 ./run-all.sh      # watch the browser
```

## Website only

```bash
python3 -m pytest tests/website -v
```

Nothing is hardcoded. Override with `LUMEN_BASE_URL`, `LUMEN_STAFF_EMAIL`,
`LUMEN_STAFF_PASSWORD`; the defaults are the deployed site and the seeded
demo supervisor whose credentials are printed on the login page itself.

## Android only

Needs a phone on adb — over USB, or wirelessly:

```bash
brew install android-platform-tools
npm install -g appium && appium driver install uiautomator2
appium &                     # leave running

adb pair   <phone-ip>:<pairing-port> <6-digit-code>
adb connect <phone-ip>:<connect-port>

python3 -m pytest tests/android -v
```

Install the current build on the phone first:
`https://140-238-246-75.sslip.io/lumen.apk` — uninstall any older LUMEN
first, the signing key changed so Android will not upgrade in place.

Two cases sign in and need an account:

```bash
export LUMEN_APP_EMAIL=... LUMEN_APP_PASSWORD=...
```

## Skips are not passes

Every test SKIPS, rather than passing, when it cannot really run: no phone,
no Appium, no credentials. A run that is entirely skips is a run that did
not happen.

## Notes on what these check

Where a page exists to show numbers, the test insists on numbers greater
than zero. A dashboard of dashes is what a dead endpoint looks like, and it
renders every heading perfectly, so checking headings proves nothing.

Three cases are negative — a wrong password, an empty report, the app with
no network. A suite in which nothing can fail is not evidence.

No credential is written in any file; all come from the environment.
