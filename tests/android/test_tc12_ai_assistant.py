"""TC-12 - the civic AI assistant opens and offers something to ask."""
import time

from conftest import in_app, present, tap_header


def test_tc12_ai_assistant(app, shot):
    tap_header(app, "assistant")
    time.sleep(4)
    shot()
    assert in_app(app), "the tap left the app entirely"
    assert present(app, "LUMEN AI Assistant") or present(app, "CIVIC AI"), (
        "the assistant did not open")
    assert present(app, "Suggested questions") or present(app, "Ask anything"), (
        "the assistant opened with nothing to ask")
