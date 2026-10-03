"""TC-16 - the assignment optimiser proposes work for the crews."""
import re

from conftest import open_page, shot


def test_assignment(staff):
    body = open_page(staff, "assignment", "Assignment",
                     expect=r"PROPOSED ASSIGNMENTS \(\d+\)")
    shot(staff, "TC16_assignment")
    m = re.search(r"PROPOSED ASSIGNMENTS \((\d+)\)", body)
    assert m, "no proposed assignments"
    assert int(m.group(1)) > 0, "the optimiser proposed nothing"
