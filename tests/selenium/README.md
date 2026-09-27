# Browser tests

Selenium tests that drive the deployed LUMEN website in a real Chrome and check
it does what it claims. They run against the live Oracle deployment by default,
so they test the thing users actually get — TLS, nginx, the built frontend and
the API behind it — rather than a dev server.

## Running them

```bash
pip install selenium pytest
python3 -m pytest tests/selenium -q
```

Watch it happen in a visible window:

```bash
HEADLESS=0 python3 -m pytest tests/selenium -q
```

Point them somewhere else (a local `npm run dev`, say):

```bash
LUMEN_BASE_URL=http://localhost:5173 python3 -m pytest tests/selenium -q
```

`LUMEN_STAFF_EMAIL` and `LUMEN_STAFF_PASSWORD` override the demo supervisor
account the console tests sign in with.

## What is covered

`test_public_site.py` — the pages anyone can reach: the landing page and its
claims, the four public routes, the staff login page, and the Android download.

`test_staff_console.py` — signing in and the console behind it: a wrong password
is refused, the dashboard reports non-zero figures, the complaint list and
detail load, the detail page shows the detector's annotated photograph, the GIS
map draws its tiles, and no console page throws a script error.

## Two things worth knowing

The APK test fetches the download with a real HEAD request and checks the status,
the content type and that the body is over 10 MB. An earlier nginx rule matched
only the exact path `/lumen.apk`, so a neighbouring APK URL quietly returned the
1 KB single-page-app shell with a 200. A test that only checked the link's href
would have passed throughout.

The login form arrives with the demo credentials already filled in, and its
inputs are React-controlled, so `element.clear()` does not reach React's state:
the old value returns on the next render and `send_keys` appends to it. That
produced `supervisor@lumen.govsupervisor@lumen.gov`, which the browser refused
to submit with no visible error. `type_into` in `conftest.py` goes through the
native value setter and dispatches the event React listens for. Use it for any
input on this site.
