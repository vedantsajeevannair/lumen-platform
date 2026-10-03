"""TC-06 - the console navigates between its pages and back."""
from conftest import open_page, shot


def test_dashboard_navigation(staff):
    open_page(staff, "complaints", "Complaints")
    assert "/app/complaints" in staff.current_url
    open_page(staff, "dashboard", "Dashboard", expect=r"OPEN COMPLAINTS")
    shot(staff, "TC06_dashboard_navigation")
    assert "/app/dashboard" in staff.current_url
