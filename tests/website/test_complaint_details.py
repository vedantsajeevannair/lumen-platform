"""TC-10 - a complaint opens and shows what the model found.

The original pinned CMP-10494 by hand, which only works until that row ages
out of the queue. This takes whichever reference is on the page.
"""
import re

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait

from conftest import open_page, shot


def test_complaint_details(staff):
    body = open_page(staff, "complaints", "Complaints", expect=r"CMP-\d+")
    ref = re.search(r"CMP-\d+", body).group(0)

    staff.find_element(By.XPATH, f"//*[contains(text(), '{ref}')]").click()
    WebDriverWait(staff, 30).until(lambda d: f"/complaints/{ref}" in d.current_url)
    WebDriverWait(staff, 30).until(
        lambda d: len(d.find_elements(By.CSS_SELECTOR, "img[src*='/uploads/']")) >= 1)
    shot(staff, "TC10_complaint_details")

    srcs = [i.get_attribute("src") for i in
            staff.find_elements(By.CSS_SELECTOR, "img[src*='/uploads/']")]
    assert any("annotated-" in s for s in srcs), \
        f"{ref} shows no model output, only {srcs}"
