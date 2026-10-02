"""TC-16 - the same screen explains why reporting matters."""
import time

from conftest import present, scroll_to, tap_header


def test_tc16_civic_impact(app, shot):
    tap_header(app, "helplines")
    time.sleep(4)
    assert scroll_to(app, "Why Report Issues", swipes=5), (
        "the civic impact section was not found"
    )
    shot()
    assert present(app, "Why Report Issues")
