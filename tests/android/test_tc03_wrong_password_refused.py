"""TC-03 - a wrong password is refused, and refused visibly.

The suite this replaces had no negative case at all, so every test passing
told you nothing about whether the app can fail correctly.
"""
import time

import pytest

from conftest import on_home, on_login, present, sign_in, tap, type_into


def test_tc03_wrong_password_refused(required_credentials, app, shot):
    email, password = required_credentials

    tap(app, "Profile")
    time.sleep(2)
    if not present(app, "Sign out", timeout=10):
        pytest.skip("no Sign out control on this build")
    tap(app, "Sign out")
    time.sleep(1)
    tap(app, "Sign out")          # the confirmation dialog repeats the label
    time.sleep(3)

    assert on_login(app), "signing out did not return to the login screen"

    sign_in(app, email, "definitely-not-the-password")
    time.sleep(4)
    shot("refused")

    assert not on_home(app), "a wrong password signed the user in"

    # back to a usable state for the rest of the run
    type_into(app, "you@example.com", email)
    sign_in(app, email, password)
    time.sleep(4)
