"""TC-10 - the avatar opens the signed-in citizen's profile."""
import time

from conftest import in_app, present, tap_profile


def test_tc10_profile_screen(app, shot):
    tap_profile(app)
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    assert present(app, "Your reports") or present(app, "Citizen") \
        or present(app, "Sign out"), "the profile screen did not load"
