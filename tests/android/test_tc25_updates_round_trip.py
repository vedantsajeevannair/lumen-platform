"""TC-25 - Updates and back, without losing the session."""
import time

from conftest import wait_home, in_app, on_home, present, tap_nav, shot


def test_tc25_updates_round_trip(app, shot):
    tap_nav(app, "updates")
    time.sleep(3)
    assert in_app(app), "the Updates tab left the app"
    assert present(app, "Updates") or present(app, "caught up") \
        or present(app, "No updates yet"), "the updates screen did not render"
    tap_nav(app, "home")
    time.sleep(3)
    shot()
    assert wait_home(app), "Home did not come back"
