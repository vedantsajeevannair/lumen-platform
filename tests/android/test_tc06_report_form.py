"""TC-06 - the report form offers the three steps it promises."""
import time

from conftest import present, tap


def test_tc06_report_form(app, shot):
    tap(app, "Report")
    time.sleep(3)
    shot()
    assert present(app, "Take photo") or present(app, "Add photo"), (
        "no way to attach a photograph")
    assert present(app, "Submit Report"), "no submit control on the form"
