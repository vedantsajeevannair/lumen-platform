"""TC-15 - the budget planner actually funds repairs.

Asserts the count, not the heading: a planner that funds nothing renders
exactly the same page as one that is working.
"""
import re

from conftest import open_page, shot


def test_budget_planner(staff):
    body = open_page(staff, "budget", "Budget", expect=r"FUNDED REPAIRS \(\d+\)")
    shot(staff, "TC15_budget_planner")
    m = re.search(r"FUNDED REPAIRS \((\d+)\)", body)
    assert m, "no funded-repairs figure"
    assert int(m.group(1)) > 0, "the planner funded nothing"
