import { db } from "./db.js";

/**
 * Deliver a notification to someone's phone.
 *
 * Expo's push service is used rather than FCM and APNs directly: it holds the
 * platform credentials, so the server needs none, and one request covers both
 * platforms. The token identifies a device, not an account — which is why they
 * live in their own table and why a rejected one is deleted rather than
 * retried forever.
 *
 * Nothing here throws. A push is the least important part of any request that
 * triggers it, and a phone that is off must not fail a supervisor's dispatch.
 */

const EXPO_PUSH = "https://exp.host/--/api/v2/push/send";

/** Expo accepts a batch of 100; a single user will not exceed it. */
type Message = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  /** Read by the app when the notification is tapped, to open the complaint. */
  data: Record<string, string>;
  channelId: "default";
};

type Receipt = { status?: string; message?: string; details?: { error?: string } };

export async function sendPush(
  userId: string,
  title: string,
  body: string,
  data: Record<string, string> = {},
): Promise<void> {
  try {
    const devices = await db.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    if (!devices.length) return;

    const messages: Message[] = devices.map((d) => ({
      to: d.token,
      title,
      body,
      sound: "default",
      data,
      // Android requires a channel; "default" is the one the app creates on
      // launch. Without it the notification arrives silently and unbannered.
      channelId: "default",
    }));

    const res = await fetch(EXPO_PUSH, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(messages),
      // A phone push must never hold a request open. Expo is normally
      // sub-second; past five it is not worth the supervisor's time.
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) return;

    // Expo reports per-message, so one dead device does not hide the rest.
    // DeviceNotRegistered means the app was uninstalled or the token rotated:
    // it will never work again, so the row goes rather than being retried on
    // every future notification for the life of the account.
    const { data: receipts } = (await res.json()) as { data?: Receipt[] };
    const dead = (receipts ?? [])
      .map((r, i) => (r?.details?.error === "DeviceNotRegistered" ? messages[i].to : null))
      .filter((t): t is string => Boolean(t));
    if (dead.length) {
      await db.pushToken.deleteMany({ where: { token: { in: dead } } });
    }
  } catch {
    /* offline, timed out, or Expo is down — the notification row is still written */
  }
}
