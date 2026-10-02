"""TC-18 - the profile explains the reporting process to a resident."""
import time

from conftest import in_app, present, tap, tap_profile


def test_tc18_how_reporting_works(app, shot):
    tap_profile(app)
    time.sleep(3)
    assert present(app, "How reporting works"), "the explainer is not on the profile"
    tap(app, "How reporting works")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
