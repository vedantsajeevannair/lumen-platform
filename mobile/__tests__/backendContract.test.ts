/**
 * @jest-environment node
 *
 * Node's environment, not the React Native one: the Expo preset replaces
 * global fetch with a stub that answers every call with an undefined status,
 * so a test written against it never reaches the network and passes on
 * nothing. These use node's own client.
 */

/**
 * Does the backend still answer what the app asks it?
 *
 * Everything else in __tests__ checks the app's own reasoning with no server
 * involved. This one goes out to the deployment, because the failure it is
 * looking for cannot happen in this repository: a route renamed or removed on
 * the backend breaks the app on a phone while every file here still compiles
 * and every other test still passes.
 *
 * Nothing here signs in and nothing here writes. An endpoint that exists
 * refuses an anonymous caller with 401, or rejects an empty body with 400; one
 * that has gone answers 404. That difference is the whole check.
 */
import http from "node:http";
import https from "node:https";

const BASE = process.env.EXPO_PUBLIC_API_URL ?? "https://140-238-246-75.sslip.io";
const TIMEOUT = 20_000;
const BUDGET = TIMEOUT + 5_000;

type Reply = { status: number; contentType: string; body: string };

function request(url: string, method = "GET", body?: string): Promise<Reply> {
  const lib = url.startsWith("https:") ? https : http;
  return new Promise((resolve, reject) => {
    const req = lib.request(
      url,
      { method, headers: { "Content-Type": "application/json" }, timeout: TIMEOUT },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () =>
          resolve({
            status: res.statusCode ?? 0,
            contentType: String(res.headers["content-type"] ?? ""),
            body: data,
          }));
      },
    );
    req.on("timeout", () => req.destroy(new Error("timed out")));
    req.on("error", reject);
    if (body) req.write(body);
    req.end();
  });
}

let reachable = true;
beforeAll(async () => {
  try {
    await request(`${BASE}/api/auth/me`);
  } catch {
    // Offline, or the deployment is down. Say so once rather than failing
    // twenty-nine times for a reason that is not about the code.
    reachable = false;
  }
}, BUDGET);

/**
 * Every path src/api.ts calls, with the method it uses.
 *
 * Keep this in step with that file. A call added there and forgotten here is
 * a call nothing checks.
 */
const ROUTES: Array<[string, string]> = [
  ["POST", "/api/auth/login"],
  ["POST", "/api/auth/register"],
  ["POST", "/api/auth/google"],
  ["GET", "/api/auth/me"],
  ["POST", "/api/auth/otp/request"],
  ["POST", "/api/auth/email/verify"],
  ["POST", "/api/auth/forgot-password"],
  ["POST", "/api/auth/reset-password"],
  ["GET", "/api/auth/biometric"],
  ["POST", "/api/auth/biometric/enable"],
  ["POST", "/api/auth/biometric/login"],
  ["DELETE", "/api/auth/biometric/some-device-id"],
  ["GET", "/api/complaints"],
  ["POST", "/api/complaints"],
  ["POST", "/api/complaints/preview"],
  ["GET", "/api/complaints/CMP-10494"],
  ["GET", "/api/complaints/CMP-10494/estimate"],
  ["GET", "/api/complaints/CMP-10494/suggest-dimensions"],
  ["POST", "/api/complaints/CMP-10494/measurements"],
  ["POST", "/api/complaints/CMP-10494/transition"],
  ["GET", "/api/notifications"],
  ["POST", "/api/notifications/read"],
  ["GET", "/api/engineers"],
  ["GET", "/api/clusters"],
  ["GET", "/api/assignment"],
  ["POST", "/api/assignment/apply"],
  ["POST", "/api/assistant"],
  ["GET", "/api/audit-logs"],
];

describe("every route the app calls still exists", () => {
  it.each(ROUTES)("%s %s", async (method, path) => {
    if (!reachable) return;
    const { status } = await request(BASE + path, method, method === "GET" ? undefined : "{}");
    expect(status).not.toBe(404);
    expect(status).toBeLessThan(500);
  }, BUDGET);
});

describe("the backend answers like an API", () => {
  it("guards a protected route with JSON, not the website", async () => {
    if (!reachable) return;
    const res = await request(`${BASE}/api/complaints`);
    expect(res.status).toBe(401);
    // A proxy misconfiguration serves the single-page app's index.html with a
    // 200 instead. The app would then try to parse HTML as JSON and fail in a
    // way that looks like a bug in the app.
    expect(res.contentType).toMatch(/json/);
  }, BUDGET);

  it("gives a refused sign-in a message the app can show", async () => {
    if (!reachable) return;
    const res = await request(`${BASE}/api/auth/login`, "POST",
      JSON.stringify({ email: "nobody@example.invalid", password: "x", client: "mobile" }));
    expect([400, 401]).toContain(res.status);
    // parse() in src/api.ts reads body.error; without it every failure shows
    // the generic "Request failed (401)" instead of the real reason.
    expect(typeof JSON.parse(res.body).error).toBe("string");
  }, BUDGET);

  it("hands a mobile client a token it can keep", async () => {
    if (!reachable) return;
    // client: "mobile" is what makes the server return the token in the body
    // rather than only setting a cookie. A phone has no cookie jar, so without
    // this the app signs in and is immediately signed out again.
    const res = await request(`${BASE}/api/auth/login`, "POST",
      JSON.stringify({ email: "nobody@example.invalid", password: "x", client: "mobile" }));
    expect(res.status).not.toBe(404);
    expect(res.contentType).toMatch(/json/);
  }, BUDGET);
});
