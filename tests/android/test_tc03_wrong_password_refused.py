"""TC-03 - a wrong password is refused, and refused visibly.

The suite this replaces had no negative case at all, so every test passing
told you nothing about whether the app can reject anybody.

The test signs out, is refused with a bad password, then signs back in, so
the phone is left usable for everything that runs after it.
"""
import time

import pytest

from conftest import (HOME_MARKERS, any_of, on_home, on_login, present,
                      scroll_to, sign_in, tap, tap_exact, tap_profile)


def test_tc03_wrong_password_refused(required_credentials, app, shot):
    email, password = required_credentials

    tap_profile(app)
    time.sleep(3)
    if not scroll_to(app, "Sign out", swipes=8):
        pytest.skip("no Sign out control on this build")
    tap(app, "Sign out")
    time.sleep(2)
    # A confirmation dialog follows, with CANCEL and SIGN OUT. Its body text
    # does not reach the accessibility tree, so the dialog is recognised by
    # its Cancel button rather than by what it says.
    if present(app, "Cancel", timeout=6):
        # Tap the dialog's own button. A substring match would find the
        # "Sign out" row on the profile behind the dialog first, and the tap
        # would be swallowed by the scrim - leaving the dialog open and the
        # test waiting for a login screen that never arrives.
        tap_exact(app, "SIGN OUT")
    time.sleep(4)

    assert on_login(app), "signing out did not return to the login screen"

    sign_in(app, email, "definitely-not-the-password")
    time.sleep(5)
    shot("refused")
    assert not on_home(app), "a wrong password signed the user in"

    # Leave the phone signed in for the rest of the run.
    sign_in(app, email, password)
    any_of(app, *HOME_MARKERS, timeout=40)
