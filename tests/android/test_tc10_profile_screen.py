"""TC-10 - the profile screen loads the signed-in citizen."""
import time

from conftest import present, tap


def test_tc10_profile_screen(app, shot):
    tap(app, "Profile")
    time.sleep(3)
    shot()
    assert present(app, "Your reports") or present(app, "Citizen"), (
        "the profile screen did not load")
