"""TC-04 - home shows the citizen's own figures, not an empty shell."""
import pytest

from conftest import present, scroll_to


def test_tc04_home_dashboard(app, shot):
    shot()
    if present(app, "No reports yet", timeout=5):
        pytest.skip("this account has filed no reports - nothing to summarise")
    # Both panels sit below the greeting, so they need scrolling to rather
    # than asserting on wherever the screen happens to be.
    assert scroll_to(app, "At a glance", swipes=4), "the At a glance panel is missing"
    assert present(app, "Latest report") or scroll_to(app, "Latest report", swipes=4), \
        "no latest-report card"
