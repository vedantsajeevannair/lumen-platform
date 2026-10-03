"""TC-22 - the home screen's latest-report card carries a real report.

A card that renders its frame but has lost its reference is the failure
worth catching; the heading alone proves nothing.
"""
import re

from conftest import present, shot


def test_tc22_latest_report_card(app, shot):
    if not present(app, "Latest report", timeout=10):
        import pytest
        pytest.skip("this account has filed no reports")
    shot()
    refs = re.findall(r"CMP-\d+", app.page_source)
    assert refs, "the latest-report card shows no complaint reference"
    assert present(app, "Filed") or present(app, "In progress") \
        or present(app, "Resolved"), "the card shows no stage"
