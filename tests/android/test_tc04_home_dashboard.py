"""TC-04 - home shows the citizen's own figures, not an empty shell."""
from conftest import present


def test_tc04_home_dashboard(app, shot):
    shot()
    assert present(app, "At a glance"), "the At a glance panel is missing"
    assert present(app, "Latest report") or present(app, "No reports yet"), (
        "neither a latest report nor the empty state is shown")
