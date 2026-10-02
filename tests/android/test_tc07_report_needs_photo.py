"""TC-07 - submitting with no photograph is refused.

Negative case: class and severity are derived from the image, so an empty
submission must not reach the backend.
"""
import time

from conftest import present, tap


def test_tc07_report_needs_photo(app, shot):
    tap(app, "Report")
    time.sleep(3)
    tap(app, "Submit Report")
    time.sleep(2)
    shot("refused")
    assert present(app, "A photograph is required", timeout=10), (
        "an empty report was accepted")
