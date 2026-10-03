"""TC-07 - the complaints page is reachable."""
from conftest import open_page, shot


def test_complaints_navigation(staff):
    open_page(staff, "complaints", "Complaints")
    shot(staff, "TC07_complaints_page")
    assert "/app/complaints" in staff.current_url
