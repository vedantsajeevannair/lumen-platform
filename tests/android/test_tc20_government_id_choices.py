"""TC-20 - verification offers the government ID types it supports."""
import time

import pytest

from conftest import in_app, present, tap, tap_profile


def test_tc20_government_id_choices(app, shot):
    tap_profile(app)
    time.sleep(3)
    if not present(app, "Get Verified", timeout=8):
        pytest.skip("this account is already verified")
    tap(app, "Get Verified")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    offered = [n for n in ("Aadhaar", "Voter", "Driver", "Passport", "PAN")
               if present(app, n, timeout=4)]
    assert offered, "no government ID type was offered"
