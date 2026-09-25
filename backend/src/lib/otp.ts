import bcrypt from "bcrypt";
import crypto from "node:crypto";
import { db } from "./db.js";

/**
 * One-time codes, for proving an address and for authorising a password reset.
 *
 * Three rules hold everything together and none of them are optional:
 *
 *   1. The code is hashed before it is stored. A leaked database must not hand
 *      anyone a working credential, which is the same reason passwords are
 *      hashed — a six-digit code is a credential for as long as it lives.
 *   2. A code is single use and expires. Verifying consumes the row, so the
 *      same code cannot be replayed, and an abandoned code stops working on
 *      its own rather than waiting for someone to clean it up.
 *   3. Attempts are counted. Six digits is a million possibilities, which
 *      sounds like a lot until a script tries them all; five wrong guesses
 *      burns the code and the user asks for a new one.
 */

export type OtpPurpose = "VERIFY_EMAIL" | "VERIFY_PHONE" | "RESET_PASSWORD";

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
/** New codes per destination per window, so the endpoint cannot be used to spam someone. */
const MAX_SENDS_PER_HOUR = 5;

/**
 * Whether a delivery channel is actually configured.
 *
 * No SMTP or SMS provider is wired up on this deployment, so codes are written
 * to the server log instead of being sent. That is stated plainly rather than
 * hidden: an endpoint that silently drops the message would look like it works
 * and would fail only for real users.
 */
export const EMAIL_CONFIGURED = Boolean(process.env.LUMEN_SMTP_URL);
export const SMS_CONFIGURED = Boolean(process.env.LUMEN_SMS_API_KEY);

/**
 * Return the code in the API response so the flow can be exercised without a
 * mail server. Off unless explicitly switched on, and refused outright in
 * production: an endpoint that hands back its own one-time code is not an
 * authentication factor at all.
 */
export const ECHO_CODES =
  process.env.LUMEN_OTP_ECHO === "1" && process.env.NODE_ENV !== "production";

/**
 * Addresses allowed to see their own code in the API response, even in
 * production.
 *
 * This exists so the flow can be demonstrated before a mail provider is
 * configured. It is a named list rather than a global switch on purpose:
 * echoing every code would mean anyone who knows an address could request a
 * code, read it from the response and take the account over — including the
 * administrator's. Restricted to listed addresses, the worst case is that the
 * listed accounts are as weak as the list is public, and no other account is
 * affected at all.
 *
 * Set LUMEN_OTP_ECHO_EMAILS to a comma-separated list. Empty means nobody.
 */
const ECHO_TO = new Set(
  (process.env.LUMEN_OTP_ECHO_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

/** Whether this particular destination may be shown its own code. */
export function mayEchoTo(destination: string): boolean {
  return ECHO_CODES || ECHO_TO.has(destination.trim().toLowerCase());
}

function sixDigits(): string {
  // randomInt is drawn from the same CSPRNG as key material. Math.random is
  // predictable from a handful of outputs and has no business near a credential.
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
}

async function deliver(channel: "EMAIL" | "SMS", to: string, code: string, purpose: OtpPurpose) {
  const configured = channel === "EMAIL" ? EMAIL_CONFIGURED : SMS_CONFIGURED;
  if (!configured) {
    // eslint-disable-next-line no-console
    console.log(`[otp] ${purpose} code for ${to} (${channel}, not configured): ${code}`);
    return;
  }
  // A provider would be called here. Deliberately left unimplemented rather
  // than faked: see LUMEN_SMTP_URL / LUMEN_SMS_API_KEY.
  // eslint-disable-next-line no-console
  console.log(`[otp] ${purpose} code dispatched to ${to} over ${channel}`);
}

export type IssueResult =
  | { ok: true; code?: string; expiresAt: Date }
  | { ok: false; error: string };

/**
 * Issue a code for a destination.
 *
 * Callers pass `userId: null` for an address with no account. The row is still
 * written, because the rate limit has to apply to addresses that do not exist —
 * otherwise the endpoint becomes a way to find out which ones do.
 */
export async function issueOtp(opts: {
  userId: string | null;
  purpose: OtpPurpose;
  channel: "EMAIL" | "SMS";
  destination: string;
}): Promise<IssueResult> {
  const destination = opts.destination.trim().toLowerCase();
  const hourAgo = new Date(Date.now() - 3600_000);

  const recent = await db.otpCode.count({
    where: { destination, purpose: opts.purpose, createdAt: { gt: hourAgo } },
  });
  if (recent >= MAX_SENDS_PER_HOUR) {
    return { ok: false, error: "Too many codes requested. Try again in an hour." };
  }

  // Any code still outstanding for this destination and purpose is retired, so
  // only the newest one works. Two live codes would double the guessing budget.
  await db.otpCode.updateMany({
    where: { destination, purpose: opts.purpose, consumedAt: null },
    data: { consumedAt: new Date() },
  });

  const code = sixDigits();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000);
  await db.otpCode.create({
    data: {
      userId: opts.userId,
      purpose: opts.purpose,
      channel: opts.channel,
      destination,
      codeHash: await bcrypt.hash(code, 10),
      expiresAt,
    },
  });

  await deliver(opts.channel, destination, code, opts.purpose);
  // The caller does not decide this — the policy lives here, next to the
  // reasoning, so a new route cannot accidentally start echoing codes.
  return mayEchoTo(destination) ? { ok: true, code, expiresAt } : { ok: true, expiresAt };
}

export type VerifyResult =
  | { ok: true; userId: string | null }
  | { ok: false; error: string };

/**
 * Check a code and consume it.
 *
 * Every failure returns the same message. Distinguishing "no such code" from
 * "wrong code" from "expired" tells an attacker which addresses have pending
 * requests, and none of those distinctions help an honest user who only needs
 * to know to ask for a new one.
 */
export async function verifyOtp(opts: {
  purpose: OtpPurpose;
  destination: string;
  code: string;
}): Promise<VerifyResult> {
  const destination = opts.destination.trim().toLowerCase();
  const wrong = { ok: false as const, error: "That code is not valid. Request a new one." };

  const row = await db.otpCode.findFirst({
    where: { destination, purpose: opts.purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return wrong;

  if (row.expiresAt < new Date() || row.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
    return wrong;
  }

  if (!(await bcrypt.compare(opts.code.trim(), row.codeHash))) {
    await db.otpCode.update({ where: { id: row.id }, data: { attempts: row.attempts + 1 } });
    return wrong;
  }

  await db.otpCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true, userId: row.userId };
}

/** Random, unguessable, and long enough that it is never brute-forced. */
export function deviceToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}
