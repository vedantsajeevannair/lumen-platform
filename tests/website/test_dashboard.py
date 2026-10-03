"""TC-04 - signing in reaches the operations console."""
from conftest import shot, sign_in


def test_login_and_dashboard(driver):
    sign_in(driver)
    shot(driver, "TC04_dashboard")
    assert "/app" in driver.current_url, f"sign-in landed on {driver.current_url}"
