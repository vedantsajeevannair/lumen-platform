"""TC-01 - the signed APK installs, launches and is the app we built."""
from conftest import PACKAGE


def test_tc01_app_launch(driver, shot):
    driver.activate_app(PACKAGE)
    shot()
    assert driver.current_package == PACKAGE, (
        f"a different app is in the foreground: {driver.current_package}")
