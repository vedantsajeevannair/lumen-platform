import bcrypt from "bcrypt";
import { Router } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { db } from "../lib/db.js";
import { signSession, COOKIE, requireAuth } from "../lib/auth.js";
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

export default router;
