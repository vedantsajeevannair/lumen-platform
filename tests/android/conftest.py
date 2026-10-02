"""Shared setup for the LUMEN Android tests.

These drive the real app on a real phone through Appium + UiAutomator2, which
is the one thing the jest suite in mobile/__tests__ cannot do: that renders
components in Node with a mocked native layer, so it never proves the signed
APK actually runs on Android.

Nothing here hardcodes a device or a password. The suite finds whatever phone
adb can see, and reads the account from the environment:

    export LUMEN_APP_EMAIL=...
    export LUMEN_APP_PASSWORD=...

With no phone attached, no Appium server, or no credentials, every test is
SKIPPED rather than failed — a suite that cannot run has not passed.
"""
import os
import shutil
import subprocess
import time
from pathlib import Path

import pytest

PACKAGE = os.environ.get("LUMEN_APP_PACKAGE", "gov.lumen.report")
APPIUM = os.environ.get("APPIUM_URL", "http://127.0.0.1:4723")
EMAIL = os.environ.get("LUMEN_APP_EMAIL")
PASSWORD = os.environ.get("LUMEN_APP_PASSWORD")

SHOTS = Path(__file__).parent / "screenshots"
SHOTS.mkdir(exist_ok=True)

# Appium's own default is 60 s, which is not enough for the first run on a
# phone that has never had the UiAutomator2 server installed.
SERVER_INSTALL_TIMEOUT = 180_000


def _adb() -> str | None:
    found = shutil.which("adb")
    if found:
        return found
    for base in (os.environ.get("ANDROID_HOME"), os.environ.get("ANDROID_SDK_ROOT"),
                 Path.home() / "Library/Android/sdk"):
        if base and (cand := Path(base) / "platform-tools/adb").exists():
            return str(cand)
    return None


def attached_device() -> str | None:
    """The first phone adb reports as ready, or None."""
    adb = _adb()
    if not adb:
        return None
    try:
        out = subprocess.run([adb, "devices"], capture_output=True, text=True,
                             timeout=30).stdout
    except (subprocess.SubprocessError, OSError):
        return None
    for line in out.splitlines()[1:]:
        parts = line.split()
        # "unauthorized" and "offline" are attached but unusable - skip them.
        if len(parts) == 2 and parts[1] == "device":
            return parts[0]
    return None


@pytest.fixture(scope="session")
def udid() -> str:
    found = attached_device()
    if not found:
        pytest.skip("no Android device: plug a phone in with USB debugging on")
    return found


@pytest.fixture(scope="session")
def credentials() -> tuple[str, str]:
    if not EMAIL or not PASSWORD:
        pytest.skip("set LUMEN_APP_EMAIL and LUMEN_APP_PASSWORD")
    return EMAIL, PASSWORD


@pytest.fixture(scope="session")
def driver(udid):
    """One Appium session for the whole run.

    A fixture per test file would be tidier to read but costs an install,
    launch and teardown every time - the suite this replaces spent 9m25s on
    25 tests almost entirely in session setup.
    """
    try:
        from appium import webdriver
        from appium.options.android import UiAutomator2Options
    except ImportError:
        pytest.skip("pip install -r tests/android/requirements.txt")

    opts = UiAutomator2Options()
    opts.platform_name = "Android"
    opts.automation_name = "UiAutomator2"
    opts.udid = udid
    opts.device_name = udid
    opts.app_package = PACKAGE
    opts.app_activity = os.environ.get("LUMEN_APP_ACTIVITY", ".MainActivity")
    opts.no_reset = True
    opts.new_command_timeout = 300
    opts.set_capability("uiautomator2ServerInstallTimeout", SERVER_INSTALL_TIMEOUT)
    opts.set_capability("appWaitActivity", "*")

    try:
        d = webdriver.Remote(APPIUM, options=opts)
    except Exception as exc:                                  # noqa: BLE001
        pytest.skip(f"cannot reach Appium at {APPIUM}: {exc}")

    d.implicitly_wait(0)        # explicit waits only; implicit waits hide races
    yield d
    d.quit()


# --------------------------------------------------------------------------
# locators
#
# The app carries only 4 testIDs, so there is little to target but visible
# text and content-desc. React Native puts a Text's string on content-desc
# for some nodes and in @text for others, so every lookup checks both.
# --------------------------------------------------------------------------

def by_text(fragment: str) -> tuple:
    from selenium.webdriver.common.by import By
    esc = fragment.replace('"', '\\"')
    return (By.XPATH,
            f'//*[contains(@text, "{esc}") or contains(@content-desc, "{esc}")]')


def wait_for(driver, fragment: str, timeout: float = 25):
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    return WebDriverWait(driver, timeout).until(
        EC.presence_of_element_located(by_text(fragment)))


def present(driver, fragment: str, timeout: float = 8) -> bool:
    from selenium.common.exceptions import TimeoutException
    try:
        wait_for(driver, fragment, timeout)
        return True
    except TimeoutException:
        return False


def tap(driver, fragment: str, timeout: float = 25):
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    el = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable(by_text(fragment)))
    el.click()
    return el


def any_of(driver, *fragments, timeout: float = 25) -> str:
    """Wait until one of several strings is on screen; return which."""
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.common.exceptions import TimeoutException

    def _check(d):
        source = d.page_source
        return next((f for f in fragments if f in source), False)

    try:
        return WebDriverWait(driver, timeout).until(_check)
    except TimeoutException:
        raise AssertionError(
            f"none of {fragments} appeared within {timeout}s") from None


# --------------------------------------------------------------------------
# state
# --------------------------------------------------------------------------

HOME_MARKERS = ("Good morning", "Good afternoon", "Good evening",
                "At a glance", "Latest report")
LOGIN_MARKERS = ("Welcome back", "Sign in", "you@example.com")


def on_home(driver) -> bool:
    src = driver.page_source
    return any(m in src for m in HOME_MARKERS)


def on_login(driver) -> bool:
    src = driver.page_source
    return any(m in src for m in LOGIN_MARKERS) and not on_home(driver)


def type_into(driver, hint: str, value: str):
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    locator = (By.XPATH, f'//android.widget.EditText[@hint="{hint}"]')
    field = WebDriverWait(driver, 25).until(
        EC.presence_of_element_located(locator))
    field.click()
    # Re-find: tapping a React Native input can re-render the node and
    # invalidate the handle we are holding.
    field = WebDriverWait(driver, 25).until(
        EC.presence_of_element_located(locator))
    field.clear()
    field.send_keys(value)
    return field


def sign_in(driver, email: str, password: str):
    type_into(driver, "you@example.com", email)
    type_into(driver, "•" * 8, password)
    try:
        driver.hide_keyboard()
    except Exception:                                          # noqa: BLE001
        pass
    tap(driver, "Sign in")


@pytest.fixture(scope="session")
def app(driver, credentials):
    """A session already signed in and sitting on Home."""
    email, password = credentials
    driver.activate_app(PACKAGE)
    time.sleep(2)
    if on_login(driver):
        sign_in(driver, email, password)
    any_of(driver, *HOME_MARKERS, timeout=40)
    return driver


@pytest.fixture
def shot(driver, request):
    """Save a screenshot named after the test, always - pass or fail."""
    saved = []

    def _take(suffix: str = ""):
        name = request.node.name.replace("test_", "").replace("_", "-")
        path = SHOTS / f"{name}{('_' + suffix) if suffix else ''}.png"
        driver.save_screenshot(str(path))
        saved.append(path)
        return path

    yield _take
    if not saved:
        _take()


@pytest.fixture(autouse=True)
def back_to_home(request):
    """Leave each test on Home so the next one starts from a known screen."""
    yield
    if "driver" not in request.fixturenames:
        return
    d = request.getfixturevalue("driver")
    for _ in range(4):
        if on_home(d):
            return
        try:
            d.back()
            time.sleep(1)
        except Exception:                                      # noqa: BLE001
            return
