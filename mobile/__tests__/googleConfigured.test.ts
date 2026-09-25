/**
 * The login screen must not mount the Google button unless a client id exists.
 *
 * This is a regression test for a crash, not a style preference.
 * `useIdTokenAuthRequest` throws — during render — when the client id for the
 * running platform is undefined. Because the hook lived directly in
 * LoginScreen, a build with no ids configured threw on the first screen a
 * signed-out user sees, and the app did not open at all.
 *
 * The guard is therefore load-bearing: `googleConfigured` must be false when
 * nothing is configured, so the component holding the hook is never mounted.
 */

describe("googleConfigured", () => {
  const KEYS = [
    "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID",
    "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID",
    "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID",
  ] as const;

  const saved: Record<string, string | undefined> = {};
  beforeEach(() => {
    jest.resetModules();
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });
  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it("is false when no client id is configured", () => {
    const { googleConfigured } = require("../src/components/GoogleButton");
    expect(googleConfigured).toBe(false);
  });

  it("is true once a platform has an id", () => {
    process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = "123.apps.googleusercontent.com";
    const { googleConfigured } = require("../src/components/GoogleButton");
    expect(googleConfigured).toBe(true);
  });

  it("does not treat an empty string as configured", () => {
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = "";
    const { googleConfigured } = require("../src/components/GoogleButton");
    expect(googleConfigured).toBe(false);
  });
});
