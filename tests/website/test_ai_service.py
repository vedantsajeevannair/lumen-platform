"""TC-19 - the console reports the detection service as reachable.

This is the one that matters most on the dashboard: the site can look
perfectly healthy while the model behind it is down.
"""
from conftest import open_page, shot


def test_ai_service_status(staff):
    body = open_page(staff, "dashboard", "Dashboard", expect=r"AI service")
    shot(staff, "TC19_ai_service")
    assert "AI service online" in body, \
        "the dashboard does not report the AI service as online"
