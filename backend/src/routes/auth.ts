import bcrypt from "bcrypt";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "../lib/db.js";
import { signSession, COOKIE, requireAuth } from "../lib/auth.js";
import { issueOtp, verifyOtp, deviceToken } from "../lib/otp.js";
import { ROLE_LABELS } from "../lib/rbac.js";

const router = Router();

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = await db.user.findUnique({ where: { email } });
  // bcrypt.compare is deliberately slow and constant-time, so a wrong password
  // costs the same as a right one — no timing signal, and a leaked database
  // does not hand over usable credentials.
  //
  // An account created through Google has no hash to compare against, and is
  // refused here with the same wording as a wrong password. Saying "this
  // address uses Google" would confirm the address exists to anyone guessing.
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials. Use one of the demo accounts." });
  }

  const session = { sub: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId };
  const token = await signSession(session);

  await db.auditLog.create({
    data: {
      actor: user.name, actorRole: user.role, action: "LOGIN_SUCCESS",
      module: "Authentication", target: user.email,
      details: `${ROLE_LABELS[user.role] ?? user.role} signed in`,
    },
  });

  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 * 1000 });
  // The mobile app cannot read the cookie, so it asks for the token in the
  // body and stores it itself. Only returned when explicitly requested: the
  // web app never asks, so its session stays in the httpOnly cookie where a
  // cross-site script cannot reach it.
  const wantsToken = String(req.body?.client ?? "") === "mobile";
  res.json(wantsToken ? { user: session, token } : { user: session });
});

/**
 * Public sign-up. Creates a CITIZEN account and signs it in.
 *
 * The role is hardcoded rather than read from the request: a public endpoint
 * that lets the caller pick their own role is an account-takeover waiting to
 * happen. Staff accounts are created by seeding, never here.
 */
router.post("/register", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const name = String(req.body?.name ?? "").trim();

  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  if (await db.user.findUnique({ where: { email } }))
    return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });

  const user = await db.user.create({
    data: {
      email, name, role: "CITIZEN",
      // Cost 10, the same as the seeded accounts. Never store the password.
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  const session = { sub: user.id, email: user.email, name: user.name, role: user.role, departmentId: null };
  const token = await signSession(session);

  await db.auditLog.create({
    data: {
      actor: user.name, actorRole: user.role, action: "CITIZEN_REGISTERED",
      module: "Authentication", target: user.email, details: "Citizen account created",
    },
  });

  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 * 1000 });
  // Same rule as sign-in: the token is handed back only to a client that
  // cannot use the cookie. See the note there.
  const wantsToken = String(req.body?.client ?? "") === "mobile";
  res.status(201).json(wantsToken ? { user: session, token } : { user: session });
});

/**
 * Sign in with Google.
 *
 * The client runs the OAuth flow itself and sends the resulting ID token here.
 * That token is a JWT signed by Google, so the server can establish who this
 * is without ever holding the user's Google password — which is the whole
 * point of doing it this way rather than asking for one.
 *
 * Verification is the security boundary and all four checks matter:
 *
 *   signature  against Google's published keys, so the token is not forged
 *   issuer     accounts.google.com, so another provider's token is not accepted
 *   audience   our own client ids, so a token minted for a *different* app
 *              cannot be replayed here — this is the check that is easy to
 *              skip and the one that makes skipping it a vulnerability
 *   expiry     enforced by jwtVerify, so a stolen old token is worthless
 *
 * A verified email is also required. Google will assert an address it has not
 * confirmed, and treating one as proof of identity would let someone claim an
 * account belonging to that address.
 */
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));

/** Every client id we mint tokens for: web, Android, iOS. */
const GOOGLE_AUDIENCES = (process.env.GOOGLE_CLIENT_IDS ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

router.post("/google", async (req, res) => {
  const idToken = String(req.body?.idToken ?? "").trim();
  if (!idToken) return res.status(400).json({ error: "Missing Google credential." });
  if (!GOOGLE_AUDIENCES.length) {
    // Refusing loudly beats verifying against an empty audience list, which
    // would accept a token minted for anybody's app.
    return res.status(503).json({ error: "Google sign-in is not configured on this server." });
  }

  let claims: { sub?: string; email?: string; email_verified?: boolean | string; name?: string };
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: GOOGLE_ISSUERS,
      audience: GOOGLE_AUDIENCES,
    });
    claims = payload as typeof claims;
  } catch {
    return res.status(401).json({ error: "That Google sign-in could not be verified." });
  }

  const googleId = String(claims.sub ?? "");
  const email = String(claims.email ?? "").trim().toLowerCase();
  // Google sends this as a boolean over the wire and as the string "true" in
  // some flows, so both are accepted and nothing else is.
  const verified = claims.email_verified === true || claims.email_verified === "true";
  if (!googleId || !email || !verified) {
    return res.status(401).json({ error: "That Google account has no verified email address." });
  }

  // Matched on the subject first, then on the address. The second case is a
  // citizen who registered with a password and is now using the Google button
  // with the same address: it is the same person and the same inbox, so the
  // accounts are linked rather than duplicated. Their password keeps working.
  let user = await db.user.findUnique({ where: { googleId } });
  let created = false;
  if (!user) {
    const byEmail = await db.user.findUnique({ where: { email } });
    if (byEmail) {
      user = await db.user.update({ where: { id: byEmail.id }, data: { googleId } });
    } else {
      // CITIZEN, hardcoded, for the same reason /register hardcodes it: a
      // public endpoint that lets the caller choose a role is an account
      // takeover waiting to happen. Staff accounts come from seeding.
      user = await db.user.create({
        data: { email, googleId, name: String(claims.name ?? "").trim() || email.split("@")[0], role: "CITIZEN" },
      });
      created = true;
    }
  }

  const session = {
    sub: user.id, email: user.email, name: user.name,
    role: user.role, departmentId: user.departmentId,
  };
  const token = await signSession(session);

  await db.auditLog.create({
    data: {
      actor: user.name, actorRole: user.role,
      action: created ? "CITIZEN_REGISTERED" : "LOGIN_SUCCESS",
      module: "Authentication", target: user.email,
      details: created ? "Citizen account created with Google" : "Signed in with Google",
    },
  });

  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 * 1000 });
  const wantsToken = String(req.body?.client ?? "") === "mobile";
  res.status(created ? 201 : 200).json(wantsToken ? { user: session, token } : { user: session });
});

router.post("/logout", async (req, res) => {
  if (req.session) {
    await db.auditLog.create({
      data: {
        actor: req.session.name, actorRole: req.session.role, action: "LOGOUT",
        module: "Authentication", target: req.session.email, details: "User signed out",
      },
    });
  }
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.session });
});

/* ------------------------------------------------------------------ *
 * One-time codes: proving an address, and resetting a password.
 * ------------------------------------------------------------------ */

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Ask for a code.
 *
 * Always answers the same way whether or not the address has an account. A
 * different response for an unknown address turns this into a way to test
 * which email addresses are registered, which is exactly what someone
 * preparing a credential-stuffing run wants.
 */
router.post("/otp/request", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const purpose = String(req.body?.purpose ?? "VERIFY_EMAIL").toUpperCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (purpose !== "VERIFY_EMAIL" && purpose !== "RESET_PASSWORD") {
    return res.status(400).json({ error: "Unsupported purpose." });
  }

  const user = await db.user.findUnique({ where: { email } });
  const result = await issueOtp({
    userId: user?.id ?? null,
    purpose: purpose as "VERIFY_EMAIL" | "RESET_PASSWORD",
    channel: "EMAIL",
    destination: email,
  });
  if (!result.ok) return res.status(429).json({ error: result.error });

  res.json({
    ok: true,
    expiresAt: result.expiresAt,
    // Present only for an address the deployment has explicitly listed as
    // allowed to see its own code, so the flow can be shown before a mail
    // provider exists. Absent for everyone else.
    ...(result.code ? { devCode: result.code } : {}),
  });
});

/** Check a code without spending it on anything else. */
router.post("/otp/verify", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  const purpose = String(req.body?.purpose ?? "VERIFY_EMAIL").toUpperCase();
  if (!email || !code) return res.status(400).json({ error: "Email and code are required." });

  const result = await verifyOtp({
    purpose: purpose as "VERIFY_EMAIL" | "RESET_PASSWORD",
    destination: email,
    code,
  });
  if (!result.ok) return res.status(400).json({ error: result.error });

  if (purpose === "VERIFY_EMAIL" && result.userId) {
    await db.user.update({ where: { id: result.userId }, data: { emailVerifiedAt: new Date() } });
  }
  res.json({ ok: true });
});

/** Named for what the user is doing. Same machinery, purpose fixed. */
router.post("/email/verify", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  if (!email || !code) return res.status(400).json({ error: "Email and code are required." });

  const result = await verifyOtp({ purpose: "VERIFY_EMAIL", destination: email, code });
  if (!result.ok) return res.status(400).json({ error: result.error });
  if (result.userId) {
    await db.user.update({ where: { id: result.userId }, data: { emailVerifiedAt: new Date() } });
  }
  res.json({ ok: true });
});

/**
 * Start a password reset.
 *
 * Returns ok even for an address with no account, for the reason above. The
 * user who typed their address wrongly learns nothing either way, which is the
 * cost of not leaking the ones that are right.
 */
router.post("/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return res.status(400).json({ error: "Enter a valid email address." });

  const user = await db.user.findUnique({ where: { email } });
  const result = await issueOtp({
    userId: user?.id ?? null,
    purpose: "RESET_PASSWORD",
    channel: "EMAIL",
    destination: email,
  });
  if (!result.ok) return res.status(429).json({ error: result.error });

  res.json({
    ok: true,
    message: "If that address has an account, a code is on its way.",
    ...(result.code ? { devCode: result.code } : {}),
  });
});

/** Finish a password reset: code in, new password set, every device signed out. */
router.post("/reset-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const code = String(req.body?.code ?? "").trim();
  const password = String(req.body?.password ?? "");
  if (!email || !code) return res.status(400).json({ error: "Email and code are required." });
  if (password.length < 8) {
    return res.status(400).json({ error: "Choose a password of at least 8 characters." });
  }

  const result = await verifyOtp({ purpose: "RESET_PASSWORD", destination: email, code });
  if (!result.ok) return res.status(400).json({ error: result.error });

  const user = result.userId
    ? await db.user.findUnique({ where: { id: result.userId } })
    : await db.user.findUnique({ where: { email } });
  // A valid code with no account behind it means the address was never
  // registered. Nothing to reset, and still nothing to disclose.
  if (!user) return res.json({ ok: true });

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  // Whoever reset the password may be recovering from someone else having it.
  // Enrolled devices are revoked so an attacker's phone stops being a key.
  await db.biometricCredential.deleteMany({ where: { userId: user.id } });

  await db.auditLog.create({
    data: {
      actor: user.name, actorRole: user.role, action: "PASSWORD_RESET",
      module: "Authentication", target: user.email,
      details: "Password reset with a one-time code; enrolled devices revoked",
    },
  });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------ *
 * Biometric sign-in.
 *
 * The fingerprint never leaves the phone and is never sent here. The device
 * stores a random token behind its own biometric gate and presents it; this
 * server only ever learns that the gate opened. That is the strongest honest
 * claim a server can make about a fingerprint it cannot see.
 * ------------------------------------------------------------------ */

router.post("/biometric/enable", requireAuth, async (req, res) => {
  const deviceId = String(req.body?.deviceId ?? "").trim();
  if (!deviceId) return res.status(400).json({ error: "A device id is required." });

  const token = deviceToken();
  const data = {
    userId: req.session!.sub,
    tokenHash: await bcrypt.hash(token, 10),
    label: String(req.body?.label ?? "").trim() || null,
    platform: String(req.body?.platform ?? "").trim() || null,
  };
  // Re-enrolling replaces the row rather than adding a second one, so a device
  // always has exactly one credential and revoking it revokes everything.
  await db.biometricCredential.upsert({
    where: { deviceId },
    create: { deviceId, ...data },
    update: { ...data, lastUsedAt: null },
  });

  // Returned once and never again: the hash is all that is kept.
  res.json({ ok: true, deviceToken: token });
});

router.post("/biometric/login", async (req, res) => {
  const deviceId = String(req.body?.deviceId ?? "").trim();
  const token = String(req.body?.deviceToken ?? "");
  if (!deviceId || !token) return res.status(400).json({ error: "Device not enrolled." });

  const cred = await db.biometricCredential.findUnique({
    where: { deviceId }, include: { user: true },
  });
  if (!cred || !(await bcrypt.compare(token, cred.tokenHash))) {
    return res.status(401).json({ error: "Device not enrolled." });
  }

  const u = cred.user;
  const session = {
    sub: u.id, email: u.email, name: u.name, role: u.role, departmentId: u.departmentId,
  };
  const sessionToken = await signSession(session);
  await db.biometricCredential.update({
    where: { id: cred.id }, data: { lastUsedAt: new Date() },
  });
  await db.auditLog.create({
    data: {
      actor: u.name, actorRole: u.role, action: "LOGIN_SUCCESS",
      module: "Authentication", target: u.email, details: "Signed in with a biometric device",
    },
  });

  res.cookie(COOKIE, sessionToken, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 * 1000 });
  const wantsToken = String(req.body?.client ?? "") === "mobile";
  res.json(wantsToken ? { user: session, token: sessionToken } : { user: session });
});

/** The devices on this account, so a user can see and revoke them. */
router.get("/biometric", requireAuth, async (req, res) => {
  const devices = await db.biometricCredential.findMany({
    where: { userId: req.session!.sub },
    orderBy: { createdAt: "desc" },
    select: { deviceId: true, label: true, platform: true, createdAt: true, lastUsedAt: true },
  });
  res.json({ devices });
});

router.delete("/biometric/:deviceId", requireAuth, async (req, res) => {
  // Scoped to the caller's own id: without that, knowing a device id would be
  // enough to sign someone else's phone out.
  await db.biometricCredential.deleteMany({
    where: { deviceId: req.params.deviceId, userId: req.session!.sub },
  });
  res.json({ ok: true });
});

export default router;
