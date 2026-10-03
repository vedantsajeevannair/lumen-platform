"""TC-08 - the queue lists actual complaints, with references."""
import re

from conftest import open_page, shot


def test_complaint_queue(staff):
    body = open_page(staff, "complaints", "Complaints", expect=r"CMP-\d+")
    shot(staff, "TC08_complaint_queue")
    refs = re.findall(r"CMP-\d+", body)
    assert refs, "the queue is empty - no complaint references on the page"
