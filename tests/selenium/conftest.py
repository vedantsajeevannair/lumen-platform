"""Shared setup for the LUMEN web tests.

The tests run against the deployed site by default, because that is the thing
being graded and the thing residents use. Point BASE_URL at a local dev server
to run them there instead.
"""
import os
import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

BASE_URL = os.environ.get("LUMEN_BASE_URL", "https://140-238-246-75.sslip.io")

# The seeded supervisor. These are demo credentials that ship with the
# project's own seed data, not anybody's real account.
STAFF_EMAIL = os.environ.get("LUMEN_STAFF_EMAIL", "supervisor@lumen.gov")
STAFF_PASSWORD = os.environ.get("LUMEN_STAFF_PASSWORD", "lumen123")


@pytest.fixture(scope="session")
def base_url():
    return BASE_URL


@pytest.fixture
def driver():
    opts = Options()
    # Headless so the suite can run in CI and over SSH. Drop HEADLESS=0 in the
    # environment to watch it drive a real window.
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1440,900")
    opts.add_argument("--disable-gpu")
    d = webdriver.Chrome(options=opts)
    d.set_page_load_timeout(60)
    d.implicitly_wait(5)
    yield d
    d.quit()

@pytest.fixture(scope="module")
def module_driver():
    """One browser for a whole file.

    Signing in is not free: it writes an audit row on the live system every
    time. A file that visits eleven pages should not leave eleven sign-ins
    behind, so these share a session.
    """
    opts = Options()
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1440,900")
    opts.set_capability("goog:loggingPrefs", {"browser": "ALL"})
    d = webdriver.Chrome(options=opts)
    d.set_page_load_timeout(60)
    yield d
    d.quit()


def type_into(driver, element, text):
    """Replace the contents of a React-controlled input.

    element.clear() sets the DOM value but never reaches React's state, so the
    next render puts the old value back and send_keys appends to it. The login
    page arrives with the demo credentials already filled in, which turned
    "type an email" into "supervisor@lumen.govsupervisor@lumen.gov" — an
    invalid address that the browser refused to submit, with no visible error.

    Going through the native value setter and dispatching the event React
    listens for is what actually updates the component's state.
    """
    driver.execute_script(
        """
        const [el, value] = arguments;
        const proto = el instanceof HTMLTextAreaElement
          ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        """,
        element, text,
    )
