"""TC-11 - identity verification is reachable from the profile."""
import time

import pytest

from conftest import present, tap, tap_profile


def test_tc11_identity_verification(app, shot):
    tap_profile(app)
    time.sleep(3)
    if not present(app, "Get Verified", timeout=10):
        pytest.skip("this account is already verified")
    tap(app, "Get Verified")
    time.sleep(4)
    shot()
    assert present(app, "Citizen Identity Verification") or present(app, "Aadhaar"), (
        "the verification flow did not open")
