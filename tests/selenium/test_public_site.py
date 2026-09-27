"""The public side of LUMEN: what a resident sees before signing in."""
import pytest
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


def test_landing_page_loads(driver, base_url):
    driver.get(base_url)
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.TAG_NAME, "h1"))
    )
    assert "LUMEN" in driver.title or "LUMEN" in driver.page_source
    heading = driver.find_element(By.TAG_NAME, "h1").text
    assert "photo" in heading.lower() or "damage" in heading.lower(), heading


def test_headline_claims_are_present(driver, base_url):
    """The stat strip is what a visitor reads first; it must actually render."""
    driver.get(base_url)
    body = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    ).text
    for claim in ("pipeline", "damage", "audit"):
        assert claim in body.lower(), f"{claim!r} missing from the landing page"


@pytest.mark.parametrize("path,expect", [
    ("/about", "about"),
    ("/features", "feature"),
    ("/faq", "faq"),
    ("/contact", "contact"),
])
def test_public_pages_render(driver, base_url, path, expect):
    driver.get(base_url + path)
    body = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.TAG_NAME, "body"))
    ).text.lower()
    assert len(body) > 200, f"{path} rendered almost nothing"
    assert expect in body or expect in driver.current_url


def test_android_download_link_is_real(driver, base_url):
    """The button must point at an APK that exists, not a 404 or the SPA shell."""
    driver.get(base_url)
    link = WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, 'a[href$=".apk"]'))
    )
    href = link.get_attribute("href")
    assert href.endswith("/lumen.apk"), href

    # Fetch it from inside the page so the check uses the same origin and TLS.
    result = driver.execute_async_script(
        """
        const done = arguments[arguments.length - 1];
        fetch(arguments[0], { method: 'HEAD' })
          .then(r => done({ status: r.status,
                            type: r.headers.get('content-type'),
                            size: Number(r.headers.get('content-length') || 0) }))
          .catch(e => done({ error: String(e) }));
        """,
        href,
    )
    assert result.get("status") == 200, result
    assert "android.package-archive" in (result.get("type") or ""), result
    # An APK is tens of megabytes; the SPA shell is about a kilobyte.
    assert result["size"] > 10_000_000, f"only {result['size']} bytes — probably index.html"


def test_staff_login_page_renders(driver, base_url):
    driver.get(base_url + "/auth/login")
    WebDriverWait(driver, 20).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, "input[type=password]"))
    )
    assert driver.find_elements(By.CSS_SELECTOR, "input[type=email], input[name=email]")
    assert driver.find_elements(By.CSS_SELECTOR, "button, input[type=submit]")
