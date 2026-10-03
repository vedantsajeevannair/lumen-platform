"""TC-18 - the console sidebar offers every section."""
from selenium.webdriver.common.by import By

from conftest import open_page, shot


def test_sidebar_navigation(staff):
    open_page(staff, "dashboard", "Dashboard", expect=r"OPEN COMPLAINTS")
    body = staff.find_element(By.TAG_NAME, "body").text
    shot(staff, "TC18_sidebar_navigation")
    missing = [s for s in ("Dashboard", "Complaints", "GIS", "Work Orders", "Engineers")
               if s not in body]
    assert not missing, f"the sidebar is missing: {missing}"
