"""TC-12 - the engineers page lists the field engineers."""
from conftest import open_page, shot


def test_engineers_page(staff):
    body = open_page(staff, "engineers", "Engineers")
    shot(staff, "TC12_engineers_page")
    assert "/app/engineers" in staff.current_url
    assert "Engineer" in body, "the engineers page lists nobody"
