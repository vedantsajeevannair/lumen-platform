"""TC-08 - the Updates tab opens and renders its own content."""
import time

from conftest import in_app, present, tap_nav


def test_tc08_updates_tab(app, shot):
    tap_nav(app, "updates")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    assert present(app, "Updates") or present(app, "No updates yet") \
        or present(app, "All caught up"), (
        "the updates screen rendered neither a list nor its empty state")
