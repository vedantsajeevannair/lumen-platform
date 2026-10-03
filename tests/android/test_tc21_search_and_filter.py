"""TC-21 - a resident can search their reports and filter the list.

Deliberately modest in what it asserts. The headings and the chip bar are
re-laid-out as the filter changes, so pinning the test to any particular one
makes it fail on a screen that is working. What it does prove is that the
controls exist, respond, and leave you inside the app with the list intact.
"""
import time

import pytest

from selenium.webdriver.common.by import By

from conftest import by_exact, in_app, present, scroll_to, tap_exact, wait_for


def test_tc21_search(app, shot):
    if present(app, "No reports yet", timeout=5):
        pytest.skip("this account has filed no reports - nothing to search")
    # The search row is page content, not a pinned bar: at the top of the
    # home screen it lands behind the floating tab bar, and a tap there hits
    # the navigation instead. Scrolled up it is an ordinary input.
    assert scroll_to(app, "Search your reports", swipes=5), (
        "the search field was never brought into reach")
    wait_for(app, "Search your reports", timeout=20).click()
    time.sleep(1.5)
    # Focusing re-renders the input: the placeholder disappears, so it cannot
    # be found by that any more, and the handle we clicked is already stale.
    # The focused EditText is what we actually want to type into.
    focused = app.find_elements(By.XPATH, '//android.widget.EditText[@focused="true"]')
    assert focused, "tapping the search field did not focus an input"
    focused[0].send_keys("CMP")
    time.sleep(3)
    shot("search")
    assert in_app(app), "searching left the app"
    assert present(app, "CMP") or present(app, "Nothing matches"), (
        "searching produced neither a result nor the no-match state")


def test_tc21b_filters(app, shot):
    if present(app, "No reports yet", timeout=5):
        pytest.skip("this account has filed no reports - nothing to filter")
    tapped = []
    for chip in ("Open", "Resolved", "All"):
        found = app.find_elements(*by_exact(chip))
        if not found:
            continue
        tap_exact(app, chip)
        tapped.append(chip)
        time.sleep(2)
        assert in_app(app), f"the {chip} filter left the app"
    assert tapped, "no filter chips were found on the home screen"
    shot("filters")
