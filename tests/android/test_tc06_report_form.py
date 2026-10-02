"""TC-06 - the report form offers the pieces it promises."""
import time

from conftest import in_app, present, tap_nav


def test_tc06_report_form(app, shot):
    tap_nav(app, "report")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    assert present(app, "Take photo") or present(app, "Add photo"), (
        "no way to attach a photograph")
    assert present(app, "Submit Report"), "no submit control on the form"
