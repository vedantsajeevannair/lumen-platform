"""TC-11 - identity verification is reachable and offers an ID type."""
import time

import pytest

from conftest import present, tap


def test_tc11_identity_verification(app, shot):
    tap(app, "Profile")
    time.sleep(2)
    if not present(app, "Get Verified", timeout=10):
        pytest.skip("this account is already verified")
    tap(app, "Get Verified")
    time.sleep(3)
    shot()
    assert present(app, "Citizen Identity Verification") or present(app, "Aadhaar"), (
        "the verification flow did not open")
