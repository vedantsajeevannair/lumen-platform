"""TC-08 - the Updates tab opens and renders its own content."""
import time

from conftest import present, tap


def test_tc08_updates_tab(app, shot):
    tap(app, "Updates")
    time.sleep(3)
    shot()
    assert present(app, "Updates & Notifications") or present(app, "No updates yet"), (
        "the updates screen rendered neither a list nor its empty state")
