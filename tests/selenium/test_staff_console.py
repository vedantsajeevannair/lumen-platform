"""The operations console: what municipal staff use after signing in."""
import re

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import STAFF_EMAIL, STAFF_PASSWORD, type_into


def fill_login(driver, base_url, email, password):
    driver.get(base_url + "/auth/login")
    field = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=email]"))
    )
    type_into(driver, field, email)
    type_into(driver, driver.find_element(By.CSS_SELECTOR, "input[type=password]"), password)
    driver.find_element(By.CSS_SELECTOR, "button[type=submit]").click()


def sign_in(driver, base_url):
    fill_login(driver, base_url, STAFF_EMAIL, STAFF_PASSWORD)
    WebDriverWait(driver, 30).until(lambda d: "/app" in d.current_url)
    return driver


@pytest.fixture
def staff(driver, base_url):
    return sign_in(driver, base_url)


def test_wrong_password_is_refused(driver, base_url):
    """A bad password must fail visibly, not silently or by letting you in."""
    fill_login(driver, base_url, STAFF_EMAIL, "not-the-password")
    # It must say something rather than sit silent, and must not let us through.
    WebDriverWait(driver, 20).until(
        lambda d: "not authenticated" in d.find_element(By.TAG_NAME, "body").text.lower()
        or "/app" in d.current_url
    )
    assert "/app" not in driver.current_url, "wrong password signed in"


def test_sign_in_reaches_the_console(staff):
    assert "/app" in staff.current_url


def test_dashboard_shows_real_figures(staff, base_url):
    """Hundreds of complaints are seeded; a dashboard of zeros means a dead API."""
    staff.get(base_url + "/app/dashboard")
    WebDriverWait(staff, 30).until(
        lambda d: any(
            int(n) > 0
            for n in re.findall(r"\b\d{1,5}\b", d.find_element(By.TAG_NAME, "body").text)
        )
    )


def test_complaint_list_loads(staff, base_url):
    staff.get(base_url + "/app/complaints")
    WebDriverWait(staff, 30).until(
        lambda d: "CMP-" in d.find_element(By.TAG_NAME, "body").text
    )


def test_complaint_detail_shows_model_output(staff, base_url):
    """Open the first complaint; the annotated photograph must actually load."""
    staff.get(base_url + "/app/complaints")
    WebDriverWait(staff, 30).until(
        lambda d: "CMP-" in d.find_element(By.TAG_NAME, "body").text
    )
    ref = re.search(r"CMP-[\w-]+", staff.find_element(By.TAG_NAME, "body").text).group(0)

    staff.find_element(By.XPATH, f"//*[contains(text(), '{ref}')]").click()
    WebDriverWait(staff, 30).until(lambda d: f"/complaints/{ref}" in d.current_url)

    # The citizen's photograph and the detector's annotated copy both appear.
    # Waiting for them to finish decoding matters: checking the moment the
    # first <img> exists catches the second one mid-download and calls a
    # working page broken.
    WebDriverWait(staff, 30).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "img[src*='/uploads/']")) >= 2
        and d.execute_script(
            "return [...document.querySelectorAll(\"img[src*='/uploads/']\")]"
            ".every(i => i.complete && i.naturalWidth > 0);"
        )
    )
    srcs = [i.get_attribute("src") for i in
            staff.find_elements(By.CSS_SELECTOR, "img[src*='/uploads/']")]
    assert any("annotated-" in s for s in srcs), \
        f"{ref} shows no model output, only {srcs}"


def test_gis_map_renders(staff, base_url):
    staff.get(base_url + "/app/gis")
    # Leaflet writes its own container into the DOM once the map initialises.
    WebDriverWait(staff, 30).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".leaflet-container"))
    )
    WebDriverWait(staff, 20).until(
        lambda d: d.find_elements(By.CSS_SELECTOR, ".leaflet-tile")
    )
