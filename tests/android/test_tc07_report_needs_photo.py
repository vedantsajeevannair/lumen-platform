"""TC-07 - submitting with no photograph is refused.

Negative case: class and severity are read off the image, so an empty
submission must not reach the backend.
"""
import time

from conftest import in_app, present, scroll_to, tap, tap_nav


def test_tc07_report_needs_photo(app, shot):
    tap_nav(app, "report")
    time.sleep(4)
    assert present(app, "Report Civic Problem"), "the report screen did not open"

    # The submit control starts beneath the floating tab bar; tapping it there
    # hits the navigation and submits nothing at all.
    assert scroll_to(app, "Submit Report"), "no Submit control on the form"
    tap(app, "Submit Report")
    time.sleep(3)
    shot("refused")

    assert in_app(app), "the tap left the app entirely"
    assert present(app, "A photograph is required", timeout=12), (
        "an empty report was accepted")
