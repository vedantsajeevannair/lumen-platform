"""TC-19 - the profile offers an app lock.

The phone has a fingerprint and face unlock, so the control must be offered
rather than reporting that no biometric is set up.
"""
import time

from conftest import present, scroll_to, tap_profile


def test_tc19_security_options(app, shot):
    tap_profile(app)
    time.sleep(3)
    assert scroll_to(app, "Security", swipes=4), "no security section on the profile"
    shot()
    assert present(app, "Lock the app"), "no app-lock control"
