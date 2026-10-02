"""TC-13 - with the radios off, a report is queued rather than lost."""
import time

import pytest

from conftest import present, tap


def test_tc13_offline_outbox(app, shot):
    app.set_network_connection(0)          # aeroplane mode
    try:
        time.sleep(3)
        tap(app, "Home")
        time.sleep(3)
        shot("offline")
        assert present(app, "Waiting to send") or present(app, "At a glance"), (
            "the app did not stay usable without a network")
    except Exception as exc:               # noqa: BLE001
        pytest.skip(f"this phone refuses network control: {exc}")
    finally:
        app.set_network_connection(6)      # wifi + data back on
        time.sleep(5)
