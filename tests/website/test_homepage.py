"""TC-01 - the public site is reachable and is LUMEN."""
from conftest import BASE_URL, shot


def test_homepage(driver):
    driver.get(BASE_URL)
    body = driver.find_element("tag name", "body").text
    shot(driver, "TC01_homepage")
    assert driver.current_url.startswith(BASE_URL)
    assert "LUMEN" in body, "the landing page does not identify itself"
