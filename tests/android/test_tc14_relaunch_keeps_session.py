"""TC-14 - the session survives the app being backgrounded and reopened."""
import time

from conftest import PACKAGE, HOME_MARKERS, any_of


def test_tc14_relaunch_keeps_session(app, shot):
    app.terminate_app(PACKAGE)
    time.sleep(2)
    app.activate_app(PACKAGE)
    time.sleep(5)
    shot()
    assert any_of(app, *HOME_MARKERS, timeout=40), (
        "the citizen was signed out by a restart")
