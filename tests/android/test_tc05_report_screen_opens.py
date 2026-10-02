"""TC-05 - the centre button opens the reporting flow.

This is the control that was changed after the review comment about the
circle around it, so it is worth asserting it still does its job.
"""
import time

from conftest import in_app, present, tap_nav


def test_tc05_report_screen_opens(app, shot):
    tap_nav(app, "report")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    assert present(app, "Report Civic Problem") or present(app, "Take photo"), (
        "the report screen did not open from the centre button")
