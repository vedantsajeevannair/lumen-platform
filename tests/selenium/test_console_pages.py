"""Every page of the operations console, with something real on it.

The four pages covered elsewhere are the ones a demo walks through. These are
the other eight, and the reason to test them is that each is driven by its own
backend endpoint: a route renamed or a query broken shows up here as an empty
page long before anyone notices in the repository.

So these do not merely check that a page rendered. Where a page exists to
show numbers, the test insists on numbers greater than zero — a dashboard of
dashes is what a dead endpoint looks like.
"""
import re

import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import STAFF_EMAIL, STAFF_PASSWORD, type_into


@pytest.fixture(scope="module")
def staff(module_driver, base_url):
    """Sign in once for the whole file — eight sign-ins is eight audit rows."""
    d = module_driver
    d.get(base_url + "/auth/login")
    f = WebDriverWait(d, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=email]"))
    )
    type_into(d, f, STAFF_EMAIL)
    type_into(d, d.find_element(By.CSS_SELECTOR, "input[type=password]"), STAFF_PASSWORD)
    d.find_element(By.CSS_SELECTOR, "button[type=submit]").click()
    WebDriverWait(d, 30).until(lambda x: "/app" in x.current_url)
    return d


def open_page(driver, base_url, path, heading):
    driver.get(f"{base_url}/app/{path}")
    WebDriverWait(driver, 30).until(
        lambda d: heading in d.find_element(By.TAG_NAME, "body").text
    )
    # A route the app does not know bounces to the public landing page, so the
    # URL is checked too — otherwise a vanished route still "passes".
    assert f"/app/{path}" in driver.current_url, f"{path} redirected to {driver.current_url}"
    return driver.find_element(By.TAG_NAME, "body").text


def test_engineers_lists_real_people(staff, base_url):
    body = open_page(staff, base_url, "engineers", "Field Engineers")
    # Seeded engineers carry an ENG-#### code; no codes means the query failed.
    assert re.search(r"ENG-\d{4}", body), "no engineer records on the page"


def test_work_orders_groups_nearby_complaints(staff, base_url):
    body = open_page(staff, base_url, "work-orders", "Work Orders")
    # The page exists to group complaints within 150 m into one visit.
    assert re.search(r"\d+\s*×", body), "no grouped work orders"


def test_budget_planner_funds_repairs(staff, base_url):
    body = open_page(staff, base_url, "budget", "Budget & Repair Planner")
    m = re.search(r"FUNDED REPAIRS \((\d+)\)", body)
    assert m, "no funded-repairs figure"
    assert int(m.group(1)) > 0, "planner funded nothing"


def test_assignment_optimiser_proposes_work(staff, base_url):
    body = open_page(staff, base_url, "assignment", "Assignment Optimiser")
    m = re.search(r"PROPOSED ASSIGNMENTS \((\d+)\)", body)
    assert m, "no proposed assignments"
    assert int(m.group(1)) > 0, "optimiser proposed nothing"


def test_material_estimate_offers_a_surface(staff, base_url):
    body = open_page(staff, base_url, "estimate", "Repair Material Estimate")
    assert "Bituminous" in body, "no road surface to estimate against"


def test_audit_log_is_not_empty(staff, base_url):
    body = open_page(staff, base_url, "audit-logs", "Audit Log Explorer")
    # Every sign-in writes one, so an empty log means the endpoint is broken.
    assert len(body) > 400, "audit log rendered no entries"


def test_assistant_page_loads(staff, base_url):
    open_page(staff, base_url, "assistant", "Operations Assistant")


def test_new_complaint_form_is_usable(staff, base_url):
    open_page(staff, base_url, "complaints/new", "New Complaint")
    fields = staff.find_elements(By.CSS_SELECTOR, "input, textarea, select")
    assert fields, "the form has no fields"


def test_no_console_page_throws(staff, base_url):
    """A page that throws in the browser is broken however it looks."""
    pages = [
        "dashboard", "complaints", "complaints/new", "engineers", "gis",
        "assignment", "work-orders", "budget", "estimate", "audit-logs", "assistant",
    ]
    bad = {}
    staff.get_log("browser")  # drain what earlier pages left behind
    for path in pages:
        staff.get(f"{base_url}/app/{path}")
        WebDriverWait(staff, 25).until(
            EC.presence_of_element_located((By.TAG_NAME, "body"))
        )
        errors = [e for e in staff.get_log("browser") if e["level"] == "SEVERE"]
        if errors:
            bad[path] = [e["message"][:140] for e in errors]
    assert not bad, bad
