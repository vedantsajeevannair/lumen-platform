# LUMEN — Android tests (Appium, on a real phone)

The jest suite in `mobile/__tests__` renders our components in Node with a
mocked native layer. It is fast and it covers logic well, but it never proves
the signed APK runs on Android. These tests do: they drive the installed app
on a physical phone through Appium's UiAutomator2 driver.

## What you need once

```bash
brew install --cask temurin            # Appium's Android driver needs a JDK
brew install android-platform-tools    # gives you adb
npm  install -g appium
appium driver install uiautomator2
pip  install -r tests/android/requirements.txt
```

## Every run

1. Connect the phone by USB, with **Developer options → USB debugging** on,
   and accept the pairing prompt on the screen.
2. Install the current build on it — the hosted APK is
   `https://140-238-246-75.sslip.io/lumen.apk`. If an older LUMEN is already
   installed, uninstall it first: the signing key changed, so Android will
   refuse to upgrade in place.
3. Start the server in its own terminal: `appium`
4. Point the suite at a citizen account and run it:

```bash
export LUMEN_APP_EMAIL='citizen@example.com'
export LUMEN_APP_PASSWORD='...'
python3 -m pytest tests/android -v \
  --html=tests/android/report.html --self-contained-html
```

Screenshots land in `tests/android/screenshots/`, one per test, taken whether
the test passes or fails.

## If it skips instead of running

Every test SKIPS — rather than passing — when it cannot really run:

| Skip message | Fix |
|---|---|
| `no Android device` | phone not plugged in, USB debugging off, or the pairing prompt not accepted |
| `cannot reach Appium` | `appium` is not running on `127.0.0.1:4723` |
| `set LUMEN_APP_EMAIL and LUMEN_APP_PASSWORD` | export the two variables above |
| `pip install -r ...` | the Appium client is not in this Python |

A skipped suite has not passed. Treat a run that is entirely skips as a run
that did not happen.

## Notes

* **No credentials in the source.** The account comes from the environment.
  Never commit a real one — these tests sign in as a live user on the
  deployed system and leave an audit row behind each time.
* **No hardcoded phone.** `conftest.attached_device()` takes the first device
  `adb devices` reports as ready, so the suite runs on anyone's handset.
* **One Appium session for the whole run**, not one per test.
* **The app carries only four testIDs**, so these tests locate elements by
  visible text and `content-desc`. That is why a wording change can break a
  test: the fix is to add `testID`s to the screens, not to loosen the
  assertions.
* `LUMEN_APP_PACKAGE` overrides the package under test
  (default `gov.lumen.report`).
