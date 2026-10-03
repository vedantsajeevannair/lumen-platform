#!/usr/bin/env python3
"""Run both suites and write one clean report.

Produces a table of test cases and their results, in HTML and PDF. It does
not invent anything: the rows come from pytest's own JUnit XML. If a case
fails or cannot run, it is still listed and the report says so - a report
that only ever shows passes is not a test report.
"""
import html
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPORTS = HERE / "reports"
REPORTS.mkdir(exist_ok=True)

SUITES = [("Website", "website", "Selenium · real Chrome · deployed site"),
          ("Android", "android", "Appium · UiAutomator2 · real handset")]

TITLE = {"website": "Website", "android": "Android"}


def pretty(name: str) -> str:
    n = name.removeprefix("test_")
    if n.startswith("tc") and "_" in n:
        num, _, rest = n.partition("_")
        return f"{num.upper().replace('TC', 'TC-')}  {rest.replace('_', ' ')}"
    return n.replace("_", " ")


def run(path: str, xml: Path) -> list[tuple[str, str, float]]:
    subprocess.run([sys.executable, "-m", "pytest", path, "-q", f"--junitxml={xml}"],
                   cwd=HERE, capture_output=True)
    if not xml.exists():
        return []
    rows = []
    for case in ET.parse(xml).getroot().iter("testcase"):
        outcome = "passed"
        for child in case:
            if child.tag in ("failure", "error"):
                outcome = "failed"
            elif child.tag == "skipped":
                outcome = "skipped"
        rows.append((pretty(case.get("name", "")), outcome, float(case.get("time", 0))))
    return rows


def main() -> int:
    blocks, totals = [], {"passed": 0, "failed": 0, "skipped": 0}
    for label, path, how in SUITES:
        rows = run(path, REPORTS / f"{path.split('/')[-1]}.xml")
        for _, outcome, _ in rows:
            totals[outcome] = totals.get(outcome, 0) + 1
        body = "\n".join(
            f'<tr class="{o}"><td>{html.escape(n)}</td>'
            f'<td class="s">{o.upper()}</td><td class="t">{t:.1f}s</td></tr>'
            for n, o, t in rows)
        blocks.append(
            f'<h2>{label} <span class="how">{html.escape(how)}</span></h2>'
            f'<p class="count">{len(rows)} test cases</p>'
            f'<table><thead><tr><th>Test case</th><th>Result</th><th>Time</th></tr>'
            f'</thead><tbody>{body}</tbody></table>')

    summary = " · ".join(f"{v} {k}" for k, v in totals.items() if v)
    out = REPORTS / "LUMEN_Test_Report.html"
    out.write_text(f"""<!doctype html><meta charset="utf-8">
<title>LUMEN — Test Report</title>
<style>
 body{{font:15px/1.6 -apple-system,Segoe UI,Roboto,sans-serif;margin:40px auto;max-width:860px;color:#14213d}}
 h1{{margin-bottom:4px}} .meta{{color:#667;margin-top:0}}
 h2{{margin-top:36px;border-bottom:2px solid #14213d;padding-bottom:6px}}
 .how{{font-size:13px;font-weight:400;color:#667;margin-left:8px}}
 .count{{color:#667;margin:6px 0 10px}}
 table{{width:100%;border-collapse:collapse}}
 th{{text-align:left;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:#667;padding:8px 10px;border-bottom:1px solid #dde}}
 td{{padding:9px 10px;border-bottom:1px solid #eef}}
 .s{{font-weight:600;width:110px}} .t{{width:80px;color:#889;text-align:right}}
 .passed .s{{color:#1a7f37}} .failed .s{{color:#b42318}} .skipped .s{{color:#9a6700}}
</style>
<h1>LUMEN — Test Report</h1>
<p class="meta">{datetime.now():%d %B %Y, %H:%M} · {summary}</p>
{''.join(blocks)}
""", encoding="utf-8")
    print(f"  {out.relative_to(HERE)}  —  {summary}")

    chrome = next((c for c in (
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("google-chrome"), shutil.which("chromium")) if c and Path(c).exists()), None)
    if chrome:
        pdf = REPORTS / "LUMEN_Test_Report.pdf"
        subprocess.run([chrome, "--headless", "--disable-gpu", "--no-pdf-header-footer",
                        f"--print-to-pdf={pdf}", out.as_uri()],
                       check=True, capture_output=True, timeout=180)
        print(f"  {pdf.relative_to(HERE)}  —  {pdf.stat().st_size // 1024} KB")
    return 1 if totals.get("failed") else 0


if __name__ == "__main__":
    raise SystemExit(main())
