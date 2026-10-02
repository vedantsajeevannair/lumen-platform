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

# Appium's own defaults are 60 s, which is not enough for the first run on a
# phone that has never had the helper apps installed - and nowhere near enough
# over wireless adb, which pushes at a few MB/s rather than USB speed.
SERVER_INSTALL_TIMEOUT = 300_000
INSTALL_TIMEOUT = 300_000
ADB_EXEC_TIMEOUT = 120_000


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
def credentials() -> tuple[str, str] | None:
    """The account to sign in with, or None if we were not given one.

    Returning None rather than skipping lets the suite run against a phone
    somebody has already signed in on, which is the usual case and means no
    password has to be handed over at all. Only the two tests that exercise
    signing in need the real thing.
    """
    if EMAIL and PASSWORD:
        return EMAIL, PASSWORD
    return None


@pytest.fixture(scope="session")
def required_credentials(credentials):
    if credentials is None:
        pytest.skip("this test signs in: set LUMEN_APP_EMAIL and LUMEN_APP_PASSWORD")
    return credentials


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
    opts.set_capability("androidInstallTimeout", INSTALL_TIMEOUT)
    opts.set_capability("adbExecTimeout", ADB_EXEC_TIMEOUT)
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

_UP = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
_LO = "abcdefghijklmnopqrstuvwxyz"


def by_text(fragment: str) -> tuple:
    """Match visible text case-insensitively.

    The app styles its section headings with text-transform, so "At a glance"
    in the source reaches the accessibility tree as "AT A GLANCE". Matching
    the string as written finds nothing on a page that is rendering perfectly.
    XPath 1.0 has no lower-case(), hence translate().
    """
    from selenium.webdriver.common.by import By
    esc = fragment.replace('"', '\\"').lower()
    parts = []
    # @hint matters: an empty EditText shows its placeholder through hint,
    # not text, so a field is invisible to a @text search until it is typed
    # into. The search box on the home screen is exactly that case.
    for attr in ("@text", "@content-desc", "@hint"):
        parts.append(f'contains(translate({attr}, "{_UP}", "{_LO}"), "{esc}")')
    return (By.XPATH, "//*[" + " or ".join(parts) + "]")


def by_exact(value: str) -> tuple:
    """Match a whole label, not a fragment of one.

    by_text() is a substring match, which is right for prose but wrong for
    short labels: asking for the "All" filter chip also matches the heading
    "ALL REPORTS" above it, and tapping that goes somewhere else entirely.
    """
    from selenium.webdriver.common.by import By
    esc = value.replace('"', '\\"')
    return (By.XPATH,
            f'//*[@content-desc="{esc}" or @text="{esc}" or @hint="{esc}"]')


def tap_exact(driver, value: str, timeout: float = 25):
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    el = WebDriverWait(driver, timeout).until(
        EC.element_to_be_clickable(by_exact(value)))
    el.click()
    return el


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


def scroll_to(driver, fragment: str, swipes: int = 4) -> bool:
    """Swipe up until `fragment` is clear of the floating tab bar.

    The report form's Submit control starts under the bottom bar, so tapping
    it where it first appears hits the navigation instead and the form is
    never submitted - which looks exactly like the app accepting bad input.
    """
    size = driver.get_window_size()
    x = size["width"] // 2
    for _ in range(swipes):
        el = driver.find_elements(*by_text(fragment))
        if el:
            r = el[0].rect
            if r["y"] + r["height"] < size["height"] * 0.82:
                return True
        driver.swipe(x, int(size["height"] * 0.70), x, int(size["height"] * 0.40), 400)
        time.sleep(1)
    return bool(driver.find_elements(*by_text(fragment)))


def any_of(driver, *fragments, timeout: float = 25) -> str:
    """Wait until one of several strings is on screen; return which."""
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.common.exceptions import TimeoutException

    def _check(d):
        source = d.page_source.lower()
        return next((f for f in fragments if f.lower() in source), False)

    try:
        return WebDriverWait(driver, timeout).until(_check)
    except TimeoutException:
        raise AssertionError(
            f"none of {fragments} appeared within {timeout}s") from None


# --------------------------------------------------------------------------
# the tab bar
#
# It cannot be driven by text. TabItem only renders its label while the tab
# is active, so an inactive tab carries no text and no content-desc, and the
# centre button is an icon with neither at any time. What the bar does have
# is three clickable nodes along the bottom edge, so we find them by position
# and read them left to right. Hardcoded pixel coordinates would tie the
# suite to one handset; this works on any screen size.
#
# The app should carry accessibilityLabels here - that would make these
# locators unnecessary and the bar usable with a screen reader - but adding
# them means a rebuild, so the tests work with the app as shipped.
# --------------------------------------------------------------------------

def nav_buttons(driver) -> list:
    """The bottom bar's three buttons, left to right.

    Taking everything clickable near the bottom edge is not enough: the home
    screen also puts a search field and the All/Open/Resolved chips down
    there. What separates the bar is that its buttons are tall (~170-210px
    against 17px for a chip) and share one centre line, so we group by centre
    y and take the tallest row.
    """
    from selenium.webdriver.common.by import By
    size = driver.get_window_size()
    floor = size["height"] * 0.84

    rows: dict[int, list] = {}
    for el in driver.find_elements(By.XPATH, '//*[@clickable="true"]'):
        r = el.rect
        cy = r["y"] + r["height"] / 2
        if cy < floor or r["height"] < 100:
            continue
        rows.setdefault(round(cy / 25), []).append((r["x"], r["height"], el))

    if not rows:
        return []
    # Prefer a row of exactly three; otherwise the tallest row we found.
    threes = [v for v in rows.values() if len(v) == 3]
    row = max(threes or rows.values(),
              key=lambda v: sum(h for _, h, _ in v) / len(v))
    return [el for _, _, el in sorted(row, key=lambda t: t[0])]


def tap_nav(driver, which: str):
    """which: 'home' | 'report' | 'updates' - a citizen's three buttons."""
    import pytest
    buttons = nav_buttons(driver)
    if len(buttons) < 3:
        pytest.skip(f"expected 3 nav buttons, found {len(buttons)}")
    buttons[{"home": 0, "report": 1, "updates": 2}[which]].click()


def header_buttons(driver) -> list:
    """The header's controls, left to right.

    For a citizen that is: the wordmark, the AI assistant, helplines & civic
    impact, then the avatar. None of them carries a usable label - the two
    middle ones are icon-font glyphs - so they are addressed by position.
    """
    from selenium.webdriver.common.by import By
    ceiling = driver.get_window_size()["height"] * 0.15
    found = [(el.rect["x"], el) for el in driver.find_elements(By.XPATH, '//*[@clickable="true"]')
             if el.rect["y"] + el.rect["height"] / 2 < ceiling]
    return [el for _, el in sorted(found, key=lambda t: t[0])]


def tap_header(driver, which: str):
    """which: 'assistant' | 'helplines' | 'profile'."""
    import pytest
    buttons = header_buttons(driver)
    index = {"assistant": -3, "helplines": -2, "profile": -1}[which]
    if len(buttons) < 3:
        pytest.skip(f"expected at least 3 header controls, found {len(buttons)}")
    buttons[index].click()


def tap_profile(driver):
    """The avatar in the top-right - a citizen's way into Profile."""
    from selenium.webdriver.common.by import By
    import pytest
    size = driver.get_window_size()
    ceiling = size["height"] * 0.15
    top = [(el.rect["x"], el) for el in driver.find_elements(By.XPATH, '//*[@clickable="true"]')
           if el.rect["y"] + el.rect["height"] / 2 < ceiling]
    if not top:
        pytest.skip("no controls found in the header")
    sorted(top, key=lambda t: t[0])[-1][1].click()


# --------------------------------------------------------------------------
# state
# --------------------------------------------------------------------------

HOME_MARKERS = ("Good morning", "Good afternoon", "Good evening",
                "At a glance", "Latest report")
LOGIN_MARKERS = ("Welcome back", "Sign in", "you@example.com")


def on_home(driver) -> bool:
    src = driver.page_source.lower()
    return any(m.lower() in src for m in HOME_MARKERS)


def on_login(driver) -> bool:
    src = driver.page_source.lower()
    return any(m.lower() in src for m in LOGIN_MARKERS) and not on_home(driver)


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
    """A session signed in and sitting on Home.

    If the phone is already signed in we use that session untouched. If it is
    not, and no account was supplied, we skip rather than fail: the app being
    logged out is not a defect in the thing under test.
    """
    driver.activate_app(PACKAGE)
    time.sleep(3)
    if on_login(driver):
        if credentials is None:
            pytest.skip("the app is signed out - sign in on the phone, "
                        "or set LUMEN_APP_EMAIL and LUMEN_APP_PASSWORD")
        sign_in(driver, *credentials)
    # A previous run may have left the list scrolled; the greeting is only in
    # page_source while it is actually on screen.
    scroll_to_top(driver, 3)
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


def scroll_to_top(driver, swipes: int = 4) -> None:
    """Swipe back to the top of whatever list is showing.

    page_source only carries what is on screen, so a home screen scrolled
    down past the greeting looks, to every marker we have, like some other
    screen entirely.
    """
    size = driver.get_window_size()
    x = size["width"] // 2
    for _ in range(swipes):
        try:
            driver.swipe(x, int(size["height"] * 0.35), x, int(size["height"] * 0.75), 350)
            time.sleep(0.8)
        except Exception:                                      # noqa: BLE001
            return


def _restore(driver) -> None:
    """Put LUMEN back in front, on Home.

    Pressing back past the app's first screen drops you on the launcher, and
    from there the next test drives whatever happens to be on top - once it
    was the phone's Contacts app, which has its own three-button bottom bar
    and took the taps without complaint. So every test both starts and ends
    by checking the foreground package, not just the visible text.
    """
    # A test that typed into a field can leave the keyboard up, and the first
    # back press then only dismisses that - which looks like the navigation
    # having no effect.
    try:
        if driver.is_keyboard_shown():
            driver.hide_keyboard()
            time.sleep(1)
    except Exception:                                          # noqa: BLE001
        pass

    for _ in range(5):
        try:
            if driver.current_package != PACKAGE:
                driver.activate_app(PACKAGE)
                time.sleep(3)
                continue
            if on_home(driver):
                return
            scroll_to_top(driver, 3)
            if on_home(driver):
                return
            driver.back()
            time.sleep(1.5)
        except Exception:                                      # noqa: BLE001
            return


@pytest.fixture(autouse=True)
def home_before_and_after(request):
    """Guarantee each test begins in our app on Home, and leaves it there."""
    if "app" not in request.fixturenames:
        yield
        return
    driver = request.getfixturevalue("app")
    _restore(driver)
    yield
    _restore(driver)


def in_app(driver) -> bool:
    """Guard an assertion against being made about somebody else's app."""
    return driver.current_package == PACKAGE
