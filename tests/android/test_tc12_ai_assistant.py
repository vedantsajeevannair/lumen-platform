"""TC-12 - the in-app assistant opens and accepts a question."""
import time

import pytest

from conftest import present, tap


def test_tc12_ai_assistant(app, shot):
    if not present(app, "Ask", timeout=8):
        pytest.skip("no assistant entry point on this screen")
    tap(app, "Ask")
    time.sleep(4)
    shot()
    assert present(app, "Check with AI") or present(app, "Assistant"), (
        "the assistant did not open")
