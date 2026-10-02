"""TC-17 - opening a report shows its tracked progress.

The home card carries a CMP- reference; the detail view must show the same
report and its dispatch stages, not an empty shell.
"""
import re
import time

from conftest import by_text, in_app, present, tap


def test_tc17_report_detail(app, shot):
    refs = re.findall(r"CMP-\d+", app.page_source)
    if not refs:
        import pytest
        pytest.skip("this account has filed no reports")
    ref = refs[0]

    tap(app, ref)
    time.sleep(4)
    shot()
    assert in_app(app), "opening the report left the app"
    assert present(app, ref), f"the detail view does not show {ref}"
    assert present(app, "Filed") or present(app, "In progress") \
        or present(app, "Resolved"), "no dispatch progress on the detail view"
