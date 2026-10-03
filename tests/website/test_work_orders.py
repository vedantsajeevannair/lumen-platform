"""TC-13 - work orders group nearby complaints into one visit."""
import re

from conftest import open_page, shot


def test_work_orders(staff):
    body = open_page(staff, "work-orders", "Work Orders", expect=r"\d+\s*×")
    shot(staff, "TC13_work_orders")
    assert re.search(r"\d+\s*×", body), "no grouped work orders on the page"
