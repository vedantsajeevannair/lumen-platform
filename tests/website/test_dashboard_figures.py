"""TC-05 - the dashboard shows real figures, not a row of dashes.

Replaces a debug script that had no assertion at all. A dashboard whose
endpoint has broken still renders every heading, so checking the headings
proves nothing; what fails visibly is the numbers going away.
"""
import re

from conftest import open_page, shot


def test_dashboard_shows_figures(staff):
    body = open_page(staff, "dashboard", "Dashboard", expect=r"OPEN COMPLAINTS")
    shot(staff, "TC05_dashboard_figures")
    numbers = [int(n) for n in re.findall(r"\b\d+\b", body)]
    assert numbers, "the dashboard shows no figures at all"
    assert max(numbers) > 0, "every figure on the dashboard is zero"
