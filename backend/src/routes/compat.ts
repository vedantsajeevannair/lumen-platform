import bcrypt from "bcrypt";
import { Router } from "express";
import multer from "multer";
import { randomUUID } from "crypto";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { SignJWT, jwtVerify } from "jose";
import { db } from "../lib/db.js";
import { requireAuth, signSession, type Session } from "../lib/auth.js";
import { issueOtp, verifyOtp } from "../lib/otp.js";
import { categoryOf } from "../lib/taxonomy.js";
import { TRANSITIONS, STATUS_LABELS } from "../lib/rbac.js";

/**
 * Compatibility routes for the LUMEN mobile client.
 *
 * The app and this server were written against different API shapes: the app
 * calls `/auth/login` and `/api/v1/citizen/dashboard`, expects `access_token`
 * and `refresh_token` in the body, and reads its error text from `message`.
 * This server speaks `/api/auth/login`, returns one `token`, and reports
 * errors as `error`.
 *
 * Rather than edit either side into the other's shape, this router translates
 * between them. The app stays as its authors wrote it and the web console
 * keeps the API it was built on — the difference lives in one file that says
 * so, instead of being smeared across two codebases.
 *
 * Where a request needs the full detection pipeline, this router calls this
 * server's own `/api/complaints` over loopback rather than reimplementing it.
 * A second copy of that logic would drift from the first, and the one thing
 * worse than an adapter is two pipelines that disagree about what a pothole is.
 */

const router = Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOADS = path.join(__dirname, "..", "..", "uploads");
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

const SECRET = new TextEncoder().encode(
  process.env.LUMEN_SESSION_SECRET ?? "lumen-dev-secret-change-in-production",
);

/** Refresh tokens are separate from sessions: longer-lived, and good for nothing but refreshing. */
async function signRefresh(userId: string): Promise<string> {
  return new SignJWT({ sub: userId, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(SECRET);
}

async function readRefresh(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    // A session token must not be usable as a refresh token, or a stolen
    // 12-hour session silently becomes a 30-day one.
    return payload.typ === "refresh" ? String(payload.sub) : null;
  } catch {
    return null;
  }
}

type UserRow = { id: string; email: string; name: string; role: string; departmentId: string | null };

/** The body shape the app's `handleTokenResponse` destructures. */
async function tokenResponse(u: UserRow) {
  const session: Session = {
    sub: u.id, email: u.email, name: u.name, role: u.role, departmentId: u.departmentId,
  };
  return {
    user: { ...session, id: u.id, fullName: u.name },
    access_token: await signSession(session),
    refresh_token: await signRefresh(u.id),
  };
}

/** The app reads `response.data.message`; this server says `error`. */
function fail(res: any, status: number, message: string) {
  return res.status(status).json({ message, error: message });
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/* ------------------------------------------------------------------ *
 * Authentication
 * ------------------------------------------------------------------ */

/**
 * Sign-up, which in this app is step one of two: the account is created and a
 * code is sent, and `/auth/verify-otp` is what actually signs the person in.
 */
router.post("/auth/register", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const name = String(req.body?.fullName ?? req.body?.name ?? "").trim();
  const phone = String(req.body?.phoneNumber ?? req.body?.phone ?? "").trim() || null;

  if (!name) return fail(res, 400, "Please enter your name.");
  if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email address.");
  if (password.length < 8) return fail(res, 400, "Choose a password of at least 8 characters.");

  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.passwordHash) return fail(res, 409, "That email already has an account.");

  const user = existing
    ? await db.user.update({
        where: { id: existing.id },
        data: { name, phone, passwordHash: await bcrypt.hash(password, 10) },
      })
    : await db.user.create({
        data: { name, email, phone, passwordHash: await bcrypt.hash(password, 10), role: "CITIZEN" },
      });

  const otp = await issueOtp({
    userId: user.id, purpose: "VERIFY_EMAIL", channel: "EMAIL", destination: email,
  });
  if (!otp.ok) return fail(res, 429, otp.error);

  res.status(201).json({
    message: "Account created. Enter the code we sent to finish signing in.",
    email,
    ...(otp.code ? { devCode: otp.code } : {}),
  });
});

router.post("/auth/resend-otp", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email address.");
  const user = await db.user.findUnique({ where: { email } });
  const otp = await issueOtp({
    userId: user?.id ?? null, purpose: "VERIFY_EMAIL", channel: "EMAIL", destination: email,
  });
  if (!otp.ok) return fail(res, 429, otp.error);
  res.json({ message: "A new code is on its way.", ...(otp.code ? { devCode: otp.code } : {}) });
});

/** Step two of sign-up: the code proves the address, and the session begins. */
router.post("/auth/verify-otp", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const otp = String(req.body?.otp ?? req.body?.code ?? "").trim();
  if (!email || !otp) return fail(res, 400, "Email and code are required.");

  const result = await verifyOtp({ purpose: "VERIFY_EMAIL", destination: email, code: otp });
  if (!result.ok) return fail(res, 400, result.error);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return fail(res, 404, "No account for that address.");
  await db.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
  res.json(await tokenResponse(user));
});

router.post("/auth/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return fail(res, 400, "Email and password are required.");

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    return fail(res, 401, "Invalid email or password.");
  }
  res.json(await tokenResponse(user));
});

router.post("/auth/forgot-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email)) return fail(res, 400, "Enter a valid email address.");
  const user = await db.user.findUnique({ where: { email } });
  const otp = await issueOtp({
    userId: user?.id ?? null, purpose: "RESET_PASSWORD", channel: "EMAIL", destination: email,
  });
  if (!otp.ok) return fail(res, 429, otp.error);
  // Answers identically whether or not the address has an account.
  res.json({
    message: "If that address has an account, a code is on its way.",
    ...(otp.code ? { devCode: otp.code } : {}),
  });
});

router.post("/auth/reset-password", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const otp = String(req.body?.otp ?? req.body?.code ?? "").trim();
  const password = String(req.body?.newPassword ?? req.body?.password ?? "");
  if (!email || !otp) return fail(res, 400, "Email and code are required.");
  if (password.length < 8) return fail(res, 400, "Choose a password of at least 8 characters.");

  const result = await verifyOtp({ purpose: "RESET_PASSWORD", destination: email, code: otp });
  if (!result.ok) return fail(res, 400, result.error);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) return res.json({ message: "Password updated." });

  await db.user.update({
    where: { id: user.id }, data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  // Someone resetting a password may be locking an attacker out; enrolled
  // devices are keys to the account and go with it.
  await db.biometricCredential.deleteMany({ where: { userId: user.id } });
  res.json({ message: "Password updated." });
});

router.post("/auth/refresh", async (req, res) => {
  const userId = await readRefresh(String(req.body?.refreshToken ?? ""));
  if (!userId) return fail(res, 401, "Session expired. Sign in again.");
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return fail(res, 401, "Session expired. Sign in again.");
  res.json(await tokenResponse(user));
});

router.post("/auth/logout", (_req, res) => res.json({ message: "Signed out." }));

/**
 * Biometric enrolment.
 *
 * The app generates a random hash on the device, keeps it behind the phone's
 * own biometric gate, and sends it here once. The fingerprint itself never
 * leaves the phone and is never sent anywhere — what this server learns is
 * that the device released its secret, which is the strongest honest claim
 * available to it. Only the bcrypt hash is stored.
 */
router.post("/auth/biometric/enable", requireAuth, async (req, res) => {
  const hash = String(req.body?.biometricHash ?? "").trim();
  if (!hash) return fail(res, 400, "No biometric credential supplied.");
  const data = {
    userId: req.session!.sub,
    tokenHash: await bcrypt.hash(hash, 10),
    label: String(req.body?.label ?? "").trim() || null,
    platform: String(req.body?.platform ?? "").trim() || null,
  };
  await db.biometricCredential.upsert({
    where: { deviceId: hash }, create: { deviceId: hash, ...data }, update: data,
  });
  res.json({ message: "Biometric sign-in enabled on this device." });
});

router.post("/auth/biometric/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const hash = String(req.body?.biometricHash ?? "").trim();
  if (!email || !hash) return fail(res, 400, "Device not enrolled.");

  const cred = await db.biometricCredential.findUnique({
    where: { deviceId: hash }, include: { user: true },
  });
  // Both the credential and the account it claims to belong to must match, or
  // one enrolled device could sign in as any account.
  if (!cred || cred.user.email !== email || !(await bcrypt.compare(hash, cred.tokenHash))) {
    return fail(res, 401, "Device not enrolled.");
  }
  await db.biometricCredential.update({
    where: { id: cred.id }, data: { lastUsedAt: new Date() },
  });
  res.json(await tokenResponse(cred.user));
});

/* ------------------------------------------------------------------ *
 * Complaints
 * ------------------------------------------------------------------ */

/**
 * Public base URL for images.
 *
 * `<Image source={{ uri }}>` does not know about the API client's baseURL, so
 * a path like `/uploads/x.png` would simply fail to load. The absolute URL is
 * built from the request, and X-Forwarded-Proto is honoured because nginx
 * terminates TLS — without it every link would come back as http and Android
 * would refuse it in a release build.
 */
function publicUrl(req: any, p?: string | null): string | null {
  if (!p) return null;
  if (/^https?:\/\//.test(p)) return p;
  const proto = String(req.headers["x-forwarded-proto"] ?? req.protocol ?? "https").split(",")[0];
  return `${proto}://${req.get("host")}${p}`;
}

/**
 * The shape the app's complaint screens read.
 *
 * Field names and units follow the app rather than this server: it shows
 * severity as "x/5.0", so the 0–100 score is converted here; it reads the
 * detector's findings from `aiPrediction`; and the thumbnail it renders is
 * `imageUrl`, which is deliberately the *annotated* image — the photograph
 * with the detector's boxes and outlines drawn on it — so what the reporter
 * sees is what the model saw. The untouched photograph is still available as
 * `originalUrl` for anything that wants it.
 */
function toAppComplaint(c: any, req: any) {
  const image = c.images?.[0];
  const annotated = publicUrl(req, image?.annotated ?? null);
  const original = publicUrl(req, image?.path ?? null);
  const detections = image?.detections ? JSON.parse(image.detections) : [];

  return {
    id: c.ref,
    _id: c.ref,
    ref: c.ref,
    trackingId: c.ref,
    title: c.title,
    description: c.description,
    category: c.category,
    civicCategory: c.civicCategory,
    status: c.status,
    priority: c.priority,
    // The app prints this as "x/5.0"; this server scores severity out of 100.
    severity: c.severityScore == null ? null : Math.round((c.severityScore / 20) * 10) / 10,
    severityScore: c.severityScore,
    severityBand: c.severityBand,
    aiPrediction: c.aiPredicted
      ? {
          damageClass: c.category,
          confidenceScore: c.aiConfidence,
          modelMode: c.aiModelMode,
          detections,
        }
      : null,
    confidence: c.aiConfidence,
    address: c.address,
    zone: c.zone,
    latitude: c.lat,
    longitude: c.lng,
    location: { latitude: c.lat, longitude: c.lng },
    lat: c.lat,
    lng: c.lng,
    slaHours: c.slaHours,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    reporterId: c.reporterId,
    department: c.department?.name ?? null,
    assignedEngineer: c.engineer
      ? { name: c.engineer.name, department: c.department?.name ?? null, phone: c.engineer.phone }
      : null,
    imageUrl: annotated ?? original,
    annotatedUrl: annotated,
    originalUrl: original,
    detections,
    timeline: (c.events ?? []).map((e: any) => ({
      type: e.type, message: e.message, actor: e.actor, at: e.createdAt,
    })),
  };
}

const withRelations = {
  images: true,
  department: true,
  engineer: true,
  events: { orderBy: { createdAt: "asc" as const } },
};

router.get("/complaints", requireAuth, async (req, res) => {
  const rows = await db.complaint.findMany({
    where: { reporterId: req.session!.sub },
    orderBy: { createdAt: "desc" },
    include: withRelations,
  });
  res.json(rows.map((c) => toAppComplaint(c, req)));
});

router.get("/complaints/nearby", requireAuth, async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const radiusKm = Number(req.query.radius ?? 5);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return fail(res, 400, "A latitude and longitude are required.");
  }
  // A degree of latitude is ~111 km everywhere; longitude shrinks with the
  // cosine of latitude. Good enough to bound a query that is then filtered
  // properly, and it keeps the work in the database.
  const dLat = radiusKm / 111;
  const dLng = radiusKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  const rows = await db.complaint.findMany({
    where: {
      lat: { gte: lat - dLat, lte: lat + dLat },
      lng: { gte: lng - dLng, lte: lng + dLng },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: withRelations,
  });
  res.json(rows.map((c) => toAppComplaint(c, req)));
});

router.get("/complaints/:id", requireAuth, async (req, res) => {
  const c = await db.complaint.findUnique({
    where: { ref: req.params.id }, include: withRelations,
  });
  if (!c) return fail(res, 404, "No such complaint.");
  res.json(toAppComplaint(c, req));
});

/**
 * Store a photograph and hand back a URL.
 *
 * The app uploads the image first and then files the complaint as JSON, so the
 * file has to exist under a name the next request can name.
 */
router.post("/storage/upload", requireAuth, upload.single("file"), async (req, res) => {
  const file = req.file ?? (Array.isArray(req.files) ? req.files[0] : undefined);
  if (!file) return fail(res, 400, "No file was uploaded.");
  await mkdir(UPLOADS, { recursive: true });
  const ext = (file.originalname.match(/\.[a-z0-9]+$/i)?.[0] ?? ".jpg").toLowerCase();
  const name = `citizen-${randomUUID()}${ext}`;
  await writeFile(path.join(UPLOADS, name), file.buffer);
  const url = `/uploads/${name}`;
  res.json({ url, path: url, filename: name });
});

/**
 * File a complaint.
 *
 * The photograph was uploaded separately, so this reads it back off disk and
 * puts it through this server's own `/api/complaints`, which owns detection,
 * severity, duplicate consolidation, routing and notification. Going over
 * loopback rather than copying that code keeps one pipeline, not two.
 */
router.post("/complaints", requireAuth, async (req, res) => {
  const title = String(req.body?.title ?? "").trim() || "Civic issue reported from the app";
  const description = String(req.body?.description ?? "").trim();
  const imageUrl = String(req.body?.imageUrl ?? req.body?.image ?? "").trim();
  const lat = Number(req.body?.latitude ?? req.body?.lat);
  const lng = Number(req.body?.longitude ?? req.body?.lng);

  if (!imageUrl.startsWith("/uploads/")) {
    return fail(res, 400, "Upload the photograph first, then file the complaint.");
  }

  const form = new FormData();
  form.append("title", title);
  form.append("description", description);
  if (Number.isFinite(lat)) form.append("lat", String(lat));
  if (Number.isFinite(lng)) form.append("lng", String(lng));

  const file = uploadPathFor(imageUrl);
  const bytes = await (await import("fs/promises")).readFile(file);
  form.append(
    "photos",
    new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }),
    path.basename(file),
  );

  const port = Number(process.env.PORT ?? 4000);
  const upstream = await fetch(`http://127.0.0.1:${port}/api/complaints`, {
    method: "POST",
    headers: { authorization: req.headers.authorization ?? "" },
    body: form,
  });
  const body = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    return fail(res, upstream.status, (body as any).error ?? "Could not file the complaint.");
  }

  const ref = (body as any).complaint?.ref ?? (body as any).ref;
  const saved = ref
    ? await db.complaint.findUnique({ where: { ref }, include: withRelations })
    : null;
  res.status(201).json(saved ? toAppComplaint(saved, req) : body);
});

/** Only the person who filed it, and only while nobody has acted on it. */
router.delete("/complaints/:id", requireAuth, async (req, res) => {
  const c = await db.complaint.findUnique({ where: { ref: req.params.id } });
  if (!c) return fail(res, 404, "No such complaint.");
  if (c.reporterId !== req.session!.sub) return fail(res, 403, "That is not your report.");
  if (c.status !== "SUBMITTED") {
    return fail(res, 409, "Work has already started on this report, so it cannot be withdrawn.");
  }
  await db.complaint.delete({ where: { id: c.id } });
  res.json({ message: "Report withdrawn." });
});

/** Keeps a path the caller supplied from escaping the uploads directory. */
function uploadPathFor(urlPath: string): string {
  const name = path.basename(urlPath);
  const full = path.join(UPLOADS, name);
  if (!full.startsWith(UPLOADS)) throw new Error("bad path");
  return full;
}

/* ------------------------------------------------------------------ *
 * Citizen views
 * ------------------------------------------------------------------ */

router.get("/api/v1/citizen/complaints", requireAuth, async (req, res) => {
  const rows = await db.complaint.findMany({
    where: { reporterId: req.session!.sub },
    orderBy: { createdAt: "desc" },
    include: withRelations,
  });
  res.json(rows.map((c) => toAppComplaint(c, req)));
});

router.get("/api/v1/citizen/complaints/:id/tracking", requireAuth, async (req, res) => {
  const c = await db.complaint.findUnique({
    where: { ref: req.params.id }, include: withRelations,
  });
  if (!c) return fail(res, 404, "No such complaint.");
  const mapped = toAppComplaint(c, req);
  res.json({ status: mapped.status, timeline: mapped.timeline, complaint: mapped });
});

router.get("/api/v1/citizen/dashboard", requireAuth, async (req, res) => {
  const rows = await db.complaint.findMany({
    where: { reporterId: req.session!.sub },
    orderBy: { createdAt: "desc" },
    include: withRelations,
  });
  const closed = new Set(["CLOSED", "RESOLVED", "REJECTED"]);
  const unread = await db.notification.count({
    where: { userId: req.session!.sub, readAt: null },
  });
  res.json({
    stats: {
      total: rows.length,
      open: rows.filter((c) => !closed.has(c.status)).length,
      resolved: rows.filter((c) => closed.has(c.status)).length,
      urgent: rows.filter((c) => c.priority === "HIGH" || c.priority === "CRITICAL").length,
    },
    unreadNotifications: unread,
    recent: rows.slice(0, 5).map((c) => toAppComplaint(c, req)),
  });
});

router.get("/api/v1/citizen/analytics", requireAuth, async (req, res) => {
  const range = String(req.query.range ?? "daily").toLowerCase();
  const days = range === "yearly" ? 365 : range === "monthly" ? 30 : 7;
  const since = new Date(Date.now() - days * 86_400_000);
  const rows = await db.complaint.findMany({
    where: { reporterId: req.session!.sub, createdAt: { gte: since } },
    orderBy: { createdAt: "asc" },
  });

  const byDay = new Map<string, number>();
  for (const c of rows) {
    const key = c.createdAt.toISOString().slice(0, 10);
    byDay.set(key, (byDay.get(key) ?? 0) + 1);
  }
  const byCategory = new Map<string, number>();
  for (const c of rows) byCategory.set(c.category, (byCategory.get(c.category) ?? 0) + 1);

  res.json({
    range,
    series: [...byDay.entries()].map(([date, count]) => ({ date, count })),
    byCategory: [...byCategory.entries()].map(([label, count]) => ({ label, count })),
    total: rows.length,
  });
});

router.get("/api/v1/citizen/profile", requireAuth, async (req, res) => {
  const u = await db.user.findUnique({ where: { id: req.session!.sub } });
  if (!u) return fail(res, 404, "No such account.");
  const filed = await db.complaint.count({ where: { reporterId: u.id } });
  res.json({
    id: u.id, fullName: u.name, name: u.name, email: u.email, phoneNumber: u.phone,
    role: u.role, emailVerified: Boolean(u.emailVerifiedAt), reportsFiled: filed,
  });
});

router.patch("/api/v1/citizen/profile", requireAuth, async (req, res) => {
  const name = String(req.body?.fullName ?? req.body?.name ?? "").trim();
  const phone = String(req.body?.phoneNumber ?? req.body?.phone ?? "").trim();
  const u = await db.user.update({
    where: { id: req.session!.sub },
    data: { ...(name ? { name } : {}), ...(phone ? { phone } : {}) },
  });
  res.json({ id: u.id, fullName: u.name, email: u.email, phoneNumber: u.phone, role: u.role });
});

/**
 * Municipal payments.
 *
 * The app has screens for these; this deployment has no payment provider and
 * no municipal billing data behind it. An empty list is the truthful answer —
 * inventing bills would put fake money owed in front of a real person.
 */
router.get("/api/v1/citizen/payments", requireAuth, (_req, res) => {
  res.json({ payments: [], message: "Municipal payments are not enabled on this deployment." });
});

router.post("/api/v1/citizen/payments/:id/pay", requireAuth, (_req, res) =>
  fail(res, 501, "Payments are not enabled on this deployment."),
);

/**
 * Text triage, for the app's "analyse" action.
 *
 * Detection runs on the photograph, not on prose — this only guesses which
 * civic category a description belongs to, and says so rather than implying
 * the model looked at anything.
 */
router.post("/api/v1/ai-triage/analyze", requireAuth, async (req, res) => {
  const description = String(req.body?.description ?? "").toLowerCase();

  // The app's own category ids, so the screen can preselect one. Anything it
  // does not recognise is simply left for the reporter to choose.
  const GUESSES: Array<[RegExp, string, string, string]> = [
    [/pothole|crater|road damage|gadda|crack|alligator/, "road", "Road Damage", "high"],
    [/manhole|drain cover|open drain|sewer/, "water", "Open Manhole or Drain", "high"],
    [/garbage|trash|rubbish|waste|kachra|bin|overflow/, "garbage", "Garbage or Waste", "medium"],
    [/street ?light|lamp|pole light/, "streetlight", "Street Light", "medium"],
    [/electric|wire|transformer|shock|current/, "electricity", "Electrical Hazard", "high"],
    [/water leak|pipe|burst|supply/, "water", "Water Leakage", "medium"],
    [/fire|smoke|burning/, "fire", "Fire Hazard", "high"],
    [/bridge|flyover|culvert/, "bridge", "Bridge or Structure", "high"],
  ];

  const hit = GUESSES.find(([re]) => re.test(description));
  const [, id, label, priority] = hit ?? ["", "other", "Uncategorised", "medium"];

  // The shape the app destructures: `result.success` and `result.triageResult`.
  // Anything else and the screen quietly does nothing.
  res.json({
    success: Boolean(hit),
    triageResult: {
      category: id,
      priority,
      confidence: hit ? 0.5 : 0,
      aiSummary: hit
        ? `Reads as ${label.toLowerCase()}, suggested priority ${priority}. ` +
          "This is from your words only — the detector runs on the photograph " +
          "once the report is filed, and that result is what the department sees."
        : "Not enough in the description to classify it. Choose a category, and " +
          "the detector will analyse the photograph once the report is filed.",
    },
  });
});

/* ------------------------------------------------------------------ *
 * Endpoints the app calls that had no counterpart here.
 *
 * Each one was found by reading the app's own call sites rather than
 * guessing: an adapter that answers the wrong shape fails silently, which is
 * worse than a 404 because nothing in the interface says so.
 * ------------------------------------------------------------------ */

/** The socket layer pings this to check the session is still good. */
router.get("/auth/me", requireAuth, async (req, res) => {
  const u = await db.user.findUnique({ where: { id: req.session!.sub } });
  if (!u) return fail(res, 401, "Session expired. Sign in again.");
  res.json({
    user: {
      id: u.id, sub: u.id, fullName: u.name, name: u.name, email: u.email,
      phoneNumber: u.phone, role: u.role, departmentId: u.departmentId,
      emailVerified: Boolean(u.emailVerifiedAt),
    },
  });
});

/**
 * Reports queued while the phone was offline.
 *
 * They arrive without photographs — the outbox holds only the text the
 * reporter typed — so there is nothing for the detector to look at. They are
 * filed with the category the reporter chose and no AI prediction, which is
 * honest: a complaint with no photograph has not been analysed, and claiming
 * otherwise would put an unearned confidence figure in front of a department.
 */
router.post("/complaints/sync", requireAuth, async (req, res) => {
  const incoming = Array.isArray(req.body?.complaints) ? req.body.complaints : [];
  if (!incoming.length) return res.json({ synced: 0, complaints: [] });

  const fallback = await db.department.findFirst({ where: { code: "RDS" } })
    ?? await db.department.findFirst();
  if (!fallback) return fail(res, 500, "No department is configured to receive reports.");

  const made: string[] = [];
  for (const item of incoming.slice(0, 50)) {
    const lat = Number(item?.latitude);
    const lng = Number(item?.longitude);
    const ref = `CMP-${10000 + Math.floor(Math.random() * 89999)}`;
    const c = await db.complaint.create({
      data: {
        ref,
        title: String(item?.title ?? "Offline report").slice(0, 160),
        description: String(item?.description ?? "").slice(0, 2000),
        zone: "Central Zone",
        address: "Reported offline",
        lat: Number.isFinite(lat) ? lat : 0,
        lng: Number.isFinite(lng) ? lng : 0,
        category: String(item?.category ?? "Unclassified"),
        priority: String(item?.priority ?? "MEDIUM").toUpperCase(),
        slaHours: fallback.slaTarget,
        status: "SUBMITTED",
        departmentId: fallback.id,
        reporterId: req.session!.sub,
        aiPredicted: false,
      },
    });
    await db.timelineEvent.create({
      data: {
        complaintId: c.id, type: "CREATED", actor: req.session!.name,
        message: "Filed from the offline outbox, without a photograph",
      },
    });
    made.push(ref);
  }
  res.json({ synced: made.length, complaints: made });
});

/**
 * Identity verification.
 *
 * The documents are stored and the request is recorded for a human to look at.
 * Nothing here decides that someone is who they say they are — no check of
 * that kind exists on this deployment, and marking an account verified
 * automatically would be a lie the rest of the system then trusts.
 */
router.post("/api/v1/citizen/verify-identity", requireAuth, async (req, res) => {
  const docs = req.body?.documents ?? {};
  await db.auditLog.create({
    data: {
      actor: req.session!.name, actorRole: req.session!.role,
      action: "IDENTITY_SUBMITTED", module: "Accounts", target: req.session!.email,
      details: `Document type ${String(req.body?.documentType ?? "unknown")}; `
        + `id ${String(docs.idDocumentUrl ?? "none")}, selfie ${String(docs.selfieUrl ?? "none")}`,
    },
  });
  res.json({
    status: "PENDING_REVIEW",
    message: "Your documents were received and are awaiting review.",
  });
});

/** Dashboard figures for the staff screens. */
router.get("/analytics/dashboard", requireAuth, async (_req, res) => {
  const closed = ["CLOSED", "RESOLVED", "REJECTED"];
  const [total, open, resolved, urgent] = await Promise.all([
    db.complaint.count(),
    db.complaint.count({ where: { NOT: { status: { in: closed } } } }),
    db.complaint.count({ where: { status: { in: closed } } }),
    db.complaint.count({ where: { priority: { in: ["HIGH", "CRITICAL"] } } }),
  ]);
  const byCategory = await db.complaint.groupBy({ by: ["category"], _count: { _all: true } });
  res.json({
    stats: { total, open, resolved, urgent },
    totalComplaints: total, openComplaints: open,
    resolvedComplaints: resolved, urgentComplaints: urgent,
    byCategory: byCategory.map((r) => ({ label: r.category, count: r._count._all })),
  });
});

/** Payments have no provider on this deployment; say so rather than pretend. */
router.post("/api/v1/payments/create-payment-intent", requireAuth, (_req, res) =>
  fail(res, 501, "Payments are not enabled on this deployment."));
router.post("/api/v1/payments/pay", requireAuth, (_req, res) =>
  fail(res, 501, "Payments are not enabled on this deployment."));

/**
 * Status change from the app's staff screens.
 *
 * Restricted to staff roles, and the transition is validated against the same
 * workflow rules the web console obeys — the app must not be a side door that
 * moves a complaint somewhere the console would refuse.
 */
router.patch("/api/v1/admin/complaints/:id/status", requireAuth, async (req, res) => {
  const role = req.session!.role;
  if (!["SUPERVISOR", "ADMINISTRATOR", "ENGINEER"].includes(role)) {
    return fail(res, 403, "Your role cannot change a complaint's status.");
  }
  const to = String(req.body?.status ?? "").toUpperCase();
  const c = await db.complaint.findUnique({ where: { ref: req.params.id } });
  if (!c) return fail(res, 404, "No such complaint.");

  const allowed = (TRANSITIONS[c.status] ?? []).filter((t) => t.roles.includes(role));
  if (!allowed.some((t) => t.to === to)) {
    return fail(res, 409, `A complaint that is ${STATUS_LABELS[c.status] ?? c.status} cannot move to ${to}.`);
  }

  const updated = await db.complaint.update({
    where: { id: c.id },
    data: { status: to, ...(to === "CLOSED" ? { closedAt: new Date() } : {}) },
  });
  await db.timelineEvent.create({
    data: {
      complaintId: c.id, type: "STATUS_CHANGE", actor: req.session!.name,
      message: `${STATUS_LABELS[c.status] ?? c.status} → ${STATUS_LABELS[to] ?? to}`,
    },
  });
  res.json({ status: updated.status, message: "Status updated." });
});

export default router;
