"""TC-09 - the tab bar returns to Home from elsewhere."""
import time

from conftest import on_home, tap


def test_tc09_navigation_round_trip(app, shot):
    tap(app, "Updates")
    time.sleep(2)
    tap(app, "Home")
    time.sleep(2)
    shot()
    assert on_home(app), "the Home tab did not return to the home screen"
