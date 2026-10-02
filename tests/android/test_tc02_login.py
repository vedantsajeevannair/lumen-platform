"""TC-02 - a citizen can sign in with correct credentials."""
from conftest import HOME_MARKERS, any_of


def test_tc02_login(app, shot):
    landed = any_of(app, *HOME_MARKERS, timeout=40)
    shot()
    assert landed, "signed in but the home screen never appeared"
