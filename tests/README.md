# Tests

Everything that checks LUMEN, and how to run it.

```bash
./tests/run-all.sh
```

That runs all three suites and prints one summary. To watch the browser
actually click through the site instead of running it hidden:

```bash
./tests/run-all.sh --watch
```

## What there is

| Suite | Count | Where | What it drives |
|---|---|---|---|
| Website | 23 | `tests/selenium/` | Real Chrome against the live deployment |
| App | 177 | `mobile/__tests__/` | Screens, logic, and the live API contract |
| Backend | 5 | `backend/__tests__/` | One-time-code rules |

**205 tests.**

### Why they are not all in this folder

Only the browser tests live here. The other two sit beside the code they
test, because that is where jest looks for them and because they import it
by relative path — moving them would mean rewriting both the configuration
and every import for no gain. `run-all.sh` is the single entry point
instead, so there is one command and one answer even though the files are in
three places.

## The website — `tests/selenium/`

| File | Covers |
|---|---|
| `test_public_site.py` | Landing page and its claims, the four public routes, the staff login page, and the Android download |
| `test_staff_console.py` | A refused password, signing in, the dashboard, the complaint list, complaint detail with the detector's annotated photograph, and the GIS map drawing tiles |
| `test_console_pages.py` | The other eight console pages, each asserting on real data |

These run against `https://140-238-246-75.sslip.io` unless you point them
elsewhere:

```bash
LUMEN_BASE_URL=http://localhost:5173 python3 -m pytest tests/selenium -q
```

They insist on data rather than on a page having rendered. The budget planner
has to fund more than zero repairs, the optimiser has to propose more than
zero assignments, the engineer list has to contain `ENG-####` codes. A page
that loads but shows nothing is what a broken endpoint looks like, and that
is the failure worth catching.

## The app — `mobile/__tests__/`

`LoginScreen`, `ReportScreen` and `DetailScreen` are rendered and driven the
way a person drives them — typed into, pressed, read back.
`backendContract.test.ts` goes out to the live deployment and asks for all 28
paths the app calls: one that exists refuses an anonymous caller, one that has
gone answers 404. The rest are the app's own reasoning — severity, routing,
offline queueing, formatting, the repair workflow.

```bash
cd mobile && npm test
```

## The backend — `backend/__tests__/`

The properties a one-time code has to hold: six digits, unguessable, hashed
before storage, single use, expiring.

```bash
cd backend && npm test
```

## Two traps worth knowing

**The browser tests sign in to the live system**, which writes an audit row
each time. `test_console_pages.py` shares one browser across the file for
that reason — eleven pages should not leave eleven sign-ins behind.

**In the app tests, `render` and `fireEvent` are asynchronous** under React
19. A missing `await` does not fail where you wrote it: it leaves an `act()`
scope open and the *next* screen in the file renders as an empty shell whose
every query fails for no visible reason. Await all of them.
