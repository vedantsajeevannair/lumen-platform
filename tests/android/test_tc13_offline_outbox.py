"""TC-13 - with the radios off, a report is queued rather than lost.

Only meaningful over USB. On a wireless adb connection the radios we would
switch off are the ones carrying the test session, so the first thing this
would prove is that it can disconnect itself - it took the phone off the
network mid-run once already.
"""
import time

import pytest

from conftest import attached_device, present, tap


def test_tc13_offline_outbox(app, shot):
    serial = attached_device() or ""
    if ":" in serial or serial.startswith("adb-"):
        pytest.skip("wireless adb: toggling the radios would cut this session - run over USB")

    app.set_network_connection(0)          # aeroplane mode
    try:
        time.sleep(3)
        tap(app, "Home")
        time.sleep(3)
        shot("offline")
        assert present(app, "Waiting to send") or present(app, "At a glance"), (
            "the app did not stay usable without a network")
    finally:
        app.set_network_connection(6)      # wifi + data back on
        time.sleep(5)
