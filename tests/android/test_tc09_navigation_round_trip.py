"""TC-09 - the tab bar comes back to Home from elsewhere."""
import time

from conftest import on_home, tap_nav


def test_tc09_navigation_round_trip(app, shot):
    tap_nav(app, "updates")
    time.sleep(3)
    tap_nav(app, "home")
    time.sleep(3)
    shot()
    assert on_home(app), "the Home button did not return to the home screen"
