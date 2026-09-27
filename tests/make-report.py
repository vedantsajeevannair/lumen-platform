#!/usr/bin/env python3
"""Run every suite and write one PDF report.

    python3 tests/make-report.py            run everything, write tests/report.pdf
    python3 tests/make-report.py --open     …and open it
    python3 tests/make-report.py --html     keep the HTML beside it as well

The page is laid out in HTML and printed by headless Chrome, which is
already installed for the browser tests — so there is no PDF library to add
and the PDF looks exactly like the page.

Each runner already emits machine-readable results — pytest JUnit XML, jest
JSON, node:test JUnit — so nothing here re-parses terminal output, which
would break the first time a runner changed its wording.
"""
import html
import json
import re
import subprocess
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "tests" / "report.pdf"
HTML = ROOT / "tests" / "report.html"
TMP = ROOT / "tests" / ".results"
TMP.mkdir(exist_ok=True)


def run(cmd, cwd):
    print(f"  $ {' '.join(cmd[:4])} …", flush=True)
    return subprocess.run(cmd, cwd=cwd, capture_output=True, text=True).returncode


def from_junit(path, strip=lambda s: s):
    """Cases out of a JUnit file, as (suite, name, ok, seconds, failure)."""
    if not path.exists():
        return []
    cases = []
    for tc in ET.parse(path).getroot().iter("testcase"):
        fail = tc.find("failure") if tc.find("failure") is not None else tc.find("error")
        cases.append((
            strip(tc.get("classname") or ""),
            tc.get("name") or "",
            fail is None,
            float(tc.get("time") or 0),
            (fail.get("message") if fail is not None else "") or "",
        ))
    return cases


def from_jest(path):
    if not path.exists():
        return []
    data = json.loads(path.read_text())
    cases = []
    for suite in data.get("testResults", []):
        name = Path(suite.get("name", "")).name
        for t in suite.get("assertionResults", []):
            title = " › ".join(t.get("ancestorTitles", []) + [t.get("title", "")])
            cases.append((
                name, title, t.get("status") == "passed",
                (t.get("duration") or 0) / 1000,
                "\n".join(t.get("failureMessages", [])),
            ))
    return cases


print("Running the suites…")
run(["python3", "-m", "pytest", "tests/selenium", "-q",
     f"--junitxml={TMP/'web.xml'}"], ROOT)
run(["npx", "jest", "--watchAll=false", "--json",
     f"--outputFile={TMP/'app.json'}"], ROOT / "mobile")
run(["npx", "tsx", "--test", "--test-reporter=junit",
     f"--test-reporter-destination={TMP/'backend.xml'}", "__tests__/otp.test.ts"],
    ROOT / "backend")

suites = [
    ("Website", "Selenium driving real Chrome against the live deployment",
     from_junit(TMP / "web.xml", lambda c: c.split(".")[-1] + ".py")),
    ("Mobile app", "Screens, logic, and the live API contract",
     from_jest(TMP / "app.json")),
    ("Backend", "The rules a one-time code has to hold",
     from_junit(TMP / "backend.xml", lambda c: Path(c).name or "otp.test.ts")),
]

total = sum(len(c) for _, _, c in suites)
failed = sum(1 for _, _, cs in suites for c in cs if not c[2])
when = datetime.now(timezone.utc).astimezone().strftime("%d %B %Y, %H:%M")

def esc(s):
    return html.escape(str(s))

rows = []
for title, blurb, cases in suites:
    by_file: dict[str, list] = {}
    for f, name, ok, secs, msg in cases:
        by_file.setdefault(f, []).append((name, ok, secs, msg))
    n_ok = sum(1 for c in cases if c[2])
    rows.append(f"""
    <section>
      <h2>{esc(title)} <span class="count">{n_ok}/{len(cases)}</span></h2>
      <p class="blurb">{esc(blurb)}</p>""")
    for f, items in sorted(by_file.items()):
        rows.append(f'      <h3>{esc(f)}</h3>\n      <ul>')
        for name, ok, secs, msg in items:
            mark = "pass" if ok else "fail"
            detail = f'<pre>{esc(msg[:800])}</pre>' if not ok and msg else ""
            rows.append(
                f'        <li class="{mark}"><span class="dot"></span>'
                f'<span class="name">{esc(name)}</span>'
                f'<span class="secs">{secs:.2f}s</span>{detail}</li>')
        rows.append("      </ul>")
    rows.append("    </section>")

verdict = "All tests passed" if failed == 0 else f"{failed} of {total} failed"
HTML.write_text(f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>LUMEN — test report</title>
<style>
  :root {{ --ink:#111827; --muted:#6b7280; --line:#e5e7eb; --ok:#15803d; --bad:#b91c1c; --bg:#fff; }}
  * {{ box-sizing:border-box; }}
  body {{ margin:0; padding:48px 40px; background:var(--bg); color:var(--ink);
         font:15px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }}
  .wrap {{ max-width:860px; margin:0 auto; }}
  header {{ border-bottom:2px solid var(--ink); padding-bottom:20px; margin-bottom:8px; }}
  h1 {{ margin:0; font-size:27px; letter-spacing:-.02em; }}
  .sub {{ color:var(--muted); margin-top:6px; font-size:13.5px; }}
  .totals {{ display:flex; gap:36px; margin:26px 0 30px; }}
  .totals div span {{ display:block; }}
  .big {{ font-size:32px; font-weight:700; letter-spacing:-.02em; }}
  .lbl {{ font-size:11px; letter-spacing:.09em; text-transform:uppercase; color:var(--muted); }}
  .ok {{ color:var(--ok); }} .bad {{ color:var(--bad); }}
  section {{ margin:0 0 34px; }}
  h2 {{ font-size:18px; margin:0 0 2px; display:flex; align-items:baseline; gap:10px;
        break-after:avoid; }}
  .count {{ font-size:13px; font-weight:600; color:var(--muted); }}
  .blurb {{ color:var(--muted); margin:0 0 14px; font-size:13.5px; }}
  h3 {{ font-size:12px; letter-spacing:.06em; text-transform:uppercase; color:var(--muted);
        margin:18px 0 7px; font-weight:600; break-after:avoid; }}
  ul {{ list-style:none; margin:0; padding:0; }}
  li {{ display:flex; align-items:baseline; gap:10px; padding:5px 0;
        border-bottom:1px solid var(--line); flex-wrap:wrap; }}
  .dot {{ width:7px; height:7px; border-radius:50%; background:var(--ok); flex:none; }}
  li.fail .dot {{ background:var(--bad); }}
  li.fail .name {{ color:var(--bad); font-weight:600; }}
  .name {{ flex:1; }}
  .secs {{ color:var(--muted); font-size:12px; font-variant-numeric:tabular-nums; }}
  pre {{ flex-basis:100%; background:#fef2f2; color:var(--bad); padding:10px 12px;
         border-radius:6px; font-size:12px; overflow-x:auto; margin:8px 0 4px; }}
  footer {{ margin-top:40px; padding-top:16px; border-top:1px solid var(--line);
            color:var(--muted); font-size:12.5px; }}
  @media print {{ body {{ padding:0; }} li {{ break-inside:avoid; }} }}
</style></head><body><div class="wrap">
<header>
  <h1>LUMEN — test report</h1>
  <div class="sub">AI-assisted civic damage reporting · generated {esc(when)}</div>
</header>
<div class="totals">
  <div><span class="big">{total}</span><span class="lbl">Tests</span></div>
  <div><span class="big ok">{total - failed}</span><span class="lbl">Passed</span></div>
  <div><span class="big {'bad' if failed else ''}">{failed}</span><span class="lbl">Failed</span></div>
  <div><span class="big {'ok' if not failed else 'bad'}" style="font-size:19px;padding-top:11px">{esc(verdict)}</span><span class="lbl">Result</span></div>
</div>
{chr(10).join(rows)}
<footer>
  The website suite runs against the live deployment at
  140-238-246-75.sslip.io, so it tests what is actually deployed rather than
  a local copy. The app's contract tests call that same deployment.
  Regenerate with <code>python3 tests/make-report.py</code>.
</footer>
</div></body></html>""")

# Printed by the same Chrome the browser tests drive, so the PDF matches the
# page exactly and nothing extra has to be installed.
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
if not Path(CHROME).exists():
    sys.exit(f"Chrome not found at {CHROME} — cannot render the PDF.\n"
             f"The page is at {HTML}; open it and print to PDF.")

print("Printing to PDF…")
subprocess.run([
    CHROME, "--headless", "--disable-gpu", "--no-sandbox",
    "--no-pdf-header-footer",
    f"--print-to-pdf={PDF}", HTML.as_uri(),
], capture_output=True, text=True, timeout=120)

if not PDF.exists():
    sys.exit(f"Chrome did not produce a PDF. The page is at {HTML}.")

if "--html" not in sys.argv:
    HTML.unlink()

print(f"\n{total} tests, {total - failed} passed, {failed} failed")
print(f"Report: {PDF}  ({PDF.stat().st_size // 1024} KB)")
if "--open" in sys.argv:
    subprocess.run(["open", str(PDF)])
