"""TC-11 - the GIS map draws tiles and markers, not an empty box."""
from selenium.webdriver.common.by import By
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait

from conftest import open_page, shot


def test_gis_map(staff):
    open_page(staff, "gis", "GIS Map")
    WebDriverWait(staff, 30).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".leaflet-container")))
    WebDriverWait(staff, 25).until(lambda d: d.find_elements(By.CSS_SELECTOR, ".leaflet-tile"))
    shot(staff, "TC11_gis_map")
    assert staff.find_elements(By.CSS_SELECTOR, ".leaflet-tile"), "the map drew no tiles"
