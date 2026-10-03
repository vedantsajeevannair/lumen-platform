"""TC-14 - the material estimator produces quantities."""
import re

from conftest import open_page, shot


def test_material_estimate(staff):
    body = open_page(staff, "estimate", "Material")
    shot(staff, "TC14_material_estimate")
    assert "Material" in body or "Estimate" in body
    assert re.search(r"\d", body), "the estimator produced no numbers"
