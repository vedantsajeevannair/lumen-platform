"""TC-02 - the sign-in form renders all three controls."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import BASE_URL, shot


def test_login_form(driver):
    driver.get(BASE_URL + "/auth/login")
    wait = WebDriverWait(driver, 25)
    email = wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=email]")))
    password = driver.find_element(By.CSS_SELECTOR, "input[type=password]")
    submit = driver.find_element(By.CSS_SELECTOR, "button[type=submit]")
    shot(driver, "TC02_login_page")
    assert email.is_displayed() and password.is_displayed() and submit.is_displayed()
