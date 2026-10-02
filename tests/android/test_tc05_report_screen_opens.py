"""TC-05 - the centre button opens the reporting flow.

This is the control that was changed after the review comment about the
circle around it, so it is worth asserting it still works.
"""
import time

from conftest import present, tap


def test_tc05_report_screen_opens(app, shot):
    tap(app, "Report")
    time.sleep(3)
    shot()
    assert present(app, "Report Civic Problem") or present(app, "Take photo"), (
        "the report screen did not open from the centre button")
