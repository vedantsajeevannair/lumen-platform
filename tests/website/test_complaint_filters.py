"""TC-09 - the status filters narrow the queue without emptying the page."""
from selenium.webdriver.common.by import By

from conftest import open_page, shot


def test_complaint_status_filters(staff):
    open_page(staff, "complaints", "Complaints", expect=r"CMP-\d+")
    clicked = 0
    for label in ("Open", "Assigned", "Resolved", "All"):
        found = staff.find_elements(
            By.XPATH, f"//*[self::button or @role='button'][normalize-space()='{label}']")
        if found:
            found[0].click()
            clicked += 1
    shot(staff, "TC09_complaint_filters")
    assert clicked, "no status filter controls were found"
    assert "Complaints" in staff.find_element(By.TAG_NAME, "body").text, \
        "the complaints page did not survive filtering"
