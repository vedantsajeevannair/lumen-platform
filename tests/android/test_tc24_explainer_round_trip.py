"""TC-24 - the reporting explainer returns you to where you were.

How many back presses that takes depends on whether the explainer opens as
a screen or a sheet, so the test uses the same restore the fixtures use:
it checks the foreground package as it goes, rather than pressing back a
fixed number of times and walking out of the app onto the launcher.
"""
import time

from conftest import wait_home, _restore, in_app, on_home, present, tap, tap_profile


def test_tc24_explainer_round_trip(app, shot):
    tap_profile(app)
    time.sleep(3)
    assert present(app, "How reporting works"), "the explainer is missing"
    tap(app, "How reporting works")
    time.sleep(3)
    assert in_app(app), "the explainer left the app"

    _restore(app)
    shot()
    assert in_app(app), "navigating back left the app"
    assert wait_home(app), "the explainer did not lead back to the home screen"
