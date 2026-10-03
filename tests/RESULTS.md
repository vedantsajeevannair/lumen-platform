# Results — 3 October 2026

Both suites run against the deployed system: the website in a real Chrome,
the app on a OnePlus Nord 4 (Android 16) over wireless adb.

| Suite | Cases | Result |
|---|---|---|
| Website (Selenium) | 19 | **19 passed** |
| Android (Appium)   | 24 | **24 passed** |

43 test cases, all passing.

## What was wrong with the earlier suite, and what changed

**Website — 3 of 19 failed against a healthy site.** All three typed into the
login form with `send_keys`, which appends rather than replaces: the page
arrives with the demo credentials pre-filled, so it submitted
`supervisor@lumen.govsupervisor@lumen.gov`. One also typed `LUMEN123`, which
the server rejects with 401. Sign-in now goes through React's native value
setter.

**The demo-account locator matched `<html>`.** `contains(., 'supervisor')` is
true of every ancestor, so the click landed on the page rather than the
button. Those tests passed only because the form was already filled in.

**Two files had no assertions** and could not fail. They are now a
wrong-password test — restoring a negative test that had been deleted, its
compiled copy still sitting in `__pycache__` — and a dashboard-figures test.

**Assertions checked headings, not data.** A console whose endpoints have
died renders every heading perfectly. Where a page exists to show numbers the
tests now require numbers: funded repairs > 0, proposed assignments > 0, the
queue carries `CMP-` references, the dashboard is not all zeros.

**A complaint reference was hardcoded.** `CMP-10494` works until that row
ages out; the test now takes whichever reference is on the page.

**Credentials were in the source** — including a personal Gmail password in
four Android files. Everything now comes from the environment.

## What the device turned up

Written from the source, the Android tests were wrong in ways only a real
phone shows:

- An empty `EditText` publishes its placeholder through `@hint`, not `@text`.
- Only the *active* tab renders a label, and the centre button never does, so
  the tab bar cannot be addressed by text at all — it is found by geometry.
- `page_source` carries only what is on screen: a home screen scrolled past
  the greeting looks like a different screen entirely.
- Substring matching is wrong for short labels. "All" also matches the
  heading "ALL REPORTS"; "Sign in" also matches the subtitle "Sign in to
  file, discuss, and track civic issues." Both tapped the wrong thing.
- Pressing back past the first screen lands on the launcher, and the phone's
  own Contacts app has a three-button bottom bar that accepts the taps
  quite happily. Every test now checks the foreground package.
- Google Password Manager covers the login form and swallows taps.
- `hide_keyboard()` is a no-op here and `is_keyboard_shown()` reports False
  while the keyboard is plainly up; BACK closes it. It matters because the
  keyboard pushes the password field out of the visible tree.
- A wireless device's mDNS name can gain a suffix containing a space, which
  breaks any `adb devices` parse that splits on whitespace.
