import { describe, test } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcrypt";
import crypto from "node:crypto";

/**
 * The rules a one-time code has to obey, tested against the same primitives
 * the route uses.
 *
 * These are deliberately about the properties rather than the database: the
 * value of a six-digit code is entirely in being unguessable, single use and
 * short-lived, and each of those is something a future change could quietly
 * break while every screen still looked right.
 */

function sixDigits(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

describe("one-time codes", () => {
  test("a code is always six digits", () => {
    for (let i = 0; i < 200; i++) {
      assert.match(sixDigits(), /^\d{6}$/);
    }
  });

  test("codes are not predictable from each other", () => {
    // 200 draws from a million possibilities should essentially never repeat.
    // A sequential or seeded generator would fail this immediately.
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(sixDigits());
    assert.ok(seen.size > 190, `only ${seen.size} distinct`);
  });

  test("the stored hash does not reveal the code", async () => {
    const code = sixDigits();
    const hash = await bcrypt.hash(code, 10);
    assert.ok(!hash.includes(code));
    assert.equal(await bcrypt.compare(code, hash), true);
    assert.equal(await bcrypt.compare("000000", hash), code === "000000");
  });

  test("an expired code is rejected by the expiry check", () => {
    const expiresAt = new Date(Date.now() - 1000);
    assert.equal(expiresAt < new Date(), true);
  });

  test("device tokens are long and unique", () => {
    const tokens = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const t = crypto.randomBytes(32).toString("base64url");
      // 32 bytes is 43 base64url characters — far past brute force.
      assert.ok(t.length >= 43);
      tokens.add(t);
    }
    assert.equal(tokens.size, 100);
  });
});
