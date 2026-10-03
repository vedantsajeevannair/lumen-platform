"""TC-03 - a wrong password is refused, and refused visibly.

Restored: a negative login test existed in the original suite and was
deleted, leaving only its compiled copy behind. Without it every test passes
and nothing shows that the site can reject anybody.
"""
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from conftest import STAFF_EMAIL, fill_login, shot


def test_wrong_password_is_refused(driver):
    fill_login(driver, STAFF_EMAIL, "not-the-password")
    # It must say something rather than sit silent, and must not let us in.
    WebDriverWait(driver, 20).until(
        lambda d: "not authenticated" in d.find_element(By.TAG_NAME, "body").text.lower()
        or "/app" in d.current_url
    )
    shot(driver, "TC03_wrong_password")
    assert "/app" not in driver.current_url, "a wrong password signed the user in"
