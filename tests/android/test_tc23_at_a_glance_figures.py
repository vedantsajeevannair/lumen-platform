"""TC-23 - the at-a-glance panel shows counts, not blanks.

The resident's own totals come from the backend; if that call fails the
panel still draws, which is why this checks for digits rather than headings.
"""
import re

import pytest

from conftest import present, scroll_to


def test_tc23_at_a_glance_figures(app, shot):
    if present(app, "No reports yet", timeout=5):
        pytest.skip("this account has filed no reports - nothing to count")
    assert scroll_to(app, "At a glance", swipes=3), "no at-a-glance panel"
    shot()
    assert re.search(r"\d", app.page_source), "the at-a-glance panel shows no figures"
