"""TC-15 - emergency helplines are reachable and show real numbers.

Worth asserting the numbers themselves: a screen that renders its headings
but loses its content is the failure that matters here.
"""
import time

from conftest import in_app, present, tap_header


def test_tc15_helplines(app, shot):
    tap_header(app, "helplines")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    assert present(app, "Emergency Helplines"), "the helplines screen did not open"
    for number in ("112", "100", "108"):
        assert present(app, number, timeout=6), f"helpline {number} is missing"
