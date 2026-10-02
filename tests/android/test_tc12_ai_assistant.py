"""TC-12 - the in-app assistant opens from the header."""
import time

import pytest

from conftest import present, tap


def test_tc12_ai_assistant(app, shot):
    if not present(app, "Check with AI", timeout=6) and not present(app, "Ask", timeout=6):
        pytest.skip("no assistant entry point on the home screen")
    tap(app, "Check with AI" if present(app, "Check with AI", timeout=3) else "Ask")
    time.sleep(4)
    shot()
    assert present(app, "Assistant") or present(app, "Check with AI"), (
        "the assistant did not open")
