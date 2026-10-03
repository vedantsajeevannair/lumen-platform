"""TC-17 - the audit log records what staff have done."""
from conftest import open_page, shot


def test_audit_log(staff):
    body = open_page(staff, "audit-logs", "Audit")
    shot(staff, "TC17_audit_log")
    assert "Audit" in body
    assert len(body.splitlines()) > 5, "the audit log is empty"
