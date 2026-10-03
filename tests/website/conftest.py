"""Shared setup for the LUMEN website tests.

These run against the deployed site, because that is the thing being marked
and the thing residents use. Point LUMEN_BASE_URL at a dev server to run them
somewhere else.
"""
import os
from pathlib import Path

import pytest
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

BASE_URL = os.environ.get("LUMEN_BASE_URL", "https://140-238-246-75.sslip.io")
STAFF_EMAIL = os.environ.get("LUMEN_STAFF_EMAIL", "supervisor@lumen.gov")
STAFF_PASSWORD = os.environ.get("LUMEN_STAFF_PASSWORD", "lumen123")

SHOTS = Path(__file__).resolve().parents[1] / "screenshots" / "website"
SHOTS.mkdir(parents=True, exist_ok=True)


def _chrome():
    opts = Options()
    # Headless by default so the suite is reproducible and can run over SSH.
    # HEADLESS=0 to watch it drive a real window.
    if os.environ.get("HEADLESS", "1") == "1":
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1440,900")
    opts.add_argument("--disable-gpu")
    d = webdriver.Chrome(options=opts)
    d.set_page_load_timeout(60)
    return d


@pytest.fixture
def driver():
    d = _chrome()
    yield d
    d.quit()


@pytest.fixture(scope="module")
def module_driver():
    d = _chrome()
    yield d
    d.quit()


@pytest.fixture
def base_url():
    return BASE_URL


def type_into(driver, element, text):
    """Replace the contents of a React-controlled input.

    element.clear() and send_keys both go to the DOM without ever reaching
    React's state, so the next render puts the old value back and send_keys
    appends to it. The login page arrives with the demo credentials already
    filled in, which turned "type an email" into
    "supervisor@lumen.govsupervisor@lumen.gov" - an address the browser
    refused to submit, with no visible error and a 30-second timeout as the
    only symptom.

    Going through the native value setter and dispatching the event React
    listens for is what actually updates the component.
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


def fill_login(driver, email, password):
    driver.get(BASE_URL + "/auth/login")
    field = WebDriverWait(driver, 25).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=email]")))
    type_into(driver, field, email)
    type_into(driver, driver.find_element(By.CSS_SELECTOR, "input[type=password]"), password)
    driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()


def sign_in(driver):
    fill_login(driver, STAFF_EMAIL, STAFF_PASSWORD)
    WebDriverWait(driver, 30).until(lambda d: "/app" in d.current_url)
    return driver


@pytest.fixture(scope="module")
def staff(module_driver):
    """Signed in once per file - every sign-in writes an audit row."""
    return sign_in(module_driver)


def open_page(driver, path, heading, expect=None):
    """Open a console page and return its text, waiting for its data.

    The heading is shell and renders at once while the figures arrive from a
    separate request, so reading the body on the heading alone races the data
    and fails on a page that is merely still loading.
    """
    driver.get(f"{BASE_URL}/app/{path}")
    WebDriverWait(driver, 30).until(
        lambda d: heading.lower() in d.find_element(By.TAG_NAME, "body").text.lower())
    assert f"/app/{path}" in driver.current_url, \
        f"{path} redirected to {driver.current_url}"
    if expect:
        import re
        WebDriverWait(driver, 60).until(
            lambda d: re.search(expect, d.find_element(By.TAG_NAME, "body").text))
    return driver.find_element(By.TAG_NAME, "body").text


def shot(driver, name):
    path = SHOTS / f"{name}.png"
    driver.save_screenshot(str(path))
    return path
